/**
 * Reproduce the "MCP Hub button does nothing" report against the REAL panel.
 *
 * Loads the actual generated panel HTML, the real air-flutter.js, the real
 * sidebar/module scripts, and the real inline bridge — then clicks the button
 * the way a user does. Any exception is surfaced instead of swallowed.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const outDir = path.join(repoRoot, 'out');

// Build the panel HTML exactly as the extension host does.
const Module = require('module');
const stub = path.join(require('os').tmpdir(), '__panel_panel_stub.js');
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

// A fake webview whose asWebviewUri rewrites file paths to a readable path
// jsdom can resolve.
const panel = {
  webview: {
    cspSource: 'vscode-resource:',
    asWebviewUri: (uri) => ({ toString: () => 'file:///' + uri.fsPath.replace(/\\/g, '/') }),
    postMessage: () => {},
    onDidReceiveMessage: () => ({ dispose() {} })
  }
};

const ctx = { extensionPath: repoRoot };
let html = getPanelWebviewContent(ctx, panel, '1.7.0');

// jsdom cannot load file:// resources, so rewrite every <script src> into an
// inline <script> containing the real file contents, in the same order.
html = html.replace(
  /<script\s+src="file:\/\/\/([^"]+)"([^>]*)><\/script>/g,
  (match, filePath, rest) => {
    const abs = decodeURIComponent(filePath);
    if (!fs.existsSync(abs)) {
      return `<script>console.error('missing script: ${abs.replace(/\\/g, '\\\\')}')</script>`;
    }
    const code = fs.readFileSync(abs, 'utf8');
    // Escape any accidental </script> in the source.
    return `<script>${code.replace(/<\/script>/g, '<\\/script>')}</script>`;
  }
);

// Stylesheet links are irrelevant to behaviour; drop them to avoid network noise.
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://localhost/'
});

const window = dom.window;
const posted = [];
const errors = [];

// Capture every exception, including ones swallowed by try/catch logging.
window.addEventListener('error', (e) => errors.push('window.onerror: ' + e.message));
const originalError = window.console.error;
window.console.error = (...args) => {
  errors.push('console.error: ' + args.map(String).join(' '));
  originalError.apply(window.console, args);
};
window.console.log = () => {};

window.acquireVsCodeApi = () => ({
  postMessage: (m) => posted.push(m),
  getState: () => ({}),
  setState: () => {}
});

// jsdom does not execute inline onclick, so invoke the handler the button names.
function clickByExpression(expr) {
  const fnMatch = expr.match(/^(\w+(?:\.\w+)*)\((.*)\)$/);
  if (!fnMatch) throw new Error('unsupported onclick: ' + expr);
  const parts = fnMatch[1].split('.');
  let fn = window;
  for (const p of parts) fn = fn[p];
  if (typeof fn !== 'function') {
    throw new Error(`${fnMatch[1]} is not a function (got ${typeof fn})`);
  }
  return fn.call(window.airFlutter);
}

console.log('🧪 MCP Hub panel button — real integration probe\n');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.error('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

// Give the loaded scripts a tick to run.
setTimeout(() => {
  console.log('[1] Scripts loaded');
  ok('AirFlutterMcpModule defined', typeof window.AirFlutterMcpModule === 'function');
  ok('airFlutter bridge exists', Boolean(window.airFlutter));
  ok('real webview instance exposed as window.airFlutterApp', Boolean(window.airFlutterApp));

  if (errors.length) {
    console.log('\n  ⚠️  Errors captured during load:');
    errors.forEach((e) => console.log('      ' + e));
  }

  console.log('\n[2] The real instance is exposed for the bridge');
  const app = window.airFlutterApp;
  ok('window.airFlutterApp exists', Boolean(app));
  for (const m of ['initMcpModal', 'openMcpHub', 'next', 'renderConfig', 'onCompanionStatus']) {
    ok(`real instance has ${m}()`, app && typeof app[m] === 'function', app ? typeof app[m] : 'no app');
  }

  console.log('\n[3] The button expression resolves and delegates');
  const btn = window.document.querySelector('button[data-command="mcpHubModal"]');
  ok('button exists in the DOM', Boolean(btn));
  const onclick = btn ? btn.getAttribute('onclick') : '';
  ok(
    'button onclick explicitly calls window.airFlutter.openMcpHubModal()',
    onclick === 'window.airFlutter.openMcpHubModal()',
    onclick
  );

  if (!window.airFlutter) {
    console.error('\nCannot continue: no airFlutter bridge.');
    process.exit(1);
  }

  // This is the exact call the browser makes.
  posted.length = 0;
  errors.length = 0;

  // Spy on the real instance to prove the bridge delegates to it rather than
  // posting a message and waiting for the host to reply.
  let delegateCalled = false;
  const originalOpen = app.openMcpHub;
  app.openMcpHub = function (...args) {
    delegateCalled = true;
    return originalOpen.apply(this, args);
  };

  try {
    clickByExpression(onclick);
    ok('click produced no exception', errors.length === 0, errors.join('; '));
  } catch (e) {
    ok('click produced no exception', false, e.message);
  }

  ok('bridge delegated to window.airFlutterApp.openMcpHub()', delegateCalled);
  app.openMcpHub = originalOpen;

  // The bridge must delegate to the real instance, which opens the modal
  // immediately and asks the host for the catalog.
  const modalEl = window.document.getElementById('mcpHubModal');
  ok(
    'click opened the modal immediately (no host round trip needed)',
    modalEl && modalEl.hidden === false,
    modalEl ? 'hidden=' + modalEl.hidden : 'no modal'
  );
  ok(
    'click requested the catalog from the host',
    posted.some((m) => m.command === 'mcpRequestData'),
    JSON.stringify(posted)
  );

  // The bridge must not call itself: verify the method on the real instance
  // was the one that ran, by checking wizard state was initialised.
  ok('real instance wizard state was initialised', app && app.step === 1, app ? String(app.step) : 'no app');

  console.log('\n[4] Host replies are handled');
  posted.length = 0;
  try {
    app.handleMessage({
      command: 'mcpHubData',
      agents: [{ id: 'cursor', name: 'Cursor', description: 'x', capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] } }],
      servers: [{ id: 'pubdev-mcp', name: 'pub.dev', category: 'Core', description: 'y', transport: 'stdio', runtime: 'node', parameters: [], instructionTemplates: [] }]
    });
    ok('catalog rendered after the host reply',
      window.document.querySelectorAll('#mcpServerList input[data-server-id]').length === 1);
  } catch (e) {
    ok('catalog rendered after the host reply', false, e.message);
  }

  console.log('\n[5] A host re-confirm does not close an open modal');
  try {
    app.handleMessage({ command: 'openMcpHubModal', workspaceRoot: 'D:\\ws' });
    ok('modal still visible after host confirm', modalEl && modalEl.hidden === false);
    ok('selections not wiped by host confirm', app.step === 1);
  } catch (e) {
    ok('host confirm handled', false, e.message);
  }

  console.log('');
  if (errors.length) {
    console.log('Captured errors:');
    errors.forEach((e) => console.log('  ' + e));
  }
  if (fail > 0) {
    console.error(`\n❌ ${fail} failed, ${pass} passed.`);
    process.exit(1);
  }
  console.log(`🎉 All ${pass} panel-button probes passed!`);
}, 400);
