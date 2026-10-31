import { execFile, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as globalStateKeys from '../../config/global-state-keys'
import { getCommonADBPaths } from '../adb-resolver/adb-path'
import { AndroidDevice, AndroidDeviceManager } from '../android-device-manager'
export interface DeviceInfoSnapshot {
  serial: string
  model: string
  manufacturer: string
  androidVersion: string
  apiLevel: string
  batteryLevel: number | null
  batteryStatus: 'charging' | 'discharging' | 'full' | 'unknown'
  batteryTemperature: number | null
  networkType: string
  wifiSsid: string
  ipAddress: string
  screenOn: boolean
}

interface StateStorage {
  get<T>(key: string, defaultValue?: T): T | undefined
}

/**
 * Reads live phone state through `adb shell` and runs the one-shot developer
 * actions. Every call targets an explicit serial, so it never guesses which
 * phone the user meant.
 */
export class DeviceToolsService {
  private adbExecutable: string | undefined

  constructor(
    private readonly storage: StateStorage,
    private readonly deviceManager: AndroidDeviceManager
  ) {}

  public async getDeviceInfo(serial: string): Promise<DeviceInfoSnapshot> {
    this.validateSerial(serial)

    const [props, battery, connectivity, screen] = await Promise.all([
      this.shell(serial, ['getprop'], 12000),
      this.shell(serial, ['dumpsys', 'battery'], 12000),
      this.shell(serial, ['dumpsys', 'connectivity'], 15000),
      this.shell(serial, ['dumpsys', 'power'], 12000)
    ])

    const readProp = (name: string): string => {
      const match = props.match(new RegExp(`\\[${name}\\]:\\s*\\[([^\\]]*)\\]`))
      return match ? match[1].trim() : ''
    }

    const batteryLevelMatch = battery.match(/level:\s*(\d+)/i)
    const batteryStatusMatch = battery.match(/status:\s*(\d+)/i)
    const temperatureMatch = battery.match(/temperature:\s*(\d+)/i)

    const batteryLevel = batteryLevelMatch ? Number(batteryLevelMatch[1]) : null
    const batteryStatus = this.toBatteryStatus(
      batteryStatusMatch ? Number(batteryStatusMatch[1]) : -1
    )
    const batteryTemperature = temperatureMatch ? Number(temperatureMatch[1]) / 10 : null

    const networkType = this.toNetworkType(connectivity)
    const wifiSsid = readProp('wifi.interface')
      ? await this.readWifiSsid(serial)
      : ''

    const ipAddress = await this.readIpAddress(serial)

    return {
      serial,
      model: readProp('ro.product.model') || readProp('ro.product.vendor.model') || 'Android device',
      manufacturer:
        readProp('ro.product.manufacturer') || readProp('ro.product.vendor.manufacturer'),
      androidVersion: readProp('ro.build.version.release'),
      apiLevel: readProp('ro.build.version.sdk'),
      batteryLevel,
      batteryStatus,
      batteryTemperature,
      networkType,
      wifiSsid,
      ipAddress,
      screenOn: /mWakefulness=Awake|Display Power: state=ON/i.test(screen)
    }
  }

  /** `screencap` writes the PNG to stdout; the phone stays untouched. */
  public async captureScreenshot(serial: string, destination: string): Promise<string> {
    this.validateSerial(serial)
    const adb = await this.getADBExecutable()

    await fs.promises.mkdir(path.dirname(destination), { recursive: true })

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      execFile(
        adb,
        ['-s', serial, 'exec-out', 'screencap', '-p'],
        { windowsHide: true, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 30000 },
        (error, stdout) => {
          if (error) {
            reject(new Error(error.message))
            return
          }
          resolve(stdout as unknown as Buffer)
        }
      )
    })

    if (!buffer || buffer.length < 1024) {
      throw new Error('The phone returned an empty screenshot. Unlock it and try again.')
    }

    await fs.promises.writeFile(destination, buffer)
    return destination
  }

  public async wakeScreen(serial: string): Promise<void> {
    this.validateSerial(serial)
    await this.shell(serial, ['input', 'keyevent', 'KEYCODE_WAKEUP'], 10000)
    // Some OEM builds ignore WAKEUP while the screen is off; MENU is the fallback.
    await this.shell(serial, ['input', 'keyevent', 'KEYCODE_MENU'], 10000).catch(() => undefined)
  }

  public async installApk(serial: string, apkPath: string): Promise<string> {
    this.validateSerial(serial)
    if (!fs.existsSync(apkPath)) {
      throw new Error(`APK file not found: ${apkPath}`)
    }
    const { stdout, stderr } = await this.runADB(['-s', serial, 'install', '-r', '-d', apkPath], 180000)
    if (stderr && !stdout.includes('Success')) {
      throw new Error(stderr)
    }
    return `${stdout}\n${stderr}`.trim()
  }

  public async sendText(serial: string, text: string): Promise<void> {
    this.validateSerial(serial)
    if (!text) {
      return
    }
    // Android `input text` accepts string. Spaces should be %s. Special shell chars escaped.
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/ /g, '%s')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/([&<>;|()$`*?~!=])/g, '\\$1')
    await this.shell(serial, ['input', 'text', escaped], 15000)
  }

  /** Full radio reset: reboot, wait for the phone, then restore wireless ADB. */
  public async healWifi(serial: string, onProgress: (message: string) => void): Promise<string> {
    this.validateSerial(serial)

    const isWireless = /:\d+$/.test(serial)
    const port = isWireless ? serial.split(':').pop()! : '5555'

    onProgress('Rebooting the phone…')
    await this.shell(serial, ['reboot'], 10000).catch(() => undefined)

    onProgress('Waiting for the phone to come back…')
    await this.waitUntilGone(serial)
    const restored = await this.waitUntilOnline(serial, 180000)

    if (!isWireless) {
      return restored || serial
    }

    onProgress('Restoring wireless ADB…')
    await this.delay(6000)
    await this.runADB(['connect', serial], 20000).catch(() => undefined)

    const endpoint = await this.deviceManager
      .reconnectWirelessDevice(restored || serial, port)
      .catch(() => serial)

    await this.runADB(['connect', endpoint], 20000).catch(() => undefined)
    onProgress(`Wireless ADB restored on ${endpoint}`)
    return endpoint
  }

  public async listConnectedSerial(): Promise<string | undefined> {
    const devices = await this.deviceManager.listDevices().catch(() => [] as AndroidDevice[])
    const online = devices.find(device => device.state === 'device' && device.transport !== 'usb')
    return (online || devices.find(device => device.state === 'device'))?.id
  }

  // --- internals -----------------------------------------------------------

  private async readWifiSsid(serial: string): Promise<string> {
    const output = await this.shell(
      serial,
      ['dumpsys', 'wifi', '|', 'grep', 'SSID'],
      12000
    ).catch(() => '')
    const match = output.match(/SSID:\s*"?([^",\n]+)"?/)
    return match ? match[1].trim() : ''
  }

  private async readIpAddress(serial: string): Promise<string> {
    const output = await this.shell(serial, ['ip', '-f', 'inet', 'addr', 'show', 'wlan0'], 12000).catch(
      () => ''
    )
    const match = output.match(/\binet\s+(\d{1,3}(?:\.\d{1,3}){3})/)
    return match ? match[1] : ''
  }

  private toBatteryStatus(raw: number): DeviceInfoSnapshot['batteryStatus'] {
    // BatteryManager: 2 charging, 3 discharging, 4 not charging, 5 full
    switch (raw) {
      case 2:
        return 'charging'
      case 3:
        return 'discharging'
      case 4:
        return 'charging'
      case 5:
        return 'full'
      default:
        return 'unknown'
    }
  }

  private toNetworkType(connectivity: string): string {
    if (/WIFI|WifiNetworkAgent/i.test(connectivity) && /CONNECTED/i.test(connectivity)) {
      return 'wifi'
    }
    if (/MOBILE|CellularNetworkAgent/i.test(connectivity) && /CONNECTED/i.test(connectivity)) {
      return 'mobile'
    }
    if (/ETHERNET/i.test(connectivity)) {
      return 'ethernet'
    }
    if (/CONNECTED/i.test(connectivity)) {
      return 'connected'
    }
    return 'offline'
  }

  private async waitUntilGone(serial: string): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const devices = await this.deviceManager.listDevices().catch(() => [] as AndroidDevice[])
      if (!devices.some(device => device.id === serial)) {
        return
      }
      await this.delay(1000)
    }
  }

  private async waitUntilOnline(serial: string, timeout: number): Promise<string | undefined> {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const devices = await this.deviceManager.listDevices().catch(() => [] as AndroidDevice[])
      const match = devices.find(device => device.id === serial && device.state === 'device')
      if (match) {
        return match.id
      }
      // A rebooted wireless phone often returns on the same address only after
      // adb re-connects; a USB phone just reappears.
      await this.delay(3000)
    }
    return undefined
  }

  private async shell(serial: string, args: string[], timeout: number): Promise<string> {
    this.validateSerial(serial)
    const { stdout, stderr } = await this.runADB(['-s', serial, 'shell', ...args], timeout)
    return `${stdout}${stderr}`
  }

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

    // Fall back to the manager's own resolver before giving up.
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

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }
}

export type SpawnedLogcat = {
  process: ChildProcess
  close: () => void
}
