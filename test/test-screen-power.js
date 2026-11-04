const assert = require('assert');
const { ScreenPowerService } = require('../out/domain/screen-power');

(async () => {
  const normalCommands = [];
  const normalService = new ScreenPowerService(async (adbPath, args, timeout) => {
    normalCommands.push({ adbPath, args, timeout });
  });

  await normalService.wakeSleepingDevice('adb-test', 'phone-1');
  assert.deepStrictEqual(normalCommands, [{
    adbPath: 'adb-test',
    args: ['-s', 'phone-1', 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'],
    timeout: 10000
  }], 'normal sleep must use the idempotent WAKEUP key');

  const offCommands = [];
  const offService = new ScreenPowerService(async (adbPath, args, timeout) => {
    offCommands.push({ adbPath, args, timeout });
  });
  await offService.turnPhysicalDisplayOff('adb-test', 'phone-1');
  assert.deepStrictEqual(offCommands[0].args, [
    '-s', 'phone-1', 'shell', 'cmd', 'display', 'power-off', '0'
  ]);

  const samsungService = new ScreenPowerService(
    async () => {},
    async () => [
      'Display State=ON',
      '  mState=OFF',
      '  mCommittedState=OFF',
      '  mDisplayState=ON',
      '  mScreenState=ON'
    ].join('\n')
  );
  assert.strictEqual(
    await samsungService.getDisplayPowerState('adb-test', 'samsung-phone'),
    'off',
    'physical DisplayManager state must win when framework wakefulness remains ON'
  );

  const verifiedOffCommands = [];
  const verifiedOffService = new ScreenPowerService(
    async (_adbPath, args) => verifiedOffCommands.push(args),
    async () => 'mState=OFF\nmScreenState=ON'
  );
  assert.strictEqual(
    await verifiedOffService.turnPhysicalDisplayOffVerified('adb-test', 'phone-verified'),
    'off',
    'display-off must be verified from the physical panel state'
  );
  assert.strictEqual(verifiedOffCommands.length, 1, 'verified display-off must not issue extra power toggles');

  const android15Commands = [];
  const android15Service = new ScreenPowerService(async (_adbPath, args) => {
    android15Commands.push(args);
  });

  await android15Service.restoreScrcpyBlankedDisplay('adb-test', 'phone-2');
  assert.deepStrictEqual(android15Commands, [
    ['-s', 'phone-2', 'shell', 'cmd', 'display', 'power-on', '0']
  ], 'scrcpy-blanked displays should use Android 15 display power-on first');

  const legacyCommands = [];
  const legacyService = new ScreenPowerService(async (_adbPath, args) => {
    legacyCommands.push(args);
    if (args.includes('power-on') || args.includes('power-reset')) {
      throw new Error('Unknown display power command');
    }
  });

  await legacyService.restoreScrcpyBlankedDisplay('adb-test', 'phone-3');
  assert.deepStrictEqual(legacyCommands, [
    ['-s', 'phone-3', 'shell', 'cmd', 'display', 'power-on', '0'],
    ['-s', 'phone-3', 'shell', 'cmd', 'display', 'power-reset', '0'],
    ['-s', 'phone-3', 'shell', 'input', 'keyevent', 'KEYCODE_POWER']
  ], 'older Android versions must fall back to POWER, not ineffective WAKEUP');

  const oemCommands = [];
  const oemService = new ScreenPowerService(async (_adbPath, args) => {
    oemCommands.push(args);
    if (args.includes('power-on')) {
      throw new Error('Unknown command: display power-on');
    }
  });

  await oemService.restoreScrcpyBlankedDisplay('adb-test', 'phone-4');
  assert.deepStrictEqual(oemCommands, [
    ['-s', 'phone-4', 'shell', 'cmd', 'display', 'power-on', '0'],
    ['-s', 'phone-4', 'shell', 'cmd', 'display', 'power-reset', '0']
  ], 'OEM power-reset must wake the panel without toggling POWER');

  // --- verified wake ladder ---

  // Plain sleep: the very first WAKEUP must lift the screen.
  const sleepCommands = [];
  let sleepScreenState = 'OFF';
  const sleepService = new ScreenPowerService(
    async (_adbPath, args) => {
      sleepCommands.push(args);
      if (args.includes('KEYCODE_WAKEUP')) sleepScreenState = 'ON';
    },
    async () => `mScreenState=${sleepScreenState}`
  );
  assert.strictEqual(await sleepService.wakeDisplay('adb-test', 'phone-5'), 'on');
  assert.strictEqual(sleepScreenState, 'ON');
  assert.ok(
    sleepCommands.some(args => args.includes('KEYCODE_WAKEUP')) &&
      !sleepCommands.some(args => args.includes('KEYCODE_POWER')),
    'a plain sleeping phone must not receive a POWER toggle'
  );

  // scrcpy blank: the restore path runs first and the verified result is used.
  const scrcpyCommands = [];
  let scrcpyScreenState = 'OFF';
  const scrcpyService = new ScreenPowerService(
    async (_adbPath, args) => {
      scrcpyCommands.push(args);
      if (args.includes('power-on')) scrcpyScreenState = 'ON';
    },
    async () => `mScreenState=${scrcpyScreenState}`
  );
  assert.strictEqual(
    await scrcpyService.wakeDisplay('adb-test', 'phone-6', { preferScrcpyRestore: true }),
    'on'
  );
  assert.deepStrictEqual(scrcpyCommands[0], [
    '-s', 'phone-6', 'shell', 'cmd', 'display', 'power-on', '0'
  ]);

  // Dead display service: WAKEUP and power-on no-op, POWER must rescue it.
  const stuckCommands = [];
  let stuckScreenState = 'OFF';
  const stuckService = new ScreenPowerService(
    async (_adbPath, args) => {
      stuckCommands.push(args);
      if (args.includes('KEYCODE_POWER')) stuckScreenState = 'ON';
    },
    async (_adbPath, args) => {
      if (args.includes('power-on') || args.includes('power-reset')) {
        throw new Error('display service unavailable');
      }
      return `mScreenState=${stuckScreenState}`;
    }
  );
  stuckService.runCommand = async (adbPath, args, timeout) => {
    stuckCommands.push(args);
    if (args.includes('power-on') || args.includes('power-reset')) {
      throw new Error('display service unavailable');
    }
    if (args.includes('KEYCODE_POWER')) stuckScreenState = 'ON';
  };
  assert.strictEqual(
    await stuckService.wakeDisplay('adb-test', 'phone-7', { preferScrcpyRestore: true }),
    'on'
  );
  assert.strictEqual(stuckScreenState, 'ON', 'POWER toggle must rescue devices the display service ignores');

  // Already-on device: wake must be a no-op.
  const awakeReads = [];
  const awakeService = new ScreenPowerService(
    async () => {
      throw new Error('no command should run');
    },
    async (_adbPath, args) => {
      awakeReads.push(args);
      return 'mScreenState=ON';
    }
  );
  assert.strictEqual(await awakeService.wakeDisplay('adb-test', 'phone-8'), 'on');
  assert.strictEqual(awakeReads.length, 1, 'an awake display must not receive wake commands');

  console.log('✅ Screen wake command selection verified');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
