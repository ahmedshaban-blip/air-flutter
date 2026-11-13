// Verifies the simplified panel navigation: grouped tabs keep the ten-tool
// contract, every tab still switches its view, and the quick-jump field filters
// and selects tools by name and alias.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');

// Stub the vscode module so panelHtml.js can be required under Node.
const stub = path.join(os.tmpdir(), '__af_panel_nav_stub.js');
fs.writeFileSync(stub, 'module.exports = { Uri: { file: (p) => ({ fsPath: p, toString: () => p }) } };');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  if (r === 'vscode') return stub;
  return origResolve.call(this, r, ...a);
};

const { getPanelWebviewContent } = require('../out/controllers/flutter-panel-controller/views/panelHtml');

(async () => {
  console.log('🧪 Testing panel navigation (grouped tabs + quick jump)...');

  const panelMock = { webview: { asWebviewUri: u => 'file:///' + u.fsPath.replace(/\\/g, '/') } };
  let html = getPanelWebviewContent({ extensionPath: repoRoot }, panelMock, '3.1.0');
  html = html.replace(/<script\s+src="file:\/\/\/([^"]+)"([^>]*)><\/script>/g, '');
  html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '');

  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://localhost/' });
  const { window } = dom;
  const document = window.document;

  // Minimal message bridge + the tab logic the panel relies on.
  window.vscode = { postMessage: () => {} };
  window.eval(fs.readFileSync(path.join(repoRoot, 'media', 'modules', 'assetAssistantModule.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(repoRoot, 'media', 'modules', 'panelNavModule.js'), 'utf8'));

  // Mount just the two module prototypes, mirroring air-flutter.js's mixin.
  const app = {};
  [window.AirFlutterAssetAssistantModule, window.AirFlutterPanelNavModule].forEach(Module_ => {
    const proto = Module_.prototype || Module_;
    Object.getOwnPropertyNames(proto).forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
      if (!descriptor) return;
      if (typeof descriptor.value === 'function') {
        app[prop] = descriptor.value.bind(app);
      } else if (descriptor.get) {
        Object.defineProperty(app, prop, {
          get: () => descriptor.get.call(app),
          configurable: true
        });
      }
    });
  });
  // selectPanelTab reaches for helpers from other modules; stub what it touches.
  app.sendMessage = () => {};
  app.scanAssets = () => {};
  app.loadPermissionCatalog = () => {};
  app.setAssetAssistantLoading = () => {};
  document.querySelectorAll('[data-panel-tab]').forEach(button => {
    button.addEventListener('click', () => app.selectPanelTab(button.dataset.panelTab));
  });
  app.initPanelNav();

  // 1. Group structure: every tab lives inside a labelled group.
  const groups = Array.from(document.querySelectorAll('.ff-nav .ff-tab-group'));
  assert.ok(groups.length >= 3, 'Tab strip should be split into labelled groups');
  groups.forEach(group => {
    assert.ok(group.querySelector('.ff-tab-group-label'), 'Each group must carry a label');
    assert.ok(group.querySelectorAll('.ff-tab').length > 0, 'Each group must hold at least one tab');
  });

  // 2. Contract intact: the ten tabs remain, and clicking one reveals its view.
  const tabNames = Array.from(document.querySelectorAll('.ff-tab')).map(b => b.dataset.panelTab);
  const expected = ['workspace', 'device-env', 'ssl-proxy', 'build-runner', 'icon-splash', 'localization', 'assets', 'deep-links', 'permissions', 'cleanup'];
  expected.forEach(name => assert.ok(tabNames.includes(name), `Tab ${name} must exist`));

  expected.forEach(name => {
    const button = document.querySelector(`[data-panel-tab="${name}"]`);
    button.click();
    const view = document.querySelector(`[data-panel-view="${name}"]`);
    assert.ok(view, `View for ${name} must exist`);
    assert.strictEqual(view.hidden, false, `Clicking ${name} must show its view`);
    const visible = Array.from(document.querySelectorAll('[data-panel-view]')).filter(v => !v.hidden);
    assert.strictEqual(visible.length, 1, 'Exactly one view may be visible at a time');
  });

  // 3. Quick jump: filtering by alias finds the right tool, and selecting it
  //    switches the panel without duplicating the tab logic.
  const input = document.getElementById('panelJumpInput');
  const results = document.getElementById('panelJumpResults');
  assert.ok(input && results, 'Jump field and results panel must exist');

  input.value = 'ssl';
  input.dispatchEvent(new window.Event('input'));
  assert.strictEqual(results.hidden, false, 'Typing must open the results panel');
  const sslOption = results.querySelector('[data-jump-tab="ssl-proxy"]');
  assert.ok(sslOption, 'Searching "ssl" must surface SSL & Proxy');

  input.value = 'permission';
  input.dispatchEvent(new window.Event('input'));
  assert.ok(results.querySelector('[data-jump-tab="permissions"]'), 'Searching "permission" must surface Permissions');

  input.value = 'zzzznope';
  input.dispatchEvent(new window.Event('input'));
  assert.ok(results.querySelector('.ff-jump-empty'), 'A query with no match must show an empty state');

  // Selecting via the registry helper drives the same tab contract.
  app.jumpToTool('icon-splash');
  const iconView = document.querySelector('[data-panel-view="icon-splash"]');
  assert.strictEqual(iconView.hidden, false, 'jumpToTool must open the requested tool');
  assert.strictEqual(input.value, '', 'Selecting a tool must clear the jump field');
  assert.strictEqual(results.hidden, true, 'Selecting a tool must close the results panel');

  // 4. Keyboard navigation: ArrowDown/Up move a highlight tracked through
  //    aria-activedescendant, and Enter runs the highlighted option.
  input.focus();
  input.value = 'build';
  input.dispatchEvent(new window.Event('input'));
  assert.strictEqual(input.getAttribute('aria-autocomplete'), 'list', 'Jump input declares list autocomplete');

  const optionEls = () => Array.from(results.querySelectorAll('.ff-jump-option'));
  assert.ok(optionEls().length >= 2, 'Searching "build" must surface more than one option');

  const down = () => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  const up = () => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));

  down();
  const firstId = optionEls()[0].id;
  assert.strictEqual(input.getAttribute('aria-activedescendant'), firstId, 'ArrowDown highlights the first option');
  assert.ok(optionEls()[0].classList.contains('is-active'), 'The highlighted option carries is-active');

  down();
  const secondId = optionEls()[1].id;
  assert.strictEqual(input.getAttribute('aria-activedescendant'), secondId, 'ArrowDown moves to the second option');

  up();
  assert.strictEqual(input.getAttribute('aria-activedescendant'), firstId, 'ArrowUp moves back to the first option');

  up();
  const lastId = optionEls()[optionEls().length - 1].id;
  assert.strictEqual(input.getAttribute('aria-activedescendant'), lastId, 'ArrowUp from the top wraps to the last option');

  // 5. Command deep-link: a command registry entry opens the owning disclosure
  //    and reveals the row (the reachability the collapsed groups depend on).
  input.value = 'apk';
  input.dispatchEvent(new window.Event('input'));
  const apkCommand = results.querySelector('[data-jump-command="buildAPK"]');
  assert.ok(apkCommand, 'Searching "apk" must surface the Build APK command');
  const beforeHidden = document.querySelector('[data-command="buildAPK"]').hidden;
  app.jumpToCommand('buildAPK');
  const buildRow = document.querySelector('[data-command="buildAPK"]');
  assert.ok(buildRow.closest('details') === null || buildRow.closest('details').open, 'The owning group must open for the command');
  assert.strictEqual(input.value, '', 'Selecting a command must clear the jump field');

  // 6. Enter runs the highlighted option (first match when nothing is arrowed).
  input.value = 'localization';
  input.dispatchEvent(new window.Event('input'));
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.strictEqual(document.querySelector('[data-panel-view="localization"]').hidden, false, 'Enter must open the first match');
  input.blur();

  // 7. The tab strip is a single tab stop with arrow-key navigation.
  const tablist = document.querySelector('.ff-tabs');
  const tabs = Array.from(tablist.querySelectorAll('.ff-tab'));
  const tabStops = tabs.filter(t => t.tabIndex === 0);
  assert.strictEqual(tabStops.length, 1, 'Exactly one tab may be in the tab order (roving tabindex)');
  assert.strictEqual(tabStops[0].dataset.panelTab, 'localization', 'The active tab owns the tab stop');

  const tabIndex = tabs.findIndex(t => t.classList.contains('is-active'));
  const arrowRight = () => tablist.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  const expectedAfterRight = tabs[(tabIndex + 1) % tabs.length].dataset.panelTab;
  arrowRight();
  assert.strictEqual(document.activeElement.dataset.panelTab, expectedAfterRight, 'ArrowRight moves to the next tab');
  const newStops = Array.from(tablist.querySelectorAll('.ff-tab')).filter(t => t.tabIndex === 0);
  assert.strictEqual(newStops.length, 1, 'Roving tabindex keeps a single tab stop after arrow navigation');

  tablist.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  assert.strictEqual(document.activeElement.dataset.panelTab, 'workspace', 'Home moves to the first tab');

  console.log('🎉 Panel navigation tests passed: grouped tabs + quick jump.');
})().catch(err => {
  console.error('❌ Panel navigation test failed:', err);
  process.exit(1);
});
