import { execFile, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

export interface MirrorOptions {
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
}

export class ScreenMirrorManager {
  private scrcpyExecutable: string | undefined

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
    await this.launchScrcpy(executable, args, adbPath)
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
    const configuration = vscode.workspace.getConfiguration('airFlutter')
    const maxFps = configuration.get<number>('mirroringMaxFps', 60)
    const bitRate = configuration.get<string>('mirroringVideoBitRate', '6M')
    const enableAudio = configuration.get<boolean>('mirroringAudio', false)

    const args: string[] = [
      '--serial',
      deviceSerial,
      '--new-display',
      '--video-codec=h264',
      `--max-fps=${maxFps}`,
      `--video-bit-rate=${bitRate}`,
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

    if (!enableAudio) {
      args.push('--no-audio')
    }
    if (options.startApp) {
      args.push(`--start-app=${options.startApp}`)
    }

    await this.launchScrcpy(executable, args, adbPath)
  }

  private getScrcpyArguments(
    deviceSerial: string,
    deviceName: string,
    options: MirrorOptions
  ): string[] {
    const configuration = vscode.workspace.getConfiguration('airFlutter')
    const maxSize = configuration.get<number>('mirroringMaxSize', 1600)
    const maxFps = configuration.get<number>('mirroringMaxFps', 60)
    const bitRate = configuration.get<string>('mirroringVideoBitRate', '6M')
    const enableAudio = configuration.get<boolean>('mirroringAudio', false)
    const args: string[] = [
      '--serial',
      deviceSerial,
      '--video-codec=h264',
      `--max-size=${maxSize}`,
      `--max-fps=${maxFps}`,
      `--video-bit-rate=${bitRate}`,
      '--video-buffer=0',
      '--no-mipmaps',
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
    if (!enableAudio) {
      args.push('--no-audio')
    }
    return args
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

  private launchScrcpy(executable: string, args: string[], adbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // `windowsHide` gives the process a hidden console, so the `adb` children
      // scrcpy spawns inherit it. Using `detached` here would create a process
      // without any console, and Windows would then flash a visible console
      // window for every `adb` call.
      const child = spawn(executable, args, {
        windowsHide: true,
        stdio: 'ignore',
        env: { ...process.env, ADB: adbPath }
      })

      child.once('spawn', () => {
        child.unref()
        resolve()
      })
      child.once('error', reject)
    })
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
