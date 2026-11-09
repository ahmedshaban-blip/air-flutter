const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const {
  ANDROID_PERMISSION_CATALOG,
  IOS_PERMISSION_CATALOG,
  getPermissionCategories
} = require('../out/domain/android-permission-manager');

const repoRoot = path.join(__dirname, '..');
const moduleSrc = fs.readFileSync(path.join(repoRoot, 'media', 'modules', 'permissionManagerModule.js'), 'utf8');

const html = `<!DOCTYPE html><html><body>
  <div class="permission-manager-layout">
    <div class="ff-section">
      <h2 id="permissionHeading">Android Permissions</h2>
      <span class="ff-section-note" id="permissionTargetBadge">AndroidManifest.xml</span>
      <div class="permission-platform-tabs" role="tablist">
        <button class="permission-platform-tab is-active" id="permPlatformAndroidBtn" type="button" data-perm-platform="android">Android</button>
        <button class="permission-platform-tab" id="permPlatformIosBtn" type="button" data-perm-platform="ios">iOS</button>
      </div>
      <button class="btn btn-primary" id="addPermissionsBtn" type="button" disabled>
        <span id="addPermissionsBtnText">Add to Manifest</span>
      </button>
      <p class="permission-help" id="permissionHelpText">Android help</p>
      <p class="permission-status" id="permissionStatus">Initial status</p>
    </div>
    <div class="ff-section">
      <span class="ff-section-note" id="permissionSelectedBadge">multi-select</span>
      <div class="permission-search-wrapper">
        <input type="search" id="permissionSearchInput" class="permission-search-input" />
      </div>
      <div class="permission-chips-bar" id="permissionCategoryChips"></div>
      <div class="permission-catalog" id="permissionCatalog"></div>
    </div>
  </div>
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'dangerously' });
const { window } = dom;

// Polyfill minimal CSS.escape if not available in older JSDOM
if (!window.CSS) window.CSS = {};
if (!window.CSS.escape) {
  window.CSS.escape = (s) => s.replace(/([^\w-])/g, '\\$1');
}

// Mock AirFlutter base
class MockAirFlutter {
  constructor() {
    this.messages = [];
    this.toasts = [];
  }
  sendMessage(cmd, payload) {
    this.messages.push({ cmd, payload });
  }
  showToast(msg, type) {
    this.toasts.push({ msg, type });
  }
  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Evaluate module in window
const scriptEl = window.document.createElement('script');
scriptEl.textContent = moduleSrc;
window.document.body.appendChild(scriptEl);

const ModuleClass = window.AirFlutterPermissionManagerModule;
assert.ok(ModuleClass, 'PermissionManagerModule must be exposed on window');

// Mixin into mock
Object.getOwnPropertyNames(ModuleClass.prototype).forEach(prop => {
  if (prop !== 'constructor') {
    MockAirFlutter.prototype[prop] = ModuleClass.prototype[prop];
  }
});

const app = new MockAirFlutter();
// Bind document to window.document
global.document = window.document;
global.CSS = window.CSS;

app.initPermissionManager();

// Test 1: Load and Render Android permissions with categories
const androidCats = getPermissionCategories('android');
app.renderPermissionCatalog(ANDROID_PERMISSION_CATALOG, ['android.permission.INTERNET'], androidCats, 'android');

assert.strictEqual(window.document.getElementById('permissionHeading').textContent, 'Android Permissions');
assert.strictEqual(window.document.getElementById('permissionTargetBadge').textContent, 'AndroidManifest.xml');
assert.strictEqual(window.document.getElementById('addPermissionsBtnText').textContent, 'Add to Manifest');

// Verify category chips
const chips = window.document.querySelectorAll('.permission-chip');
assert.ok(chips.length > 5, 'Should render All + category chips');
assert.strictEqual(chips[0].dataset.category, 'all');

// Verify rendered rows
const rows = window.document.querySelectorAll('.permission-row');
assert.ok(rows.length > 20, 'Should render Android catalog items');
const internetRow = Array.from(rows).find(r => r.textContent.includes('android.permission.INTERNET'));
assert.ok(internetRow, 'Must include INTERNET permission row');
assert.ok(internetRow.classList.contains('is-present'), 'INTERNET must be marked is-present');

const internetRemoveBtn = internetRow.querySelector('.permission-remove-btn');
assert.ok(internetRemoveBtn, 'Declared INTERNET row must render a Remove button');
assert.strictEqual(internetRemoveBtn.dataset.permission, 'android.permission.INTERNET');

// Test Removal click
internetRemoveBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
const removeMsg = app.messages[app.messages.length - 1];
assert.strictEqual(removeMsg.cmd, 'removePermission');
assert.strictEqual(removeMsg.payload.permission, 'android.permission.INTERNET');
assert.strictEqual(removeMsg.payload.platform, 'android');

// Simulate host replying with permissionsRemoved
app.handlePermissionsRemoved({
  command: 'permissionsRemoved',
  platform: 'android',
  permission: 'android.permission.INTERNET',
  message: 'Removed android.permission.INTERNET from AndroidManifest.xml.',
  declaredPermissions: []
});

const updatedInternetRow = Array.from(window.document.querySelectorAll('.permission-row')).find(r => r.textContent.includes('android.permission.INTERNET'));
assert.ok(updatedInternetRow, 'INTERNET row must still exist in catalog');
assert.strictEqual(updatedInternetRow.classList.contains('is-present'), false, 'INTERNET must no longer be marked is-present');
assert.strictEqual(updatedInternetRow.querySelector('.permission-remove-btn'), null, 'Un-declared row must not have Remove button');

// Test 2: Search filter
const searchInput = window.document.getElementById('permissionSearchInput');
searchInput.value = 'camera';
searchInput.dispatchEvent(new window.Event('input'));

const searchFilteredRows = window.document.querySelectorAll('.permission-row');
assert.ok(searchFilteredRows.length > 0 && searchFilteredRows.length < 5, 'Search for camera should show small matching subset');

// Reset search
searchInput.value = '';
searchInput.dispatchEvent(new window.Event('input'));

// Test 3: Category Chip selection
const cameraChip = Array.from(window.document.querySelectorAll('.permission-chip')).find(c => c.dataset.category === 'camera_optical');
assert.ok(cameraChip, 'Must find camera_optical chip');
cameraChip.dispatchEvent(new window.Event('click', { bubbles: true }));

const catFilteredRows = window.document.querySelectorAll('.permission-row');
assert.ok(catFilteredRows.length >= 1 && catFilteredRows.length <= 4, 'camera_optical should filter rows');

// Reset to all
chips[0].dispatchEvent(new window.Event('click', { bubbles: true }));

// Test 4: Checkbox selection & action state
const cameraCheck = window.document.querySelector('.permission-row input[value="android.permission.CAMERA"]');
assert.ok(cameraCheck, 'Must find CAMERA checkbox');
assert.strictEqual(cameraCheck.disabled, false);
cameraCheck.checked = true;
cameraCheck.dispatchEvent(new window.Event('change', { bubbles: true }));

const addBtn = window.document.getElementById('addPermissionsBtn');
assert.strictEqual(addBtn.disabled, false, 'Add button must be enabled when permission selected');
assert.ok(window.document.getElementById('permissionStatus').textContent.includes('1 permission(s) selected'));

// Test 5: Switch to iOS platform
const iosPlatformBtn = window.document.getElementById('permPlatformIosBtn');
iosPlatformBtn.dispatchEvent(new window.Event('click'));

assert.strictEqual(app.currentPlatform, 'ios');
assert.strictEqual(window.document.getElementById('permissionHeading').textContent, 'iOS Permissions');
assert.strictEqual(window.document.getElementById('permissionTargetBadge').textContent, 'Info.plist');
assert.strictEqual(window.document.getElementById('addPermissionsBtnText').textContent, 'Add to Info.plist');

// Render iOS catalog
const iosCats = getPermissionCategories('ios');
app.renderPermissionCatalog(IOS_PERMISSION_CATALOG, [], iosCats, 'ios');

const iosRows = window.document.querySelectorAll('.permission-row');
assert.ok(iosRows.length >= 20, 'Should render iOS catalog items');

// Verify iOS usage description input exists
const cameraDescInput = window.document.querySelector('.permission-ios-input[data-permission-name="NSCameraUsageDescription"]');
assert.ok(cameraDescInput, 'Must render usage description input for iOS');
assert.ok(cameraDescInput.value.length > 10, 'Must have default usage description');

// Test 6: Edit usage description and submit
cameraDescInput.value = 'Custom camera prompt for barcode scanning';
cameraDescInput.dispatchEvent(new window.Event('input', { bubbles: true }));

const iosCameraCheck = window.document.querySelector('.permission-row input[value="NSCameraUsageDescription"]');
iosCameraCheck.checked = true;
iosCameraCheck.dispatchEvent(new window.Event('change', { bubbles: true }));

app.addSelectedPermissions();
const lastMsg = app.messages[app.messages.length - 1];
assert.strictEqual(lastMsg.cmd, 'addPermissions');
assert.strictEqual(lastMsg.payload.platform, 'ios');
assert.strictEqual(lastMsg.payload.permissionsMap['NSCameraUsageDescription'], 'Custom camera prompt for barcode scanning');

console.log('PermissionManager DOM and interactive tests passed successfully.');

