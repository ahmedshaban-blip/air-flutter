const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { IconSplashStudioService } = require('../out/domain/icon-splash-studio');

console.log('🧪 Testing full flutter_native_splash config writer...');

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-splashcfg-'));
  fs.writeFileSync(path.join(root, 'pubspec.yaml'), 'name: demo\nversion: 1.0.0+1\n', 'utf8');
  return root;
}

const service = new IconSplashStudioService();
let failed = false;

// 1. Every documented general key round-trips into the pubspec block.
try {
  const root = makeProject();
  const config = {
    android: true,
    ios: true,
    web: false,
    color: '#101828',
    color_dark: '#0B0F1A',
    image: 'assets/splash.png',
    image_dark: 'assets/splash_dark.png',
    branding: 'assets/brand.png',
    branding_dark: 'assets/brand_dark.png',
    branding_mode: 'bottomRight',
    branding_bottom_padding: 24,
    fullscreen: true,
    android_gravity: 'bottom',
    ios_content_mode: 'scaleAspectFill',
    web_image_mode: 'cover',
    android_screen_orientation: 'sensorLandscape',
    android_min_sdk: 24,
    info_plist_files: ['ios/Runner/Info-Debug.plist', 'ios/Runner/Info-Release.plist'],
    android_12: {
      color: '#101828',
      color_dark: '#0B0F1A',
      image: 'assets/splash12.png',
      image_dark: 'assets/splash12_dark.png',
      icon_background_color: '#FFFFFF',
      icon_background_color_dark: '#000000',
      branding: 'assets/brand12.png',
      branding_dark: 'assets/brand12_dark.png'
    }
  };
  const result = service.configureSplashConfig(root, config);
  const parsed = yaml.load(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8'));
  assert.strictEqual(result.ok, true, result.message);
  const splash = parsed.flutter_native_splash;
  for (const [key, value] of Object.entries(config)) {
    if (key === 'android_12') continue;
    assert.deepStrictEqual(splash[key], value, `${key} should round-trip`);
  }
  assert.deepStrictEqual(splash.android_12, config.android_12, 'android_12 block should round-trip');
  console.log('  ✓ every general + android_12 key round-trips');
} catch (error) {
  failed = true;
  console.error(`  ✗ general keys: ${error.message}`);
}

// 2. Platform-specific overrides serialize correctly.
try {
  const root = makeProject();
  service.configureSplashConfig(root, {
    color_android: '#111111',
    color_dark_android: '#222222',
    color_ios: '#333333',
    color_dark_ios: '#444444',
    color_web: '#555555',
    color_dark_web: '#666666',
    image_android: 'assets/a.png',
    image_dark_android: 'assets/ad.png',
    image_ios: 'assets/i.png',
    image_dark_ios: 'assets/id.png',
    image_web: 'assets/w.png',
    image_dark_web: 'assets/wd.png',
    background_image_ios: 'assets/bg_ios.png',
    background_image_dark_ios: 'assets/bg_ios_d.png',
    branding_bottom_padding_android: 12,
    branding_bottom_padding_ios: 16
  });
  const parsed = yaml.load(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8')).flutter_native_splash;
  assert.strictEqual(parsed.color_android, '#111111');
  assert.strictEqual(parsed.color_dark_web, '#666666');
  assert.strictEqual(parsed.image_dark_ios, 'assets/id.png');
  assert.strictEqual(parsed.background_image_dark_ios, 'assets/bg_ios_d.png');
  assert.strictEqual(parsed.branding_bottom_padding_ios, 16);
  console.log('  ✓ platform-specific overrides serialize');
} catch (error) {
  failed = true;
  console.error(`  ✗ platform overrides: ${error.message}`);
}

// 3. Undefined keys are never written (no clutter), booleans preserve explicit false.
try {
  const root = makeProject();
  service.configureSplashConfig(root, { color: '#FFFFFF', web: false, fullscreen: false });
  const parsed = yaml.load(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8')).flutter_native_splash;
  assert.deepStrictEqual(Object.keys(parsed).sort(), ['color', 'fullscreen', 'web'], 'only defined keys are written');
  assert.strictEqual(parsed.web, false);
  assert.strictEqual(parsed.fullscreen, false);
  console.log('  ✓ undefined keys omitted, explicit false preserved');
} catch (error) {
  failed = true;
  console.error(`  ✗ minimal output: ${error.message}`);
}

// 4. Re-writing replaces the previous block instead of duplicating it.
try {
  const root = makeProject();
  service.configureSplashConfig(root, { color: '#000000', branding_mode: 'bottomLeft' });
  service.configureSplashConfig(root, { color: '#FFFFFF' });
  const after = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  assert.strictEqual((after.match(/^flutter_native_splash:/gm) || []).length, 1, 'single block only');
  const parsed = yaml.load(after).flutter_native_splash;
  assert.strictEqual(parsed.color, '#FFFFFF');
  assert.strictEqual(parsed.branding_mode, undefined, 'stale keys are dropped on rewrite');
  console.log('  ✓ rewrite replaces the block, drops stale keys');
} catch (error) {
  failed = true;
  console.error(`  ✗ rewrite: ${error.message}`);
}

// 5. prepareSplashStudio merges studio-managed keys over the user config.
try {
  const root = makeProject();
  const png = Buffer.alloc(32);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(0x0d0a1a0a, 4);
  png.writeUInt32BE(1024, 16);
  png.writeUInt32BE(1024, 20);
  const b64 = `data:image/png;base64,${png.toString('base64')}`;
  const result = service.prepareSplashStudio({
    projectRoot: root,
    imageBase64: b64,
    backgroundColorHex: '#493058',
    fullscreen: true,
    config: { color: '#WRONG00', branding: 'assets/b.png', android_gravity: 'top' }
  });
  assert.strictEqual(result.ok, true, result.message);
  const parsed = yaml.load(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8')).flutter_native_splash;
  assert.strictEqual(parsed.color, '#493058', 'managed color overrides user value');
  assert.strictEqual(parsed.image, 'assets/air_flutter_icon/splash.png', 'managed image path is written');
  assert.strictEqual(parsed.branding, 'assets/b.png', 'user branding passes through');
  assert.strictEqual(parsed.android_gravity, 'top', 'user android_gravity passes through');
  assert.strictEqual(parsed.fullscreen, true);
  console.log('  ✓ prepareSplashStudio merges managed keys over user config');
} catch (error) {
  failed = true;
  console.error(`  ✗ managed merge: ${error.message}`);
}

if (failed) {
  console.error('\n❌ full splash config test FAILED');
  process.exit(1);
}
console.log('\n✅ full splash config test passed');
