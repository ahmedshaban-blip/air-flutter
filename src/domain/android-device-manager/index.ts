import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { Socket } from 'net'
import * as globalStateKeys from '../../config/global-state-keys'
import { getCommonADBPaths } from '../adb-resolver/adb-path'

const findLocalDevices: () => Promise<Array<{ name?: string; ip: string }>> = require('local-devices')

export type AndroidDeviceState = 'device' | 'offline' | 'unauthorized'
export type AndroidDeviceTransport = 'usb' | 'wireless' | 'emulator'

export interface AndroidDevice {
  id: string
  name: string
  state: AndroidDeviceState
  transport: AndroidDeviceTransport
}

export interface WirelessConnectionResult {
  ipAddress: string
  port: string
  message: string
}

export interface NetworkDevice {
  id: string
  name: string
  endpoint: string
}

interface CommandResult {
  stdout: string
  stderr: string
}

interface StateStorage {
  get<T>(key: string, defaultValue?: T): T | undefined
}

export class AndroidDeviceManager {
  private adbExecutable: string | undefined

  constructor(private readonly storage: StateStorage) {}

  public async listDevices(): Promise<AndroidDevice[]> {
    const { stdout } = await this.runADB(['devices', '-l'])
    return this.parseDevices(stdout)
  }

  public async discoverNetworkDevices(): Promise<NetworkDevice[]> {
    const { stdout } = await this.runADB(['mdns', 'services'], 10000)
    const discoveredDevices = this.parseMDNSDevices(stdout)
    const savedDevice = this.getSavedNetworkDevice()
    const legacyDevices = await this.discoverLegacyADBDevices()
    return this.mergeNetworkDevices([
      ...discoveredDevices,
      ...(savedDevice ? [savedDevice] : []),
      ...legacyDevices
    ])
  }

  public async connectNetworkDevice(endpoint: string): Promise<void> {
    this.validateEndpoint(endpoint)
    const { stdout, stderr } = await this.runADB(['connect', endpoint], 20000)
    const connectionOutput = `${stdout}\n${stderr}`.trim()
    if (!/(connected to|already connected to)/i.test(connectionOutput)) {
      throw new Error(connectionOutput || `Could not connect to ${endpoint}.`)
    }
    await this.requireOnlineDevice(endpoint)
  }

  public async connectUSBDevice(
    serial: string,
    port = '5555'
  ): Promise<WirelessConnectionResult> {
    this.validateSerial(serial)
    this.validatePort(port)

    const selectedDevice = await this.getOnlineUSBDevice(serial)
    const ipAddress = await this.findWifiIPAddress(serial)
    const endpoint = await this.enableWirelessADB(serial, ipAddress, port)
    await this.requireOnlineDevice(endpoint)

    return {
      ipAddress,
      port,
      message: `Connected ${selectedDevice.name} wirelessly at ${endpoint}`
    }
  }

  /**
   * Restores wireless ADB on a phone that is already reachable (for example
   * after a reboot), without needing it on USB. Used by the Wi-Fi heal action.
   */
  public async reconnectWirelessDevice(serial: string, port = '5555'): Promise<string> {
    this.validateSerial(serial)
    this.validatePort(port)

    await this.runADB(['connect', serial], 20000)
    await this.waitForDevice(serial)

    if (/:\d+$/.test(serial)) {
      // Already an IP endpoint: just re-enable TCP/IP mode in place.
      await this.runADB(['-s', serial, 'tcpip', port], 20000)
      return serial
    }

    const ipAddress = await this.findWifiIPAddress(serial)
    const endpoint = await this.enableWirelessADB(serial, ipAddress, port)
    await this.requireOnlineDevice(endpoint)
    return endpoint
  }

  public async disconnectDevice(serial: string): Promise<void> {
    this.validateSerial(serial)
    if (!serial.includes(':')) {
      throw new Error('Only wireless devices can be disconnected from ADB.')
    }

    const result = await this.runADB(['disconnect', serial])
    const output = `${result.stdout}\n${result.stderr}`
    if (!/disconnected/i.test(output)) {
      throw new Error(output.trim() || `Could not disconnect ${serial}.`)
    }
  }

