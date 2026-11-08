import { execFile } from 'child_process';

export interface GpsLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  name?: string;
}

export interface GpsPreset extends GpsLocation {
  id: string;
  name: string;
  city: string;
  country: string;
}

export const GPS_PRESETS: readonly GpsPreset[] = [
  { id: 'cairo', name: 'Cairo, Egypt', city: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357 },
  { id: 'riyadh', name: 'Riyadh, Saudi Arabia', city: 'Riyadh', country: 'Saudi Arabia', latitude: 24.7136, longitude: 46.6753 },
  { id: 'dubai', name: 'Dubai, UAE', city: 'Dubai', country: 'UAE', latitude: 25.2048, longitude: 55.2708 },
  { id: 'london', name: 'London, UK', city: 'London', country: 'UK', latitude: 51.5074, longitude: -0.1278 },
  { id: 'new_york', name: 'New York, USA', city: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.0060 },
  { id: 'san_francisco', name: 'San Francisco, USA', city: 'San Francisco', country: 'USA', latitude: 37.7749, longitude: -122.4194 },
  { id: 'tokyo', name: 'Tokyo, Japan', city: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503 },
  { id: 'berlin', name: 'Berlin, Germany', city: 'Berlin', country: 'Germany', latitude: 52.5200, longitude: 13.4050 }
];

export interface GpsDispatchResult {
  ok: boolean;
  latitude: number;
  longitude: number;
  altitude?: number;
  mode: 'emulator' | 'broadcast' | 'both';
  message: string;
}

export class MockGpsService {
  constructor(
    private readonly getADBExecutable: () => Promise<string>,
    private readonly runProcess: (
      executable: string,
      args: string[],
      timeout?: number
    ) => Promise<{ stdout: string; stderr: string; errorMessage?: string }> = MockGpsService.executeProcess
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

  public static validateCoordinates(lat: number, lon: number): void {
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error(`Latitude must be between -90 and 90. Got ${lat}`);
    }
    if (typeof lon !== 'number' || isNaN(lon) || lon < -180 || lon > 180) {
      throw new Error(`Longitude must be between -180 and 180. Got ${lon}`);
    }
  }

  public async setLocation(
    serial: string,
    lat: number,
    lon: number,
    altitude = 0
  ): Promise<GpsDispatchResult> {
    MockGpsService.validateCoordinates(lat, lon);
    const adb = await this.getADBExecutable();
    const isEmulator = serial.startsWith('emulator-');

    if (isEmulator) {
      // Use adb emu geo fix <lon> <lat> [alt]
      const emuArgs = ['-s', serial, 'emu', 'geo', 'fix', lon.toFixed(6), lat.toFixed(6), altitude.toFixed(1)];
      const res = await this.runProcess(adb, emuArgs, 10000);
      if (res.errorMessage && !res.stdout.includes('OK')) {
        throw new Error(`Emulator geo fix failed: ${res.errorMessage}`);
      }
      return {
        ok: true,
        latitude: lat,
        longitude: lon,
        altitude,
        mode: 'emulator',
        message: `Emulator location updated to (${lat}, ${lon})`
      };
    } else {
      // Physical device: broadcast intent for mock location apps + set location enabled
      const broadcastArgs = [
        '-s', serial, 'shell', 'am', 'broadcast',
        '-a', 'com.airflutter.MOCK_LOCATION',
        '--ef', 'lat', lat.toFixed(6),
        '--ef', 'lon', lon.toFixed(6),
        '--ef', 'alt', altitude.toFixed(1)
      ];
      await this.runProcess(adb, ['-s', serial, 'shell', 'cmd', 'location', 'set-location-enabled', 'true'], 5000);
      const res = await this.runProcess(adb, broadcastArgs, 10000);

      return {
        ok: true,
        latitude: lat,
        longitude: lon,
        altitude,
        mode: 'broadcast',
        message: `Device location broadcast dispatched: (${lat}, ${lon})`
      };
    }
  }

  public async resetLocation(serial: string): Promise<GpsDispatchResult> {
    const adb = await this.getADBExecutable();
    const isEmulator = serial.startsWith('emulator-');

    if (isEmulator) {
      await this.runProcess(adb, ['-s', serial, 'emu', 'geo', 'fix', '0', '0', '0'], 10000);
      return {
        ok: true,
        latitude: 0,
        longitude: 0,
        altitude: 0,
        mode: 'emulator',
        message: 'Emulator mock GPS reset to default coordinates (0, 0).'
      };
    } else {
      await this.runProcess(adb, [
        '-s', serial, 'shell', 'am', 'broadcast',
        '-a', 'com.airflutter.MOCK_LOCATION_RESET'
      ], 10000);
      await this.runProcess(adb, ['-s', serial, 'shell', 'cmd', 'location', 'set-location-enabled', 'true'], 5000);

      return {
        ok: true,
        latitude: 0,
        longitude: 0,
        altitude: 0,
        mode: 'broadcast',
        message: 'Mock GPS reset to default on connected device.'
      };
    }
  }

  public static calculateWaypoints(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    steps: number
  ): GpsLocation[] {
    MockGpsService.validateCoordinates(startLat, startLon);
    MockGpsService.validateCoordinates(endLat, endLon);
    const clampedSteps = Math.max(2, Math.min(steps, 100));
    const waypoints: GpsLocation[] = [];

    for (let i = 0; i <= clampedSteps; i++) {
      const fraction = i / clampedSteps;
      const lat = startLat + (endLat - startLat) * fraction;
      const lon = startLon + (endLon - startLon) * fraction;
      waypoints.push({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6))
      });
    }

    return waypoints;
  }
}

