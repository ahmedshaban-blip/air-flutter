const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CodeCleanupAssistant } = require('../out/domain/code-cleanup-assistant');

(async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-cleanup-scope-'));
  const write = (relativePath, content) => {
    const target = path.join(project, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };

  write('pubspec.yaml', "name: cleanup_scope\nenvironment:\n  sdk: '>=3.0.0 <4.0.0'\n");
  write('lib/main.dart', [
    "import 'src/active.dart';",
    "import 'src/model.g.dart';",
    'void main() { runActive(); }',
    '// final oldMainFlag = true;',
    '// final value is cached to make rendering faster.',
    '// return the active route selected by the user.',
    '// if (the device disconnects), the UI explains what happened.',
    '// Keep this explanatory note;',
    ''
  ].join('\n'));
  write('lib/src/active.dart', [
    'void runActive() {}',
    '// void oldActiveFeature() {}',
    '// This method updates the screen without rebuilding the parent.',
    ''
  ].join('\n'));
  write('lib/src/model.g.dart', '// final generatedField = 1;\n');
  write('lib/orphan.dart', '// void orphanedFeature() {}\n');
  write('test/widget_test.dart', '// void disabledTest() {}\n');
  write('integration_test/app_test.dart', '// void disabledIntegrationTest() {}\n');
  write('tool/release.dart', '// void oldReleaseTool() {}\n');
  write('example/lib/main.dart', '// void oldExample() {}\n');

  const report = await CodeCleanupAssistant.scan(project);
  const commentedFiles = report.findings
    .filter(finding => finding.kind === 'commented-code')
    .map(finding => finding.file)
    .sort();

  assert.deepStrictEqual(commentedFiles, ['lib/main.dart', 'lib/src/active.dart']);
  assert.ok(report.unusedFiles.some(file => file.file === 'lib/orphan.dart'));
  console.log('✅ Commented-out code scan is limited to production build sources');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
