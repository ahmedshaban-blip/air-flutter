const assert = require('assert');
const http = require('http');
const { JSDOM } = require('jsdom');
const { NetworkManager, BLACKHOLE_PROXY_HOST, BLACKHOLE_PROXY_PORT } = require('../out/domain/network-manager');
const { MockErrorProxyService } = require('../out/domain/network-manager/mockErrorProxy');
const { AndroidRuntimePermissionService } = require('../out/domain/android-permission-manager');

async function testNetworkDetection() {
  console.log('🧪 Testing Network Device Detection & Isolation Logic...');

  assert.strictEqual(NetworkManager.isWirelessDevice('192.168.1.102:5555'), true);
  assert.strictEqual(NetworkManager.isWirelessDevice('10.0.0.5:43215'), true);
  assert.strictEqual(NetworkManager.isWirelessDevice('emulator-5554'), false);
  assert.strictEqual(NetworkManager.isWirelessDevice('RF8M32ABCDE'), false);

  assert.strictEqual(NetworkManager.isEmulator('emulator-5554'), true);
  assert.strictEqual(NetworkManager.isEmulator('emulator-5556'), true);
  assert.strictEqual(NetworkManager.isEmulator('192.168.1.102:5555'), false);

  console.log('✅ Network device detection passed.');
}

async function testMockErrorProxy() {
  console.log('🧪 Testing Mock Error & Latency Proxy Service...');
  const proxy = MockErrorProxyService.getInstance();

  // Test 1: HTTP 500 Simulation
  const { port: port500 } = await proxy.start({ mode: 'error_500' });
  assert.strictEqual(proxy.isRunning(), true);
  assert.ok(port500 > 0);

  const res500 = await makeHttpRequest(`http://127.0.0.1:${port500}/api/test`);
  assert.strictEqual(res500.statusCode, 500);
  const body500 = JSON.parse(res500.body);
  assert.strictEqual(body500.status, 500);
  assert.strictEqual(body500.error, 'Internal Server Error');

  await proxy.stop();
  assert.strictEqual(proxy.isRunning(), false);

  // Test 2: HTTP 404 Simulation
  const { port: port404 } = await proxy.start({ mode: 'error_404' });
  const res404 = await makeHttpRequest(`http://127.0.0.1:${port404}/api/missing`);
  assert.strictEqual(res404.statusCode, 404);
  const body404 = JSON.parse(res404.body);
  assert.strictEqual(body404.status, 404);

  await proxy.stop();

  // Test 3: Artificial Latency / Delay
  const start = Date.now();
  const { port: portDelay } = await proxy.start({ mode: 'delay', delayMs: 150 });
  const resDelay = await makeHttpRequest(`http://127.0.0.1:${portDelay}/api/throttle`);
  const elapsed = Date.now() - start;
  assert.strictEqual(resDelay.statusCode, 200);
  assert.ok(elapsed >= 100, `Expected delay >= 100ms, got ${elapsed}ms`);

  await proxy.stop();
  console.log('✅ Mock Error Proxy passed.');
}

async function testRuntimePermissionParsing() {
  console.log('🧪 Testing Android Runtime Permission Parsing...');

  const mockDumpsys = `
    Packages:
      Package [com.example.app] (12345):
        userId=10123
        pkg=Package{abcdef com.example.app}
        codePath=/data/app/com.example.app
        runtime permissions:
          android.permission.CAMERA: granted=true
          android.permission.ACCESS_FINE_LOCATION: granted=false, flags=[ USER_SET ]
          android.permission.READ_EXTERNAL_STORAGE: granted=true
          android.permission.RECORD_AUDIO: granted=false
  `;

  const parsed = AndroidRuntimePermissionService.parseDumpsysPermissions(mockDumpsys);
  assert.strictEqual(parsed.length, 4);

  const camera = parsed.find(p => p.name === 'android.permission.CAMERA');
  assert.ok(camera);
  assert.strictEqual(camera.granted, true);
  assert.strictEqual(camera.label, 'CAMERA');

  const location = parsed.find(p => p.name === 'android.permission.ACCESS_FINE_LOCATION');
  assert.ok(location);
  assert.strictEqual(location.granted, false);

  console.log('✅ Runtime Permission parsing passed.');
}

