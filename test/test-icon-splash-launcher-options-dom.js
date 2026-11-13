const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getIconSplashViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/iconSplashViewHtml');

console.log('🧪 Testing "All launcher icon options" panel...');

const dom = new JSDOM(`<body>${getIconSplashViewHtml()}</body>`, { runScripts: 'outside-only' });
const { window } = dom;
window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'iconSplashModule.js'), 'utf8'));

function mixin(targetClass, moduleClass) {
  const proto = moduleClass.prototype || moduleClass;
  for (const prop of Object.getOwnPropertyNames(proto)) {
    if (prop !== 'constructor') targetClass.prototype[prop] = proto[prop];
  }
}
class FakeWebview {}
mixin(FakeWebview, window.AirFlutterIconSplashModule);

const moduleInstance = new FakeWebview();
moduleInstance.sendMessage = () => {};
moduleInstance.showToast = () => {};
moduleInstance.initIconSplash();
const byId = id => window.document.getElementById(id);
const panel = byId('launcherIconsOptionsPanel');
const pathRow = byId('launcherIconsAssetPathRow');

/** Selects a generation mode radio and fires the change event the module listens for. */
function selectMode(mode) {
  const radio = window.document.querySelector(`input[name="iconDeploymentMode"][value="${mode}"]`);
  radio.checked = true;
  radio.dispatchEvent(new window.Event('change', { bubbles: true }));
}

let failed = false;

// 0. Package-only chrome is hidden in the default (native) mode.
try {
  assert.strictEqual(panel.hidden, true, 'options panel is hidden in native mode by default');
  assert.strictEqual(pathRow.hidden, true, 'asset path row is hidden in native mode by default');
  console.log('  ✓ package-only chrome hidden in native mode');
} catch (error) {
  failed = true;
  console.error(`  ✗ native-mode visibility: ${error.message}`);
}

// 1. Selecting Flutter package reveals the panel and the asset path row.
try {
  selectMode('packages');
  assert.strictEqual(panel.hidden, false, 'options panel is revealed in package mode');
  assert.strictEqual(pathRow.hidden, false, 'asset path row is revealed in package mode');
  selectMode('native');
  assert.strictEqual(panel.hidden, true, 'options panel hides again when returning to native');
  assert.strictEqual(pathRow.hidden, true, 'asset path row hides again when returning to native');
  console.log('  ✓ visibility tracks the generation mode radio');
} catch (error) {
  failed = true;
  console.error(`  ✗ mode toggle: ${error.message}`);
}

// Enter package mode for the remaining structural assertions.
selectMode('packages');

// 2. The panel exists, is collapsed by default, and names every group.
try {
  assert.ok(panel, 'options panel must exist');
  assert.strictEqual(panel.open, false, 'panel starts collapsed');
  const groups = [...panel.querySelectorAll('.is-opt-group')].map(g => g.id);
  ['liconOptCore', 'liconOptAdaptive', 'liconOptIos', 'liconOptWeb', 'liconOptWindows', 'liconOptMacos'].forEach(id => {
    assert.ok(groups.includes(id), `group ${id} must exist`);
  });
  console.log('  ✓ panel and all groups present, collapsed by default');
} catch (error) {
  failed = true;
  console.error(`  ✗ panel structure: ${error.message}`);
}

// 2. Every flutter_launcher_icons 0.14.x key has a field.
try {
  const keys = [...panel.querySelectorAll('[data-licon-key]')].map(f => f.dataset.liconKey);
  const expected = [
    'image_path', 'android', 'ios', 'image_path_android', 'image_path_ios', 'min_sdk_android',
    'adaptive_icon_background', 'adaptive_icon_foreground', 'adaptive_icon_foreground_inset', 'adaptive_icon_monochrome',
    'remove_alpha_ios', 'background_color_ios', 'desaturate_tinted_to_grayscale_ios',
    'image_path_ios_dark_transparent', 'image_path_ios_tinted_grayscale',
    'web.generate', 'web.image_path', 'web.background_color', 'web.theme_color',
    'windows.generate', 'windows.image_path', 'windows.icon_size',
    'macos.generate', 'macos.image_path'
  ];
  const missing = expected.filter(key => !keys.includes(key));
  assert.deepStrictEqual(missing, [], `missing fields: ${missing.join(', ')}`);
  console.log(`  ✓ all ${keys.length} launcher icon fields present`);
} catch (error) {
  failed = true;
  console.error(`  ✗ field coverage: ${error.message}`);
}

// 3. An untouched panel collects nothing (no leaks into pubspec).
try {
  const empty = moduleInstance.collectLauncherIconsConfig();
  assert.strictEqual(JSON.stringify(empty), '{}', 'untouched panel collects nothing');
  console.log('  ✓ untouched panel collects an empty config');
} catch (error) {
  failed = true;
  console.error(`  ✗ empty collect: ${error.message}`);
}

