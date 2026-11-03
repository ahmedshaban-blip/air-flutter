const assert = require('assert');
const { DeepLinkHistory, DeepLinkIntentStudio } = require('../out/domain/deep-link-intent-studio');

(async () => {
  assert.strictEqual(
    DeepLinkIntentStudio.validateUri('myapp://products/42?source=studio&debug=true'),
    'myapp://products/42?source=studio&debug=true'
  );
  assert.throws(() => DeepLinkIntentStudio.validateUri('products/42'), /Malformed URI/);
  assert.throws(() => DeepLinkIntentStudio.validateUri('myapp://product/42\nrm -rf /'), /control/);
  assert.throws(() => DeepLinkIntentStudio.validateUri('myapp://product name'), /spaces/);

  const calls = [];
  const studio = new DeepLinkIntentStudio(
    async () => 'adb',
    async (executable, args, timeout) => {
      calls.push({ executable, args, timeout });
      return { stdout: 'Starting: Intent { act=android.intent.action.VIEW dat=myapp://products/42 }\nStatus: ok\nActivity: com.example/.MainActivity', stderr: '' };
    }
  );
  const launched = await studio.dispatch({
    deviceId: 'emulator-5554',
    uri: 'myapp://products/42?source=studio&debug=true',
    packageName: 'com.example.app'
  });
  assert.strictEqual(launched.ok, true);
  assert.strictEqual(launched.kind, 'launched');
  assert.deepStrictEqual(calls[0].args, [
    '-s', 'emulator-5554', 'shell', 'am', 'start', '-W',
    '-a', 'android.intent.action.VIEW',
    '-d', 'myapp://products/42?source=studio&debug=true',
    'com.example.app'
  ]);

  const unresolved = DeepLinkIntentStudio.parseResult({
    stdout: '',
    stderr: 'Error: Activity not started, unable to resolve Intent { act=android.intent.action.VIEW }',
    errorMessage: 'Command failed'
  });
  assert.strictEqual(unresolved.kind, 'unresolved');
  assert.match(unresolved.summary, /No Activity found/);

  const links = DeepLinkIntentStudio.extractManifestLinks(`
    <intent-filter>
      <data android:scheme="myapp" android:host="products" />
      <data android:host='example.com' android:scheme='https' />
      <data android:scheme="myapp" android:host="products" />
    </intent-filter>
    <intent-filter>
      <data android:scheme="separate" />
      <data android:host="callback" />
    </intent-filter>`);
  assert.deepStrictEqual(links.map(link => link.uri), ['myapp://products', 'myapp://example.com', 'https://products', 'https://example.com', 'separate://callback']);

  const persisted = new Map();
  const storage = {
    get: (key, fallback) => persisted.has(key) ? persisted.get(key) : fallback,
    update: async (key, value) => { persisted.set(key, value); }
  };
  const firstSession = new DeepLinkHistory(storage);
  for (let index = 0; index < 12; index += 1) await firstSession.remember(`myapp://item/${index}`);
  assert.strictEqual(firstSession.list().length, 10, 'history is capped at 10');
  const reloadedSession = new DeepLinkHistory(storage);
  assert.deepStrictEqual(reloadedSession.list(), firstSession.list(), 'history survives a recreated extension session');
  await reloadedSession.remember('myapp://item/5');
  assert.strictEqual(reloadedSession.list()[0], 'myapp://item/5', 'reused links move to the front');

  console.log('Deep Link & Intent Studio tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
