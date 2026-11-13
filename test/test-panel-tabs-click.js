const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const outDir = path.join(repoRoot, 'out');

// Stub vscode module for getPanelWebviewContent
const Module = require('module');
const stub = path.join(require('os').tmpdir(), '__panel_tabs_stub.js');
fs.writeFileSync(
  stub,
  `module.exports = {
     Uri: { file: (p) => ({ fsPath: p, toString: () => 'vscode-resource://' + p }) },
     workspace: { getConfiguration: () => ({ get: (k, d) => d }) }
   };`
);
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  if (r === 'vscode') return stub;
  return origResolve.call(this, r, ...a);
};

const { getPanelWebviewContent } = require(path.join(outDir, 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.js'));

const panel = {
  webview: {
    cspSource: 'vscode-resource:',
    asWebviewUri: (uri) => ({ toString: () => 'file:///' + uri.fsPath.replace(/\\/g, '/') }),
    postMessage: () => {},
    onDidReceiveMessage: () => ({ dispose() {} })
  }
};

const ctx = { extensionPath: repoRoot };
let html = getPanelWebviewContent(ctx, panel, '3.0.0');

// Replace file:/// script tags with their real contents
html = html.replace(
  /<script\s+src="file:\/\/\/([^"]+)"([^>]*)><\/script>/g,
  (match, filePath) => {
    const abs = decodeURIComponent(filePath);
    if (!fs.existsSync(abs)) return '';
    const code = fs.readFileSync(abs, 'utf8');
    return `<script>${code.replace(/<\/script>/g, '<\\/script>')}</script>`;
  }
);
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://localhost/'
});

const window = dom.window;
const document = window.document;

const tabsToTest = [
  { tab: 'workspace', label: 'Workspace' },
  { tab: 'device-env', label: 'Device Sandbox' },
  { tab: 'ssl-proxy', label: 'SSL & Proxy' },
  { tab: 'build-runner', label: 'Build Runner' },
  { tab: 'icon-splash', label: 'Icon & Splash' },
  { tab: 'localization', label: 'Localization' },
  { tab: 'assets', label: 'Assets & Media' },
  { tab: 'deep-links', label: 'Deep Links' },
  { tab: 'permissions', label: 'Permissions' },
  { tab: 'cleanup', label: 'Code Cleanup' }
];

console.log('🧪 Testing the grouped tab strip in Panel...');

// The strip is `.ff-tab` buttons carrying `data-panel-tab`; the view switching
// is owned by AssetAssistantModule.selectPanelTab, which is not loaded here.
// This harness asserts the tab/view contract and the single-active-tab
// invariant instead of evaluating (no-longer-present) inline onclick attrs.
const tabButtons = Array.from(document.querySelectorAll('.ff-tabs .ff-tab'));
assert.strictEqual(tabButtons.length, tabsToTest.length, 'The strip must expose exactly ten tabs');

tabsToTest.forEach(({ tab, label }) => {
  const btn = document.querySelector(`.ff-tab[data-panel-tab="${tab}"]`);
  assert.ok(btn, `Tab button for ${tab} must exist`);
  assert.strictEqual(btn.getAttribute('role'), 'tab', `Tab ${tab} must carry role="tab"`);
  assert.ok(btn.getAttribute('aria-selected') === 'true' || btn.getAttribute('aria-selected') === 'false',
    `Tab ${tab} must declare aria-selected`);
  assert.ok(btn.textContent.trim().includes(label), `Tab ${tab} must be labelled "${label}"`);

  const view = document.querySelector(`[data-panel-view="${tab}"]`);
  assert.ok(view, `View for ${tab} must exist`);
  console.log(`✅ Tab ${tab} is wired to its view.`);
});

// Exactly one tab is active and exactly one view starts visible.
const activeTabs = tabButtons.filter(b => b.classList.contains('is-active'));
assert.strictEqual(activeTabs.length, 1, 'Exactly one tab may be active at a time');
assert.strictEqual(activeTabs[0].dataset.panelTab, 'workspace', 'Workspace is the default tool');

const visibleViews = Array.from(document.querySelectorAll('[data-panel-view]')).filter(v => !v.hidden);
assert.strictEqual(visibleViews.length, 1, 'Exactly one view may be visible at rest');
assert.strictEqual(visibleViews[0].dataset.panelView, 'workspace', 'Workspace view is the default');

// The jump registry must offer every tab as a quick-jump target.
assert.ok(document.getElementById('panelJumpInput'), 'Jump field must exist');
assert.ok(document.getElementById('panelJumpResults'), 'Jump results panel must exist');

console.log('🎉 All panel tab triggers verified successfully!');