  public async getADBExecutable(): Promise<string> {
    if (this.adbExecutable) {
      return this.adbExecutable
    }

    const candidates = this.getADBCandidates()
    let lastError: Error | undefined

    for (const candidate of candidates) {
      try {
        await this.execute(candidate, ['version'], 5000)
        this.adbExecutable = candidate
        return candidate
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    throw new Error(
      `ADB not found. Install Android platform-tools or configure the ADB path.${
        lastError ? ` (${lastError.message})` : ''
      }`
    )
  }

  private async runADB(args: string[], timeout = 15000): Promise<CommandResult> {
    const adb = await this.getADBExecutable()
    return this.execute(adb, args, timeout)
  }

  private execute(
    executable: string,
    args: string[],
    timeout: number
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      execFile(
        executable,
        args,
        {
          windowsHide: true,
          timeout,
          maxBuffer: 1024 * 1024
        },
        (error, stdout, stderr) => {
          const stdoutText = String(stdout || '')
          const stderrText = String(stderr || '')

          if (error) {
            const details = (stderrText || stdoutText || error.message).trim()
            reject(new Error(details))
            return
          }

          resolve({ stdout: stdoutText, stderr: stderrText })
        }
      )
    })
  }

  private getADBCandidates(): string[] {
    const executableName = os.type() === 'Windows_NT' ? 'adb.exe' : 'adb'
    const candidates: string[] = []
    const configuredPath = this.storage.get<string>(globalStateKeys.customADBPathKey())

    if (typeof configuredPath === 'string' && configuredPath.trim()) {
      const normalizedPath = configuredPath.trim()
      candidates.push(
        fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isDirectory()
          ? path.join(normalizedPath, executableName)
          : normalizedPath
      )
    }

    for (const adbFolder of getCommonADBPaths({
      osType: os.type(),
      homeDir: os.homedir()
    })) {
      candidates.push(path.join(adbFolder, executableName))
    }

    candidates.push('adb')
    return Array.from(new Set(candidates))
  }

