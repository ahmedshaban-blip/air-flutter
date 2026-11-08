const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CodeCleanupAssistant } = require('../out/domain/code-cleanup-assistant');

(async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-cleanup-packages-'));
  const write = (relativePath, content) => {
    const target = path.join(project, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };

  write('pubspec.yaml', [
    'name: test_app',
    'environment:',
    "  sdk: '>=3.0.0 <4.0.0'",
    'dependencies:',
    '  cupertino_icons: ^1.0.8',
    '  unused_dep: ^1.0.0',
    'dev_dependencies:',
    '  flutter_launcher_icons: ^0.13.1',
    '  flutter_lints: ^3.0.0',
    '  build_runner: ^2.4.0',
    '',
    'flutter_launcher_icons:',
    '  android: true',
    '  ios: true'
  ].join('\n'));

  write('analysis_options.yaml', 'include: package:flutter_lints/flutter.yaml\n');
  write('lib/main.dart', 'void main() {}\n');

  const report = await CodeCleanupAssistant.scan(project);
  const launcherIcons = report.unusedPackages.find(p => p.name === 'flutter_launcher_icons');
  const lints = report.unusedPackages.find(p => p.name === 'flutter_lints');
  const buildRunner = report.unusedPackages.find(p => p.name === 'build_runner');
  const unusedDep = report.unusedPackages.find(p => p.name === 'unused_dep');

  assert.ok(launcherIcons, 'flutter_launcher_icons should be in review list');
  assert.strictEqual(launcherIcons.usageType, 'config');
  assert.strictEqual(launcherIcons.usageDetail, 'pubspec.yaml');

  assert.ok(lints, 'flutter_lints should be in review list');
  assert.strictEqual(lints.usageType, 'config');
  assert.strictEqual(lints.usageDetail, 'analysis_options.yaml');

  assert.ok(buildRunner, 'build_runner should be in review list');
  assert.strictEqual(buildRunner.usageType, 'tool');

  assert.ok(unusedDep, 'unused_dep should be in review list');
  assert.strictEqual(unusedDep.usageType, 'unknown');

  // Test DOM rendering in CodeCleanupModule
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(`
    <div id="codeCleanupSummary"></div>
    <div id="codeCleanupStatus"></div>
    <div id="codeCleanupResults"></div>
  `, { runScripts: 'outside-only' });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'codeCleanupModule.js'), 'utf8'));

  const cleanupModule = new window.AirFlutterCodeCleanupModule();
  cleanupModule.escapeHtml = text => String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  cleanupModule.renderCodeCleanupReport(report);

  const resultsHtml = window.document.getElementById('codeCleanupResults').innerHTML;
  assert.ok(resultsHtml.includes('cleanup-advisory-callout'), 'Advisory callout banner should be rendered');
  assert.ok(resultsHtml.includes('Config: pubspec.yaml'), 'Config badge should be rendered for flutter_launcher_icons');
  assert.ok(resultsHtml.includes('Config: analysis_options.yaml'), 'Config badge should be rendered for flutter_lints');
  assert.ok(resultsHtml.includes('CLI / Dev Tool'), 'CLI tool badge should be rendered for build_runner');
  assert.ok(resultsHtml.includes('Verify Usage'), 'Verify usage badge should be rendered for unused_dep');

  console.log('✅ Unused packages smart detection & UI DOM rendering test passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
