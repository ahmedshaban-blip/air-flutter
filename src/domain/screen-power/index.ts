import { execFile } from 'child_process'

export type ScreenPowerCommandRunner = (
  adbPath: string,
  args: string[],
  timeout: number
) => Promise<void>

export type ScreenPowerOutputRunner = (
  adbPath: string,
  args: string[],
  timeout: number
) => Promise<string>

export type DisplayPowerState = 'on' | 'off' | 'unknown'

const STATE_READ_DELAY_MS = 350

/**
 * Wakes the physical Android display, including displays blanked directly by
 * scrcpy. In that state Android may already be awake, so KEYCODE_WAKEUP alone
 * is intentionally not used.
 */
export class ScreenPowerService {
  constructor(
    private readonly runCommand: ScreenPowerCommandRunner = runADBCommand,
    private readonly runOutput: ScreenPowerOutputRunner = runADBOutput
  ) {}

  public async wakeSleepingDevice(adbPath: string, serial: string): Promise<void> {
    await this.runCommand(adbPath, ['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], 10000)
  }

  public async turnPhysicalDisplayOff(adbPath: string, serial: string): Promise<void> {
    await this.runCommand(adbPath, ['-s', serial, 'shell', 'cmd', 'display', 'power-off', '0'], 10000)
  }

  /** Turns the display off and reports the verified state right after. */
  public async turnPhysicalDisplayOffVerified(adbPath: string, serial: string): Promise<DisplayPowerState> {
    await this.turnPhysicalDisplayOff(adbPath, serial)
    await delay(STATE_READ_DELAY_MS)
    return this.getDisplayPowerState(adbPath, serial)
  }

  public async restoreScrcpyBlankedDisplay(adbPath: string, serial: string): Promise<void> {
    // Android 15+ exposes idempotent display-power commands. Some OEM builds
    // provide power-reset instead of power-on, so support both before falling
    // back to POWER for older Android versions.
    try {
      await this.runCommand(adbPath, ['-s', serial, 'shell', 'cmd', 'display', 'power-on', '0'], 10000)
      return
    } catch {
      // Try the OEM/API variant below.
    }

    try {
      await this.runCommand(adbPath, ['-s', serial, 'shell', 'cmd', 'display', 'power-reset', '0'], 10000)
    } catch {
      // Unlike WAKEUP, POWER restores a panel blanked directly by scrcpy.
      await this.runCommand(adbPath, ['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_POWER'], 10000)
    }
  }

  /**
   * Reads the real display state from the device. dumpsys display covers
   * modern builds (mScreenState / mGlobalDisplayState); dumpsys power covers
   * older ones (Display Power: state=... / mWakefulness).
   */
  public async getDisplayPowerState(adbPath: string, serial: string): Promise<DisplayPowerState> {
    const displayDump = await this.runOutput(
      adbPath, ['-s', serial, 'shell', 'dumpsys', 'display'], 10000
    ).catch(() => '')
    const screenState = this.parseScreenState(displayDump)
    if (screenState !== 'unknown') {
      return screenState
    }

    const powerDump = await this.runOutput(
      adbPath, ['-s', serial, 'shell', 'dumpsys', 'power'], 10000
    ).catch(() => '')
    return this.parseWakefulness(powerDump)
  }

  /**
   * Wakes the display and verifies the result, escalating through strategies
   * until the device reports the screen as on. `preferScrcpyRestore` starts
   * with the scrcpy-blank restore path because WAKEUP does not lift a panel
   * blanked by scrcpy's --turn-screen-off.
   *
   * The returned state is the verified device state — callers should trust it
   * over any remembered flag.
   */
  public async wakeDisplay(
    adbPath: string,
    serial: string,
    options: { preferScrcpyRestore?: boolean } = {}
  ): Promise<DisplayPowerState> {
    const initialState = await this.getDisplayPowerState(adbPath, serial)
    if (initialState === 'on') {
      return 'on'
    }

    // Case list for the escalation ladder (each step verified before the next):
    // - scrcpy blank → display restore commands, else WAKEUP can't lift it
    // - plain sleep  → WAKEUP is the gentle, correct first move
    // - both         → POWER toggles the display service, second try pairs
    //                  POWER with WAKEUP/restore for devices that need a toggle
    const steps: Array<'restore' | 'wakeup' | 'power'> = []
    if (options.preferScrcpyRestore) {
      steps.push('restore')
    }
    steps.push('wakeup', 'power')
    if (!options.preferScrcpyRestore) {
      steps.push('restore')
    }
    steps.push('power', 'restore')

    let finalState: DisplayPowerState = initialState
    for (const step of steps) {
      await this.runWakeStep(adbPath, serial, step)
      await delay(STATE_READ_DELAY_MS)
      finalState = await this.getDisplayPowerState(adbPath, serial)
      if (finalState === 'on') {
        return 'on'
      }
    }
    return finalState
  }

  private async runWakeStep(adbPath: string, serial: string, step: 'restore' | 'wakeup' | 'power'): Promise<void> {
    try {
      if (step === 'restore') {
        await this.restoreScrcpyBlankedDisplay(adbPath, serial)
      } else {
        const keyevent = step === 'wakeup' ? 'KEYCODE_WAKEUP' : 'KEYCODE_POWER'
        await this.runCommand(adbPath, ['-s', serial, 'shell', 'input', 'keyevent', keyevent], 10000)
      }
    } catch {
      // A failed step is not fatal: the ladder escalates and the returned
      // state reports the honest end result.
    }
  }

  private parseScreenState(output: string): DisplayPowerState {
    // `cmd display power-off` blanks the physical panel through DisplayManager.
    // On Samsung/MediaTek builds mScreenState remains ON while the physical
    // display's first standalone mState changes to OFF, so prefer that value.
    const match = output.match(/^\s*mState=(ON|OFF|DOZE|DOZE_SUSPEND|UNKNOWN)\s*$/m) ||
      output.match(/mScreenState=(\w+)/) ||
      output.match(/mGlobalDisplayState=(\w+)/)
    if (!match) {
      return 'unknown'
    }
    return normalizePowerState(match[1])
  }

  private parseWakefulness(output: string): DisplayPowerState {
    const displayMatch = output.match(/Display Power: state=(\w+)/)
    if (displayMatch) {
      return normalizePowerState(displayMatch[1])
    }
    const wakefulnessMatch = output.match(/mWakefulness=(\w+)/)
    if (wakefulnessMatch) {
      return normalizePowerState(wakefulnessMatch[1])
    }
    return 'unknown'
  }
}

function normalizePowerState(value: string): DisplayPowerState {
  const normalized = value.toUpperCase()
  if (normalized.startsWith('ON')) {
    return 'on'
  }
  if (normalized.startsWith('OFF') || normalized === 'ASLEEP') {
    return 'off'
  }
  return 'unknown'
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function runADBCommand(adbPath: string, args: string[], timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(adbPath, args, { windowsHide: true, timeout }, error => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function runADBOutput(adbPath: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(adbPath, args, { windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout.toString())
    })
  })
}
