// Verifies the sidebar's tool filter: one field narrows all sidebar tools by name,
// note and category; matches auto-expand, empty groups hide, and Escape clears.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');

// Stub vscode so sidebarHtml.js can be required under Node.
const stub = path.join(os.tmpdir(), '__af_sidebar_filter_stub.js');
fs.writeFileSync(stub, 'module.exports = { Uri: { file: (p) => ({ fsPath: p, toString: () => p }) } };');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  if (r === 'vscode') return stub;
  return origResolve.call(this, r, ...a);
};

const { getSidebarWebviewHtml } = require('../out/controllers/sidebar-controller/sidebarHtml');

console.log('🧪 Testing sidebar tool filter...');

const fakeWebview = { cspSource: 'vscode-webview:' };
const fakeUri = { toString: () => 'uri' };
const html = getSidebarWebviewHtml(fakeWebview, fakeUri, fakeUri, '3.1.0', repoRoot);

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const document = window.document;

// Minimal host API for the sidebar boot.
window.acquireVsCodeApi = () => ({ postMessage: () => {}, getState: () => ({}), setState: () => {} });
window.eval(fs.readFileSync(path.join(repoRoot, 'media', 'sidebar.js'), 'utf8'));

const input = document.getElementById('toolFilterInput');
const clearBtn = document.getElementById('toolFilterClearBtn');
const hint = document.getElementById('toolsCountHint');
assert.ok(input && clearBtn && hint, 'Filter field, clear button and count hint must exist');

const allGroups = () => Array.from(document.querySelectorAll('[data-tool-group]'));
const visibleTools = () => Array.from(document.querySelectorAll('[data-tool-group] .sf-tool')).filter(t => !t.hidden);

// 1. Rest state: all 27 grouped tools visible, hint names the full count.
assert.strictEqual(visibleTools().length, 27, 'All 27 grouped tools should show at rest');
assert.strictEqual(hint.textContent, '27 tools', 'Hint should report 27 tools at rest');

// 2. Filtering by name narrows the list and auto-expands matching groups.
input.value = 'mirror';
input.dispatchEvent(new window.Event('input'));
const mirrorMatches = visibleTools();
assert.ok(mirrorMatches.length > 0 && mirrorMatches.length < 27, 'A query must narrow the list');
assert.ok(
  mirrorMatches.every(t => /mirror/i.test(t.closest('[data-tool-group]').textContent)),
  'Every visible tool must sit in a group that matches the query'
);
assert.ok(/match/.test(hint.textContent), 'Hint should switch to a match count');
assert.ok(!clearBtn.hidden, 'Clear button should appear once filtering');

// 3. Filtering by category keyword reaches tools that do not contain the word in their name.
input.value = 'build';
input.dispatchEvent(new window.Event('input'));
const buildMatches = visibleTools();
assert.ok(buildMatches.some(t => t.id === 'toolApkSize'), '"build" should reach Size Analyzer via its note');

// 4. No match: every group hides and the count reads zero.
input.value = 'zzzznope';
input.dispatchEvent(new window.Event('input'));
assert.strictEqual(visibleTools().length, 0, 'A no-match query hides every tool');
allGroups().forEach(group => assert.strictEqual(group.hidden, true, 'Empty groups hide when filtering'));

// 5. Escape clears the filter and restores the full list.
input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.strictEqual(input.value, '', 'Escape must clear the field');
assert.strictEqual(visibleTools().length, 27, 'Clearing must restore all 27 tools');
assert.strictEqual(hint.textContent, '27 tools', 'Hint must return to the full count');

// 6. Clear button also restores.
input.value = 'ssl';
input.dispatchEvent(new window.Event('input'));
clearBtn.click();
assert.strictEqual(visibleTools().length, 27, 'Clear button must restore all tools');

console.log('🎉 Sidebar tool filter tests passed.');
