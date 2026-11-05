/**
 * MCP Hub — DOM integration test.
 *
 * Renders the real panel HTML in a headless DOM, loads the real webview
 * modules, and drives the modal the way a user would. This catches wiring
 * bugs that static inspection cannot, such as state that the mixin pattern
 * never initialises.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
let failures = 0;
let passes = 0;

function ok(label, condition, detail) {
  if (condition) {
    passes++;
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// -----------------------------------------------------------------------------
// Build a DOM from the real media files and panel markup.
// -----------------------------------------------------------------------------
const mediaDir = path.join(repoRoot, 'media');

// Extract the modal markup from the compiled template so the test cannot drift
// from what actually ships.
const modalSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'controllers', 'flutter-panel-controller', 'views', 'modals', 'mcpHubModalHtml.ts'),
  'utf8'
);
const modalMatch = modalSource.match(/return `([\s\S]*)`;\s*\}/);
if (!modalMatch) {
  console.error('Could not extract modal markup from the template.');
  process.exit(1);
}
const modalHtml = modalMatch[1];

// Minimal host shell: a mount point plus the scripts in real load order.
const html = `<!DOCTYPE html><html><body>
  <button id="hostOpenBtn" onclick="airFlutter.openMcpHubModal()">MCP Hub</button>
  <div id="toast" class="toast"></div>
  ${modalHtml}
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

// A VS Code API stub that records everything the webview posts to the host.
const hostInbox = [];
window.acquireVsCodeApi = () => ({
  postMessage: (msg) => { hostInbox.push(msg); },
  getState: () => ({}),
  setState: () => {}
});

// air-flutter.js expects these globals.
window.console = console;

// Load the modules in the same order the panel does.
const moduleOrder = ['mcpHubModule.js'];
for (const file of moduleOrder) {
  const code = fs.readFileSync(path.join(mediaDir, 'modules', file), 'utf8');
  window.eval(code);
}

// The panel's inline bridge object. Mirrors panelHtml.ts so the click path is
// exercised end to end.
window.eval(`
  window.vscode = acquireVsCodeApi();
  window.airFlutter = {
    openMcpHubModal: function () {
      if (window.vscode) {
        window.vscode.postMessage({ command: 'openMcpHubModal' });
      }
    }
  };
`);

// Build the webview class the way air-flutter.js does: mixin prototype methods.
window.eval(`
  window.AirFlutterWebview = class AirFlutterWebview {
    initializeEventListeners() { this.initMcpModal(); }
    showToast(message) { window.__lastToast = message; }
    sendMessage(command, data) {
      if (window.vscode) window.vscode.postMessage(Object.assign({ command }, data || {}));
    }
    // The real class routes host messages through this switch; for the DOM test
    // only the MCP cases matter.
    handleMessage(message) {
      switch (message.command) {
        case 'openMcpHubModal': this.openMcpHub(message.workspaceRoot); break;
        case 'mcpHubData': this.setData(message.agents, message.servers); break;
        case 'mcpPrereqResult': this.showPrerequisiteResult(message); break;
        case 'mcpWriteDone': this.onWriteDone(message); break;
        case 'mcpCompanionStatus': this.onCompanionStatus(message); break;
        case 'mcpCompanionDone': this.onCompanionDone(message); break;
        case 'mcpShowCompanionGuide': this.openCompanionGuide(message.serverId); break;
      }
    }
  };
  (function () {
    const mod = window.AirFlutterMcpModule;
    for (const prop of Object.getOwnPropertyNames(mod.prototype)) {
      if (prop !== 'constructor') {
        window.AirFlutterWebview.prototype[prop] = mod.prototype[prop];
      }
    }
  })();
  window.__app = new window.AirFlutterWebview();
  window.__app.initializeEventListeners();
`);

const app = window.__app;

console.log('🧪 Running MCP Hub DOM integration test...\n');
console.log('[A] Panel button → host message');

// --- 1. Clicking the panel button posts openMcpHubModal ---------------------
hostInbox.length = 0;

// jsdom does not execute inline `onclick` attributes, so the handler is
// invoked directly. This still verifies the contract that matters: the panel
// button's expression resolves to a function that posts the expected message.
const hostBtn = window.document.getElementById('hostOpenBtn');
const inlineHandler = hostBtn.getAttribute('onclick') || '';
ok(
  'panel button dispatches airFlutter.openMcpHubModal()',
  inlineHandler.includes('airFlutter.openMcpHubModal()'),
  inlineHandler
);
ok(
  'the bridge target is a callable function',
  typeof window.airFlutter.openMcpHubModal === 'function'
);

window.airFlutter.openMcpHubModal();
ok(
  'panel button posts openMcpHubModal to the host',
  hostInbox.some((m) => m.command === 'openMcpHubModal'),
  `inbox=${JSON.stringify(hostInbox)}`
);

// --- 2. Simulate the host replying, as PanelMcpHandler does ------------------
console.log('\n[B] Host reply opens the modal');

const AGENTS = [
  { id: 'cursor', name: 'Cursor', description: '~/.cursor/mcp.json', capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] } },
  { id: 'copilot', name: 'GitHub Copilot', description: '.mcp.json', capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] } },
  { id: 'cline', name: 'Cline', description: 'Global only', capabilities: { integrationMode: 'global-only', supportedScopes: ['global'] } },
  { id: 'crewai', name: 'CrewAI', description: 'Code template', capabilities: { integrationMode: 'code-template', supportedScopes: ['workspace'] } }
];
const SERVERS = [
  {
    id: 'supabase-mcp',
    name: 'Supabase MCP Server',
    category: 'Backend & Database',
    badge: 'Official',
    description: 'SQL, schema, RLS',
    transport: 'stdio',
    runtime: 'node',
    parameters: [
      { key: 'SUPABASE_URL', label: 'Supabase URL', description: '', placeholder: '', defaultValue: '', secret: false, required: true }
    ],
    defaultInstructions: 'Stay in one schema.',
    instructionTemplates: [{ label: 'Restrict schema', description: 'One schema only', value: 'Only use truck_store.' }]
  },
  {
    id: 'pubdev-mcp',
    name: 'pub.dev MCP Server',
    category: 'Flutter & Dart Core',
    badge: '',
    description: 'Package discovery',
    transport: 'stdio',
    runtime: 'node',
    parameters: [],
    defaultInstructions: '',
    instructionTemplates: []
  },
  {
    id: 'marionette-mcp',
    name: 'Marionette MCP Server',
    category: 'Device & QA',
    badge: '',
    description: 'Drive a running Flutter app',
    transport: 'stdio',
    runtime: 'dart',
    parameters: [],
    defaultInstructions: '',
    instructionTemplates: [],
    companionPackage: {
      packageName: 'marionette_flutter',
      addCommand: 'flutter pub add marionette_flutter',
      docsUrl: 'https://pub.dev/packages/marionette_flutter',
      mainDartSnippet: 'void main() {\n  if (kDebugMode) {\n    MarionetteBinding.ensureInitialized();\n  } else {\n    WidgetsFlutterBinding.ensureInitialized();\n  }\n  runApp(const MyApp());\n}',
      setupSteps: ['Add the package', 'Wire main.dart', 'Activate the bridge']
    }
  }
];

app.handleMessage({ command: 'openMcpHubModal', workspaceRoot: 'D:\\ws' });
const modal = window.document.getElementById('mcpHubModal');
ok('modal becomes visible after the host reply', modal && modal.hidden === false);

app.handleMessage({ command: 'mcpHubData', agents: AGENTS, servers: SERVERS });
ok(
  'agent checkboxes are rendered',
  window.document.querySelectorAll('#mcpAgentList input[data-agent-id]').length === AGENTS.length
);
ok(
  'server checkboxes are rendered',
  window.document.querySelectorAll('#mcpServerList input[data-server-id]').length === SERVERS.length
);

const clineBox = window.document.querySelector('#mcpAgentList input[data-agent-id="cline"]');
const crewBox = window.document.querySelector('#mcpAgentList input[data-agent-id="crewai"]');
const workspaceScope = window.document.querySelector('input[name="mcpScope"][value="workspace"]');
const globalScope = window.document.querySelector('input[name="mcpScope"][value="global"]');

clineBox.checked = true;
clineBox.dispatchEvent(new window.Event('change', { bubbles: true }));
ok('global-only agent disables workspace scope', workspaceScope.disabled && globalScope.checked);

clineBox.checked = false;
clineBox.dispatchEvent(new window.Event('change', { bubbles: true }));
crewBox.checked = true;
crewBox.dispatchEvent(new window.Event('change', { bubbles: true }));
ok('code-template agent disables global scope', globalScope.disabled && workspaceScope.checked);

clineBox.checked = true;
clineBox.dispatchEvent(new window.Event('change', { bubbles: true }));
app.next();
ok('incompatible agent scopes cannot advance', app.step === 1, `step=${app.step}`);

clineBox.checked = false;
crewBox.checked = false;
clineBox.dispatchEvent(new window.Event('change', { bubbles: true }));
crewBox.dispatchEvent(new window.Event('change', { bubbles: true }));

// --- 3. Walk the wizard -----------------------------------------------------
console.log('\n[C] Stepper navigation');

ok('starts on step 1', app.step === 1, `step=${app.step}`);
ok(
  'Next is labelled "Next" on step 1',
  window.document.getElementById('mcpNextBtn').textContent.includes('Next')
);

// Attempt to advance without selecting an agent: must be blocked.
app.next();
ok('cannot leave step 1 without an agent', app.step === 1, `step=${app.step}`);

// Select an agent.
const agentBox = window.document.querySelector('#mcpAgentList input[data-agent-id="cursor"]');
agentBox.checked = true;
agentBox.dispatchEvent(new window.Event('change', { bubbles: true }));
app.next();
ok('advances to step 2 after selecting an agent', app.step === 2, `step=${app.step}`);

app.next(); // scope is preset; straight through
ok('advances to step 3 (servers)', app.step === 3, `step=${app.step}`);

app.next(); // blocked: no server selected
ok('cannot leave step 3 without a server', app.step === 3, `step=${app.step}`);

const serverBox = window.document.querySelector('#mcpServerList input[data-server-id="supabase-mcp"]');
serverBox.checked = true;
serverBox.dispatchEvent(new window.Event('change', { bubbles: true }));
app.next();
ok('advances to step 4 (configure)', app.step === 4, `step=${app.step}`);

// --- 4. Configuration validation -------------------------------------------
console.log('\n[D] Configuration and review');

ok(
  'config form renders a required parameter input',
  Boolean(window.document.querySelector('input[data-param-key="SUPABASE_URL"]'))
);
ok(
  'config form renders an instructions textarea',
  Boolean(window.document.querySelector('textarea[data-instr-server="supabase-mcp"]'))
);

app.next(); // blocked: required param empty
ok('cannot advance with an empty required parameter', app.step === 4, `step=${app.step}`);

window.document.querySelector('input[data-param-key="SUPABASE_URL"]').value = 'https://x.supabase.co';
window.document.querySelector('textarea[data-instr-server="supabase-mcp"]').value = 'Only use truck_store.';
app.next();
ok('advances to step 5 (review)', app.step === 5, `step=${app.step}`);

// --- 5. THE REPORTED BUGS ---------------------------------------------------
console.log('\n[E] Regression guards for the reported bugs');

const nextLabel = window.document.getElementById('mcpNextBtn').textContent;
ok(
  'final button reads "Write integration files", not "Next" (bug #1)',
  nextLabel.includes('Write integration files'),
  `label was "${nextLabel.trim()}"`
);
ok('totalSteps is initialised (mixin state)', app.totalSteps === 5, `totalSteps=${app.totalSteps}`);
ok('step counter is a real number', typeof app.step === 'number', `typeof step=${typeof app.step}`);
ok(
  'check-prerequisites button is visible on the final step',
  window.document.getElementById('mcpCheckPrereqBtn').hidden === false
);

// Clicking the final button must post the write command.
hostInbox.length = 0;
window.document.getElementById('mcpNextBtn').click();
const writeMsg = hostInbox.find((m) => m.command === 'mcpWrite');
ok('final click posts mcpWrite to the host (bug #1)', Boolean(writeMsg), JSON.stringify(hostInbox));
if (writeMsg) {
  ok('write payload carries the selected agent', writeMsg.agentIds.includes('cursor'));
  ok('write payload carries the selected server', writeMsg.serverIds.includes('supabase-mcp'));
  ok('write payload carries the parameter value', writeMsg.parameters['supabase-mcp'].SUPABASE_URL === 'https://x.supabase.co');
  ok('write payload carries the instruction', writeMsg.instructions['supabase-mcp'] === 'Only use truck_store.');
  ok('write payload carries the scope', writeMsg.scope === 'workspace');
}

// --- 6. Re-opening resets state ---------------------------------------------
console.log('\n[F] Re-open behaviour');

// Closing and re-opening starts a fresh run.
window.document.getElementById('closeMcpHubModalBtn').click();
app.handleMessage({ command: 'openMcpHubModal', workspaceRoot: 'D:\\ws' });
ok('re-opening after close returns to step 1', app.step === 1, `step=${app.step}`);
ok('re-opening clears selected servers', app.selectedServers.size === 0, `size=${app.selectedServers.size}`);
ok('modal is visible again', window.document.getElementById('mcpHubModal').hidden === false);

// A host confirmation while the modal is already open must NOT wipe an
// in-progress flow (this guards against the open/request feedback loop).
app.handleMessage({ command: 'mcpHubData', agents: AGENTS, servers: SERVERS });
const keepBox = window.document.querySelector('#mcpServerList input[data-server-id="pubdev-mcp"]');
keepBox.checked = true;
keepBox.dispatchEvent(new window.Event('change', { bubbles: true }));
app.handleMessage({ command: 'openMcpHubModal', workspaceRoot: 'D:\\ws' });
ok(
  'an already-open modal keeps its selections on a host re-confirm',
  app.selectedServers.has('pubdev-mcp'),
  `size=${app.selectedServers.size}`
);
ok('an already-open modal stays on its current step', app.step === 1, `step=${app.step}`);

// --- 7. Companion package flow ----------------------------------------------
console.log('\n[G] Companion package (Marionette)');

// Start from a clean wizard. The modal is still visible from section F, and
// re-opening deliberately preserves an in-progress flow, so close it first to
// mirror a user starting a fresh run.
window.document.getElementById('closeMcpHubModalBtn').click();
app.handleMessage({ command: 'openMcpHubModal', workspaceRoot: 'D:\\ws' });
ok('wizard reset before companion flow', app.step === 1, `step=${app.step}`);

// Select Marionette and walk to the configure step.
app.handleMessage({ command: 'mcpHubData', agents: AGENTS, servers: SERVERS });
const agentBox2 = window.document.querySelector('#mcpAgentList input[data-agent-id="cursor"]');
agentBox2.checked = true;
agentBox2.dispatchEvent(new window.Event('change', { bubbles: true }));
app.next(); // 1 -> 2
app.next(); // 2 -> 3

const marionetteBox = window.document.querySelector('#mcpServerList input[data-server-id="marionette-mcp"]');
marionetteBox.checked = true;
marionetteBox.dispatchEvent(new window.Event('change', { bubbles: true }));
app.next(); // 3 -> 4 (renderConfig)
ok('reached the configure step', app.step === 4, `step=${app.step}`);

const banner = window.document.querySelector('[data-companion="marionette-mcp"]');
ok('companion banner rendered for Marionette', Boolean(banner));
ok('banner names the pub package', banner && banner.textContent.includes('marionette_flutter'));

// The host is asked for the dependency status.
const statusReq = hostInbox.find((m) => m.command === 'mcpCompanionStatus');
ok('host asked for companion status', Boolean(statusReq), JSON.stringify(hostInbox.slice(-4)));
ok('status request carries the server id', statusReq && statusReq.serverId === 'marionette-mcp');

// Host reports installed -> banner flips.
app.handleMessage({ command: 'mcpCompanionStatus', serverId: 'marionette-mcp', installed: true, hasMainDart: true });
const statusEl = window.document.querySelector('[data-companion-status="marionette-mcp"]');
ok('banner shows installed state', statusEl && statusEl.textContent.includes('Already in your pubspec'), statusEl && statusEl.textContent);
ok('banner gets the ok class', statusEl && statusEl.classList.contains('is-ok'));

const installBtn = window.document.querySelector('[data-companion-install="marionette-mcp"]');
ok('install button relabels to "Wire main.dart"', installBtn && installBtn.textContent.includes('Wire main.dart'), installBtn && installBtn.textContent);

// Host reports not installed.
app.handleMessage({ command: 'mcpCompanionStatus', serverId: 'marionette-mcp', installed: false, hasMainDart: true });
ok('banner shows not-installed state', statusEl && statusEl.textContent.includes('Not installed'));
ok('install button relabels back to "Add package"', installBtn && installBtn.textContent.includes('Add package'), installBtn && installBtn.textContent);

// Opening the guide.
hostInbox.length = 0;
installBtn.click();
const guideOpened = hostInbox.find((m) => m.command === 'mcpCompanionInstall');
ok('install button posts mcpCompanionInstall', Boolean(guideOpened), JSON.stringify(hostInbox));
ok('install request carries the server id', guideOpened && guideOpened.serverId === 'marionette-mcp');

// Guide modal via the Setup guide button.
hostInbox.length = 0;
const guideBtn = window.document.querySelector('[data-companion-guide="marionette-mcp"]');
guideBtn.click();
const guideModal = window.document.getElementById('mcpCompanionGuide');
ok('setup guide modal opens', guideModal && guideModal.hidden === false);
ok('guide shows the exact add command', window.document.getElementById('mcpGuideAddCmd').textContent === 'flutter pub add marionette_flutter');
ok(
  'guide shows the binding snippet',
  window.document.getElementById('mcpGuideSnippet').textContent.includes('MarionetteBinding.ensureInitialized();')
);
ok(
  'guide snippet includes the debug guard',
  window.document.getElementById('mcpGuideSnippet').textContent.includes('if (kDebugMode)')
);
ok(
  'guide lists the setup steps',
  window.document.querySelectorAll('#mcpGuideSteps li').length === 3
);

// Save-as-Markdown button.
hostInbox.length = 0;
window.document.getElementById('mcpGuideFileBtn').click();
ok(
  'save-as-Markdown posts mcpCompanionGuideFile',
  hostInbox.some((m) => m.command === 'mcpCompanionGuideFile')
);

// Close the guide.
window.document.getElementById('closeMcpGuideBtn').click();
ok('guide modal closes', guideModal.hidden === true);

// Companion done report.
app.handleMessage({ command: 'mcpCompanionDone', serverId: 'marionette-mcp', ok: true, mainDartEdited: true });
ok('companion done refreshes status', hostInbox.some((m) => m.command === 'mcpCompanionStatus'));

// Servers without a companion package must NOT show a banner.
ok(
  'no banner for servers without a companion package',
  !window.document.querySelector('[data-companion="supabase-mcp"]')
);

// --- summary ----------------------------------------------------------------
console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} DOM check(s) failed, ${passes} passed.`);
  process.exit(1);
}
console.log(`🎉 All ${passes} MCP Hub DOM integration checks passed!`);
