import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as readline from 'readline'
import * as globalStateKeys from '../../config/global-state-keys'
import { getCommonADBPaths } from '../adb-resolver/adb-path'

export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'

/**
 * Verbosity presets.
 *
 * A Samsung in debug mode can emit tens of thousands of lines per second. Even
 * `*:I` is dominated by the vendor's own chatter (SurfaceFlinger, WindowManager,
 * Kumiho, Auth, ...), which drowns the app's own logs. The presets narrow the
 * stream instead of just raising the level.
 */
export type LogPriority = 'normal' | 'verbose'

/**
 * Normal keeps everything at Info and above from the app process and Flutter,
 * plus every warning and error from the rest of the system. Fragile tags are
 * named explicitly because an unknown tag in a logcat filter list silently
 * lowers the priority for *all* tags, which would hide crashes.
 */
const FRAGILE_SYSTEM_TAGS = [
  'AndroidRuntime',
  'DEBUG',
  'libc',
  'tombstoned',
  'crash_dump',
  'Choreographer',
  'ActivityManager',
  'ConnectivityService',
  'WifiService',
  'StrictMode'
]

export const LOG_FILTERS: Record<LogPriority, string[]> = {
  normal: ['*:S', 'Flutter:V', 'flutter:V', '*:E', ...FRAGILE_SYSTEM_TAGS.map(tag => `${tag}:W`)],
  // Everything, including the debug and verbose chatter.
  verbose: ['*:V']
}

export const DEFAULT_LOG_PRIORITY: LogPriority = 'normal'

export interface LogcatLine {
  seq: number
  time: string
  level: LogLevel
  tag: string
  pid: string
  text: string
}

interface StateStorage {
  get<T>(key: string, defaultValue?: T): T | undefined
}

const MAX_RING_LINES = 3000
const FLUSH_INTERVAL_MS = 1000

/**
 * Streams `adb logcat` for one phone.
 *
 * The ring buffer is the display source (capped so a chatty phone cannot eat
 * the extension host), and the same lines are appended to a file in the
 * workspace so nothing is lost between sessions.
 */
export class LogcatService {
  private process?: ChildProcessWithoutNullStreams
  private ring: LogcatLine[] = []
  private sequence = 0
  private flushBuffer: string[] = []
  private flushTimer?: NodeJS.Timeout
  private filePath?: string
  private adbExecutable?: string
  /** True only while a stop was requested, so the close handler stays quiet. */
  private stopping = false

  constructor(private readonly storage: StateStorage) {}

  public get isRunning(): boolean {
    return Boolean(this.process && !this.process.killed)
  }

  public get logFilePath(): string | undefined {
    return this.filePath
  }

  public get buffer(): LogcatLine[] {
    return this.ring
  }

  public getSerial(): string | undefined {
    return this.serial
  }

  public getPriority(): LogPriority {
    return this.priority
  }

  private serial?: string
  private priority: LogPriority = DEFAULT_LOG_PRIORITY

  public async start(
    serial: string,
    workspaceRoot: string,
    handlers: {
      onLine: (line: LogcatLine) => void
      onEnd: (reason: string) => void
    },
    priority: LogPriority = DEFAULT_LOG_PRIORITY
  ): Promise<string> {
    if (this.isRunning) {
      this.stop()
    }

    const adb = await this.resolveAdb()
    const logDir = path.join(workspaceRoot, '.air-flutter')
    await fs.promises.mkdir(logDir, { recursive: true })
    this.filePath = path.join(logDir, 'logcat.log')
    this.priority = priority
    await fs.promises.appendFile(
      this.filePath,
      `\n--- Air Flutter logcat session ${new Date().toISOString()} (${serial}, ${priority}) ---\n`,
      'utf8'
    )

    this.serial = serial
    this.ring = []
    this.sequence = 0
    this.flushBuffer = []
    this.stopping = false

    const child = spawn(
      adb,
      ['-s', serial, 'logcat', '-v', 'threadtime', ...LOG_FILTERS[priority]],
      { windowsHide: true }
    )
    this.process = child

    const reader = readline.createInterface({ input: child.stdout })

    reader.on('line', raw => {
      const parsed = this.parseLine(raw)
      if (!parsed) {
        return
      }
      this.sequence += 1
      const line: LogcatLine = { ...parsed, seq: this.sequence }

      this.ring.push(line)
      if (this.ring.length > MAX_RING_LINES) {
        this.ring.splice(0, this.ring.length - MAX_RING_LINES)
      }

      this.flushBuffer.push(`${line.time} ${line.level.toUpperCase()} ${line.tag}: ${line.text}`)
      handlers.onLine(line)
    })

    child.on('error', error => {
      this.cleanup()
      handlers.onEnd(`Logcat failed: ${error.message}`)
    })

    child.on('close', (code, signal) => {
      const wasStopping = this.stopping
      this.cleanup()
      if (wasStopping) {
        // The user pressed Stop; that is not an error.
        handlers.onEnd('')
        return
      }
      handlers.onEnd(
        code === 0
          ? 'Logcat stream ended. Reconnect the phone and start again.'
          : `Logcat stream stopped unexpectedly (code ${code ?? 'none'}, signal ${signal ?? 'none'}). Reconnect the phone and start again.`
      )
    })

    this.flushTimer = setInterval(() => this.flushToFile(), FLUSH_INTERVAL_MS)

    return this.filePath
  }

