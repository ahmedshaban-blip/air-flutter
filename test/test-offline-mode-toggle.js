const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('🧪 Running Offline Mode Toggle & Restore Online Feedback Loop...');

// 1. Test ProxyModule (State & Net Lab modal)
const modalHtml = `
  <!DOCTYPE html>
  <html>
    <body>
      <div id="proxyModal">
        <span id="stateLabOfflineBadge"></span>
        <button id="toggleDnsOfflineBtn">Instant DNS Drop (Wireless Safe)</button>
        <button id="toggleHardwareOfflineBtn">Full Hardware Radio Cut</button>
        <button id="restoreOnlineBtn" style="display: none;">Restore Online</button>
        <span id="offlineStateHint"></span>
      </div>
    </body>
  </html>
`;

const modalDom = new JSDOM(modalHtml, { runScripts: 'outside-only' });
modalDom.window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'proxyModule.js'), 'utf8'));

const fakeBridge = {
  sendMessage() {},
  showToast() {},
  escapeHtml(s) { return s; }
};

const proxyMod = new modalDom.window.AirFlutterProxyModule();
Object.assign(proxyMod, fakeBridge);
proxyMod.initProxyModal();

// Test modal offline mode changes button to Restore Online
proxyMod.renderNetworkState({
  isOffline: true,
  offlineMode: 'dns_drop',
  isWireless: true,
  isEmulator: true,
  dnsMode: 'hostname',
  dnsSpecifier: 'dns.offline.invalid'
});

const dnsBtn = modalDom.window.document.getElementById('toggleDnsOfflineBtn');
const restoreBtn = modalDom.window.document.getElementById('restoreOnlineBtn');

console.log('Modal DNS button content when offline:', dnsBtn.innerHTML);
assert.strictEqual(
  dnsBtn.textContent.includes('Restore Online'),
  true,
  'FAIL: toggleDnsOfflineBtn should change to "Restore Online" when DNS offline mode is active'
);
assert.strictEqual(
  restoreBtn.style.display,
  'inline-flex',
  'FAIL: restoreOnlineBtn should be visible when offline'
);

// 2. Test Sidebar DOM and Message Handling
const { getSidebarWebviewHtml } = require('../out/controllers/sidebar-controller/sidebarHtml');
const fakeWebview = { cspSource: 'vscode-webview:' };
const fakeUri = { toString: () => 'uri' };
const sidebarHtml = getSidebarWebviewHtml(fakeWebview, fakeUri, fakeUri, '3.0.0');

const sidebarDom = new JSDOM(sidebarHtml, { runScripts: 'outside-only' });
sidebarDom.window.acquireVsCodeApi = () => ({
  postMessage() {},
  getState() { return {}; },
  setState() {}
});
sidebarDom.window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'sidebar.js'), 'utf8'));

const toolToggleOffline = sidebarDom.window.document.getElementById('toolToggleOffline');
assert.ok(toolToggleOffline, 'FAIL: toolToggleOffline button must exist in sidebar');

// Post offlineState: true to sidebar webview
sidebarDom.window.postMessage({ command: 'offlineState', isOffline: true }, '*');

// In JSDOM, event loop may take a tick for postMessage
setTimeout(() => {
  const offlineName = toolToggleOffline.querySelector('.sf-tool-name');
  const offlineNote = toolToggleOffline.querySelector('.sf-tool-note');

  console.log('Sidebar offline button classes:', toolToggleOffline.className);
  console.log('Sidebar offline button text:', offlineName ? offlineName.textContent : null);

  assert.strictEqual(
    toolToggleOffline.classList.contains('is-offline-active'),
    true,
    'FAIL: toolToggleOffline should have class "is-offline-active" when offline'
  );
  assert.strictEqual(
    offlineName ? offlineName.textContent.trim() : '',
    'Restore Online',
    'FAIL: toolToggleOffline name should be "Restore Online" when offline'
  );

  // Now test toggling back to online
  proxyMod.renderNetworkState({
    isOffline: false,
    offlineMode: null,
    isWireless: true,
    isEmulator: true,
    dnsMode: null,
    dnsSpecifier: null
  });

  assert.strictEqual(
    dnsBtn.textContent.includes('Instant DNS Drop'),
    true,
    'FAIL: toggleDnsOfflineBtn should revert to Instant DNS Drop when online'
  );
  assert.strictEqual(
    restoreBtn.style.display,
    'none',
    'FAIL: restoreOnlineBtn should be hidden when online'
  );

  sidebarDom.window.postMessage({ command: 'offlineState', isOffline: false }, '*');

  setTimeout(() => {
    assert.strictEqual(
      toolToggleOffline.classList.contains('is-offline-active'),
      false,
      'FAIL: toolToggleOffline should not have is-offline-active when online'
    );
    assert.strictEqual(
      offlineName ? offlineName.textContent.trim() : '',
      'Offline Mode',
      'FAIL: toolToggleOffline name should revert to "Offline Mode" when online'
    );

    console.log('✅ ALL OFFLINE TOGGLE TESTS PASSED (ROUND-TRIP VERIFIED)!');
  }, 50);
}, 50);
