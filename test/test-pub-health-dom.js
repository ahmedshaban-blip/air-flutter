const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getPubHealthModalHtml } = require('../out/controllers/flutter-panel-controller/views/modals/pubHealthModalHtml');

console.log('🧪 Testing Pub Health Webview DOM & Module...');

const dom = new JSDOM(`<body>${getPubHealthModalHtml()}</body>`, { runScripts: 'outside-only' });
const { window } = dom;

window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'pubHealthModule.js'), 'utf8'));

// Test mixin usage without constructor call (mimics AirFlutterWebview mixinModule)
function mixinModule(targetClass, moduleClass) {
  const proto = moduleClass.prototype || moduleClass;
  for (const prop of Object.getOwnPropertyNames(proto)) {
    if (prop !== 'constructor') targetClass.prototype[prop] = proto[prop];
  }
}
class FakeWebview {}
mixinModule(FakeWebview, window.AirFlutterPubHealthModule);

const moduleInstance = new FakeWebview();
const sentMessages = [];
moduleInstance.sendMessage = (command, payload) => sentMessages.push({ command, payload });
moduleInstance.initPubHealth();

const byId = id => window.document.getElementById(id);

// 1. Initial state
assert.strictEqual(byId('pubHealthModal').hidden, true);
assert.strictEqual(byId('pubTabsBar').hidden, true);

// 2. Open modal and receive success state
moduleInstance.openPubHealthModal({ projectPath: 'D:\\Flutter\\my_app' });
assert.strictEqual(byId('pubHealthModal').hidden, false);
assert.strictEqual(sentMessages[0].command, 'checkPubHealth');

const mockSummary = {
  total: 4,
  upToDateCount: 1,
  upgradableCount: 2,
  majorUpdateCount: 1,
  packages: [
    {
      name: 'flutter_bloc',
      kind: 'direct',
      currentVersion: '8.1.3',
      upgradableVersion: '8.1.6',
      latestVersion: '9.1.1',
      status: 'upgradable'
    },
    {
      name: 'dio',
      kind: 'direct',
      currentVersion: '5.4.0',
      upgradableVersion: '5.4.0',
      latestVersion: '5.9.0',
      status: 'major_update'
    },
    {
      name: 'flutter_lints',
      kind: 'dev',
      currentVersion: '3.0.0',
      upgradableVersion: '3.0.2',
      latestVersion: '3.0.2',
      status: 'upgradable'
    },
    {
      name: 'sqflite_common',
      kind: 'transitive',
      currentVersion: '2.5.14',
      upgradableVersion: '2.5.15',
      latestVersion: '2.5.15',
      status: 'upgradable',
      parentPackages: ['supabase_flutter']
    }
  ]
};

moduleInstance.handlePubHealthState({
  status: 'success',
  summary: mockSummary,
  projectPath: 'D:\\Flutter\\my_app'
});

// Check summary numbers
assert.strictEqual(byId('pubTotalCount').textContent, '4');
assert.strictEqual(byId('pubUpgradableCount').textContent, '2');
assert.strictEqual(byId('pubMajorCount').textContent, '1');

// Check tab badges
assert.strictEqual(byId('pubTabAllCount').textContent, '4');
assert.strictEqual(byId('pubTabDirectCount').textContent, '2');
assert.strictEqual(byId('pubTabDevCount').textContent, '1');
assert.strictEqual(byId('pubTabTransitiveCount').textContent, '1');

// Check rows rendered in All tab
let rows = window.document.querySelectorAll('#pubPackagesTbody tr');
assert.strictEqual(rows.length, 4);

// 3. Tab switching to Direct
const directTab = window.document.querySelector('.pub-tab[data-tab="direct"]');
directTab.click();
rows = window.document.querySelectorAll('#pubPackagesTbody tr');
assert.strictEqual(rows.length, 2);
assert.strictEqual(byId('pubTransitiveBanner').hidden, true);

// 4. Tab switching to Transitive
const transTab = window.document.querySelector('.pub-tab[data-tab="transitive"]');
transTab.click();
rows = window.document.querySelectorAll('#pubPackagesTbody tr');
assert.strictEqual(rows.length, 1);
assert.strictEqual(byId('pubTransitiveBanner').hidden, false);
assert.ok(rows[0].textContent.includes('via'));
assert.ok(rows[0].textContent.includes('supabase_flutter'));

// 5. Switch back to All and test Selection & Batch Update
const allTab = window.document.querySelector('.pub-tab[data-tab="all"]');
allTab.click();

const selectAllCb = byId('pubSelectAllCheckbox');
selectAllCb.checked = true;
selectAllCb.dispatchEvent(new window.Event('change'));

const updateSelectedBtn = byId('pubUpdateSelectedBtn');
assert.strictEqual(updateSelectedBtn.disabled, false);
assert.strictEqual(byId('pubSelectedCount').textContent, '3'); // flutter_bloc, dio, flutter_lints (sqflite_common is transitive, not selectable)

// Click Update Selected -> Since 'dio' is major_update, confirmation modal must appear
updateSelectedBtn.click();
const confirmModal = byId('pubConfirmModal');
assert.strictEqual(confirmModal.hidden, false);
assert.ok(byId('pubConfirmTitle').textContent.includes('Batch Update'));
const confirmList = byId('pubConfirmList');
assert.ok(confirmList.textContent.includes('dio'));

// Click Proceed
byId('pubConfirmProceedBtn').click();
assert.strictEqual(confirmModal.hidden, true);

const lastMsg = sentMessages.at(-1);
assert.strictEqual(lastMsg.command, 'updatePubPackages');
assert.strictEqual(lastMsg.payload.packages.length, 3);

// 6. Test Transitive CLI upgrade button & confirmation
transTab.click();
const transUpgradeBtn = window.document.querySelector('.pub-btn-action-transitive');
assert.ok(transUpgradeBtn);
transUpgradeBtn.click();
assert.strictEqual(confirmModal.hidden, false);
assert.ok(byId('pubConfirmTitle').textContent.includes('Transitive'));

byId('pubConfirmProceedBtn').click();
assert.strictEqual(confirmModal.hidden, true);
const transMsg = sentMessages.at(-1);
assert.strictEqual(transMsg.command, 'upgradeTransitivePubPackage');
assert.strictEqual(transMsg.payload.packageName, 'sqflite_common');

console.log('✅ Pub Health Webview DOM tests passed successfully!');

