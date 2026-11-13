const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getIconSplashViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/iconSplashViewHtml');

console.log('🧪 Testing "All splash options" panel...');

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
const panel = byId('splashOptionsPanel');

let failed = false;

// 1. The panel exists, is collapsed by default, and names every group.
try {
  assert.ok(panel, 'options panel must exist');
  assert.strictEqual(panel.open, false, 'panel starts collapsed');
  const groups = [...panel.querySelectorAll('.is-opt-group')].map(g => g.id);
  ['splashOptGeneral', 'splashOptBranding', 'splashOptAlignment', 'splashOptPlatform', 'splashOptAndroid12', 'splashOptPlatforms'].forEach(id => {
    assert.ok(groups.includes(id), `group ${id} must exist`);
  });
  console.log('  ✓ panel and all groups present, collapsed by default');
} catch (error) {
  failed = true;
  console.error(`  ✗ panel structure: ${error.message}`);
}

// 2. Every documented key has a field.
try {
  const keys = [...panel.querySelectorAll('[data-splash-key]')].map(f => f.dataset.splashKey);
  const expected = [
    'color_dark', 'background_image_dark', 'image_dark',
    'branding', 'branding_dark', 'branding_mode', 'branding_bottom_padding', 'branding_bottom_padding_android', 'branding_bottom_padding_ios',
    'android_gravity', 'ios_content_mode', 'web_image_mode', 'android_screen_orientation', 'android_min_sdk', 'info_plist_files',
    'color_android', 'color_dark_android', 'color_ios', 'color_dark_ios', 'color_web', 'color_dark_web',
    'background_image_android', 'background_image_dark_android', 'background_image_ios', 'background_image_dark_ios', 'background_image_web', 'background_image_dark_web',
    'image_android', 'image_dark_android', 'image_ios', 'image_dark_ios', 'image_web', 'image_dark_web',
    'branding_android', 'branding_dark_android', 'branding_ios', 'branding_dark_ios', 'branding_web', 'branding_dark_web',
    'android_12.color', 'android_12.color_dark', 'android_12.image', 'android_12.image_dark',
    'android_12.icon_background_color', 'android_12.icon_background_color_dark', 'android_12.branding', 'android_12.branding_dark',
    'android', 'ios', 'web'
  ];
  const missing = expected.filter(key => !keys.includes(key));
  assert.deepStrictEqual(missing, [], `missing fields: ${missing.join(', ')}`);
  console.log(`  ✓ all ${keys.length} option fields present`);
} catch (error) {
  failed = true;
  console.error(`  ✗ field coverage: ${error.message}`);
}

// 3. collectSplashConfig omits untouched blanks; only default-on platform toggles remain.
try {
  const empty = moduleInstance.collectSplashConfig();
  assert.strictEqual(JSON.stringify(empty), JSON.stringify({ android: true, ios: true }), 'only default-on platform toggles are present');
  console.log('  ✓ untouched panel collects only the default platform toggles');
} catch (error) {
  failed = true;
  console.error(`  ✗ empty collect: ${error.message}`);
}

// 4. Setting fields collects the right types, including nested android_12.
try {
  const set = (key, value) => {
    const field = panel.querySelector(`[data-splash-key="${key}"]`);
    field.value = value;
    field.dispatchEvent(new window.Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  };
  const check = (key, checked) => {
    const field = panel.querySelector(`[data-splash-key="${key}"]`);
    field.checked = checked;
    field.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  set('branding', 'assets/brand.png');
  set('branding_bottom_padding', '24');
  set('branding_mode', 'bottomRight');
  set('android_min_sdk', '24');
  set('info_plist_files', 'ios/Runner/Info-Debug.plist\nios/Runner/Info-Release.plist');
  set('color_dark', '#0B0F1A');
  check('web', true);
  set('android_12.icon_background_color', '#111111');
  const config = moduleInstance.collectSplashConfig();
  assert.strictEqual(config.branding, 'assets/brand.png');
  assert.strictEqual(config.branding_bottom_padding, 24);
  assert.strictEqual(config.branding_mode, 'bottomRight');
  assert.strictEqual(config.android_min_sdk, 24);
  assert.strictEqual((config.info_plist_files || []).join(','), 'ios/Runner/Info-Debug.plist,ios/Runner/Info-Release.plist');
  assert.strictEqual(config.color_dark, '#0B0F1A');
  assert.strictEqual(config.web, true);
  assert.strictEqual(config.android_12.icon_background_color, '#111111');
  console.log('  ✓ fields collect with correct types and nesting');
} catch (error) {
  failed = true;
  console.error(`  ✗ collect values: ${error.message}`);
}

// 5. A saved config repopulates every field (round-trip through the panel).
try {
  const saved = {
    branding: 'assets/x.png',
    branding_mode: 'bottomLeft',
    android_min_sdk: 21,
    info_plist_files: ['ios/A.plist'],
    android: true,
    android_12: { image: 'assets/a12.png', icon_background_color: '#222222' }
  };
  moduleInstance.populateSplashOptions(saved);
  const collected = moduleInstance.collectSplashConfig();
  assert.strictEqual(collected.branding, 'assets/x.png');
  assert.strictEqual(collected.branding_mode, 'bottomLeft');
  assert.strictEqual(collected.android_min_sdk, 21);
  assert.strictEqual((collected.info_plist_files || []).join(','), 'ios/A.plist');
  assert.strictEqual(collected.android, true);
  assert.strictEqual(collected.android_12.image, 'assets/a12.png');
  assert.strictEqual(collected.android_12.icon_background_color, '#222222');
  assert.notStrictEqual(byId('splashOptionsCount').textContent, '0 set', 'count reflects populated fields');
  console.log('  ✓ saved config repopulates and round-trips');
} catch (error) {
  failed = true;
  console.error(`  ✗ populate: ${error.message}`);
}

// 6. Colour text input syncs its picker.
try {
  const text = panel.querySelector('[data-splash-for="color_dark"]');
  const picker = panel.querySelector('input[type="color"][data-splash-key="color_dark"]');
  text.value = '#ABCDEF';
  text.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.strictEqual(picker.value, '#abcdef', 'text input drives the colour picker');
  console.log('  ✓ colour text and picker stay in sync');
} catch (error) {
  failed = true;
  console.error(`  ✗ colour sync: ${error.message}`);
}

if (failed) {
  console.error('\n❌ splash options panel test FAILED');
  process.exit(1);
}
console.log('\n✅ splash options panel test passed');
