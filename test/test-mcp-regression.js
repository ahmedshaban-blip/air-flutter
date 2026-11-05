/**
 * Regression-injection harness.
 *
 * Deliberately breaks the product in known ways and asserts that the test
 * suite FAILS. A test that passes against broken code protects nothing, so
 * these probes prove the guards are real.
 *
 * Each probe: back up, inject, run the suite, expect a non-zero exit, restore.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const targets = {
  companion: path.join(repoRoot, 'src', 'mcp', 'companionPackage.ts'),
  catalog: path.join(repoRoot, 'src', 'mcp', 'catalog.ts'),
  modal: path.join(repoRoot, 'media', 'modules', 'mcpHubModule.js'),
  webview: path.join(repoRoot, 'media', 'air-flutter.js'),
  panelHtml: path.join(repoRoot, 'src', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.ts')
};

let failures = 0;

function runSuite() {
  try {
    execSync('npm run test:mcp', { cwd: repoRoot, stdio: 'pipe' });
    return true; // passed
  } catch {
    return false; // failed
  }
}

function withInjection(file, transform, label) {
  const original = fs.readFileSync(file, 'utf8');
  const mutated = transform(original);

  if (mutated === original) {
    console.error(`  ⚠️  ${label}: transform did not change the file (probe invalid)`);
    failures++;
    return;
  }

  fs.writeFileSync(file, mutated);

  // The suite compiles TS first, so a type error is also a legitimate failure.
  const passed = runSuite();
  fs.writeFileSync(file, original);

  if (passed) {
    console.error(`  ❌ ${label}: suite PASSED against broken code — the guard is fake`);
    failures++;
  } else {
    console.log(`  ✅ ${label}: suite correctly failed`);
  }
}

console.log('🧪 Regression-injection probes\n');

console.log('[1] Break nested-parenthesis runApp handling');
withInjection(
  targets.companion,
  (s) =>
    s.replace(
      'const runAppArg = extractRunAppArgument(body);',
      'const _m = body.match(/runApp\\s*\\(([^)]*)\\)/); const runAppArg = _m ? _m[1].trim() : undefined;'
    ),
  'naive regex must be caught'
);

console.log('[2] Remove the main.dart backup');
withInjection(
  targets.companion,
  (s) => s.replace('airflutter-backup-', 'airflutter-noop-'),
  'missing backup must be caught'
);

console.log('[3] Drop the unreachable-main safety valve');
withInjection(
  targets.companion,
  (s) => s.replace("outcome: 'unsupported',", "outcome: 'edited',"),
  'mangling an unknown main() must be caught'
);

console.log('[4] Strip the -y flag from a mobile server');
withInjection(
  targets.catalog,
  (s) => s.replace("args: ['-y', '@mobilenext/mobile-mcp@latest'],", "args: ['@mobilenext/mobile-mcp@latest'],"),
  'a missing -y must be caught'
);

console.log('[5] Rename the companion package');
withInjection(
  targets.catalog,
  (s) => s.replace("packageName: 'marionette_flutter',", "packageName: 'marionette_flutter_WRONG',"),
  'a wrong pub package name must be caught'
);

console.log('[6] Break the companion banner rendering');
withInjection(
  targets.modal,
  (s) => s.replace('const companion = s.companionPackage', 'const companion = null && s.companionPackage'),
  'a missing companion banner must be caught'
);

console.log('[7] Hide the real webview instance from the panel bridge');
withInjection(
  targets.webview,
  (s) => s.replace('window.airFlutterApp = airFlutter;', '// removed'),
  'a hidden instance must be caught (the panel button would do nothing)'
);

console.log('[8] Make the bridge call itself instead of delegating');
withInjection(
  targets.panelHtml,
  (s) =>
    s.replace(
      "this.delegate('openMcpHub', 'openMcpHubModal');",
      "if (window.vscode) { window.vscode.postMessage({ command: 'openMcpHubModal' }); }"
    ),
  'a non-delegating bridge must be caught'
);

console.log('[9] Remove the mcpRequestData host case');
withInjection(
  path.join(repoRoot, 'src', 'controllers', 'flutter-panel-controller', 'FlutterPanelController.ts'),
  (s) => s.replace("case 'mcpRequestData':", "case 'mcpRequestData_DISABLED':"),
  'a missing catalog request handler must be caught'
);

console.log('[10] Defer the bridge definition to DOMContentLoaded');
withInjection(
  targets.panelHtml,
  (s) =>
    s.replace(
      'window.airFlutter = {',
      "window.addEventListener('DOMContentLoaded', () => { window.airFlutter = {"
    ),
  'a deferred bridge (airFlutter is not defined on early click) must be caught'
);

console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} probe(s) failed — the suite has blind spots.`);
  process.exit(1);
}
console.log(`🎉 All 10 regression probes confirmed the suite catches real breakage.`);
