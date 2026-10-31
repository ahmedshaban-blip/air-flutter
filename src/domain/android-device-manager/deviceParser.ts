import {
  AndroidDevice,
  AndroidDeviceState,
  AndroidDeviceTransport,
  NetworkDevice
} from './types';

export class DeviceParser {
  public static parseDevices(output: string): AndroidDevice[] {
    return output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('List of devices'))
      .map(line => this.parseDeviceLine(line))
      .filter((device): device is AndroidDevice => device !== null);
  }

  public static parseDeviceLine(line: string): AndroidDevice | null {
    const [id, rawState, ...properties] = line.split(/\s+/);
    if (!id || !rawState) {
      return null;
    }

    const state: AndroidDeviceState =
      rawState === 'device' || rawState === 'offline' || rawState === 'unauthorized'
        ? rawState
        : 'offline';
    const metadata = new Map<string, string>();

    for (const property of properties) {
      const separatorIndex = property.indexOf(':');
      if (separatorIndex > 0) {
        metadata.set(
          property.substring(0, separatorIndex),
          property.substring(separatorIndex + 1)
        );
      }
    }

    const model = metadata.get('model')?.replace(/_/g, ' ');
    const transport: AndroidDeviceTransport = id.startsWith('emulator-')
      ? 'emulator'
      : id.includes(':')
        ? 'wireless'
        : 'usb';

    return {
      id,
      name: model || metadata.get('device') || id,
      state,
      transport
    };
  }

  public static parseMDNSDevices(output: string): NetworkDevice[] {
    const devices = new Map<string, NetworkDevice>();
    for (const line of output.split(/\r?\n/).map(value => value.trim())) {
      const match = line.match(
        /^(\S+)\s+(_adb-tls-connect\._tcp\.?)\s+(\S+:\d+)$/i
      );
      if (!match) {
        continue;
      }

      const endpoint = match[3];
      devices.set(endpoint, {
        id: `${match[1]}:${match[2]}`,
        name: this.getMDNSDeviceName(match[1]),
        endpoint
      });
    }
    return Array.from(devices.values());
  }

  public static getMDNSDeviceName(serviceName: string): string {
    const withoutPrefix = serviceName.replace(/^adb-/i, '');
    const serial = withoutPrefix.split('-')[0];
    return serial || serviceName;
  }

  public static mergeNetworkDevices(devices: NetworkDevice[]): NetworkDevice[] {
    const devicesByHost = new Map<string, NetworkDevice>();
    for (const device of devices) {
      const host = device.endpoint.substring(0, device.endpoint.lastIndexOf(':'));
      const existingDevice = devicesByHost.get(host);
      if (!existingDevice || device.endpoint.endsWith(':5555')) {
        devicesByHost.set(host, device);
      }
    }
    return Array.from(devicesByHost.values());
  }
}

