import { execFile, spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import {
  buildMirrorAudioArguments,
  buildMirrorTuningArguments,
  MirrorLaunchPreferences
} from '../mirror-profile'

export interface MirrorOptions extends Partial<MirrorLaunchPreferences> {
  /** Turn the phone display off and keep it off for the whole session. */
  displayOff?: boolean
  /** Start an app by package name once mirroring is live. */
  startApp?: string
  /**
   * Send keys as a simulated physical keyboard (Android UHID) instead of
   * through the Android input API. Required for per-keystroke language
   * switching on the computer keyboard.
   */
  hardwareKeyboard?: boolean
  /** Mirror into a separate Android virtual display. */
  wirelessDisplay?: boolean
}

export class ScreenMirrorManager {
  private scrcpyExecutable: string | undefined
  private activeProcesses: Map<string, ChildProcess> = new Map()
  private screenOffDevices: Set<string> = new Set()
  private activeSessions: Map<string, { executable: string; args: string[]; adbPath: string }> = new Map()
  private lastActiveSerial: string | undefined
  private readonly _onMirroringStateChanged = new vscode.EventEmitter<{ isMirroring: boolean; serial?: string }>()
  public readonly onMirroringStateChanged = this._onMirroringStateChanged.event

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async start(
    deviceSerial: string,
    deviceName: string,
    adbPath: string,
    options: MirrorOptions = {}
  ): Promise<void> {
    if (!/^[A-Za-z0-9._:-]+$/.test(deviceSerial)) {
      throw new Error('Invalid Android device serial.')
    }

    const executable = await this.getScrcpyExecutable()
    const args = this.getScrcpyArguments(deviceSerial, deviceName, options)
    await this.launchScrcpy(executable, args, adbPath, deviceSerial)
  }

  /**
   * Streams the phone into a virtual display the computer owns: the physical
   * panel stays off while the desktop window shows a fully usable screen.
   */
  public async startWirelessDisplay(
    deviceSerial: string,
    deviceName: string,
    adbPath: string,
    options: MirrorOptions = {}
  ): Promise<void> {
    if (!/^[A-Za-z0-9._:-]+$/.test(deviceSerial)) {
      throw new Error('Invalid Android device serial.')
    }

    const executable = await this.getScrcpyExecutable()
    const tuningArgs = this.getTuningArguments(options)
    const audioArgs = this.getAudioArguments(options)

    const args: string[] = [
      '--serial',
      deviceSerial,
      '--new-display',
      '--video-codec=h264',
      ...tuningArgs,
      '--always-on-top',
      // The virtual display is the point of this mode, but the physical panel
      // has to go dark too, otherwise the phone stays lit on the desk.
      '--turn-screen-off',
      // The virtual display has no taskbar of its own; let the mirrored window
      // reach the phone's navigation buttons without touching the physical
      // panel, which would wake it.
      '--no-vd-system-decorations',
      '--window-title',
      `Air Flutter - ${deviceName} (phone display off)`
    ]

    args.push(...audioArgs)
    if (options.startApp) {
      args.push(`--start-app=${options.startApp}`)
    }

    await this.launchScrcpy(executable, args, adbPath, deviceSerial)
  }

  private getScrcpyArguments(
    deviceSerial: string,
    deviceName: string,
    options: MirrorOptions
  ): string[] {
    const tuningArgs = this.getTuningArguments(options)
    const audioArgs = this.getAudioArguments(options)
    const args: string[] = [
      '--serial',
      deviceSerial,
      '--video-codec=h264',
      ...tuningArgs,
      '--always-on-top',
      '--stay-awake',
      '--window-title',
      `Air Flutter - ${deviceName}`
    ]

    if (options.displayOff) {
      args.push('--turn-screen-off')
    }
    if (options.hardwareKeyboard) {
      // The Android input API maps the computer's keys to the device's active
      // input method, so foreign layouts never reach the app. A simulated HID
      // keyboard delivers real keystrokes, so the device treats them like a
      // physical keyboard and switches language per keystroke.
      args.push('--keyboard=uhid')
    }
    if (options.startApp) {
      args.push(`--start-app=${options.startApp}`)
    }
    args.push(...audioArgs)
    return args
  }

  private getTuningArguments(options: MirrorOptions): string[] {
    if (options.performanceProfile) {
      return buildMirrorTuningArguments(options.performanceProfile)
    }
    const configuration = vscode.workspace.getConfiguration('airFlutter')
    return [
      `--max-size=${configuration.get<number>('mirroringMaxSize', 1600)}`,
      `--max-fps=${configuration.get<number>('mirroringMaxFps', 60)}`,
      `--video-bit-rate=${configuration.get<string>('mirroringVideoBitRate', '6M')}`,
      '--video-buffer=0'
    ]
  }

  private getAudioArguments(options: MirrorOptions): string[] {
    if (options.audioRoute) {
      return buildMirrorAudioArguments(options.audioRoute)
    }
    return vscode.workspace.getConfiguration('airFlutter').get<boolean>('mirroringAudio', false)
      ? ['--audio-source=output']
      : ['--no-audio']
  }

  /** Opens the device's physical-keyboard layout picker so the mapping can be set. */
  public async configureHardwareKeyboardLayout(adbPath: string, serial: string): Promise<void> {
    if (!/^[A-Za-z0-9._:-]+$/.test(serial)) {
      throw new Error('Invalid Android device serial.')
    }

    await new Promise<void>((resolve, reject) => {
      execFile(
        adbPath,
        ['-s', serial, 'shell', 'am', 'start', '-a', 'android.settings.HARD_KEYBOARD_SETTINGS'],
        { windowsHide: true, timeout: 15000 },
        error => (error ? reject(error) : resolve())
      )
    })
  }

  private launchScrcpy(
    executable: string,
    args: string[],
    adbPath: string,
    deviceSerial: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // If an existing scrcpy process is running for this device, terminate it
      const existing = this.activeProcesses.get(deviceSerial)
      if (existing) {
        try {
          existing.kill()
        } catch {
          // ignore
        }
        this.activeProcesses.delete(deviceSerial)
      }

      const child = spawn(executable, args, {
        windowsHide: true,
        stdio: 'ignore',
        env: { ...process.env, ADB: adbPath }
      })

      child.once('spawn', () => {
        this.activeProcesses.set(deviceSerial, child)
        this.activeSessions.set(deviceSerial, { executable, args: [...args], adbPath })
        if (args.includes('--turn-screen-off')) {
          this.screenOffDevices.add(deviceSerial)
        } else {
          this.screenOffDevices.delete(deviceSerial)
        }
        this.lastActiveSerial = deviceSerial
        this._onMirroringStateChanged.fire({ isMirroring: true, serial: deviceSerial })
        child.once('exit', () => {
          if (this.activeProcesses.get(deviceSerial) === child) {
            this.activeProcesses.delete(deviceSerial)
            this.activeSessions.delete(deviceSerial)
            this.screenOffDevices.delete(deviceSerial)
            if (this.lastActiveSerial === deviceSerial) {
              this.lastActiveSerial = this.activeProcesses.keys().next().value
            }
            this._onMirroringStateChanged.fire({ isMirroring: this.activeProcesses.size > 0, serial: deviceSerial })
          }
        })
        resolve()
      })
      child.once('error', reject)
    })
  }

  /**
   * Stops mirroring sessions. If deviceSerial is omitted, stops all sessions.
   */
  public async stop(deviceSerial?: string): Promise<boolean> {
    let stoppedAny = false

    if (deviceSerial && this.activeProcesses.has(deviceSerial)) {
      const proc = this.activeProcesses.get(deviceSerial)
      if (proc) {
        try {
          proc.kill()
          stoppedAny = true
        } catch {
          // ignore
        }
      }
      this.activeProcesses.delete(deviceSerial)
      this.activeSessions.delete(deviceSerial)
      this.screenOffDevices.delete(deviceSerial)
      if (this.lastActiveSerial === deviceSerial) {
        this.lastActiveSerial = this.activeProcesses.keys().next().value
      }
    } else {
      for (const [, proc] of this.activeProcesses) {
        try {
          proc.kill()
          stoppedAny = true
        } catch {
          // ignore
        }
      }
      this.activeProcesses.clear()
      this.activeSessions.clear()
      this.screenOffDevices.clear()
      this.lastActiveSerial = undefined
    }

    // Ensure any orphaned scrcpy processes are terminated
    if (process.platform === 'win32') {
      try {
        await new Promise<void>((resolve) => {
          execFile('taskkill', ['/F', '/T', '/IM', 'scrcpy.exe'], { windowsHide: true }, (error) => {
            if (!error) {
              stoppedAny = true
            }
            resolve()
          })
        })
      } catch {
        // ignore
      }
    } else {
      try {
        await new Promise<void>((resolve) => {
          execFile('pkill', ['-f', 'scrcpy'], () => resolve())
        })
        stoppedAny = true
      } catch {
        // ignore
      }
    }

    this._onMirroringStateChanged.fire({ isMirroring: this.activeProcesses.size > 0 })
    return stoppedAny
  }

  public isMirroring(deviceSerial?: string): boolean {
    if (deviceSerial) {
      return this.activeProcesses.has(deviceSerial)
    }
    return this.activeProcesses.size > 0
  }

  public getActiveDeviceSerial(): string | undefined {
    return this.lastActiveSerial
  }

  public wasPhysicalDisplayTurnedOff(deviceSerial: string): boolean {
    return this.screenOffDevices.has(deviceSerial)
  }

  public markPhysicalDisplayOn(deviceSerial: string): void {
    this.screenOffDevices.delete(deviceSerial)
  }

  public markPhysicalDisplayOff(deviceSerial: string): void {
    this.screenOffDevices.add(deviceSerial)
  }

  public async restartWithPhysicalDisplayOff(deviceSerial: string): Promise<void> {
    const session = this.activeSessions.get(deviceSerial)
    if (!session) {
      throw new Error('No active mirror session was found for this device.')
    }
    const args = session.args.includes('--turn-screen-off')
      ? [...session.args]
      : [...session.args, '--turn-screen-off']
    await this.launchScrcpy(session.executable, args, session.adbPath, deviceSerial)
  }

  public async selectScrcpyExecutable(): Promise<string | undefined> {
    const selectedFiles = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: 'Select scrcpy executable',
      filters: process.platform === 'win32'
        ? { 'scrcpy executable': ['exe'] }
        : undefined
    })

    if (!selectedFiles || !selectedFiles[0]) {
      return undefined
    }

    const selectedPath = selectedFiles[0].fsPath
    await this.verifyScrcpy(selectedPath)
    await vscode.workspace
      .getConfiguration('airFlutter')
      .update('scrcpyPath', selectedPath, vscode.ConfigurationTarget.Global)
    this.scrcpyExecutable = selectedPath
    return selectedPath
  }

  private async getScrcpyExecutable(): Promise<string> {
    if (this.scrcpyExecutable) {
      return this.scrcpyExecutable
    }

    const configuredPath = vscode.workspace
      .getConfiguration('airFlutter')
      .get<string>('scrcpyPath', '')
      .trim()
    const executableName = process.platform === 'win32' ? 'scrcpy.exe' : 'scrcpy'
    const candidates = [
      configuredPath,
      path.join(this.context.extensionPath, 'bin', executableName),
      'scrcpy'
    ].filter(Boolean)

    for (const candidate of Array.from(new Set(candidates))) {
      const executable =
        fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()
          ? path.join(candidate, executableName)
          : candidate
      try {
        await this.verifyScrcpy(executable)
        this.scrcpyExecutable = executable
        return executable
      } catch {
        // Try the next configured or discoverable executable.
      }
    }

    throw new Error(
      'scrcpy was not found. Use “Air Flutter: Select scrcpy Executable” and choose scrcpy.exe.'
    )
  }

  private verifyScrcpy(executable: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        executable,
        ['--version'],
        { windowsHide: true, timeout: 5000 },
        error => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        }
      )
    })
  }
}
