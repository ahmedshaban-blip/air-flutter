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
  // Must configure test providers (gps, fused, network) with timestamps and broadcast fallback
  const adbArgStrings = adbCalls.map(c => c.args.join(' '));
  assert.ok(adbArgStrings.some(s => s.includes('appops set com.android.shell android:mock_location allow')), 'Must grant mock_location to shell');
  assert.ok(adbArgStrings.some(s => s.includes('providers add-test-provider gps')), 'Must add gps test provider');
  assert.ok(adbArgStrings.some(s => s.includes('providers set-test-provider-location gps --location 25.204800,55.270800')), 'Must set gps test location');
  assert.ok(adbArgStrings.some(s => s.includes('providers add-test-provider fused')), 'Must add fused test provider');
  assert.ok(adbArgStrings.some(s => s.includes('providers set-test-provider-location fused --location 25.204800,55.270800')), 'Must set fused test location');
  assert.ok(adbArgStrings.some(s => s.includes('providers add-test-provider network')), 'Must add network test provider');
  assert.ok(adbArgStrings.some(s => s.includes('providers set-test-provider-location network --location 25.204800,55.270800')), 'Must set network test location');
  assert.ok(adbArgStrings.some(s => s.includes('--time')), 'Must include timestamp for streaming clients');
  assert.ok(adbArgStrings.some(s => s.includes('am broadcast -a com.airflutter.MOCK_LOCATION')), 'Must broadcast fallback intent');

  // Reset Location - Emulator
  adbCalls.length = 0;
  const emuReset = await service.resetLocation('emulator-5554');
  assert.strictEqual(emuReset.ok, true);
  assert.strictEqual(emuReset.mode, 'emulator');
  assert.deepStrictEqual(adbCalls[0].args, ['-s', 'emulator-5554', 'emu', 'geo', 'fix', '0', '0', '0']);

  // Reset Location - Physical Device
  adbCalls.length = 0;
  const devReset = await service.resetLocation('physical_device_serial');
  assert.strictEqual(devReset.ok, true);
  assert.strictEqual(devReset.mode, 'broadcast');
  const resetArgStrings = adbCalls.map(c => c.args.join(' '));
  assert.ok(resetArgStrings.some(s => s.includes('remove-test-provider gps')), 'Must remove gps test provider');
  assert.ok(resetArgStrings.some(s => s.includes('remove-test-provider fused')), 'Must remove fused test provider');
  assert.ok(resetArgStrings.some(s => s.includes('remove-test-provider network')), 'Must remove network test provider');
  assert.ok(resetArgStrings.some(s => s.includes('com.airflutter.MOCK_LOCATION_RESET')), 'Must broadcast reset intent');

  service.dispose();

  console.log('✅ MockGpsService tests passed!');
})();

