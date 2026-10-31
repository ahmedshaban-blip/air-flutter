export type AndroidDeviceState = 'device' | 'offline' | 'unauthorized';
export type AndroidDeviceTransport = 'usb' | 'wireless' | 'emulator';

export interface AndroidDevice {
  id: string;
  name: string;
  state: AndroidDeviceState;
  transport: AndroidDeviceTransport;
}

export interface WirelessConnectionResult {
  ipAddress: string;
  port: string;
  message: string;
}

export interface NetworkDevice {
  id: string;
  name: string;
  endpoint: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface StateStorage {
  get<T>(key: string, defaultValue?: T): T | undefined;
}

