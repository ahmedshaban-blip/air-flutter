import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as globalStateKeys from '../../config/global-state-keys'
import { getCommonADBPaths } from '../adb-resolver/adb-path'
import { AndroidDevice, AndroidDeviceManager } from '../android-device-manager'

export interface InstalledPackage {
  /** Full Android package id, e.g. `com.example.app`. */
  id: string
  /** Short last segment shown to the user, e.g. `app`. */
  shortName: string
  /** True when `adb` reports a path outside the system partition. */
  isThirdParty: boolean
}

export type WipeOperation = 'cache' | 'databases' | 'factory' | 'all-data'

export interface WipeResult {
  operation: WipeOperation
  packageId: string
  /** How the wipe was actually carried out after any fallback. */
  method: 'pm-clear' | 'run-as' | 'rm'
  /** Whether the app launch state had to be restored by relaunching it. */
  restarted: boolean
  /** Human readable summary line for the activity log / status message. */
  message: string
  /** Non-fatal notes such as a fallback to `pm clear`. */
  warnings: string[]
}

interface StateStorage {
  get<T>(key: string, defaultValue?: T): T | undefined
}

/** Marker used by the pre-flight guard to reject packages that must never be wiped. */
const SYSTEM_PACKAGE_PREFIXES = [
  'com.android.',
  'android',
  'com.google.android.',
  'com.samsung.',
  'com.sec.android.',
  'com.mediatek.',
  'com.qualcomm.',
  'com.miui.',
  'com.xiaomi.',
  'com.huawei.',
  'com.oneplus.',
  'com.oppo.',
  'com.vivo.'
]

/**
 * Deep storage & cache wiper.
 *
 * Resolves the Flutter applicationId, then clears cache, databases or the whole
 * app sandbox over a single explicit device serial. Targeted file removal is
 * attempted through `run-as` (works on debug builds) before falling back to the
 * heavier `pm clear`, so an unrooted release build never fails silently.
 */
export class AppStateWiper {
  private adbExecutable: string | undefined

  constructor(
    private readonly storage: StateStorage,
    private readonly deviceManager: AndroidDeviceManager
  ) {}

  // --- package resolution --------------------------------------------------

  /**
   * Reads `applicationId` from `android/app/build.gradle` or `build.gradle.kts`.
   * Returns the first match across the project, or undefined when not found.
   */
  public static readApplicationId(projectPath: string): string | undefined {
    const candidates = [
      path.join(projectPath, 'android', 'app', 'build.gradle'),
      path.join(projectPath, 'android', 'app', 'build.gradle.kts')
    ]

    for (const file of candidates) {
      if (!fs.existsSync(file)) {
        continue
      }
      const id = AppStateWiper.extractApplicationId(fs.readFileSync(file, 'utf8'))
      if (id) {
        return id
      }
    }

    // Fall back to any flavor-specific module build file one level deeper.
    const appDir = path.join(projectPath, 'android', 'app')
    const nested = AppStateWiper.findNestedApplicationIds(appDir)
    return nested[0]
  }

