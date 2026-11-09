import * as os from 'os'
import { execFile } from 'child_process'
import { MockErrorProxyService } from './mockErrorProxy'

export const BLACKHOLE_PROXY_HOST = '127.0.0.1'
export const BLACKHOLE_PROXY_PORT = '54321'

export interface NetworkConfigState {
  proxy: string | null
  dnsMode: string | null
  dnsSpecifier: string | null
  localIp: string
  isWireless: boolean
  isEmulator: boolean
  isOffline: boolean
  offlineMode: 'isolated' | 'hardware' | null
  activeThrottle: string | null
  activeErrorSimulation: string | null
}

export class NetworkManager {
  /**
   * Detects the computer's primary local IPv4 address on the Wi-Fi or Ethernet LAN.
   */
  public static getLocalIp(): string {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address
        }
      }
    }
    return '127.0.0.1'
  }

  public static isWirelessDevice(serial: string): boolean {
    return /:\d+$/.test(serial.trim())
  }

  public static isEmulator(serial: string): boolean {
    return /^emulator-\d+/i.test(serial.trim())
  }

  public static async getNetworkState(adbPath: string, serial: string): Promise<NetworkConfigState> {
    const proxy = await this.runAdbShell(adbPath, serial, ['settings', 'get', 'global', 'http_proxy']).catch(() => null)
    const dnsMode = await this.runAdbShell(adbPath, serial, ['settings', 'get', 'global', 'private_dns_mode']).catch(() => null)
    const dnsSpecifier = await this.runAdbShell(adbPath, serial, ['settings', 'get', 'global', 'private_dns_specifier']).catch(() => null)
    const airplaneMode = await this.runAdbShell(adbPath, serial, ['settings', 'get', 'global', 'airplane_mode_on']).catch(() => null)

    const cleanProxy = proxy && proxy.trim() !== 'null' && proxy.trim() !== ':0' ? proxy.trim() : null
    const cleanDnsMode = dnsMode && dnsMode.trim() !== 'null' ? dnsMode.trim() : null
    const cleanDnsSpec = dnsSpecifier && dnsSpecifier.trim() !== 'null' ? dnsSpecifier.trim() : null
    const isAirplane = airplaneMode ? airplaneMode.trim() === '1' : false

    const isIsolatedOffline = cleanProxy === `${BLACKHOLE_PROXY_HOST}:${BLACKHOLE_PROXY_PORT}`
    const isOffline = isIsolatedOffline || isAirplane
    const offlineMode = isIsolatedOffline ? 'isolated' : (isAirplane ? 'hardware' : null)

    const mockProxy = MockErrorProxyService.getInstance()
    let activeErrorSimulation: string | null = null
    let activeThrottle: string | null = null

    if (mockProxy.isRunning()) {
      const mode = mockProxy.getCurrentOptions().mode
      if (mode === 'delay') {
        activeThrottle = `${mockProxy.getCurrentOptions().delayMs || 3000}ms Delay`
      } else if (mode.startsWith('error_')) {
        activeErrorSimulation = mode.replace('error_', 'HTTP ')
      }
    }

    if (cleanProxy === `${BLACKHOLE_PROXY_HOST}:${BLACKHOLE_PROXY_PORT}`) {
      activeErrorSimulation = 'SocketException (Blackhole)'
    }

    return {
      proxy: cleanProxy,
      dnsMode: cleanDnsMode,
      dnsSpecifier: cleanDnsSpec,
      localIp: this.getLocalIp(),
      isWireless: this.isWirelessDevice(serial),
      isEmulator: this.isEmulator(serial),
      isOffline,
      offlineMode,
      activeThrottle,
      activeErrorSimulation
    }
  }

  public static async setHttpProxy(adbPath: string, serial: string, host: string, port: string): Promise<void> {
    if (!host || !port) {
      throw new Error('Host and port are required to set HTTP proxy.')
    }
    await this.runAdbShell(adbPath, serial, ['settings', 'put', 'global', 'http_proxy', `${host.trim()}:${port.trim()}`])
  }

  public static async clearHttpProxy(adbPath: string, serial: string): Promise<void> {
    await this.runAdbShell(adbPath, serial, ['settings', 'put', 'global', 'http_proxy', ':0'])
  }

  public static async setPrivateDns(adbPath: string, serial: string, hostname: string): Promise<void> {
    if (!hostname) {
      throw new Error('DNS Hostname is required.')
    }
    await this.runAdbShell(adbPath, serial, ['settings', 'put', 'global', 'private_dns_mode', 'hostname'])
    await this.runAdbShell(adbPath, serial, ['settings', 'put', 'global', 'private_dns_specifier', hostname.trim()])
  }

  public static async clearPrivateDns(adbPath: string, serial: string): Promise<void> {
    await this.runAdbShell(adbPath, serial, ['settings', 'put', 'global', 'private_dns_mode', 'off'])
    await this.runAdbShell(adbPath, serial, ['settings', 'put', 'global', 'private_dns_specifier', ''])
  }

  public static async setWifiState(adbPath: string, serial: string, enabled: boolean): Promise<void> {
    await this.runAdbShell(adbPath, serial, ['svc', 'wifi', enabled ? 'enable' : 'disable'])
  }

  public static async setMobileDataState(adbPath: string, serial: string, enabled: boolean): Promise<void> {
    await this.runAdbShell(adbPath, serial, ['svc', 'data', enabled ? 'enable' : 'disable'])
  }

  public static async setAirplaneMode(adbPath: string, serial: string, enabled: boolean): Promise<void> {
    const val = enabled ? '1' : '0'
    await this.runAdbShell(adbPath, serial, ['cmd', 'connectivity', 'airplane-mode', enabled ? 'enable' : 'disable'])
      .catch(async () => {
        // Fallback for older Android releases
        await this.runAdbShell(adbPath, serial, ['settings', 'put', 'global', 'airplane_mode_on', val])
        await this.runAdbShell(adbPath, serial, ['am', 'broadcast', '-a', 'android.intent.action.AIRPLANE_MODE', '--ez', 'state', enabled ? 'true' : 'false'])
      })
  }

  /**
   * Smart Isolated Offline Mode:
   * Sets http_proxy to a local blackhole port so all HTTP/HTTPS traffic fails immediately,
   * while keeping ADB transport (port 5555 for Wireless ADB) and scrcpy completely untouched.
   */
  public static async setIsolatedOffline(adbPath: string, serial: string, offline: boolean): Promise<void> {
    if (offline) {
      await this.setHttpProxy(adbPath, serial, BLACKHOLE_PROXY_HOST, BLACKHOLE_PROXY_PORT)
    } else {
      await this.clearHttpProxy(adbPath, serial)
    }
  }

  /**
   * Smart Offline Mode:
   * Automatically selects Isolated Offline for wireless devices to prevent dropping the ADB debugging link,
   * while allowing hardware radio cut for USB / emulator devices if requested.
   */
  public static async setOfflineMode(
    adbPath: string,
    serial: string,
    offline: boolean,
    forceHardware: boolean = false
  ): Promise<{ mode: 'isolated' | 'hardware'; offline: boolean }> {
    const isWireless = this.isWirelessDevice(serial)

    if (isWireless || !forceHardware) {
      await this.setIsolatedOffline(adbPath, serial, offline)
      return { mode: 'isolated', offline }
    } else {
      await this.setAirplaneMode(adbPath, serial, offline)
      return { mode: 'hardware', offline }
    }
  }

  /**
   * Throttles network on Android Emulator via `adb emu` console commands,
   * or starts mock proxy delay if running on physical device.
   */
  public static async setNetworkThrottle(
    adbPath: string,
    serial: string,
    preset: 'normal' | '2g' | '3g' | 'delay3s'
  ): Promise<{ appliedVia: 'emulator' | 'mock_proxy' }> {
    const isEmu = this.isEmulator(serial)
    const localIp = this.getLocalIp()

    if (isEmu) {
      let speed = 'full'
      let delay = 'none'

      if (preset === '2g') {
        speed = 'gprs'
        delay = 'gprs'
      } else if (preset === '3g') {
        speed = 'umts'
        delay = 'edge'
      } else if (preset === 'delay3s') {
        speed = 'full'
        delay = 'gprs'
      }

      await this.runAdb(adbPath, ['-s', serial, 'emu', 'network', 'speed', speed]).catch(() => undefined)
      await this.runAdb(adbPath, ['-s', serial, 'emu', 'network', 'delay', delay]).catch(() => undefined)
    }

    const mockProxy = MockErrorProxyService.getInstance()
    if (preset === 'normal') {
      if (mockProxy.isRunning()) {
        await mockProxy.stop()
        await this.clearHttpProxy(adbPath, serial)
      }
      return { appliedVia: isEmu ? 'emulator' : 'mock_proxy' }
    }

    // Physical device or delay3s preset: Use Mock Proxy with artificial latency
    const delayMs = preset === 'delay3s' ? 3000 : (preset === '2g' ? 1500 : 600)
    const { port } = await mockProxy.start({ mode: 'delay', delayMs })
    await this.setHttpProxy(adbPath, serial, localIp, String(port))

    return { appliedVia: isEmu ? 'emulator' : 'mock_proxy' }
  }

  /**
   * Injects simulated error states (HTTP 500, 404, 401, or immediate Connection Refused / Drop).
   */
  public static async simulateErrorState(
    adbPath: string,
    serial: string,
    errorType: 'none' | 'connection_refused' | 'http_500' | 'http_404' | 'http_401'
  ): Promise<void> {
    const mockProxy = MockErrorProxyService.getInstance()
    const localIp = this.getLocalIp()

    if (errorType === 'none') {
      if (mockProxy.isRunning()) {
        await mockProxy.stop()
      }
      await this.clearHttpProxy(adbPath, serial)
      return
    }

    if (errorType === 'connection_refused') {
      if (mockProxy.isRunning()) {
        await mockProxy.stop()
      }
      await this.setHttpProxy(adbPath, serial, BLACKHOLE_PROXY_HOST, BLACKHOLE_PROXY_PORT)
      return
    }

    // HTTP 500 / 404 / 401 via Mock Proxy
    const mode = errorType.replace('http_', 'error_') as 'error_500' | 'error_404' | 'error_401'
    const { port } = await mockProxy.start({ mode })
    await this.setHttpProxy(adbPath, serial, localIp, String(port))
  }

  private static runAdbShell(adbPath: string, serial: string, args: string[]): Promise<string> {
    return this.runAdb(adbPath, ['-s', serial, 'shell', ...args])
  }

  private static runAdb(adbPath: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        adbPath,
        args,
        { windowsHide: true, timeout: 15000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || stdout || error.message))
          } else {
            resolve(stdout.trim())
          }
        }
      )
    })
  }
}
