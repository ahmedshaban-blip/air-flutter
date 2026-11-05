/**
 * Verify the shipped VSIX end to end.
 *
 * Extracts into the OS temp directory (never the repo, so it can never leak
 * back into a later package) and drives the real panel button logic from the
 * shipped files.
 */

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
// Discover the newest VSIX so the test never goes stale on a version bump.
const vsix = fs
  .readdirSync(repoRoot)
  .filter((f) => f.endsWith('.vsix'))
  .map((f) => ({ f, t: fs.statSync(path.join(repoRoot, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)[0]?.f;

if (!vsix) {
  console.error('No VSIX found. Run `npx vsce package` first.');
  process.exit(1);
}
const vsixPath = path.join(repoRoot, vsix);

let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.error('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airflutter-vsix-'));

console.log('🧪 Shipped VSIX verification\n');
console.log(`Package: ${vsix}\n`);

try {
  new AdmZip(vsixPath).extractAllTo(extractDir, true);
  const ext = path.join(extractDir, 'extension');

  console.log('[1] Package contents');
  const entries = new AdmZip(vsixPath).getEntries().map((e) => e.entryName);
  ok('no scratch directories leaked', !entries.some((e) => /extension\/vsix-/.test(e)));
  ok('test harness excluded', !entries.some((e) => /extension\/test\//.test(e)));
  ok('runtime deps present', entries.some((e) => e.includes('node_modules/js-yaml/')) && entries.some((e) => e.includes('node_modules/smol-toml/')));
  for (const f of [
    'out/mcp/companionPackage.js',
    'out/mcp/catalog.js',
    'out/mcp/adapterWriter.js',
    'media/modules/mcpHubModule.js',
    'media/css/mcp-hub.css',
    'out/controllers/flutter-panel-controller/handlers/panelMcpHandler.js'
  ]) {
    ok('ships ' + f, entries.includes('extension/' + f));
  }

  console.log('\n[2] The shipped bridge exposes the real instance');
  const webview = fs.readFileSync(path.join(ext, 'media', 'air-flutter.js'), 'utf8');
  ok('air-flutter.js exposes window.airFlutterApp', webview.includes('window.airFlutterApp = airFlutter'));
  ok('mcpHubModule mixed in', webview.includes('mixinModule(AirFlutterWebview, window.AirFlutterMcpModule)'));
  ok('initMcpModal is called', webview.includes('this.initMcpModal()'));

  console.log('\n[2b] Workflow troubleshooting controls ship');
  const shippedWorkflowModule = fs.readFileSync(path.join(ext, 'media', 'modules', 'workflowModule.js'), 'utf8');
  const shippedWorkflowGenerator = fs.readFileSync(path.join(ext, 'out', 'domain', 'workflow-generator', 'index.js'), 'utf8');
  ok('workflow module ships Gradle memory controls', shippedWorkflowModule.includes('workflowLimitGradleMemory'));
  ok('workflow module ships cache-provider controls', shippedWorkflowModule.includes('workflowGradleCacheProvider'));
  ok('workflow generator ships actionable diagnostics', shippedWorkflowGenerator.includes('Runner memory exhausted'));
  ok('workflow generator uploads failure logs', shippedWorkflowGenerator.includes('flutter-build-diagnostics'));

  console.log('\n[3] The shipped panel delegates instead of self-calling');
  const panelHtml = fs.readFileSync(
    path.join(ext, 'out', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.js'),
    'utf8'
  );
  ok('bridge has a delegate() helper', panelHtml.includes('delegate: function'));
  ok('MCP button delegates to openMcpHub', /delegate\('openMcpHub'/.test(panelHtml));
  ok('flavors delegates too (pre-existing bug fixed)', /delegate\('openFlavorsModal'/.test(panelHtml));
  ok(
    'MCP button addresses the window bridge explicitly',
    panelHtml.includes('onclick=\"window.airFlutter.openMcpHubModal()\"')
  );

  // The bridge must be defined synchronously, not deferred to DOMContentLoaded.
  const domReadyIdx = panelHtml.indexOf("addEventListener('DOMContentLoaded'");
  const bridgeIdx = panelHtml.indexOf('window.airFlutter = {');
  ok('window.airFlutter is assigned before any DOMContentLoaded handler',
    bridgeIdx !== -1 && (domReadyIdx === -1 || bridgeIdx < domReadyIdx),
    `bridge@${bridgeIdx} domReady@${domReadyIdx}`);

  // The bug was the *bridge definition* calling `airFlutter.openFlavorsModal()`,
  // which resolves to the bridge itself. Buttons legitimately call it from
  // their onclick attribute, so the check must inspect the definition only.
  const bridgeBody = panelHtml.slice(
    panelHtml.indexOf('window.airFlutter = {'),
    panelHtml.indexOf('window.showTroubleshootingGuide')
  );
  ok(
    'no bridge method calls itself (infinite recursion)',
    !/airFlutter\.open[A-Za-z]*Modal\(\)/.test(bridgeBody),
    bridgeBody.match(/airFlutter\.open[A-Za-z]*Modal\(\)/)?.[0] || ''
  );

  console.log('\n[4] Catalog correctness in the shipped build');
  const stub = path.join(os.tmpdir(), '__vsix_vscode_stub.js');
  fs.writeFileSync(stub, `module.exports = { workspace: { getConfiguration: () => ({ get: (k, d) => d }) } };`);
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (r, ...a) {
    if (r === 'vscode') return stub;
    return orig.call(this, r, ...a);
  };
  const { MCP_CATALOG } = require(path.join(ext, 'out', 'mcp', 'catalog.js'));
  const { findAdapterById } = require(path.join(ext, 'out', 'mcp', 'adapters', 'index.js'));
  const companion = require(path.join(ext, 'out', 'mcp', 'companionPackage.js'));
  Module._resolveFilename = orig;

  ok('21 servers ship', MCP_CATALOG.length === 21, String(MCP_CATALOG.length));
  const mobile = MCP_CATALOG.find((s) => s.id === 'mobile-mcp');
  ok('mobile-mcp ships with -y and the official package',
    mobile && mobile.args.includes('-y') && mobile.args.includes('@mobilenext/mobile-mcp@latest'),
    mobile ? mobile.args.join(' ') : 'missing');
  const marionette = MCP_CATALOG.find((s) => s.id === 'marionette-mcp');
  ok('marionette uses the dart bridge', marionette && marionette.command === 'marionette_mcp');

  console.log('\n[5] Official integration capabilities ship');
  const workspace = path.join('C:', 'workspace');
  ok('Copilot uses portable .mcp.json', findAdapterById('copilot').resolveTarget('workspace', workspace).path.endsWith('.mcp.json'));
  ok('Antigravity uses .agents/mcp_config.json', findAdapterById('antigravity').resolveTarget('workspace', workspace).path.includes(path.join('.agents', 'mcp_config.json')));
  ok('Continue writes under .continue/mcpServers', findAdapterById('continue').resolveTarget('workspace', workspace).path.includes(path.join('.continue', 'mcpServers')));
  ok('Cline is global-only', JSON.stringify(findAdapterById('cline').capabilities.supportedScopes) === '["global"]');
  ok('Aider and AutoClaw are not advertised', !findAdapterById('aider') && !findAdapterById('autoclaw'));
  ok('CrewAI ships a code generator', findAdapterById('crewai').capabilities.integrationMode === 'code-template');
  ok('AutoGPT ships a setup guide', findAdapterById('autogpt').capabilities.integrationMode === 'setup-guide');

  console.log('\n[6] The shipped main.dart transformer works');
  const src = "import 'package:flutter/material.dart';\n\nvoid main() {\n  runApp(const MyApp());\n}\n";
  const result = companion.wireMainDart(src, marionette.companionPackage);
  ok('produces an edit', result.outcome === 'edited', result.outcome);
  ok('adds the kDebugMode guard', result.newContent.includes('if (kDebugMode)'));
  ok('preserves runApp', result.newContent.includes('runApp(const MyApp());'));

  fs.rmSync(stub, { force: true });
} finally {
  fs.rmSync(extractDir, { recursive: true, force: true });
}

console.log('');
if (fail > 0) {
  console.error(`❌ ${fail} failed, ${pass} passed.`);
  process.exit(1);
}
console.log(`🎉 All ${pass} shipped-VSIX checks passed!`);
