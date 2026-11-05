const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');

const repoRoot = path.join(__dirname, '..');

// Stub vscode (companionPackage imports it for the terminal helper).
const stub = path.join(repoRoot, 'out', '__cp_stub__.js');
fs.writeFileSync(stub, 'module.exports={window:{createTerminal:()=>({show(){},sendText(){}}),showInformationMessage(){}},ProgressLocation:{Notification:1}};');
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  if (r === 'vscode') return stub;
  return orig.call(this, r, ...a);
};

const cp = require(path.join(repoRoot, 'out', 'mcp', 'companionPackage.js'));
const { MCP_CATALOG } = require(path.join(repoRoot, 'out', 'mcp', 'catalog.js'));

const marionette = MCP_CATALOG.find((s) => s.id === 'marionette-mcp');
const pkg = marionette.companionPackage;

let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

console.log('🧪 companionPackage unit checks\n');

// 1. dependency detection
console.log('[detect]');
ok('modern version form', cp.isDependencyDeclared('dependencies:\n  marionette_flutter: ^0.7.0\n', 'marionette_flutter'));
ok('no-version form', cp.isDependencyDeclared('dependencies:\n  marionette_flutter:\n', 'marionette_flutter'));
ok('git form', cp.isDependencyDeclared('  marionette_flutter:\n    git: https://x\n', 'marionette_flutter'));
ok('commented out is NOT installed', !cp.isDependencyDeclared('# marionette_flutter: ^0.7.0\n', 'marionette_flutter'));
ok('absent package', !cp.isDependencyDeclared('dependencies:\n  http: ^1.0.0\n', 'marionette_flutter'));
ok('prefix collision rejected', !cp.isDependencyDeclared('  marionette_flutter_extra: ^1.0.0\n', 'marionette_flutter'));

// 2. the exact main.dart from the user's request
console.log('\n[wire — canonical form]');
const canonical = `import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}
`;
let r = cp.wireMainDart(canonical, pkg);
ok('outcome is edited', r.outcome === 'edited', r.outcome);
ok('sets kDebugMode branch', r.newContent && r.newContent.includes('if (kDebugMode)'));
ok('calls MarionetteBinding', r.newContent && r.newContent.includes('MarionetteBinding.ensureInitialized();'));
ok('keeps release branch', r.newContent && r.newContent.includes('WidgetsFlutterBinding.ensureInitialized();'));
ok('preserves runApp arg', r.newContent && r.newContent.includes('runApp(const MyApp());'));
ok('adds marionette import', r.newContent && r.newContent.includes("import 'package:marionette_flutter/marionette_flutter.dart';"));
ok('does not duplicate material import', (r.newContent.match(/material\.dart/g) || []).length === 1);

// 3. idempotency
console.log('\n[idempotency]');
const once = r.newContent;
const twice = cp.wireMainDart(once, pkg);
ok('second run is a no-op', twice.outcome === 'already-configured', twice.outcome);

// 4. preservation of a custom runApp widget + existing init
console.log('\n[preservation]');
const custom = `import 'package:flutter/material.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const MyCustomApp(home: Home()));
}
`;
r = cp.wireMainDart(custom, pkg);
ok('handles async main', r.outcome === 'edited', r.outcome);
ok('keeps custom runApp argument', r.newContent && r.newContent.includes('runApp(const MyCustomApp(home: Home()));'));

// 5. unsupported forms must NOT be silently mangled
console.log('\n[unsupported]');
const noMain = `import 'package:flutter/material.dart';\nclass X {}\n`;
r = cp.wireMainDart(noMain, pkg);
ok('no main() → unsupported', r.outcome === 'unsupported', r.outcome);
ok('no main() → no content produced', r.newContent === undefined);

const noRunApp = `void main() {\n  doSomethingElse();\n}\n`;
r = cp.wireMainDart(noRunApp, pkg);
ok('main() without runApp → unsupported', r.outcome === 'unsupported', r.outcome);

// 6. arrow form
console.log('\n[arrow form]');
const arrow = `import 'package:flutter/material.dart';\n\nvoid main() => runApp(const MyApp());\n`;
r = cp.wireMainDart(arrow, pkg);
ok('arrow main handled', r.outcome === 'edited', r.outcome);
ok('arrow runApp arg kept', r.newContent && r.newContent.includes('runApp(const MyApp());'));

// 7. import insertion placement
console.log('\n[imports]');
const withImports = `// header comment\nimport 'package:flutter/material.dart';\nimport 'dart:async';\n\nvoid main() {}\n`;
const ins = cp.insertImport(withImports, "import 'package:marionette_flutter/marionette_flutter.dart';");
const lines = ins.split('\n');
ok('import added after last import', lines.indexOf("import 'package:marionette_flutter/marionette_flutter.dart';") === 3, JSON.stringify(lines.slice(0,5)));
ok('no duplicate insert', cp.insertImport(ins, "import 'package:marionette_flutter/marionette_flutter.dart';") === ins);

// 8. catalog integrity after the change
console.log('\n[catalog]');
ok('catalog now has 21 servers', MCP_CATALOG.length === 21, String(MCP_CATALOG.length));
ok('mobile-mcp exists', !!MCP_CATALOG.find((s) => s.id === 'mobile-mcp'));
ok('marionette is dart runtime', marionette.runtime === 'dart', marionette.runtime);
ok('marionette command is the bridge binary', marionette.command === 'marionette_mcp', marionette.command);
const mobile = MCP_CATALOG.find((s) => s.id === 'mobile-mcp');
ok('mobile-mcp uses -y', mobile.args.includes('-y'));
ok('mobile-mcp arg is the official package', mobile.args.includes('@mobilenext/mobile-mcp@latest'), mobile.args.join(' '));
ok('every npx server still passes -y', MCP_CATALOG.filter(s=>s.command==='npx').every(s=>s.args.includes('-y')));

// 9. real file write with backup
console.log('\n[file write]');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-'));
  const mainPath = path.join(dir, 'main.dart');
  fs.writeFileSync(mainPath, canonical);
  const res = cp.wireMainDart(canonical, pkg);
  const { backupPath } = await cp.applyMainDartEdit(mainPath, res, pkg);
  const written = fs.readFileSync(mainPath, 'utf8');
  ok('file written with binding', written.includes('MarionetteBinding.ensureInitialized();'));
  ok('foundation import added (kDebugMode needs it)', written.includes("package:flutter/foundation.dart"));
  ok('backup created', !!backupPath && fs.existsSync(backupPath));
  ok('backup holds the original', fs.readFileSync(backupPath, 'utf8') === canonical);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(stub, { force: true });

  console.log('');
  if (fail > 0) { console.error(`❌ ${fail} failed, ${pass} passed.`); process.exit(1); }
  console.log(`🎉 All ${pass} companion-package checks passed!`);
})();