  public stop(): void {
    this.stopping = true
    this.flushToFile()
    this.cleanup()
  }

  /** Reads the tail of an existing session file, so a restart shows history. */
  public async loadPersistedTail(limit = MAX_RING_LINES): Promise<LogcatLine[]> {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return []
    }
    try {
      const content = await fs.promises.readFile(this.filePath, 'utf8')
      const lines = content.split(/\r?\n/).slice(-limit)
      const parsed: LogcatLine[] = []
      let sequence = 0
      for (const raw of lines) {
        const match = raw.match(
          /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+([VDIWEF])\s+(.*?):\s?(.*)$/
        )
        if (!match) {
          continue
        }
        sequence += 1
        parsed.push({
          seq: sequence,
          time: match[1],
          level: this.toLevel(match[2]),
          tag: match[3].trim(),
          pid: '',
          text: match[4]
        })
      }
      this.sequence = sequence
      this.ring = parsed.slice(-MAX_RING_LINES)
      return this.ring
    } catch {
      return []
    }
  }

  private flushToFile(): void {
    if (!this.filePath || this.flushBuffer.length === 0) {
      return
    }
    const payload = this.flushBuffer.join('\n') + '\n'
    this.flushBuffer = []
    fs.promises.appendFile(this.filePath, payload, 'utf8').catch(() => {
      // A failed log write must never break the stream.
    })
  }

  private cleanup(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
    this.flushToFile()
    if (this.process && !this.process.killed) {
      this.process.kill()
    }
    this.process = undefined
    this.serial = undefined
  }

  private parseLine(raw: string): Omit<LogcatLine, 'seq'> | undefined {
    // threadtime format: "10-30 14:22:01.123  1234  1250 I Flutter : message"
    const match = raw.match(
      /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.*?):\s?(.*)$/
    )
    if (!match) {
      return undefined
    }
    const text = match[6].replace(/\u001b\[[0-9;]*m/g, '').trimEnd()
    return {
      time: match[1],
      pid: match[2],
      level: this.toLevel(match[4]),
      tag: match[5].trim() || '(no tag)',
      text
    }
  }

  private toLevel(letter: string): LogLevel {
    switch (letter) {
      case 'V':
        return 'verbose'
      case 'D':
        return 'debug'
      case 'I':
        return 'info'
      case 'W':
        return 'warn'
      case 'E':
      case 'F':
        return 'error'
      default:
        return 'info'
    }
  }

  private async resolveAdb(): Promise<string> {
    if (this.adbExecutable) {
      return this.adbExecutable
    }

    const executableName = os.type() === 'Windows_NT' ? 'adb.exe' : 'adb'
    const candidates: string[] = []
    const configured = this.storage.get<string>(globalStateKeys.customADBPathKey())

    if (typeof configured === 'string' && configured.trim()) {
      const normalized = configured.trim()
      candidates.push(
        fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()
          ? path.join(normalized, executableName)
          : normalized
      )
    }
    candidates.push(...getCommonADBPaths({ osType: os.type(), homeDir: os.homedir() }))

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.adbExecutable = candidate
        return candidate
      }
    }

    throw new Error('ADB not found. Configure the ADB path in Air Flutter settings.')
  }
}
