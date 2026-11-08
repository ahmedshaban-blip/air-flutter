const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  AndroidPermissionManager,
  ANDROID_PERMISSION_CATALOG,
  PERMISSION_CATALOG,
  getAllPermissionItems,
  findPermissionByAndroidName,
  findPermissionByIosKey
} = require('../out/domain/android-permission-manager');

(async () => {
  // 1. Verify Catalog Structure & Completeness
  assert.strictEqual(Array.isArray(PERMISSION_CATALOG), true, 'PERMISSION_CATALOG must be an array');
  assert.strictEqual(PERMISSION_CATALOG.length, 12, 'Catalog must contain exactly 12 categories');

  const allItems = getAllPermissionItems();
  assert(allItems.length >= 35, `Catalog must have comprehensive items (found: ${allItems.length})`);

  const itemIds = new Set();
  for (const item of allItems) {
    assert(item.id, 'Every item must have an id');
    assert(!itemIds.has(item.id), `Duplicate permission item id: ${item.id}`);
    itemIds.add(item.id);

    assert(item.displayName, `Item ${item.id} must have a displayName`);
    assert(item.hint && item.hint.trim().length > 10, `Item ${item.id} must have an actionable hint`);

    // Verify adbPermissionName on dangerous Android permissions
    if (item.androidProtectionLevel === 'dangerous') {
      assert(
        item.adbPermissionName && item.adbPermissionName.startsWith('android.permission.'),
        `Dangerous Android permission ${item.id} must have an exact adbPermissionName`
      );
    }

    // Verify flutterPackageRecommendation is populated where applicable
    if (item.flutterPackageRecommendation) {
      assert(Array.isArray(item.flutterPackageRecommendation), `flutterPackageRecommendation for ${item.id} must be an array`);
      assert(item.flutterPackageRecommendation.length > 0, `flutterPackageRecommendation for ${item.id} cannot be empty`);
    }
  }

  // 2. Verify Key Lookups
  const camera = findPermissionByAndroidName('android.permission.CAMERA');
  assert(camera, 'Should find CAMERA by android manifest name');
  assert.strictEqual(camera.iosKey, 'NSCameraUsageDescription');
  assert.strictEqual(camera.platform, 'both');

  const fullCalendarIos = findPermissionByIosKey('NSCalendarsFullAccessUsageDescription');
  assert(fullCalendarIos, 'Should find NSCalendarsFullAccessUsageDescription by iOS key');
  assert.strictEqual(fullCalendarIos.iosMinVersion, '17.0');

  // 3. Verify Backward-compatible ANDROID_PERMISSION_CATALOG
  assert(Array.isArray(ANDROID_PERMISSION_CATALOG), 'ANDROID_PERMISSION_CATALOG must be an array');
  const cameraFromAndroidCatalog = ANDROID_PERMISSION_CATALOG.find(p => p.name === 'android.permission.CAMERA');
  assert(cameraFromAndroidCatalog, 'ANDROID_PERMISSION_CATALOG must contain CAMERA');
  assert.strictEqual(cameraFromAndroidCatalog.label, 'Camera');
  assert.strictEqual(cameraFromAndroidCatalog.protectionLevel, 'dangerous');

  // 4. Test AndroidPermissionManager File Injection & maxSdkVersion Generation
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

  // Inject permissions: one normal, one legacy with maxSdkVersion 29
  const first = await AndroidPermissionManager.inject(project, [
    'android.permission.INTERNET',
    'android.permission.RECORD_AUDIO',
    'android.permission.WRITE_EXTERNAL_STORAGE'
  ]);
  assert.strictEqual(first.changed, true);
  assert.deepStrictEqual(first.addedPermissions, [
    'android.permission.RECORD_AUDIO',
    'android.permission.WRITE_EXTERNAL_STORAGE'
  ]);

  const afterFirstWrite = fs.readFileSync(manifestPath, 'utf8');
  assert.strictEqual((afterFirstWrite.match(/android\.permission\.RECORD_AUDIO/g) || []).length, 1);
  assert(
    afterFirstWrite.includes('<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />'),
    'Should correctly inject android:maxSdkVersion="29" for WRITE_EXTERNAL_STORAGE'
  );

  const modifiedTime = fs.statSync(manifestPath).mtimeMs;
  const second = await AndroidPermissionManager.inject(project, [
    'android.permission.INTERNET',
    'android.permission.RECORD_AUDIO',
    'android.permission.WRITE_EXTERNAL_STORAGE'
  ]);
  assert.strictEqual(second.changed, false);
  assert.strictEqual(fs.readFileSync(manifestPath, 'utf8'), afterFirstWrite);
  assert.strictEqual(fs.statSync(manifestPath).mtimeMs, modifiedTime);

  console.log(`Android permission tests passed. Fixture: ${project}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
