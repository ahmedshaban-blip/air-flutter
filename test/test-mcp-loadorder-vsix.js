/**
 * Reproduce the exact browser error:
 *   Uncaught TypeError: airFlutter.openMcpHubModal is not a function
 *
 * Verifies the fix in the shipped VSIX across both orderings:
 *  A. all scripts executed, DOMContentLoaded may or may not have fired
 *     (the realistic VS Code path)
 *  B. air-flutter.js never ran (pathological) — the bridge must degrade to
 *     posting a host message instead of throwing
 */

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { JSDOM } = require('jsdom');
const Module = require('module');

const repoRoot = process.cwd();
const vsix = fs
  .readdirSync(repoRoot)
  .filter((f) => f.endsWith('.vsix'))
  .map((f) => ({ f, t: fs.statSync(path.join(repoRoot, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)[0].f;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-loadorder-'));
new AdmZip(path.join(repoRoot, vsix)).extractAllTo(dir, true);
const ext = path.join(dir, 'extension');

const stub = path.join(os.tmpdir(), '__lo_stub.js');
fs.writeFileSync(stub, `module.exports = { Uri: { file: (p) => ({ fsPath: p, toString: () => 'x' }) }, workspace: { getConfiguration: () => ({ get: (k, d) => d }) } };`);
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  if (r === 'vscode') return stub;
  return orig.call(this, r, ...a);
};
const { getPanelWebviewContent } = require(path.join(ext, 'out', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.js'));
const panel = { webview: { cspSource: 'x', asWebviewUri: (u) => ({ toString: () => 'file:///' + u.fsPath.replace(/\\/g, '/') }), postMessage: () => {} } };
const html = getPanelWebviewContent({ extensionPath: ext }, panel, 'test');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.error('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

/** Inline every external script into the markup so jsdom runs them in order. */
function inlineScripts(source) {
  return source.replace(/<script\s+src="file:\/\/\/([^"]+)"[^>]*><\/script>/g, (m, fp) => {
    const abs = decodeURIComponent(fp);
    if (!fs.existsSync(abs)) return '';
    return `<script>${fs.readFileSync(abs, 'utf8').replace(/<\/script>/g, '<\\/script>')}</script>`;
  });
}

function makeWindow(markup) {
  const dom = new JSDOM(markup, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
  const w = dom.window;
  w.console.log = () => {};
  w.console.error = () => {};
  w.acquireVsCodeApi = () => ({ postMessage: () => {}, getState: () => ({}), setState: () => {} });
  return w;
}

console.log(`🧪 Load-order reproduction against ${vsix}\n`);

// ---------------------------------------------------------------------------
// A. Realistic ordering: every script executed.
// ---------------------------------------------------------------------------
console.log('[A] Realistic ordering (all scripts run)');
const realistic = makeWindow(inlineScripts(html));

setTimeout(() => {
  ok('real instance exposed', Boolean(realistic.airFlutterApp));
  ok(
    'bridge has openMcpHubModal',
    realistic.airFlutter && typeof realistic.airFlutter.openMcpHubModal === 'function',
    realistic.airFlutter ? typeof realistic.airFlutter.openMcpHubModal : 'no bridge'
  );
  ok(
    'bridge has openFlavorsModal',
    realistic.airFlutter && typeof realistic.airFlutter.openFlavorsModal === 'function'
  );

  let threw = null;
  try {
    realistic.airFlutter.openMcpHubModal();
  } catch (e) {
    threw = e.message;
  }
  ok('click does not throw "is not a function"', threw === null, threw || '');

  const modal = realistic.document.getElementById('mcpHubModal');
  ok('modal is visible after the click', modal && modal.hidden === false,
    modal ? 'hidden=' + modal.hidden : 'n/a');

  // Clicking every bridged button must not throw either.
  const bridged = [
    'openMcpHubModal', 'openFlavorsModal', 'openProxyModal', 'openWorkflowModal',
    'openSigningKeyModal', 'openAgentScaffoldModal', 'openCompatDoctorModal'
  ];
  const broken = [];
  for (const name of bridged) {
    try {
      realistic.airFlutter[name]();
    } catch (e) {
      broken.push(name + ': ' + e.message);
    }
  }
  ok('every bridged button is callable', broken.length === 0, broken.join(' | '));

  // -------------------------------------------------------------------------
  // B. Pathological ordering: air-flutter.js missing.
  // -------------------------------------------------------------------------
  console.log('\n[B] Pathological ordering (bridge only)');
  const markupNoScripts = html.replace(/<script\s+src="file:\/\/\/[^"]+"[^>]*><\/script>/g, '');
  const partial = makeWindow(markupNoScripts);

  setTimeout(() => {
    ok('bridge still defined', Boolean(partial.airFlutter));
    let partialThrew = null;
    try {
      partial.airFlutter.openMcpHubModal();
    } catch (e) {
      partialThrew = e.message;
    }
    ok('bridge degrades gracefully without the app instance', partialThrew === null, partialThrew || '');

    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(stub, { force: true });

    console.log('');
    if (fail > 0) {
      console.error(`❌ ${fail} failed, ${pass} passed.`);
      process.exit(1);
    }
    console.log(`🎉 All ${pass} load-order checks passed against ${vsix}!`);
  }, 250);
}, 350);
