const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getIconSplashViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/iconSplashViewHtml');

console.log('🧪 Testing "Your current assets" cards...');

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
const sentMessages = [];
moduleInstance.sendMessage = (command, payload) => sentMessages.push({ command, payload });
moduleInstance.showToast = () => {};
moduleInstance.initIconSplash();
const byId = id => window.document.getElementById(id);

let failed = false;

// 1. Empty state hides the section entirely.
try {
  assert.strictEqual(byId('iconSplashCurrentAssets').hidden, true, 'section hidden with no assets');
  assert.strictEqual(byId('currentAssetsEmpty').hidden, false, 'empty hint visible with no assets');
  console.log('  ✓ empty state hides the section');
} catch (error) {
  failed = true;
  console.error(`  ✗ empty state: ${error.message}`);
}

// 2. Receiving a project-info payload with saved assets renders both cards.
try {
  moduleInstance.handleIconStudioProjectInfo({
    appName: 'demo',
    latestBackupPath: '/tmp/backup',
    savedIcon: {
      mode: 'native',
      applyAndroid: true,
      applyIos: true,
      backgroundMode: 'gradient',
      backgroundColorHex: '#4C6EF5',
      gradientStops: [{ color: '#4C6EF5', position: 0 }, { color: '#15276F', position: 78 }],
      gradientAngle: 20,
      foregroundDataUrl: 'data:image/png;base64,AAAA',
      generatedAt: new Date('2026-01-02T10:00:00Z').toISOString()
    },
    savedSplash: {
      backgroundColorHex: '#493058',
      fullscreen: true,
      useAppIcon: true,
      splashScale: 45,
      backgroundFit: 'cover',
      generatedAt: new Date('2026-01-02T10:05:00Z').toISOString()
    }
  });
  assert.strictEqual(byId('iconSplashCurrentAssets').hidden, false, 'section shows with assets');
  const cards = byId('currentAssetsGrid').querySelectorAll('.is-current-card');
  assert.strictEqual(cards.length, 2, 'two asset cards render');
  assert.strictEqual(cards[0].dataset.asset, 'icon');
  assert.strictEqual(cards[1].dataset.asset, 'splash');
  const iconText = cards[0].textContent;
  assert.ok(iconText.includes('Gradient 2 stops @ 20°'), 'icon card shows gradient choices');
  assert.ok(cards[1].textContent.includes('Fullscreen'), 'splash card shows fullscreen choice');
  console.log('  ✓ project info renders both asset cards');
} catch (error) {
  failed = true;
  console.error(`  ✗ card render: ${error.message}`);
}

// 3. Delete buttons send the right command per asset.
try {
  sentMessages.length = 0;
  byId('currentAssetsGrid').querySelector('.is-current-card[data-asset="icon"] [data-asset-action="delete"]').click();
  assert.strictEqual(sentMessages.at(-1).command, 'deleteIconSplashAsset');
  assert.strictEqual(sentMessages.at(-1).payload.asset, 'icon');
  byId('deleteBothAssetsBtn').click();
  assert.strictEqual(sentMessages.at(-1).command, 'deleteIconSplashAsset');
  assert.strictEqual(sentMessages.at(-1).payload.asset, 'both');
  console.log('  ✓ delete actions send the correct asset scope');
} catch (error) {
  failed = true;
  console.error(`  ✗ delete actions: ${error.message}`);
}

// 4. Edit hydrates the live studio from the saved record (gradient path).
try {
  byId('currentAssetsGrid').querySelector('.is-current-card[data-asset="icon"] [data-asset-action="edit"]').click();
  assert.strictEqual(moduleInstance.iconStudioState.backgroundMode, 'gradient', 'gradient mode restored');
  assert.strictEqual(moduleInstance.iconStudioState.gradientAngle, 20, 'gradient angle restored');
  assert.strictEqual(moduleInstance.iconStudioState.gradientStops.length, 2, 'gradient stops restored');
  assert.strictEqual(moduleInstance.iconStudioState.gradientStops[1].position, 78);
  console.log('  ✓ edit hydrates the icon studio');
} catch (error) {
  failed = true;
  console.error(`  ✗ edit hydrate: ${error.message}`);
}

// 5. A deletion result repaints the cards from the fresh payload.
try {
  moduleInstance.handleIconSplashDeleted({
    success: true,
    asset: 'icon',
    message: 'Deleted icon assets.',
    savedIcon: undefined,
    savedSplash: {
      backgroundColorHex: '#493058',
      fullscreen: true,
      useAppIcon: true,
      splashScale: 45,
      backgroundFit: 'cover',
      generatedAt: new Date().toISOString()
    }
  });
  const cards = byId('currentAssetsGrid').querySelectorAll('.is-current-card');
  assert.strictEqual(cards.length, 1, 'only the splash card remains after deleting the icon');
  assert.strictEqual(cards[0].dataset.asset, 'splash');
  console.log('  ✓ deletion repaints the assets section');
} catch (error) {
  failed = true;
  console.error(`  ✗ deletion repaint: ${error.message}`);
}

// 6. Clearing everything hides the section again.
try {
  moduleInstance.handleIconSplashDeleted({ success: true, asset: 'both', message: 'Deleted both.', savedIcon: undefined, savedSplash: undefined });
  assert.strictEqual(byId('iconSplashCurrentAssets').hidden, true, 'section hides when both assets are gone');
  assert.strictEqual(byId('currentAssetsEmpty').hidden, false);
  console.log('  ✓ clearing both hides the section');
} catch (error) {
  failed = true;
  console.error(`  ✗ clear both: ${error.message}`);
}

if (failed) {
  console.error('\n❌ current assets DOM test FAILED');
  process.exit(1);
}
console.log('\n✅ current assets DOM test passed');