  private parseDevices(output: string): AndroidDevice[] {
    return output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('List of devices'))
      .map(line => this.parseDeviceLine(line))
      .filter((device): device is AndroidDevice => device !== null)
  }

  private parseMDNSDevices(output: string): NetworkDevice[] {
    const devices = new Map<string, NetworkDevice>()
    for (const line of output.split(/\r?\n/).map(value => value.trim())) {
      const match = line.match(
        /^(\S+)\s+(_adb-tls-connect\._tcp\.?)\s+(\S+:\d+)$/i
      )
      if (!match) {
        continue
      }

      const endpoint = match[3]
      devices.set(endpoint, {
        id: `${match[1]}:${match[2]}`,
        name: this.getMDNSDeviceName(match[1]),
        endpoint
      })
    }
    return Array.from(devices.values())
  }

  private getMDNSDeviceName(serviceName: string): string {
    const withoutPrefix = serviceName.replace(/^adb-/i, '')
    const serial = withoutPrefix.split('-')[0]
    return serial || serviceName
  }

  private getSavedNetworkDevice(): NetworkDevice | undefined {
    const ipAddress = this.storage.get<string>(globalStateKeys.lastUsedIP())
    const port = this.storage.get<string>(globalStateKeys.lastUsedPort(), '5555')
    if (!ipAddress || !port || !this.isValidIPv4(ipAddress)) {
      return undefined
    }
    return {
      id: `saved:${ipAddress}:${port}`,
      name: 'Previously used device',
      endpoint: `${ipAddress}:${port}`
    }
  }

  private async discoverLegacyADBDevices(): Promise<NetworkDevice[]> {
    try {
      const localDevices = await findLocalDevices()
      const candidates = localDevices.filter(device => this.isValidIPv4(device.ip))
      const openPorts = await Promise.all(
        candidates.map(device => this.isTCPPortOpen(device.ip, 5555))
      )
      return candidates
        .filter((_, index) => openPorts[index])
        .map(device => ({
          id: `lan:${device.ip}:5555`,
          name: device.name && device.name !== '?' ? device.name : `ADB device ${device.ip}`,
          endpoint: `${device.ip}:5555`
        }))
    } catch {
      return []
    }
  }

  private isTCPPortOpen(host: string, port: number): Promise<boolean> {
    return new Promise(resolve => {
      const socket = new Socket()
      let completed = false
      const finish = (isOpen: boolean) => {
        if (completed) return
        completed = true
        socket.destroy()
        resolve(isOpen)
      }
      socket.setTimeout(500)
      socket.once('connect', () => finish(true))
      socket.once('timeout', () => finish(false))
      socket.once('error', () => finish(false))
      socket.connect(port, host)
    })
  }

  private mergeNetworkDevices(devices: NetworkDevice[]): NetworkDevice[] {
    const devicesByHost = new Map<string, NetworkDevice>()
    for (const device of devices) {
      const host = device.endpoint.substring(0, device.endpoint.lastIndexOf(':'))
      const existingDevice = devicesByHost.get(host)
      if (!existingDevice || device.endpoint.endsWith(':5555')) {
        devicesByHost.set(host, device)
      }
    }
    return Array.from(devicesByHost.values())
  }

  private parseDeviceLine(line: string): AndroidDevice | null {
    const [id, rawState, ...properties] = line.split(/\s+/)
    if (!id || !rawState) {
      return null
    }

    const state: AndroidDeviceState =
      rawState === 'device' || rawState === 'offline' || rawState === 'unauthorized'
        ? rawState
        : 'offline'
    const metadata = new Map<string, string>()

    for (const property of properties) {
      const separatorIndex = property.indexOf(':')
      if (separatorIndex > 0) {
        metadata.set(
          property.substring(0, separatorIndex),
          property.substring(separatorIndex + 1)
        )
      }
    }

    const model = metadata.get('model')?.replace(/_/g, ' ')
    const transport: AndroidDeviceTransport = id.startsWith('emulator-')
      ? 'emulator'
      : id.includes(':')
        ? 'wireless'
        : 'usb'

    return {
      id,
      name: model || metadata.get('device') || id,
      state,
      transport
    }
  }

  private async getOnlineUSBDevice(serial: string): Promise<AndroidDevice> {
    const selectedDevice = (await this.listDevices()).find(device => device.id === serial)
    if (!selectedDevice) {
      throw new Error('The selected USB device is no longer connected.')
    }
    if (selectedDevice.transport !== 'usb') {
      throw new Error('Select a physical device connected through USB.')
    }
    if (selectedDevice.state === 'unauthorized') {
      throw new Error('Authorize USB debugging on the phone, then refresh the list.')
    }
    if (selectedDevice.state !== 'device') {
      throw new Error(`The selected USB device is ${selectedDevice.state}.`)
    }
    return selectedDevice
  }

  private async enableWirelessADB(
    serial: string,
    ipAddress: string,
    port: string
  ): Promise<string> {
    await this.runADB(['-s', serial, 'tcpip', port], 20000)
    await this.delay(1500)

    const endpoint = `${ipAddress}:${port}`
    const { stdout, stderr } = await this.runADB(['connect', endpoint], 20000)
    const connectionOutput = `${stdout}\n${stderr}`.trim()
    if (!/(connected to|already connected to)/i.test(connectionOutput)) {
      throw new Error(connectionOutput || `Could not connect to ${endpoint}.`)
    }
    return endpoint
  }

  private async requireOnlineDevice(endpoint: string): Promise<void> {
    const wirelessDevices = await this.waitForDevice(endpoint)
    const wirelessDevice = wirelessDevices.find(device => device.id === endpoint)
    if (!wirelessDevice || wirelessDevice.state !== 'device') {
      throw new Error(`ADB did not report ${endpoint} as an online device.`)
    }
  }

  private async findWifiIPAddress(serial: string): Promise<string> {
    const routeResult = await this.runADB(['-s', serial, 'shell', 'ip', 'route'])
    const routeMatch = routeResult.stdout.match(
      /(?:wlan\d+|wifi\d+).*?\bsrc\s+(\d{1,3}(?:\.\d{1,3}){3})/i
    )

    if (routeMatch && this.isValidIPv4(routeMatch[1])) {
      return routeMatch[1]
    }

    const addressResult = await this.runADB([
      '-s',
      serial,
      'shell',
      'ip',
      '-f',
      'inet',
      'addr',
      'show',
      'wlan0'
    ])
    const addressMatch = addressResult.stdout.match(
      /\binet\s+(\d{1,3}(?:\.\d{1,3}){3})/i
    )

    if (addressMatch && this.isValidIPv4(addressMatch[1])) {
      return addressMatch[1]
    }

    throw new Error(
      'Could not read the phone Wi-Fi address. Connect the phone to Wi-Fi and try again.'
    )
  }

  private async waitForDevice(endpoint: string): Promise<AndroidDevice[]> {
    let devices: AndroidDevice[] = []
    for (let attempt = 0; attempt < 4; attempt += 1) {
      devices = await this.listDevices()
      if (devices.some(device => device.id === endpoint && device.state === 'device')) {
        return devices
      }
      await this.delay(500)
    }
    return devices
  }

  private isValidIPv4(value: string): boolean {
    const segments = value.split('.')
    return (
      segments.length === 4 &&
      segments.every(segment => /^\d{1,3}$/.test(segment) && Number(segment) <= 255)
    )
  }

  private validateSerial(serial: string): void {
    if (!/^[A-Za-z0-9._:-]+$/.test(serial)) {
      throw new Error('Invalid Android device serial.')
    }
  }

  private validatePort(port: string): void {
    const portNumber = Number(port)
    if (!/^\d+$/.test(port) || portNumber < 1 || portNumber > 65535) {
      throw new Error('Invalid ADB port.')
    }
  }

  private validateEndpoint(endpoint: string): void {
    const match = endpoint.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/)
    if (!match || !this.isValidIPv4(match[1])) {
      throw new Error('Invalid wireless ADB endpoint.')
    }
    this.validatePort(match[2])
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }
}
