const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const outDir = path.join(repoRoot, 'out');

// Stub vscode module for node execution
const stub = path.join(os.tmpdir(), '__faithful_panel_stub.js');
fs.writeFileSync(stub, 'module.exports = { Uri: { file: (p) => ({ fsPath: p, toString: () => p }) } };');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  if (r === 'vscode') return stub;
  return origResolve.call(this, r, ...a);
};

const { getPanelWebviewContent } = require(path.join(outDir, 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.js'));
const { getSidebarWebviewHtml } = require(path.join(outDir, 'controllers', 'sidebar-controller', 'sidebarHtml.js'));

console.log('--- Phase 1: Verifying Embedded Synchronous CSS in Webviews ---');

// 1. Test Panel Webview Content
const panelMock = { webview: { asWebviewUri: u => 'file:///' + u.fsPath.replace(/\\/g, '/') } };
const panelHtml = getPanelWebviewContent({ extensionPath: repoRoot }, panelMock, '3.0.0');

console.log(`Panel HTML length: ${panelHtml.length} characters`);
const styleMatch = panelHtml.match(/<style id="air-flutter-bundled-css">([\s\S]*?)<\/style>/);
assert.ok(styleMatch, 'FAIL: panelHtml must contain <style id="air-flutter-bundled-css">');

const cssContent = styleMatch[1];
console.log(`Embedded CSS size in panel <head>: ${cssContent.length} characters`);

// Check critical layout & component rules exist synchronously in <head> <style>
assert.ok(cssContent.includes('.ff-shell'), 'Embedded CSS must contain .ff-shell');
assert.ok(cssContent.includes('.ff-masthead'), 'Embedded CSS must contain .ff-masthead');
assert.ok(cssContent.includes('.ff-tab'), 'Embedded CSS must contain .ff-tab');
assert.ok(cssContent.includes('.btn-quiet'), 'Embedded CSS must contain .btn-quiet');
assert.ok(cssContent.includes('.ff-grid'), 'Embedded CSS must contain .ff-grid');
assert.ok(cssContent.includes('.devices-list'), 'Embedded CSS must contain .devices-list');

// 2. Test Sidebar Webview Content
const sidebarMock = { cspSource: 'vscode-webview-resource:' };
const sidebarHtml = getSidebarWebviewHtml(sidebarMock, 'file:///sidebar.css', 'file:///sidebar.js', '3.0.0', repoRoot);

console.log(`Sidebar HTML length: ${sidebarHtml.length} characters`);
const sidebarStyleMatch = sidebarHtml.match(/<style id="air-flutter-sidebar-critical-styles">([\s\S]*?)<\/style>/);
assert.ok(sidebarStyleMatch, 'FAIL: sidebarHtml must contain <style id="air-flutter-sidebar-critical-styles">');

const sidebarCssContent = sidebarStyleMatch[1];
console.log(`Embedded CSS size in sidebar <head>: ${sidebarCssContent.length} characters`);
assert.ok(sidebarCssContent.includes('.sf-card'), 'Sidebar embedded CSS must contain .sf-card');
assert.ok(sidebarCssContent.includes('.sf-primary'), 'Sidebar embedded CSS must contain .sf-primary');

// 3. JSDOM render test: Verify that upon synchronous parsing (zero network), buttons have class definitions
const dom = new JSDOM(panelHtml, { pretendToBeVisual: true });
const doc = dom.window.document;
const btn = doc.querySelector('.btn-quiet');
assert.ok(btn, 'DOM must render .btn-quiet element');
const tab = doc.querySelector('.ff-tab');
assert.ok(tab, 'DOM must render .ff-tab element');

console.log('✅ PASS: All Webview synchronous CSS embedding tests passed with zero FOUC!');
