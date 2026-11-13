const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { IconSplashStudioService } = require('../out/domain/icon-splash-studio');

console.log('🧪 Testing flutter_native_splash pubspec block replacement...');

function makeProject(pubspec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-splash-'));
  fs.writeFileSync(path.join(root, 'pubspec.yaml'), pubspec, 'utf8');
  return root;
}

// A realistic pubspec where flutter_native_splash is the LAST top-level block
// (the exact shape that triggered "Duplicate mapping key").
const lastBlockPubspec = [
  'name: airflutter',
  'version: 1.0.0+1',
  'dev_dependencies:',
  '  flutter_lints: ^6.0.0',
  '  flutter_native_splash: ^2.4.8',
  '',
  'flutter:',
  '  uses-material-design: true',
  '',
  'flutter_native_splash:',
  '  color: "#493058"',
  '  image: "assets/air_flutter_icon/splash.png"',
  '  android_12:',
  '    image: "assets/air_flutter_icon/splash.png"',
  '    icon_background_color: "#493058"',
  '  web: false',
  '  fullscreen: true',
  ''
].join('\n');

// Same block but followed by another top-level key.
const middleBlockPubspec = lastBlockPubspec.replace(/fullscreen: true\n$/, 'fullscreen: true\n\nsome_other_tool:\n  enabled: false\n');

const scenarios = [
  { label: 'block is last top-level key', pubspec: lastBlockPubspec },
  { label: 'block is followed by another top-level key', pubspec: middleBlockPubspec }
];

let failed = false;
for (const scenario of scenarios) {
  const root = makeProject(scenario.pubspec);
  const service = new IconSplashStudioService();
  const result = service.configureFlutterNativeSplash({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/splash.png',
    backgroundColorHex: '#493058',
    fullscreen: true
  });

  const after = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  const count = (after.match(/^flutter_native_splash:/gm) || []).length;

  try {
    assert.strictEqual(result.ok, true, `[${scenario.label}] config should succeed: ${result.message}`);
    assert.strictEqual(count, 1, `[${scenario.label}] expected exactly one flutter_native_splash block, found ${count}`);
    const parsed = yaml.load(after); // throws on duplicate keys
    assert.strictEqual(parsed.flutter_native_splash.color, '#493058', `[${scenario.label}] color preserved`);
    assert.strictEqual(parsed.flutter_native_splash.fullscreen, true, `[${scenario.label}] fullscreen preserved`);
    assert.ok(parsed.flutter_native_splash.android_12, `[${scenario.label}] android_12 preserved`);
    // Unrelated config must survive.
    assert.ok(parsed.flutter, `[${scenario.label}] flutter section preserved`);
    assert.ok(parsed.dev_dependencies, `[${scenario.label}] dev_dependencies preserved`);
    console.log(`  ✓ ${scenario.label}`);
  } catch (error) {
    failed = true;
    console.error(`  ✗ ${scenario.label}: ${error.message}`);
    console.error('---- resulting pubspec.yaml ----');
    console.error(after);
  }
}

// Replace path must not leave an orphaned block body behind.
{
  const root = makeProject(lastBlockPubspec);
  const service = new IconSplashStudioService();
  service.configureFlutterNativeSplash({
    projectRoot: root,
    imagePath: 'assets/new/splash.png',
    backgroundColorHex: '#FFFFFF',
    fullscreen: false
  });
  const after = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  try {
    assert.ok(!after.includes('#493058'), 'old color value must be fully replaced');
    assert.ok(after.includes('assets/new/splash.png'), 'new image path must be written');
    console.log('  ✓ previous block body is replaced, not orphaned');
  } catch (error) {
    failed = true;
    console.error(`  ✗ orphaned block detection: ${error.message}`);
    console.error(after);
  }
}

