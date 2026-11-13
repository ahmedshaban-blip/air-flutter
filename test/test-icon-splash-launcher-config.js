const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { IconSplashStudioService } = require('../out/domain/icon-splash-studio');

console.log('🧪 Testing full flutter_launcher_icons config writer...');

function makeProject(pubspec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'licon-'));
  fs.writeFileSync(path.join(root, 'pubspec.yaml'), pubspec, 'utf8');
  return root;
}
const basePubspec = ['name: demo', 'version: 1.0.0', '', 'dependencies:', '  flutter:', '    sdk: flutter', ''].join('\n');

let failed = false;

// 1. Every key, including web/windows/macos, round-trips into pubspec.yaml.
try {
  const root = makeProject(basePubspec);
  const service = new IconSplashStudioService();
  const result = service.configureFlutterLauncherIcons({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/android_legacy.png',
    androidImagePath: 'assets/air_flutter_icon/android_legacy.png',
    iosImagePath: 'assets/air_flutter_icon/ios_icon.png',
    adaptiveForegroundPath: 'assets/air_flutter_icon/android_foreground.png',
    adaptiveMonochromePath: 'assets/air_flutter_icon/android_monochrome.png',
    backgroundColorHex: '#121212',
    config: {
      min_sdk_android: 24,
      adaptive_icon_foreground_inset: 16,
      remove_alpha_ios: true,
      background_color_ios: '#121212',
      desaturate_tinted_to_grayscale_ios: true,
      image_path_ios_dark_transparent: 'assets/air_flutter_icon/ios_dark.png',
      image_path_ios_tinted_grayscale: 'assets/air_flutter_icon/ios_tinted.png',
      web: { generate: true, background_color: '#121212', theme_color: '#1E88E5' },
      windows: { generate: true, icon_size: 256 },
      macos: { generate: true }
    }
  });
  const parsed = yaml.load(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8')).flutter_launcher_icons;
  assert.strictEqual(result.ok, true, `should succeed: ${result.message}`);
  assert.strictEqual(parsed.min_sdk_android, 24);
  assert.strictEqual(parsed.adaptive_icon_foreground_inset, 16);
  assert.strictEqual(parsed.remove_alpha_ios, true);
  assert.strictEqual(parsed.background_color_ios, '#121212');
  assert.strictEqual(parsed.desaturate_tinted_to_grayscale_ios, true);
  assert.strictEqual(parsed.image_path_ios_dark_transparent, 'assets/air_flutter_icon/ios_dark.png');
  assert.strictEqual(parsed.web.generate, true);
  assert.strictEqual(parsed.web.theme_color, '#1E88E5');
  assert.strictEqual(parsed.windows.generate, true);
  assert.strictEqual(parsed.windows.icon_size, 256);
  assert.strictEqual(parsed.macos.generate, true);
  console.log('  ✓ every global + web/windows/macos key round-trips');
} catch (error) {
  failed = true;
  console.error(`  ✗ full config write: ${error.message}`);
}

// 2. Blank image paths fall back to the studio-generated masters.
try {
  const root = makeProject(basePubspec);
  const service = new IconSplashStudioService();
  service.configureFlutterLauncherIcons({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/android_legacy.png',
    androidImagePath: 'assets/air_flutter_icon/android_legacy.png',
    iosImagePath: 'assets/air_flutter_icon/ios_icon.png',
    adaptiveForegroundPath: 'assets/air_flutter_icon/android_foreground.png',
    backgroundColorHex: '#121212',
    config: { web: { generate: true } }
  });
  const parsed = yaml.load(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8')).flutter_launcher_icons;
  assert.strictEqual(parsed.image_path_android, 'assets/air_flutter_icon/android_legacy.png');
  assert.strictEqual(parsed.image_path_ios, 'assets/air_flutter_icon/ios_icon.png');
  assert.strictEqual(parsed.adaptive_icon_foreground, 'assets/air_flutter_icon/android_foreground.png');
  assert.strictEqual(parsed.adaptive_icon_background, '#121212', 'solid background stays a hex color');
  console.log('  ✓ blank image paths fall back to generated masters');
} catch (error) {
  failed = true;
  console.error(`  ✗ path fallback: ${error.message}`);
}

// 3. A user-supplied image path wins over the studio default.
try {
  const root = makeProject(basePubspec);
  const service = new IconSplashStudioService();
  service.configureFlutterLauncherIcons({
    projectRoot: root,
    imagePath: 'assets/air_flutter_icon/android_legacy.png',
    androidImagePath: 'assets/air_flutter_icon/android_legacy.png',
    backgroundColorHex: '#121212',
    config: { image_path_android: 'assets/icon/mine.png' }
  });
  const parsed = yaml.load(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8')).flutter_launcher_icons;
  assert.strictEqual(parsed.image_path_android, 'assets/icon/mine.png', 'user path is not overwritten');
  console.log('  ✓ user-supplied paths are honored');
} catch (error) {
  failed = true;
  console.error(`  ✗ user path wins: ${error.message}`);
}

// 4. Undefined keys are omitted; a rewrite drops stale keys.
try {
  const root = makeProject(basePubspec);
  const service = new IconSplashStudioService();
  service.configureFlutterLauncherIcons({
    projectRoot: root,
    imagePath: 'assets/a.png',
    backgroundColorHex: '#000000',
    config: { web: { generate: true, theme_color: '#111111' } }
  });
  service.configureFlutterLauncherIcons({
    projectRoot: root,
    imagePath: 'assets/a.png',
    backgroundColorHex: '#000000',
    config: { macos: { generate: true } }
  });
  const after = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  const parsed = yaml.load(after).flutter_launcher_icons;
  assert.strictEqual((after.match(/^flutter_launcher_icons:/gm) || []).length, 1, 'single block only');
  assert.ok(!parsed.web, 'stale web block is removed');
  assert.strictEqual(parsed.macos.generate, true);
  console.log('  ✓ undefined keys omitted and stale keys dropped on rewrite');
} catch (error) {
  failed = true;
  console.error(`  ✗ rewrite: ${error.message}`);
}

if (failed) {
  console.error('\n❌ flutter_launcher_icons config test FAILED');
  process.exit(1);
}
console.log('\n✅ flutter_launcher_icons config test passed');