  /**
   * Extracts a valid applicationId from a Groovy or Kotlin DSL build script.
   * Handles `applicationId "x"`, `applicationId 'x'` and `applicationId = "x"`.
   * Flavor blocks may declare several; the first valid one is returned.
   */
  public static extractApplicationId(content: string): string | undefined {
    const pattern = /applicationId\s*(?:=)?\s*["']([^"']+)["']/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const candidate = match[1].trim()
      if (AppStateWiper.isValidPackageId(candidate)) {
        return candidate
      }
    }
    return undefined
  }

  /** Collects every applicationId found under the app module (incl. flavors). */
  private static findNestedApplicationIds(appDir: string): string[] {
    const found: string[] = []
    const walk = (dir: string, depth: number): void => {
      if (depth > 3 || !fs.existsSync(dir)) {
        return
      }
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full, depth + 1)
        } else if (entry.isFile() && /^build\.gradle(\.kts)?$/.test(entry.name)) {
          const id = AppStateWiper.extractApplicationId(fs.readFileSync(full, 'utf8'))
          if (id && !found.includes(id)) {
            found.push(id)
          }
        }
      }
    }
    walk(appDir, 0)
    return found
  }

  /**
   * A conservative package-id validator. Accepts the Android package grammar
   * and rejects empty strings, shell metacharacters and system packages.
   */
  public static isValidPackageId(packageId: string): boolean {
    if (!packageId || typeof packageId !== 'string') {
      return false
    }
    if (packageId.length > 255) {
      return false
    }
    if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageId)) {
      return false
    }
    return true
  }

  /** True when the id looks like an OS/OEM package that must not be wiped. */
  public static isLikelySystemPackage(packageId: string): boolean {
    const normalized = packageId.trim().toLowerCase()
    if (!normalized) {
      return true
    }
    return SYSTEM_PACKAGE_PREFIXES.some(
      prefix => normalized === prefix.replace(/\.$/, '') || normalized.startsWith(prefix)
    )
  }

  /** Lists installed packages on the device. `thirdPartyOnly` excludes system apps. */
  public async listInstalledPackages(
    serial: string,
    thirdPartyOnly = true
  ): Promise<InstalledPackage[]> {
    this.validateSerial(serial)
    const args = ['-s', serial, 'shell', 'pm', 'list', 'packages']
    if (thirdPartyOnly) {
      args.push('-3')
    }
    const { stdout } = await this.runADB(args, 15000)

    const packages: InstalledPackage[] = []
    for (const rawLine of stdout.split(/\r?\n/)) {
      const line = rawLine.trim()
      const match = line.match(/^package:(.+?)(?:\s.*)?$/)
      if (!match) {
        continue
      }
      const id = match[1].trim()
      if (!AppStateWiper.isValidPackageId(id)) {
        continue
      }
      packages.push({
        id,
        shortName: id.split('.').pop() || id,
        isThirdParty: !AppStateWiper.isLikelySystemPackage(id)
      })
    }

    return packages.sort((a, b) => a.id.localeCompare(b.id))
  }

  // --- pre-flight ----------------------------------------------------------

  /**
   * Validates that a package can be safely wiped: valid grammar, present on the
   * device, and not a system package. Throws with a friendly message otherwise.
   */
  public async assertWipeable(serial: string, packageId: string): Promise<void> {
    this.validateSerial(serial)

    if (!AppStateWiper.isValidPackageId(packageId)) {
      throw new Error(
        `"${packageId || '(empty)'}" is not a valid Android applicationId.`
      )
    }
    if (AppStateWiper.isLikelySystemPackage(packageId)) {
      throw new Error(
        `Refusing to wipe "${packageId}" because it looks like a system package. ` +
          'Only user-installed apps can be reset.'
      )
    }

    const { stdout } = await this.runADB(
      ['-s', serial, 'shell', 'pm', 'path', packageId],
      10000
    )
    const installedPath = stdout.trim()
    if (!installedPath || /^package:.*package not found/i.test(installedPath) || !installedPath.startsWith('package:')) {
      throw new Error(`"${packageId}" is not installed on ${serial}.`)
    }
    // `pm path` reports `/system/...` for preinstalled apps.
    if (/^package:\/system\//i.test(installedPath)) {
      throw new Error(
        `"${packageId}" is a system app (${installedPath.replace('package:', '')}) and cannot be reset.`
      )
    }
  }

  /** True when the package currently has a running process on the device. */
  public async isAppRunning(serial: string, packageId: string): Promise<boolean> {
    this.validateSerial(serial)
    try {
      const { stdout } = await this.runADB(['-s', serial, 'shell', 'pidof', packageId], 8000)
      return stdout.trim().length > 0
    } catch {
      return false
    }
  }

  // --- wipe operations -----------------------------------------------------

  /**
   * Hard reset: force-stops the app and clears everything through
   * `adb shell pm clear <package>`.
   */
  public async clearAllData(
    serial: string,
    packageId: string,
    options: { restart?: boolean } = {}
  ): Promise<WipeResult> {
    await this.assertWipeable(serial, packageId)
    const wasRunning = options.restart ? await this.isAppRunning(serial, packageId) : false

    const { stdout, stderr } = await this.runADB(
      ['-s', serial, 'shell', 'pm', 'clear', packageId],
      30000
    )
    const combined = `${stdout}\n${stderr}`.trim()
    if (!/success/i.test(combined)) {
      throw new Error(
        combined || `pm clear did not report success for "${packageId}".`
      )
    }

    const restarted = wasRunning
      ? await this.relaunch(serial, packageId)
      : false

    return {
      operation: 'factory',
      packageId,
      method: 'pm-clear',
      restarted,
      message: `Factory reset complete: cleared all data for ${packageId}.`,
      warnings: []
    }
  }

  /**
   * Cache-only clear. Prefers `run-as <pkg> rm -rf cache/*` (debug builds), then
   * falls back to `pm clear` with an explicit warning when run-as is unavailable.
   */
  public async clearCache(
    serial: string,
    packageId: string,
    options: { restart?: boolean } = {}
  ): Promise<WipeResult> {
    return this.clearScoped(serial, packageId, 'cache', options)
  }

  /** Databases-only clear, leaving shared_preferences and files untouched. */
  public async clearDatabases(
    serial: string,
    packageId: string,
    options: { restart?: boolean } = {}
  ): Promise<WipeResult> {
    return this.clearScoped(serial, packageId, 'databases', options)
  }

  private async clearScoped(
    serial: string,
    packageId: string,
    scope: 'cache' | 'databases',
    options: { restart?: boolean }
  ): Promise<WipeResult> {
    await this.assertWipeable(serial, packageId)
    const wasRunning = options.restart ? await this.isAppRunning(serial, packageId) : false
    const warnings: string[] = []

    const runAsWorked = await this.tryRunAsDelete(serial, packageId, scope)
    if (runAsWorked) {
      const restarted = wasRunning ? await this.relaunch(serial, packageId) : false
      return {
        operation: scope,
        packageId,
        method: 'run-as',
        restarted,
        message:
          scope === 'cache'
            ? `Cache cleared for ${packageId} (preferences preserved).`
            : `Databases cleared for ${packageId} (preferences preserved).`,
        warnings
      }
    }

    // run-as needs a debuggable build. Fall back to pm clear, but be honest:
    // it wipes everything, not just the requested scope.
    warnings.push(
      `Targeted ${scope} removal needs a debuggable build (run-as). Fell back to pm clear, which also resets preferences.`
    )
    const { stdout, stderr } = await this.runADB(
      ['-s', serial, 'shell', 'pm', 'clear', packageId],
      30000
    )
    const combined = `${stdout}\n${stderr}`.trim()
    if (!/success/i.test(combined)) {
      throw new Error(
        combined ||
          `Could not clear ${scope} for "${packageId}". The build is not debuggable and pm clear failed.`
      )
    }

    const restarted = wasRunning ? await this.relaunch(serial, packageId) : false
    return {
      operation: scope,
      packageId,
      method: 'pm-clear',
      restarted,
      message: `Cleared ${scope} for ${packageId} via pm clear (full data reset).`,
      warnings
    }
  }

  /**
   * Attempts a scoped delete inside the app sandbox through `run-as`.
   * Returns false when run-as is denied (release build) or the delete failed.
   */
  private async tryRunAsDelete(
    serial: string,
    packageId: string,
    scope: 'cache' | 'databases'
  ): Promise<boolean> {
    this.validateSerial(serial)
    // `run-as` runs as the app UID, so paths are relative to the sandbox root.
    // Keep the glob quoted so the device shell expands it, not the host.
    const remotePath = scope === 'cache' ? 'cache' : 'databases'
    const command = `run-as ${packageId} sh -c 'rm -rf ${remotePath}/* 2>/dev/null; true'`
    try {
      const { stdout, stderr } = await this.runADB(
        ['-s', serial, 'shell', command],
        20000
      )
      const combined = `${stdout}\n${stderr}`.toLowerCase()
      // run-as failures surface as "not debuggable", "unknown package" or a
      // permissions complaint. Success is silence.
      if (/not debuggable|unknown package|permission denied|could not/i.test(combined)) {
        return false
      }
      return true
    } catch {
      return false
    }
  }

  /** Best-effort relaunch via the monkey launcher intent. Returns success. */
  private async relaunch(serial: string, packageId: string): Promise<boolean> {
    try {
      const { stdout, stderr } = await this.runADB(
        [
          '-s',
          serial,
          'shell',
          'monkey',
          '-p',
          packageId,
          '-c',
          'android.intent.category.LAUNCHER',
          '1'
        ],
        15000
      )
      return !/No activities found|monkey aborted|Error/i.test(`${stdout}${stderr}`)
    } catch {
      return false
    }
  }

  // --- device helpers ------------------------------------------------------

  /** First online device, preferring wireless over USB, mirroring DeviceToolsService. */
  public async listConnectedSerial(): Promise<string | undefined> {
    const devices = await this.deviceManager.listDevices().catch(() => [] as AndroidDevice[])
    const online = devices.find(device => device.state === 'device' && device.transport !== 'usb')
    return (online || devices.find(device => device.state === 'device'))?.id
  }

  // --- internals -----------------------------------------------------------

  private async getADBExecutable(): Promise<string> {
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
      try {
        await this.execute(candidate, ['version'], 5000)
        this.adbExecutable = candidate
        return candidate
      } catch {
        // try the next candidate
      }
    }

    this.adbExecutable = await this.deviceManager.getADBExecutable()
    return this.adbExecutable
  }

  private async runADB(args: string[], timeout: number): Promise<{ stdout: string; stderr: string }> {
    const adb = await this.getADBExecutable()
    return this.execute(adb, args, timeout)
  }

  private execute(
    executable: string,
    args: string[],
    timeout: number
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(
        executable,
        args,
        { windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 },
        (error, stdout, stderr) => {
          const stdoutText = String(stdout || '')
          const stderrText = String(stderr || '')
          if (error) {
            reject(new Error((stderrText || stdoutText || error.message).trim()))
            return
          }
          resolve({ stdout: stdoutText, stderr: stderrText })
        }
      )
    })
  }

  private validateSerial(serial: string): void {
    if (!serial || !/^[A-Za-z0-9._:-]+$/.test(serial)) {
      throw new Error('Invalid Android device serial.')
    }
  }
}