// Rasterized adaptive background (PNG image or gradient) must be referenced as an
// asset path, never as a solid color string.
{
  const root = makeProject(lastBlockPubspec);
  const service = new IconSplashStudioService();
  const result = service.configureFlutterLauncherIcons({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/android_legacy.png',
    androidImagePath: 'assets/air_flutter_icon/android_legacy.png',
    iosImagePath: 'assets/air_flutter_icon/ios_icon.png',
    adaptiveForegroundPath: 'assets/air_flutter_icon/android_foreground.png',
    adaptiveBackgroundPath: 'assets/air_flutter_icon/android_background.png',
    adaptiveBackgroundIsRaster: true,
    backgroundColorHex: '#4C6EF5'
  });
  const after = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  try {
    assert.strictEqual(result.ok, true, `launcher icons config should succeed: ${result.message}`);
    const parsed = yaml.load(after);
    assert.strictEqual(
      parsed.flutter_launcher_icons.adaptive_icon_background,
      'assets/air_flutter_icon/android_background.png',
      'raster background references the asset path, not the fallback hex'
    );
    assert.ok(
      !/adaptive_icon_background:\s*"/.test(after) || !after.includes('adaptive_icon_background: "#4C6EF5"'),
      'fallback hex must not leak into adaptive_icon_background'
    );
    console.log('  ✓ gradient/image background resolves to the asset path');
  } catch (error) {
    failed = true;
    console.error(`  ✗ raster adaptive background: ${error.message}`);
    console.error(after);
  }
}

// The flat fallback color still applies when the background is a real solid color.
{  const root = makeProject(lastBlockPubspec);
  const service = new IconSplashStudioService();
  service.configureFlutterLauncherIcons({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/android_legacy.png',
    adaptiveForegroundPath: 'assets/air_flutter_icon/android_foreground.png',
    backgroundColorHex: '#4C6EF5'
  });
  const after = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  try {
    const parsed = yaml.load(after);
    assert.strictEqual(
      parsed.flutter_launcher_icons.adaptive_icon_background,
      '#4C6EF5',
      'solid mode keeps writing the hex color'
    );
    console.log('  ✓ solid background still writes the hex color');
  } catch (error) {
    failed = true;
    console.error(`  ✗ solid adaptive background: ${error.message}`);
    console.error(after);
  }
}

// A splash background image adds `background_image:` while keeping the artwork `image:`.
{
  const root = makeProject(lastBlockPubspec);
  const service = new IconSplashStudioService();
  const result = service.configureFlutterNativeSplash({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/splash.png',
    backgroundColorHex: '#493058',
    fullscreen: true,
    backgroundImagePath: 'assets/air_flutter_icon/splash_background.png'
  });
  const after = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  try {
    assert.strictEqual(result.ok, true, `background splash config should succeed: ${result.message}`);
    const parsed = yaml.load(after);
    assert.strictEqual(
      parsed.flutter_native_splash.background_image,
      'assets/air_flutter_icon/splash_background.png',
      'background_image should be written'
    );
    assert.strictEqual(
      parsed.flutter_native_splash.image,
      'assets/air_flutter_icon/splash.png',
      'foreground image should remain'
    );
    assert.ok(parsed.flutter_native_splash.android_12, 'android_12 block should remain');
    console.log('  ✓ splash background_image is written alongside image');
  } catch (error) {
    failed = true;
    console.error(`  ✗ splash background_image: ${error.message}`);
    console.error(after);
  }
}

// Without a background image, no stale background_image key lingers.
{
  const root = makeProject(lastBlockPubspec);
  const service = new IconSplashStudioService();
  service.configureFlutterNativeSplash({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/splash.png',
    backgroundColorHex: '#493058',
    fullscreen: true,
    backgroundImagePath: 'assets/air_flutter_icon/splash_background.png'
  });
  service.configureFlutterNativeSplash({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/splash.png',
    backgroundColorHex: '#493058',
    fullscreen: true
  });
  const after = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  try {
    const parsed = yaml.load(after);
    assert.strictEqual(parsed.flutter_native_splash.background_image, undefined, 'stale background_image must be removed');
    console.log('  ✓ removing the background image drops the key');
  } catch (error) {
    failed = true;
    console.error(`  ✗ stale background_image: ${error.message}`);
    console.error(after);
  }
}

if (failed) {
  console.error('\n❌ flutter_native_splash replacement test FAILED');
  process.exit(1);
}
console.log('\n✅ flutter_native_splash replacement test passed');
