const assert = require('assert');
const { DeepLinkIntentStudio } = require('../out/domain/deep-link-intent-studio');

(async () => {
  console.log('🧪 Testing DeepLinkIntentStudio Push Notifications...');

  const calls = [];
  const studio = new DeepLinkIntentStudio(
    async () => 'adb',
    async (exe, args) => {
      calls.push({ exe, args });
      return { stdout: 'Broadcast completed: result=0', stderr: '' };
    }
  );

  const res = await studio.dispatchPush({
    deviceId: 'emulator-5554',
    packageName: 'com.example.app',
    payload: {
      title: 'Order Delivered',
      body: 'Your coffee is outside!',
      deepLink: 'myapp://orders/42'
    }
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.kind, 'launched');
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0].args, [
    '-s', 'emulator-5554',
    'shell', 'am', 'broadcast',
    '-a', 'com.example.app.NOTIFICATION_RECEIVED',
    '--es', 'title', 'Order Delivered',
    '--es', 'body', 'Your coffee is outside!',
    '--es', 'click_action', 'myapp://orders/42',
    'com.example.app'
  ]);

  console.log('✅ DeepLinkIntentStudio Push Notifications tests passed!');
})();