async function testDomInteractions() {
  console.log('🧪 Testing Webview DOM & Interactive Modules...');

  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <!-- Network & State Lab Modal -->
        <div id="proxyModal" hidden>
          <span id="stateLabOfflineBadge"></span>
          <span id="stateLabLinkBadge"></span>
          <span id="stateLabThrottleBadge"></span>
          <span id="stateLabErrorBadge"></span>
          <span id="currentProxyBadge"></span>
          <span id="currentDnsBadge"></span>
          <button id="toggleDnsOfflineBtn"></button>
          <button id="toggleHardwareOfflineBtn"></button>
          <button id="restoreOnlineBtn"></button>
          <span id="offlineStateHint"></span>
          <button id="resetNetworkSimulationBtn"></button>
          <button id="generateFlutterOverridesBtn"></button>
          <button id="copyFlutterOverridesSnippetBtn"></button>
          <button class="throttle-btn" data-preset="normal"></button>
          <button class="throttle-btn" data-preset="2g"></button>
          <button class="error-sim-btn" data-error="http_500"></button>
          <input id="proxyHostInput" />
          <input id="proxyPortInput" />
          <input id="dnsHostInput" />
          <button id="applyProxyBtn"></button>
          <button id="clearProxyBtn"></button>
          <button id="applyDnsBtn"></button>
          <button id="clearDnsBtn"></button>
          <button id="refreshNetworkBtn"></button>
        </div>

        <!-- Permissions Panel View -->
        <div id="permModeManifestTab"></div>
        <div id="permModeRuntimeTab"></div>
        <div id="permissionManifestView"></div>
        <div id="permissionRuntimeView" hidden>
          <input id="runtimePackageIdInput" />
          <button id="refreshRuntimePermsBtn"></button>
          <span id="runtimePermissionsStatusText"></span>
          <button id="grantAllRuntimePermsBtn"></button>
          <button id="revokeAllRuntimePermsBtn"></button>
          <span id="runtimeDeviceBadge"></span>
          <span id="runtimePermCountBadge"></span>
          <input id="runtimePermSearchInput" />
          <div id="runtimePermissionsList"></div>
        </div>
      </body>
    </html>
  `, { runScripts: 'dangerously' });

  global.window = dom.window;
  global.document = dom.window.document;

  // Load modules into JSDOM environment
  require('../media/modules/proxyModule.js');
  require('../media/modules/permissionManagerModule.js');

  const sentMessages = [];
  const fakeBridge = {
    sendMessage(cmd, payload) {
      sentMessages.push({ cmd, payload });
    },
    escapeHtml(str) { return str; },
    showToast() {}
  };

  // Test ProxyModule
  const proxyModule = new window.AirFlutterProxyModule();
  Object.assign(proxyModule, fakeBridge);
  proxyModule.initProxyModal();

  // Test renderNetworkState in offline mode
  proxyModule.renderNetworkState({
    isOffline: true,
    offlineMode: 'dns_drop',
    isWireless: true,
    isEmulator: false,
    activeThrottle: '3000ms Delay',
    activeErrorSimulation: 'HTTP 500',
    proxy: null,
    dnsMode: 'hostname',
    dnsSpecifier: 'dns.offline.invalid',
    localIp: '192.168.1.15'
  });

  const offlineBadge = dom.window.document.getElementById('stateLabOfflineBadge');
  assert.strictEqual(offlineBadge.textContent, 'Offline (DNS Drop)');
  assert.strictEqual(offlineBadge.className, 'status-badge is-warning');

  const restoreBtn = dom.window.document.getElementById('restoreOnlineBtn');
  assert.strictEqual(restoreBtn.style.display, 'inline-flex');

  // Test PermissionManagerModule
  const permModule = new window.AirFlutterPermissionManagerModule();
  Object.assign(permModule, fakeBridge);
  permModule.initPermissionManager();

  // Switch to runtime mode
  permModule.switchPermissionMode('runtime');
  const runtimeView = dom.window.document.getElementById('permissionRuntimeView');
  assert.strictEqual(runtimeView.hidden, false);

  // Render runtime permissions
  permModule.renderRuntimePermissionsState({
    status: 'success',
    packageId: 'com.example.counter',
    serial: '192.168.1.102:5555',
    permissions: [
      { name: 'android.permission.CAMERA', granted: true, label: 'CAMERA' },
      { name: 'android.permission.RECORD_AUDIO', granted: false, label: 'RECORD_AUDIO' }
    ]
  });

  const countBadge = dom.window.document.getElementById('runtimePermCountBadge');
  assert.strictEqual(countBadge.textContent, '2 permissions');

  const list = dom.window.document.getElementById('runtimePermissionsList');
  assert.ok(list.innerHTML.includes('CAMERA'));
  assert.ok(list.innerHTML.includes('RECORD_AUDIO'));
  assert.ok(list.innerHTML.includes('Granted'));
  assert.ok(list.innerHTML.includes('Revoked'));

  console.log('✅ Webview DOM & Interactive Modules passed.');
}

function makeHttpRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    }).on('error', reject);
  });
}

async function runAll() {
  try {
    await testNetworkDetection();
    await testMockErrorProxy();
    await testRuntimePermissionParsing();
    await testDomInteractions();
    console.log('\n🎉 ALL NETWORK STATE & PERMISSIONS TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  }
}

runAll();

