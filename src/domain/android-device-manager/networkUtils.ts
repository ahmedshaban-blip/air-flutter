import { Socket } from 'net';

export class NetworkUtils {
  public static isTCPPortOpen(host: string, port: number): Promise<boolean> {
    return new Promise(resolve => {
      const socket = new Socket();
      let completed = false;
      const finish = (isOpen: boolean) => {
        if (completed) return;
        completed = true;
        socket.destroy();
        resolve(isOpen);
      };
      socket.setTimeout(500);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(port, host);
    });
  }

  public static isValidIPv4(value: string): boolean {
    const segments = value.split('.');
    return (
      segments.length === 4 &&
      segments.every(segment => /^\d{1,3}$/.test(segment) && Number(segment) <= 255)
    );
  }

  public static validateSerial(serial: string): void {
    if (!/^[A-Za-z0-9._:-]+$/.test(serial)) {
      throw new Error('Invalid Android device serial.');
    }
  }

  public static validatePort(port: string): void {
    const portNumber = Number(port);
    if (!/^\d+$/.test(port) || portNumber < 1 || portNumber > 65535) {
      throw new Error('Invalid ADB port.');
    }
  }

  public static validateEndpoint(endpoint: string): void {
    const match = endpoint.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
    if (!match || !this.isValidIPv4(match[1])) {
      throw new Error('Invalid wireless ADB endpoint.');
    }
    this.validatePort(match[2]);
  }
}
