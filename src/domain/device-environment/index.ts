import { execFile } from 'child_process';

export interface DeviceEnvironmentState {
  fontScale: number;
  isDarkMode: boolean;
  batteryLevel: number;
  isBatteryOverridden: boolean;
  locale: string;
  density: number | null;
  rotation: number | 'auto';
}

export class DeviceEnvironmentService {
  constructor(
    private readonly getADBExecutable: () => Promise<string>,
    private readonly runProcess: (
      executable: string,
      args: string[],
      timeout?: number
    ) => Promise<{ stdout: string; stderr: string; errorMessage?: string }> = DeviceEnvironmentService.executeProcess
  ) {}

  public static async executeProcess(
    executable: string,
    args: string[],
    timeout = 10000
  ): Promise<{ stdout: string; stderr: string; errorMessage?: string }> {
    return new Promise(resolve => {
      execFile(executable, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          errorMessage: error ? error.message : undefined
        });
      });
    });
  }

  private async runAdb(serial: string | undefined, shellArgs: string[]): Promise<string> {
    const adb = await this.getADBExecutable();
    const args: string[] = [];
    if (serial && serial.trim().length > 0) {
      args.push('-s', serial.trim());
    }
    args.push('shell', ...shellArgs);

    const res = await this.runProcess(adb, args);
    if (res.errorMessage && !res.stdout) {
      throw new Error(res.errorMessage);
    }
    return res.stdout.trim();
  }

  public async getState(serial?: string): Promise<DeviceEnvironmentState> {
    let fontScale = 1.0;
    try {
      const fsOut = await this.runAdb(serial, ['settings', 'get', 'system', 'font_scale']);
      const parsed = parseFloat(fsOut);
      if (!isNaN(parsed) && parsed > 0) fontScale = parsed;
    } catch {}

    let isDarkMode = false;
    try {
      const uiOut = await this.runAdb(serial, ['cmd', 'uimode', 'night']);
      isDarkMode = uiOut.toLowerCase().includes('yes') || uiOut.toLowerCase().includes('true');
    } catch {}

    let batteryLevel = 100;
    let isBatteryOverridden = false;
    try {
      const batOut = await this.runAdb(serial, ['dumpsys', 'battery']);
      const levelMatch = batOut.match(/level:\s*(\d+)/i);
      if (levelMatch) {
        batteryLevel = parseInt(levelMatch[1], 10);
      }
      isBatteryOverridden = batOut.toLowerCase().includes('updates: false');
    } catch {}

    let locale = 'en';
    try {
      const locOut = await this.runAdb(serial, ['getprop', 'persist.sys.locale']);
      if (locOut) locale = locOut;
    } catch {}

    let density: number | null = null;
    try {
      const denOut = await this.runAdb(serial, ['wm', 'density']);
      const match = denOut.match(/Physical density:\s*(\d+)|Override density:\s*(\d+)/);
      if (match) {
        density = parseInt(match[2] || match[1], 10);
      }
    } catch {}

    let rotation: number | 'auto' = 'auto';
    try {
      const accel = await this.runAdb(serial, ['settings', 'get', 'system', 'accelerometer_rotation']);
      if (accel.trim() === '1') {
        rotation = 'auto';
      } else {
        const userRot = await this.runAdb(serial, ['settings', 'get', 'system', 'user_rotation']);
        const r = parseInt(userRot.trim(), 10);
        rotation = isNaN(r) ? 'auto' : r;
      }
    } catch {}

    return {
      fontScale,
      isDarkMode,
      batteryLevel,
      isBatteryOverridden,
      locale,
      density,
      rotation
    };
  }

  public async setFontScale(serial: string | undefined, scale: number): Promise<boolean> {
    await this.runAdb(serial, ['settings', 'put', 'system', 'font_scale', scale.toFixed(2)]);
    return true;
  }

  public async setDarkMode(serial: string | undefined, enabled: boolean): Promise<boolean> {
    await this.runAdb(serial, ['cmd', 'uimode', 'night', enabled ? 'yes' : 'no']);
    return true;
  }

  public async setBatteryLevel(serial: string | undefined, level: number, charging = false): Promise<boolean> {
    await this.runAdb(serial, ['dumpsys', 'battery', 'set', 'level', Math.max(1, Math.min(100, level)).toString()]);
    if (charging) {
      await this.runAdb(serial, ['dumpsys', 'battery', 'set', 'status', '2']); // 2 = CHARGING
      await this.runAdb(serial, ['dumpsys', 'battery', 'set', 'ac', '1']);
    } else {
      await this.runAdb(serial, ['dumpsys', 'battery', 'set', 'status', '3']); // 3 = DISCHARGING
      await this.runAdb(serial, ['dumpsys', 'battery', 'set', 'ac', '0']);
      await this.runAdb(serial, ['dumpsys', 'battery', 'set', 'usb', '0']);
    }
    return true;
  }

  public async resetBattery(serial: string | undefined): Promise<boolean> {
    await this.runAdb(serial, ['dumpsys', 'battery', 'reset']);
    return true;
  }

  public async setLocale(serial: string | undefined, localeTag: string): Promise<boolean> {
    try {
      await this.runAdb(serial, ['cmd', 'locale', 'set', localeTag]);
    } catch {
      await this.runAdb(serial, ['setprop', 'persist.sys.locale', localeTag]);
    }
    return true;
  }

  public async setDensity(serial: string | undefined, dpi: number | 'reset'): Promise<boolean> {
    if (dpi === 'reset') {
      await this.runAdb(serial, ['wm', 'density', 'reset']);
    } else {
      await this.runAdb(serial, ['wm', 'density', Math.max(100, Math.min(800, dpi)).toString()]);
    }
    return true;
  }

  public async setRotation(serial: string | undefined, rotation: 0 | 1 | 'auto'): Promise<boolean> {
    if (rotation === 'auto') {
      await this.runAdb(serial, ['settings', 'put', 'system', 'accelerometer_rotation', '1']);
    } else {
      await this.runAdb(serial, ['settings', 'put', 'system', 'accelerometer_rotation', '0']);
      await this.runAdb(serial, ['settings', 'put', 'system', 'user_rotation', rotation.toString()]);
    }
    return true;
  }
}

