const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { IconSplashStudioService } = require('../out/domain/icon-splash-studio');

console.log('🧪 Testing persisted icon/splash studio state (sidecar)...');

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-state-'));
  fs.writeFileSync(path.join(root, 'pubspec.yaml'), 'name: demo\nversion: 1.0.0+1\n', 'utf8');
  return root;
}

// A valid 1024×1024 PNG (the service validates size on splash writes).
function pngBase64(width, height) {
  const png = Buffer.alloc(32);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(0x0d0a1a0a, 4);
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const service = new IconSplashStudioService();
let failed = false;

// 1. Saving an icon record persists choices + copies the source image.
const root = makeProject();
const foreground = pngBase64(1024, 1024);
service.saveIconRecord(
  root,
  {
    mode: 'native',
    applyAndroid: true,
    applyIos: true,
    backgroundMode: 'gradient',
    backgroundColorHex: '#4C6EF5',
    gradientStops: [{ color: '#4C6EF5', position: 0 }, { color: '#15276F', position: 78 }],
    gradientAngle: 20,
    foregroundImagePath: undefined,
    backgroundImagePath: undefined,
    monochromeImagePath: undefined
  },
  { foregroundBase64: foreground }
);

try {
  const state = service.readState(root);
  assert.ok(state.icon, 'icon record should be persisted');
  assert.strictEqual(state.icon.mode, 'native');
  assert.strictEqual(state.icon.backgroundMode, 'gradient');
  assert.strictEqual(state.icon.gradientAngle, 20);
  assert.strictEqual(state.icon.gradientStops.length, 2);
  assert.strictEqual(state.icon.gradientStops[1].position, 78);
  assert.ok(state.icon.foregroundImagePath, 'source image path should be recorded');
  const stored = service.readStateImage(root, state.icon.foregroundImagePath);
  assert.ok(stored.base64 && stored.bytes > 0, 'source image should be copied to disk');
  assert.ok(state.icon.generatedAt, 'generatedAt timestamp should be set');
  console.log('  ✓ icon record persists choices + source image');
} catch (error) {
  failed = true;
  console.error(`  ✗ icon record: ${error.message}`);
}

// 2. Writing the state adds the ignore rule to .gitignore.
try {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('.air-flutter/icon-splash/'), '.gitignore should ignore stored state images');
  console.log('  ✓ state images are git-ignored');
} catch (error) {
  failed = true;
  console.error(`  ✗ gitignore: ${error.message}`);
}

// 3. Saving a splash record coexists with the icon record.
try {
  service.saveSplashRecord(
    root,
    {
      backgroundColorHex: '#493058',
      fullscreen: true,
      useAppIcon: false,
      splashScale: 60,
      backgroundFit: 'contain',
      artworkImagePath: undefined,
      backgroundImagePath: undefined
    },
    { artworkBase64: pngBase64(1024, 1024), backgroundBase64: pngBase64(1024, 1024) }
  );
  const state = service.readState(root);
  assert.ok(state.icon && state.splash, 'both records should survive');
  assert.strictEqual(state.splash.backgroundFit, 'contain');
  assert.strictEqual(state.splash.splashScale, 60);
  assert.ok(state.splash.backgroundImagePath, 'splash background image should be stored');
  console.log('  ✓ splash record coexists with icon record');
} catch (error) {
  failed = true;
  console.error(`  ✗ splash record: ${error.message}`);
}

// 4. Clearing only the icon keeps the splash.
try {
  service.clearAssetRecord(root, 'icon');
  const state = service.readState(root);
  assert.ok(!state.icon, 'icon record should be cleared');
  assert.ok(state.splash, 'splash record should remain');
  console.log('  ✓ clearing the icon keeps the splash');
} catch (error) {
  failed = true;
  console.error(`  ✗ clear icon: ${error.message}`);
}

// 5. Clearing both empties the state and prunes stored images.
try {
  service.clearAssetRecord(root, 'both');
  const state = service.readState(root);
  assert.ok(!state.icon && !state.splash, 'both records should be cleared');
  const imageDir = path.join(root, '.air-flutter', 'icon-splash');
  const leftovers = fs.existsSync(imageDir) ? fs.readdirSync(imageDir) : [];
  assert.strictEqual(leftovers.length, 0, `stored images should be pruned, found ${leftovers.join(', ')}`);
  console.log('  ✓ clearing both empties the state and prunes images');
} catch (error) {
  failed = true;
  console.error(`  ✗ clear both: ${error.message}`);
}

// 6. A corrupt sidecar degrades to an empty state instead of throwing.
try {
  fs.writeFileSync(path.join(root, '.air-flutter', 'icon-splash-state.json'), '{ not json', 'utf8');
  const state = service.readState(root);
  assert.deepStrictEqual(state, { version: 1 }, 'corrupt state should read as empty');
  console.log('  ✓ corrupt sidecar degrades gracefully');
} catch (error) {
  failed = true;
  console.error(`  ✗ corrupt sidecar: ${error.message}`);
}

if (failed) {
  console.error('\n❌ studio state test FAILED');
  process.exit(1);
}
console.log('\n✅ studio state test passed');