// 4. Setting fields collects the right types, including nested platform blocks.
try {
  const set = (key, value) => {
    const field = panel.querySelector(`[data-licon-key="${key}"]`);
    field.value = value;
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const check = (key, checked) => {
    const field = panel.querySelector(`[data-licon-key="${key}"]`);
    field.checked = checked;
    field.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  set('image_path', 'assets/icon/app.png');
  set('min_sdk_android', '24');
  set('adaptive_icon_foreground_inset', '16');
  set('background_color_ios', '#121212');
  check('remove_alpha_ios', true);
  check('web.generate', true);
  set('web.theme_color', '#1E88E5');
  check('windows.generate', true);
  set('windows.icon_size', '256');
  check('macos.generate', true);
  const config = moduleInstance.collectLauncherIconsConfig();
  assert.strictEqual(config.image_path, 'assets/icon/app.png');
  assert.strictEqual(config.min_sdk_android, 24);
  assert.strictEqual(config.adaptive_icon_foreground_inset, 16);
  assert.strictEqual(config.background_color_ios, '#121212');
  assert.strictEqual(config.remove_alpha_ios, true);
  assert.strictEqual(config.web.generate, true);
  assert.strictEqual(config.web.theme_color, '#1E88E5');
  assert.strictEqual(config.windows.generate, true);
  assert.strictEqual(config.windows.icon_size, 256);
  assert.strictEqual(config.macos.generate, true);
  console.log('  ✓ fields collect with correct types and nesting');
} catch (error) {
  failed = true;
  console.error(`  ✗ collect values: ${error.message}`);
}

// 5. The android/ios toggles accept both a boolean and a custom icon name.
try {
  const set = (key, value) => {
    const field = panel.querySelector(`[data-licon-key="${key}"]`);
    field.value = value;
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  set('android', 'false');
  set('ios', 'MyIcon');
  const config = moduleInstance.collectLauncherIconsConfig();
  assert.strictEqual(config.android, false, 'string "false" becomes boolean false');
  assert.strictEqual(config.ios, 'MyIcon', 'a custom name is preserved as a string');
  console.log('  ✓ android/ios toggles accept boolean or custom name');
} catch (error) {
  failed = true;
  console.error(`  ✗ android/ios coercion: ${error.message}`);
}

// 6. A saved config repopulates every field (round-trip through the panel).
try {
  const saved = {
    image_path: 'assets/icon/x.png',
    min_sdk_android: 21,
    remove_alpha_ios: true,
    web: { generate: true, theme_color: '#ABCDEF' },
    windows: { generate: true, icon_size: 128 },
    macos: { generate: true, image_path: 'assets/icon/mac.png' }
  };
  moduleInstance.populateLauncherIconsOptions(saved);
  const collected = moduleInstance.collectLauncherIconsConfig();
  assert.strictEqual(collected.image_path, 'assets/icon/x.png');
  assert.strictEqual(collected.min_sdk_android, 21);
  assert.strictEqual(collected.remove_alpha_ios, true);
  assert.strictEqual(collected.web.generate, true);
  assert.strictEqual(collected.web.theme_color, '#ABCDEF');
  assert.strictEqual(collected.windows.icon_size, 128);
  assert.strictEqual(collected.macos.image_path, 'assets/icon/mac.png');
  assert.notStrictEqual(byId('launcherIconsOptionsCount').textContent, '0 set', 'count reflects populated fields');
  console.log('  ✓ saved config repopulates and round-trips');
} catch (error) {
  failed = true;
  console.error(`  ✗ populate: ${error.message}`);
}

// 7. Restoring a saved package-mode record re-selects the radio and reveals the panel.
try {
  selectMode('native');
  assert.strictEqual(panel.hidden, true, 'starts hidden before hydrate');
  moduleInstance.hydrateIconFromRecord({ mode: 'packages', config: { web: { generate: true } } });
  const packagesRadio = window.document.querySelector('input[name="iconDeploymentMode"][value="packages"]');
  assert.strictEqual(packagesRadio.checked, true, 'radio follows the saved mode');
  assert.strictEqual(panel.hidden, false, 'panel is revealed after hydrating a package record');
  console.log('  ✓ hydrating a package record restores mode and visibility');
} catch (error) {
  failed = true;
  console.error(`  ✗ hydrate mode: ${error.message}`);
}

// 8. Colour text input syncs its picker.
try {
  const text = panel.querySelector('[data-licon-for="web.theme_color"]');
  const picker = panel.querySelector('input[type="color"][data-licon-key="web.theme_color"]');
  text.value = '#123456';
  text.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.strictEqual(picker.value, '#123456', 'text input drives the colour picker');
  console.log('  ✓ colour text and picker stay in sync');
} catch (error) {
  failed = true;
  console.error(`  ✗ colour sync: ${error.message}`);
}

if (failed) {
  console.error('\n❌ launcher icon options panel test FAILED');
  process.exit(1);
}
console.log('\n✅ launcher icon options panel test passed');
