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
  { cmd: 'buildRunnerTab', tab: 'build-runner' },
  { cmd: 'iconSplashTab', tab: 'icon-splash' },
  { cmd: 'deviceEnvTab', tab: 'device-env' },
  { cmd: 'localizationTab', tab: 'localization' },
  { cmd: 'sslDoctorTab', tab: 'ssl-proxy' }
];

console.log('🧪 Testing click on Tools grid buttons in Panel...');

tabsToTest.forEach(({ cmd, tab }) => {
  const btn = document.querySelector(`button[data-command="${cmd}"]`);
  assert.ok(btn, `Button for ${cmd} must exist`);
  const onclick = btn.getAttribute('onclick');
  console.log(`Checking button ${cmd}: onclick="${onclick}"`);

  // Try to evaluate the onclick attribute in window context
  let errorCaught = null;
  try {
    window.eval(onclick);
  } catch (err) {
    errorCaught = err;
  }

  if (errorCaught) {
    console.error(`❌ Evaluation of onclick="${onclick}" threw:`, errorCaught.message);
    throw errorCaught;
  } else {
    // Check if the tab view is now visible (hidden === false)
    const view = document.querySelector(`[data-panel-view="${tab}"]`);
    assert.ok(view, `View for ${tab} must exist`);
    assert.strictEqual(view.hidden, false, `View for ${tab} should be visible (hidden: false)`);
    console.log(`✅ Tab ${tab} opened successfully!`);
  }
});

console.log('🧪 Testing click on Shortcuts rail buttons in Panel...');

tabsToTest.forEach(({ tab }) => {
  const railBtns = Array.from(document.querySelectorAll(`button.rail-item`));
  const btn = railBtns.find(b => b.getAttribute('onclick')?.includes(`'${tab}'`));
  assert.ok(btn, `Rail button for ${tab} must exist`);
  const onclick = btn.getAttribute('onclick');
  console.log(`Checking rail button ${tab}: onclick="${onclick}"`);

  let errorCaught = null;
  try {
    window.eval(onclick);
  } catch (err) {
    errorCaught = err;
  }

  if (errorCaught) {
    console.error(`❌ Evaluation of rail onclick="${onclick}" threw:`, errorCaught.message);
    throw errorCaught;
  } else {
    const view = document.querySelector(`[data-panel-view="${tab}"]`);
    assert.ok(view, `View for ${tab} must exist`);
    assert.strictEqual(view.hidden, false, `View for ${tab} should be visible (hidden: false)`);
    console.log(`✅ Rail Tab ${tab} opened successfully!`);
  }
});

console.log('🎉 All panel tab triggers verified successfully!');
