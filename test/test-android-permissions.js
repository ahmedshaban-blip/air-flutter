const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AndroidPermissionManager } = require('../out/domain/android-permission-manager');

(async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-permissions-'));
  const manifestPath = AndroidPermissionManager.getManifestPath(project);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const initialXml = [
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <uses-permission android:name="android.permission.INTERNET" />',
    '    <uses-permission android:name=\'android.permission.CAMERA\'/>',
    '    <application android:label="fixture" />',
    '</manifest>',
    ''
  ].join('\n');
  fs.writeFileSync(manifestPath, initialXml);

  const state = await AndroidPermissionManager.read(project);
  assert.deepStrictEqual(state.declaredPermissions, [
    'android.permission.INTERNET',
    'android.permission.CAMERA'
  ]);

  const first = await AndroidPermissionManager.inject(project, [
    'android.permission.INTERNET',
    'android.permission.RECORD_AUDIO',
    'android.permission.RECORD_AUDIO'
  ]);
  assert.strictEqual(first.changed, true);
  assert.deepStrictEqual(first.addedPermissions, ['android.permission.RECORD_AUDIO']);
  const afterFirstWrite = fs.readFileSync(manifestPath, 'utf8');
  assert.strictEqual((afterFirstWrite.match(/android\.permission\.RECORD_AUDIO/g) || []).length, 1);

  const modifiedTime = fs.statSync(manifestPath).mtimeMs;
  const second = await AndroidPermissionManager.inject(project, [
    'android.permission.INTERNET',
    'android.permission.RECORD_AUDIO'
  ]);
  assert.strictEqual(second.changed, false);
  assert.strictEqual(fs.readFileSync(manifestPath, 'utf8'), afterFirstWrite);
  assert.strictEqual(fs.statSync(manifestPath).mtimeMs, modifiedTime);

  console.log(`Android permission tests passed. Fixture: ${project}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
