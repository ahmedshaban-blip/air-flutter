const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Module = require('module');
const { JSDOM } = require('jsdom');

const stub = {
  Uri: {
    file: (p) => ({ fsPath: p, toString: () => 'vscode-resource://' + p }),
    joinPath: (base, ...segments) => ({
      fsPath: path.join(base.fsPath || base, ...segments),
      toString: () => 'vscode-resource://' + path.join(base.fsPath || base, ...segments)
    })
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: 'D:/mock/workspace' } }],
    getConfiguration: () => ({ get: (k, d) => d })
  },
  window: {
    showWarningMessage: async () => {},
    showErrorMessage: async () => {},
    showInformationMessage: async () => {}
  }
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  if (r === 'vscode') {
    const stubPath = path.join(require('os').tmpdir(), '__vscode_asset_preview_stub.js');
    fs.writeFileSync(
      stubPath,
      `module.exports = ${JSON.stringify(stub)};\n` +
      `module.exports.Uri.file = (p) => ({ fsPath: p, toString: () => 'vscode-resource://' + p });\n` +
      `module.exports.Uri.joinPath = (base, ...segments) => ({ fsPath: require('path').join(base.fsPath || base, ...segments), toString: () => 'vscode-resource://' + require('path').join(base.fsPath || base, ...segments) });`
    );
    return stubPath;
  }
  return origResolve.call(this, r, ...a);
};

// Require PanelAssetHandler
const { PanelAssetHandler } = require('../out/controllers/flutter-panel-controller/handlers/panelAssetHandler');

// --- Test Suite 1: Backend - localResourceRoots & enrichReport ---
const mockWebview = {
  options: {
    localResourceRoots: [
      { fsPath: path.resolve(__dirname, '../media') }
    ]
  },
  asWebviewUri: (uri) => ({
    toString: () => `vscode-resource://${uri.fsPath.replace(/\\/g, '/')}`
  }),
  postMessage: () => {}
};

const mockPanel = {
  webview: mockWebview
};

const mockCtx = {
  getPanel: () => mockPanel,
  getInitialProjectPath: () => 'D:/mock/flutter_app',
  postStatus: () => {},
  showErrorMessage: () => {},
  showSuccessMessage: () => {},
  openFlutterPanel: async () => {}
};

const handler = new PanelAssetHandler(mockCtx);

const dummyReport = {
  projectPath: 'D:/mock/flutter_app',
  files: [
    {
      path: 'assets/images/logo.png',
      size: 1024,
      kind: 'image',
      warnings: [],
      declared: true,
      used: true,
      usageCount: 1,
      safeToDelete: false,
      variants: [
        { path: 'assets/images/2.0x/logo.png', ratio: '2.0x' }
      ]
    }
  ],
  unusedCount: 0,
  undeclaredCount: 0,
  heavyCount: 0,
  pubspecUpdated: false,
  missingFromPubspec: []
};

// Call enrichReport
handler.enrichReport(dummyReport, 'D:/mock/flutter_app');

// Verification 1: file.previewUri & variant.previewUri must be populated
assert.ok(dummyReport.files[0].previewUri, 'file.previewUri should be populated');
assert.ok(dummyReport.files[0].variants[0].previewUri, 'variant.previewUri should be populated');

// Verification 2: webview.options.localResourceRoots MUST include projectPath
const hasProjectPathInRoots = (mockWebview.options.localResourceRoots || []).some(root => {
  const rootPath = path.resolve(root.fsPath).toLowerCase();
  const pPath = path.resolve('D:/mock/flutter_app').toLowerCase();
  return pPath === rootPath || pPath.startsWith(rootPath + path.sep);
});
assert.strictEqual(hasProjectPathInRoots, true, 'localResourceRoots must include projectPath');

// Verification 3: Calling enrichReport again does not duplicate entries
const countBefore = mockWebview.options.localResourceRoots.length;
handler.enrichReport(dummyReport, 'D:/mock/flutter_app');
assert.strictEqual(mockWebview.options.localResourceRoots.length, countBefore, 'localResourceRoots should not have duplicate entries');

// --- Test Suite 2: Frontend - DOM rendering & fallback icon on load error ---
const html = `
<!DOCTYPE html>
<html>
<body>
  <div id="assetFileTree"></div>
  <div id="assetHoverPopover" hidden></div>
  <div id="assetBulkBar" hidden>
    <span id="assetSelectedCount"></span>
    <span id="assetSelectedSize"></span>
    <button id="bulkDeleteBtn"></button>
    <button id="bulkCompressBtn"></button>
  </div>
  <input type="checkbox" id="assetSelectAllCheckbox" />
</body>
</html>
`;

const dom = new JSDOM(html, { runScripts: 'outside-only' });
const { window } = dom;

const moduleCode = fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'assetAssistantModule.js'), 'utf8');
window.eval(moduleCode);

const instance = new window.AirFlutterAssetAssistantModule();
instance.escapeHtml = s => s;
instance.sendMessage = () => {};
instance.selectedAssetPaths = new Set();
instance.currentFilter = 'all';
instance.searchQuery = '';
instance.currentSort = 'name-asc';
instance.initAssetTreeEvents();

// Render files with image
instance.currentReport = dummyReport;
instance.filterAndRenderTree();

const tree = window.document.getElementById('assetFileTree');
const img = tree.querySelector('.asset-thumbnail-img');
assert.ok(img, 'Image thumbnail element must be present in tree');
assert.strictEqual(img.getAttribute('src'), dummyReport.files[0].previewUri);

// Simulate image load error -> fallback icon must replace broken image
img.dispatchEvent(new window.Event('error', { bubbles: true }));
const fallbackIcon = tree.querySelector('.asset-thumb-icon');
assert.ok(fallbackIcon, 'Fallback icon should be rendered when image fails to load');
assert.strictEqual(img.style.display, 'none', 'Broken image should be hidden');

console.log('All asset preview & localResourceRoots tests passed successfully!');
