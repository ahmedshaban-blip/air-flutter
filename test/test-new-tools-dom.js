const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { getStorageInspectorModalHtml } = require('../out/controllers/flutter-panel-controller/views/modals/storageInspectorModalHtml');
const { getDebugOverlaysModalHtml } = require('../out/controllers/flutter-panel-controller/views/modals/debugOverlaysModalHtml');
const { getMockGpsModalHtml } = require('../out/controllers/flutter-panel-controller/views/modals/mockGpsModalHtml');
const { getApkSizeModalHtml } = require('../out/controllers/flutter-panel-controller/views/modals/apkSizeModalHtml');
const { getPubHealthModalHtml } = require('../out/controllers/flutter-panel-controller/views/modals/pubHealthModalHtml');
const { getSidebarWebviewHtml } = require('../out/controllers/sidebar-controller/sidebarHtml');

(async () => {
  console.log('🧪 Testing New Tools DOM and Modules...');

  // 1. Modals DOM
  const modalHtml = `
    <body>
      ${getStorageInspectorModalHtml()}
      ${getDebugOverlaysModalHtml()}
      ${getMockGpsModalHtml()}
      ${getApkSizeModalHtml()}
      ${getPubHealthModalHtml()}
    </body>
  `;

  const dom = new JSDOM(modalHtml, { url: 'http://localhost', runScripts: 'outside-only' });
  const { window } = dom;

  // Load client modules
  window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'storageInspectorModule.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'debugOverlaysModule.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'mockGpsModule.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'apkSizeModule.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'pubHealthModule.js'), 'utf8'));

  const messages = [];
  const toasts = [];
  const fakeBridge = {
    sendMessage: (cmd, payload) => messages.push({ cmd, payload }),
    showToast: (msg, type) => toasts.push({ msg, type })
  };

  // --- Storage Inspector Module ---
  const storageMod = new window.AirFlutterStorageInspectorModule();
  Object.assign(storageMod, fakeBridge);
  storageMod.initStorageInspector();

  assert.ok(window.document.getElementById('storageInspectorModal'));
  assert.ok(window.document.getElementById('storagePackageInput'));
  assert.ok(window.document.getElementById('storageRefreshFilesBtn'));
  assert.ok(window.document.getElementById('storageEditPackageBtn'));

  // Test opening without argument sends host request
  messages.length = 0;
  window.document.getElementById('storagePackageInput').value = '';
  storageMod.openStorageInspectorModal();
  assert.strictEqual(window.document.getElementById('storageInspectorModal').hidden, false);
  assert.strictEqual(messages.some(m => m.cmd === 'openStorageInspectorModal'), true);

  // Test fallback to appStatePackage when available
  storageMod.appStatePackage = 'com.truckworld.store';
  storageMod.openStorageInspectorModal();
  assert.strictEqual(window.document.getElementById('storagePackageInput').value, 'com.truckworld.store');
  assert.strictEqual(window.document.getElementById('storagePkgBadge').hidden, false);

  // Test auto-detected package ID and manual pencil unlock
  storageMod.openStorageInspectorModal({ packageId: 'com.auto.detected', isAutoDetected: true });
  assert.strictEqual(window.document.getElementById('storagePackageInput').value, 'com.auto.detected');
  assert.strictEqual(window.document.getElementById('storagePackageInput').readOnly, true);
  assert.strictEqual(window.document.getElementById('storagePkgBadge').hidden, false);

  window.document.getElementById('storageEditPackageBtn').click();
  assert.strictEqual(window.document.getElementById('storagePackageInput').readOnly, false);
  assert.strictEqual(window.document.getElementById('storagePkgBadge').hidden, true);

  // Test mode radio toggle
  const presetsRadio = window.document.querySelector('input[name="storageModuleMode"][value="presets"]');
  presetsRadio.checked = true;
  presetsRadio.dispatchEvent(new window.Event('change'));
  assert.strictEqual(window.document.getElementById('storagePresetsPanel').hidden, false);

  // Test inspect button click
  window.document.getElementById('storagePackageInput').value = 'com.test.app';
  window.document.getElementById('storageRefreshFilesBtn').click();
  assert.strictEqual(messages.at(-1).cmd, 'storageInspectorListFiles');
  assert.strictEqual(messages.at(-1).payload.packageId, 'com.test.app');

  // Test state transitions
  storageMod.handleStorageInspectorState({ status: 'loading', message: 'Reading...' });
  assert.strictEqual(window.document.getElementById('storageLoadingView').hidden, false);
  assert.strictEqual(window.document.getElementById('storageContentView').hidden, true);

  storageMod.handleStorageInspectorState({
    status: 'success',
    result: {
      packageId: 'com.test.app',
      files: [{ name: 'prefs.xml', relativePath: 'shared_prefs/prefs.xml', category: 'shared_prefs', sizeBytes: 100 }]
    }
  });
  assert.strictEqual(window.document.getElementById('storageContentView').hidden, false);
  assert.strictEqual(window.document.getElementById('storageFileCount').textContent, '1');

  // --- Debug Overlays Module ---
  const overlaysMod = new window.AirFlutterDebugOverlaysModule();
  Object.assign(overlaysMod, fakeBridge);
  overlaysMod.initDebugOverlays();

  assert.ok(window.document.getElementById('debugOverlaysModal'));
  const debugPaintBtn = window.document.querySelector('[data-toggle-overlay="debugPaint"]');
  assert.ok(debugPaintBtn);
  debugPaintBtn.click();
  assert.strictEqual(messages.at(-1).cmd, 'toggleDebugOverlay');
  assert.strictEqual(messages.at(-1).payload.overlay, 'debugPaint');

  // --- Mock GPS Module ---
  const gpsMod = new window.AirFlutterMockGpsModule();
  Object.assign(gpsMod, fakeBridge);
  gpsMod.initMockGps();

  assert.ok(window.document.getElementById('mockGpsModal'));
  const cairoBtn = window.document.querySelector('.gps-preset-btn[data-lat="30.0444"]');
  assert.ok(cairoBtn);
  cairoBtn.click();
  assert.strictEqual(window.document.getElementById('gpsLatInput').value, '30.0444');
  assert.strictEqual(window.document.getElementById('gpsLonInput').value, '31.2357');

  window.document.getElementById('gpsSetLocationBtn').click();
  assert.strictEqual(messages.at(-1).cmd, 'setMockGpsLocation');
  assert.strictEqual(messages.at(-1).payload.lat, 30.0444);

  // Test location save prompt on success
  gpsMod.handleMockGpsState({ status: 'success', result: { message: 'Location set' } });
  const savePrompt = window.document.getElementById('gpsSaveLocationPrompt');
  assert.ok(savePrompt);
  assert.strictEqual(savePrompt.hidden, false);

  window.document.getElementById('gpsCustomLocationName').value = 'Office Test';
  window.document.getElementById('gpsConfirmSaveBtn').click();
  assert.strictEqual(savePrompt.hidden, true);
  assert.ok(window.document.getElementById('gpsCustomPresetsGrid').children.length > 0);

  // Test reset button
  const resetBtn = window.document.getElementById('gpsResetBtn');
  assert.ok(resetBtn);
  resetBtn.click();
  assert.strictEqual(messages.at(-1).cmd, 'resetMockGps');
  assert.strictEqual(window.document.getElementById('gpsLatInput').value, '');

  // --- APK Size Module ---
  const apkMod = new window.AirFlutterApkSizeModule();
  Object.assign(apkMod, fakeBridge);
  apkMod.initApkSize();

  assert.ok(window.document.getElementById('apkSizeModal'));
  assert.ok(window.document.querySelector('.apk-selector-hint'));

  // Test opening without argument sends host request
  messages.length = 0;
  apkMod.openApkSizeModal();
  assert.strictEqual(window.document.getElementById('apkSizeModal').hidden, false);
  assert.strictEqual(messages.some(m => m.cmd === 'openApkSizeModal'), true);
  assert.strictEqual(window.document.getElementById('apkDetectedSelect').options[0].textContent, 'Searching for built packages…');

  // Test empty package list fallback
  apkMod.openApkSizeModal({ defaultApks: [] });
  assert.strictEqual(window.document.getElementById('apkDetectedSelect').options[0].textContent, 'No built packages found in workspace');

  apkMod.openApkSizeModal({ defaultApks: ['/build/app-debug.apk'] });
  assert.strictEqual(window.document.getElementById('apkDetectedSelect').value, '/build/app-debug.apk');
  window.document.getElementById('apkRunAnalyzeBtn').click();
  assert.strictEqual(messages.at(-1).cmd, 'analyzeApkSize');

  // Test report table rendering with column classes & titles
  apkMod.renderApkReport({
    fileName: 'app-debug.apk',
    fileSizeBytes: 1024 * 1024 * 20,
    totalUncompressedBytes: 1024 * 1024 * 25,
    categories: [{ category: 'native_lib', label: 'Native Libs', size: 1000, percentage: 50 }],
    topFiles: [{ path: 'lib/arm64-v8a/libflutter.so', category: 'native_lib', size: 5000, compressedSize: 2000 }]
  });
  const firstRow = window.document.querySelector('#apkTopFilesTbody tr');
  assert.ok(firstRow);
  assert.ok(firstRow.querySelector('.apk-cell-path[title="lib/arm64-v8a/libflutter.so"]'));
  assert.ok(firstRow.querySelector('.apk-cell-cat'));
  assert.ok(firstRow.querySelector('.apk-cell-size'));

  // --- Pub Health Module ---
  const pubMod = new window.AirFlutterPubHealthModule();
  Object.assign(pubMod, fakeBridge);
  pubMod.initPubHealth();

  assert.ok(window.document.getElementById('pubHealthModal'));
  window.document.getElementById('pubHealthCheckBtn').click();
  assert.strictEqual(messages.at(-1).cmd, 'checkPubHealth');
  window.document.getElementById('pubHealthUpgradeBtn').click();
  assert.strictEqual(messages.at(-1).cmd, 'runPubUpgrade');

  // 2. Sidebar DOM
  const fakeWebview = { cspSource: 'vscode-webview:' };
  const fakeUri = { toString: () => 'uri' };
  const sidebarHtml = getSidebarWebviewHtml(fakeWebview, fakeUri, fakeUri, '2.0.3');
  const sidebarDom = new JSDOM(sidebarHtml);
  const sDoc = sidebarDom.window.document;

  assert.ok(sDoc.getElementById('toolMockGps'), 'Sidebar should have toolMockGps');
  assert.ok(sDoc.querySelector('[data-tool-group="overlays"]'), 'Sidebar should have dedicated Flutter Overlays group');
  assert.ok(sDoc.getElementById('toolDebugPaint'), 'Sidebar should have toolDebugPaint');
  assert.ok(sDoc.getElementById('toolPerfOverlay'), 'Sidebar should have toolPerfOverlay');
  assert.ok(sDoc.getElementById('toolSlowMotion'), 'Sidebar should have toolSlowMotion');
  assert.ok(sDoc.getElementById('toolRepaintRainbow'), 'Sidebar should have toolRepaintRainbow');
  assert.ok(sDoc.getElementById('toolOverlaysModal'), 'Sidebar should have toolOverlaysModal');
  assert.ok(sDoc.getElementById('toolApkSize'), 'Sidebar should have toolApkSize');
  assert.ok(sDoc.getElementById('toolPubHealth'), 'Sidebar should have toolPubHealth');
  assert.ok(sDoc.getElementById('toolPushTester'), 'Sidebar should have toolPushTester');
  assert.ok(sDoc.getElementById('inspectStorageBtn'), 'Sidebar should have inspectStorageBtn');

  console.log('✅ New Tools DOM and Modules tests passed!');
})();

