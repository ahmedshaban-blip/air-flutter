const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 1. Check CSS rules
const assetCss = fs.readFileSync(path.join(__dirname, '..', 'media', 'css', 'asset-assistant.css'), 'utf8');
const themeCss = fs.readFileSync(path.join(__dirname, '..', 'media', 'css', 'theme.css'), 'utf8');

const hasAssetOverlayHiddenRule = /\.asset-modal-overlay\[hidden\]\s*\{[^}]*display:\s*none\s*!important/i.test(assetCss);
assert.strictEqual(hasAssetOverlayHiddenRule, true, 'CSS check failed: media/css/asset-assistant.css must contain .asset-modal-overlay[hidden] { display: none !important; }');

const hasGlobalHiddenRule = /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/i.test(themeCss);
assert.strictEqual(hasGlobalHiddenRule, true, 'CSS check failed: media/css/theme.css must contain [hidden] { display: none !important; }');

// 2. Check DOM events in JSDOM
const html = `
<!DOCTYPE html>
<html>
<body>
  <div id="assetImportModal" class="asset-modal-overlay" hidden>
    <div class="asset-modal-content">
      <div class="asset-modal-head">
        <button type="button" class="asset-modal-close" id="assetImportCloseBtn">&times;</button>
      </div>
      <div class="asset-modal-body">
        <select id="assetImportFolderSelect">
          <option value="assets/images">assets/images</option>
          <option value="assets/icons">assets/icons</option>
        </select>
        <div id="assetImportFileList"></div>
      </div>
      <div class="asset-modal-foot">
        <button type="button" id="assetImportCancelBtn">Cancel</button>
        <button type="button" id="assetImportConfirmBtn">Import & Sync</button>
      </div>
    </div>
  </div>
</body>
</html>
`;

const dom = new JSDOM(html, { runScripts: 'outside-only' });
const { window } = dom;

// Load module code
const moduleCode = fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'assetAssistantModule.js'), 'utf8');
window.eval(moduleCode);

const instance = new window.AirFlutterAssetAssistantModule();
instance.escapeHtml = s => s;
const sentMessages = [];
instance.sendMessage = (cmd, data) => sentMessages.push({ cmd, data });
instance.initImportModal();

const modal = window.document.getElementById('assetImportModal');
const cancelBtn = window.document.getElementById('assetImportCancelBtn');
const closeBtn = window.document.getElementById('assetImportCloseBtn');

// Initially hidden
assert.strictEqual(modal.hidden, true, 'Modal should initially be hidden');

// Open modal
instance.openImportModal([{ name: 'test.png', size: 1024 }]);
assert.strictEqual(modal.hidden, false, 'Modal should be visible after openImportModal');
assert.strictEqual(instance.pendingImportFiles.length, 1);

// Test Cancel button click
cancelBtn.click();
assert.strictEqual(modal.hidden, true, 'Modal should hide when Cancel button clicked');
assert.strictEqual(instance.pendingImportFiles.length, 0);

// Open again and test Close button click
instance.openImportModal([{ name: 'test2.png', size: 2048 }]);
assert.strictEqual(modal.hidden, false);
closeBtn.click();
assert.strictEqual(modal.hidden, true, 'Modal should hide when Close button clicked');
assert.strictEqual(instance.pendingImportFiles.length, 0);

// Open again and test Backdrop click
instance.openImportModal([{ name: 'test3.png', size: 3072 }]);
assert.strictEqual(modal.hidden, false);
modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true, target: modal }));
assert.strictEqual(modal.hidden, true, 'Modal should hide when clicking backdrop overlay');
assert.strictEqual(instance.pendingImportFiles.length, 0);

// Open again and test Escape key
instance.openImportModal([{ name: 'test4.png', size: 4096 }]);
assert.strictEqual(modal.hidden, false);
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
assert.strictEqual(modal.hidden, true, 'Modal should hide when Escape key pressed');
assert.strictEqual(instance.pendingImportFiles.length, 0);

// Verification: Image preview element must be generated for image files in import modal
instance.openImportModal([{ name: 'test-preview.png', size: 1024, type: 'image/png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }]);
const testRow = window.document.querySelector('.asset-import-row');
const testImg = testRow ? testRow.querySelector('.asset-thumbnail-img') : null;
assert.ok(testImg, 'Image thumbnail element must be present in asset import row for image files');
assert.strictEqual(testImg.src.startsWith('data:image/png;base64'), true, 'Image src should be populated with preview data');
assert.strictEqual(testImg.style.display, 'block', 'Image element should be visible');

// Verification: Non-image font file should show font icon
instance.openImportModal([{ name: 'custom-font.ttf', size: 5000 }]);
const fontRow = window.document.querySelector('.asset-import-row');
assert.ok(fontRow.querySelector('.fa-font'), 'Font icon should be present for .ttf file');
assert.strictEqual(fontRow.querySelector('.asset-thumbnail-img'), null, 'Image element should not be created for font file');

// Verification: Dropzone click forwards to file input
const dropZone = window.document.createElement('div');
dropZone.id = 'assetDropZone';
const fileInput = window.document.createElement('input');
fileInput.id = 'assetFileInput';
fileInput.type = 'file';
window.document.body.appendChild(dropZone);
window.document.body.appendChild(fileInput);
let fileInputClicked = false;
fileInput.click = () => { fileInputClicked = true; };
instance.initDragAndDrop();
dropZone.click();
assert.strictEqual(fileInputClicked, true, 'Clicking assetDropZone should trigger fileInput click');

console.log('All tests passed successfully!');
