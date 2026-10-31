import * as os from 'os'
import { execFile } from 'child_process'

export interface NetworkConfigState {
  proxy: string | null
  dnsMode: string | null
  dnsSpecifier: string | null
  localIp: string
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

  public static async getNetworkState(adbPath: string, serial: string): Promise<NetworkConfigState> {
    const proxy = await this.runAdbShell(adbPath, serial, ['settings', 'get', 'global', 'http_proxy']).catch(() => null)
    const dnsMode = await this.runAdbShell(adbPath, serial, ['settings', 'get', 'global', 'private_dns_mode']).catch(() => null)
    const dnsSpecifier = await this.runAdbShell(adbPath, serial, ['settings', 'get', 'global', 'private_dns_specifier']).catch(() => null)

    const cleanProxy = proxy && proxy.trim() !== 'null' && proxy.trim() !== ':0' ? proxy.trim() : null
    const cleanDnsMode = dnsMode && dnsMode.trim() !== 'null' ? dnsMode.trim() : null
    const cleanDnsSpec = dnsSpecifier && dnsSpecifier.trim() !== 'null' ? dnsSpecifier.trim() : null

    return {
      proxy: cleanProxy,
      dnsMode: cleanDnsMode,
      dnsSpecifier: cleanDnsSpec,
      localIp: this.getLocalIp()
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

  private static runAdbShell(adbPath: string, serial: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        adbPath,
        ['-s', serial, 'shell', ...args],
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

