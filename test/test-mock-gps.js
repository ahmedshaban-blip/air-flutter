const assert = require('assert');
const { MockGpsService, GPS_PRESETS } = require('../out/domain/mock-gps');

(async () => {
  console.log('🧪 Testing MockGpsService...');

  // Presets
  assert.strictEqual(GPS_PRESETS.length >= 8, true);
  const cairo = GPS_PRESETS.find(p => p.id === 'cairo');
  assert.ok(cairo);
  assert.strictEqual(cairo.latitude, 30.0444);

  // Validation
  MockGpsService.validateCoordinates(0, 0);
  MockGpsService.validateCoordinates(90, 180);
  MockGpsService.validateCoordinates(-90, -180);
  assert.throws(() => MockGpsService.validateCoordinates(91, 0), /Latitude must be between -90 and 90/);
  assert.throws(() => MockGpsService.validateCoordinates(0, 181), /Longitude must be between -180 and 180/);

  // Waypoints calculation
  const waypoints = MockGpsService.calculateWaypoints(30.0, 31.0, 30.5, 31.5, 5);
  assert.strictEqual(waypoints.length, 6);
  assert.strictEqual(waypoints[0].latitude, 30.0);
  assert.strictEqual(waypoints[waypoints.length - 1].latitude, 30.5);

  // Dispatching - Emulator
  const adbCalls = [];
  const service = new MockGpsService(
    async () => 'adb',
    async (exe, args) => {
      adbCalls.push({ exe, args });
      return { stdout: 'OK', stderr: '' };
    }
  );

  const emuRes = await service.setLocation('emulator-5554', 30.0444, 31.2357, 10);
  assert.strictEqual(emuRes.ok, true);
  assert.strictEqual(emuRes.mode, 'emulator');
  assert.deepStrictEqual(adbCalls[0].args, ['-s', 'emulator-5554', 'emu', 'geo', 'fix', '31.235700', '30.044400', '10.0']);

  // Dispatching - Physical Device
  adbCalls.length = 0;
  const devRes = await service.setLocation('physical_device_serial', 25.2048, 55.2708);
  assert.strictEqual(devRes.ok, true);
  assert.strictEqual(devRes.mode, 'broadcast');
  assert.strictEqual(adbCalls.length, 2); // set-location-enabled + broadcast

  console.log('✅ MockGpsService tests passed!');
})();

