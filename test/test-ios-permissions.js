const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  IosPermissionManager,
  IOS_PERMISSION_CATALOG,
  findPermissionByIosKey,
  getPermissionCategories
} = require('../out/domain/android-permission-manager');

(async () => {
  // 1. Verify Catalog Structure & Completeness
  assert.strictEqual(Array.isArray(IOS_PERMISSION_CATALOG), true, 'IOS_PERMISSION_CATALOG must be an array');
  assert(IOS_PERMISSION_CATALOG.length >= 20, `Catalog must have comprehensive items (found: ${IOS_PERMISSION_CATALOG.length})`);

  for (const item of IOS_PERMISSION_CATALOG) {
    assert(item.name && item.name.startsWith('NS'), `iOS permission item ${item.name} must start with NS`);
    assert(item.label, `Item ${item.name} must have a label`);
    assert(item.defaultUsageDescription && item.defaultUsageDescription.length > 10, `Item ${item.name} must have a defaultUsageDescription`);
  }

  // 2. Verify Key Lookup
  const camera = findPermissionByIosKey('NSCameraUsageDescription');
  assert(camera, 'Should find camera by iOS key');
  assert.strictEqual(camera.defaultIosUsageDescription, 'This app requires access to the camera to take photos and scan QR codes.');

  // 3. Verify Categories Filtering
  const iosCats = getPermissionCategories('ios');
  assert(iosCats.length > 0, 'Must return iOS categories');
  assert(iosCats.every(c => c.count > 0), 'Every returned category must have at least 1 permission');

  const androidCats = getPermissionCategories('android');
  assert(androidCats.length > 0, 'Must return Android categories');

  // 4. Test IosPermissionManager Read & Inject
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-ios-permissions-'));
  const plistPath = IosPermissionManager.getPlistPath(project);
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });

  const initialPlist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '\t<key>CFBundleName</key>',
    '\t<string>fixture</string>',
    '\t<key>NSMicrophoneUsageDescription</key>',
    '\t<string>Initial mic description</string>',
    '</dict>',
    '</plist>',
    ''
  ].join('\n');
  fs.writeFileSync(plistPath, initialPlist, 'utf8');

  // Read state
  const state = await IosPermissionManager.read(project);
  assert.deepStrictEqual(state.declaredPermissions, ['CFBundleName', 'NSMicrophoneUsageDescription']);
  assert.strictEqual(state.declaredDescriptions['NSMicrophoneUsageDescription'], 'Initial mic description');

  // Inject new permission
  const injectResult = await IosPermissionManager.inject(project, {
    'NSCameraUsageDescription': 'We need camera to scan QR codes.',
    'NSMicrophoneUsageDescription': 'Should be skipped because already declared'
  });

  assert.strictEqual(injectResult.changed, true);
  assert.deepStrictEqual(injectResult.addedPermissions, ['NSCameraUsageDescription']);

  const updatedPlist = fs.readFileSync(plistPath, 'utf8');
  assert(updatedPlist.includes('<key>NSCameraUsageDescription</key>'), 'Must contain injected camera key');
  assert(updatedPlist.includes('<string>We need camera to scan QR codes.</string>'), 'Must contain injected description');
  assert.strictEqual((updatedPlist.match(/NSMicrophoneUsageDescription/g) || []).length, 1, 'Existing mic key must not be duplicated');

  // No-op inject
  const noopResult = await IosPermissionManager.inject(project, {
    'NSCameraUsageDescription': 'Another camera text'
  });
  assert.strictEqual(noopResult.changed, false);
  assert.strictEqual(noopResult.addedPermissions.length, 0);

  console.log(`iOS permission tests passed. Fixture: ${project}`);
})();

