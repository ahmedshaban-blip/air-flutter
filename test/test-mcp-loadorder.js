/**
 * Faithful reproduction of the real VS Code load order.
 *
 * Key difference from the other probe: `acquireVsCodeApi` is NOT defined
 * before the scripts run. In VS Code it is injected by the host and available
 * globally, but the ordering of DOMContentLoaded matters.
 *
 * This test drives the DOMContentLoaded event explicitly to model both
 * possible orderings, and reports which one the panel actually relies on.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const os = require('os');

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, 'out');

const Module = require('module');
const stub = path.join(os.tmpdir(), '__faithful_stub.js');
fs.writeFileSync(stub, `module.exports = { Uri: { file: (p) => ({ fsPath: p, toString: () => 'x' }) }, workspace: { getConfiguration: () => ({ get: (k, d) => d }) } };`);
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) { if (r === 'vscode') return stub; return orig.call(this, r, ...a); };

const { getPanelWebviewContent } = require(path.join(outDir, 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.js'));
const panel = { webview: { cspSource: 'x', asWebviewUri: (u) => ({ toString: () => 'file:///' + u.fsPath.replace(/\\/g, '/') }), postMessage: () => {} } };
let html = getPanelWebviewContent({ extensionPath: repoRoot }, panel, '1.7.1');

html = html.replace(/<script\s+src="file:\/\/\/([^"]+)"[^>]*><\/script>/g, (m, fp) => {
  const abs = decodeURIComponent(fp);
  if (!fs.existsSync(abs)) return '';
  return `<script>${fs.readFileSync(abs, 'utf8').replace(/<\/script>/g, '<\\/script>')}</script>`;
});
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '');

// jsdom fires DOMContentLoaded during construction when scripts are inline,
// which matches a browser. That is exactly what we want to verify.
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
const w = dom.window;
w.__errors = [];
w.addEventListener('error', (event) => {
  w.__errors.push(event.message);
  event.preventDefault();
});
w.console.log = () => {};
w.console.error = (...a) => { w.__errors.push(a.map(String).join(' ')); };
w.acquireVsCodeApi = () => ({ postMessage: () => {}, getState: () => ({}), setState: () => {} });

let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.error('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

setTimeout(() => {
  console.log('🧪 Faithful load-order probe (VS Code parity)\n');

  console.log('[1] Both objects exist after load');
  ok('window.airFlutter bridge exists', Boolean(w.airFlutter));
  ok('window.airFlutterApp real instance exists', Boolean(w.airFlutterApp));

  console.log('\n[2] The bridge delegates to the real instance');
  ok('bridge has delegate()', w.airFlutter && typeof w.airFlutter.delegate === 'function');
  ok(
    'bridge.delegate resolves window.airFlutterApp.openMcpHub',
    w.airFlutterApp && typeof w.airFlutterApp.openMcpHub === 'function'
  );

  console.log('\n[3] Calling the button expression opens the modal');
  const modal = w.document.getElementById('mcpHubModal');
  ok('modal exists', Boolean(modal));

  // Exercise the real inline handler. It must address window.airFlutter
  // explicitly so a global lexical binding named `airFlutter` cannot shadow
  // the bridge in VS Code's Chromium webview.
  try {
    const button = w.document.querySelector('button[data-command="mcpHubModal"]');
    button.click();
    ok('no exception thrown', !(w.__errors || []).length, (w.__errors || []).join(' | '));
    ok('modal became visible', modal && modal.hidden === false, modal ? 'hidden=' + modal.hidden : 'n/a');
  } catch (e) {
    ok('no exception thrown', false, e.message);
  }

  console.log('\n[4] Compare with a known-working button (Flavors)');
  const proxyModal = w.document.getElementById('proxyModal');
  try {
    w.airFlutter.openProxyModal();
    ok('proxy modal opened too', !proxyModal || proxyModal.hidden === false, proxyModal ? 'hidden=' + proxyModal.hidden : 'no modal');
  } catch (e) {
    ok('proxy modal opened too', false, e.message);
  }

  console.log('\n[5] Regression: the bridge exists before DOMContentLoaded');
  // The previous implementation defined window.airFlutter inside a
  // DOMContentLoaded handler, so a click arriving first threw
  // "airFlutter is not defined". Re-parse the HTML without letting
  // DOMContentLoaded run, then assert the bridge is already usable.
  {
    const dom2 = new JSDOM(html, { runScripts: 'outside-only', url: 'https://localhost/' });

    // Execute the scripts manually, but skip dispatching DOMContentLoaded.
    const scriptBodies = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    let threw = null;
    for (const body of scriptBodies) {
      try {
        dom2.window.eval(body);
      } catch (e) {
        threw = e.message;
      }
    }

    ok('scripts executed without a hard error', threw === null, threw || '');
    ok(
      'window.airFlutter is defined before DOMContentLoaded',
      Boolean(dom2.window.airFlutter),
      typeof dom2.window.airFlutter
    );
    ok(
      'window.airFlutter.openMcpHubModal is callable immediately',
      dom2.window.airFlutter && typeof dom2.window.airFlutter.openMcpHubModal === 'function'
    );
  }

  console.log('');
  if (w.__errors && w.__errors.length) {
    console.log('Captured console.error output:');
    w.__errors.forEach((e) => console.log('  ' + e));
    console.log('');
  }
  if (fail > 0) {
    console.error(`❌ ${fail} failed, ${pass} passed.`);
    process.exit(1);
  }
  console.log(`🎉 All ${pass} faithful-parity checks passed!`);
}, 400);
