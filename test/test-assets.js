const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AssetAssistant } = require('../out/domain/asset-assistant');
const { CodeCleanupAssistant } = require('../out/domain/code-cleanup-assistant');

(async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-assets-'));
  fs.mkdirSync(path.join(project, 'assets', 'images'), { recursive: true });
  fs.mkdirSync(path.join(project, 'assets', 'icons'), { recursive: true });
  fs.mkdirSync(path.join(project, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(project, 'assets', 'images', 'new_logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(project, 'assets', 'images', 'unused_banner.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(project, 'assets', 'icons', 'bad name.bmp'), Buffer.alloc(1024 * 1024 + 1));
  fs.writeFileSync(path.join(project, 'assets', 'existing.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(project, 'pubspec.yaml'), [
    'name: asset_fixture',
    'environment:',
    "  sdk: '>=3.0.0 <4.0.0'",
    '# Keep this comment',
    'flutter:',
    '  uses-material-design: true',
    '  assets:',
    '    - assets/existing.png # Keep inline comment',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(project, 'lib', 'main.dart'), [
    "import 'core/constants/app_assets.dart';",
    'void main() {',
    '  print(AppAssets.newLogo);',
    '}',
    'void _unusedFeature() {}',
    'void unusedPublicFeature() {}',
    '// final disabledFeature = true;',
    '/* void oldFeature() {} */',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(project, 'lib', 'orphan.dart'), 'void orphanFeature() {}\n');

  const report = await AssetAssistant.scanAndSync(project);
  assert.strictEqual(report.files.length, 4);
  assert.strictEqual(report.pubspecUpdated, true);
  assert.deepStrictEqual(report.missingFromPubspec, [
    'assets/icons/bad name.bmp',
    'assets/images/new_logo.png',
    'assets/images/unused_banner.png'
  ]);
  const problematic = report.files.find(file => file.path.includes('bad name'));
  assert.ok(problematic.warnings.includes('heavy'));
  assert.ok(problematic.warnings.includes('spaces'));
  assert.ok(problematic.warnings.includes('non-standard-format'));

  const pubspec = fs.readFileSync(path.join(project, 'pubspec.yaml'), 'utf8');
  assert.ok(pubspec.includes('# Keep this comment'));
  assert.ok(pubspec.includes('assets/existing.png # Keep inline comment'));
  assert.ok(pubspec.includes("    - 'assets/icons/bad name.bmp'"));
  assert.ok(pubspec.includes('    - assets/images/new_logo.png'));
  const withoutBanner = AssetAssistant.removeAssetDeclaration(pubspec, 'assets/images/unused_banner.png');
  assert.ok(!withoutBanner.includes('assets/images/unused_banner.png'));
  assert.ok(withoutBanner.includes('# Keep this comment'));

  const generated = await AssetAssistant.generateConstants(project, report.files);
  assert.strictEqual(generated.generatedCount, 4);
  const dart = fs.readFileSync(generated.outputPath, 'utf8');
  assert.ok(dart.includes("static const String newLogo = 'assets/images/new_logo.png';"));
  const usageReport = await AssetAssistant.scan(project);
  assert.strictEqual(usageReport.files.find(file => file.path.endsWith('new_logo.png')).used, true);
  assert.strictEqual(usageReport.files.find(file => file.path.endsWith('unused_banner.png')).safeToDelete, true);
  assert.strictEqual(usageReport.files.find(file => file.path.endsWith('bad name.bmp')).safeToDelete, true);

  fs.writeFileSync(generated.outputPath, 'abstract class AppAssets { static const custom = true; }\n');
  const protectedResult = await AssetAssistant.generateConstants(project, report.files);
  assert.strictEqual(protectedResult.requiresConfirmation, true);
  assert.ok(fs.readFileSync(generated.outputPath, 'utf8').includes('custom = true'));
  await AssetAssistant.replaceConstants(project, report.files);

  const inlineYaml = 'flutter:\n  assets: [] # keep me\n';
  const expandedYaml = AssetAssistant.injectAssets(inlineYaml, ['assets/images/logo.png']);
  assert.ok(expandedYaml.includes('  assets: # keep me\n    - assets/images/logo.png'));

  const cleanup = await CodeCleanupAssistant.scan(project);
  assert.ok(cleanup.unusedFiles.some(file => file.file === 'lib/orphan.dart'));
  assert.ok(cleanup.findings.some(finding => finding.kind === 'commented-code' && finding.file === 'lib/main.dart'));
  assert.ok(cleanup.findings.filter(finding => finding.kind === 'commented-code').length >= 2);
  assert.ok(cleanup.findings.some(finding => finding.code === 'unused_element' && finding.file === 'lib/main.dart'));
  assert.ok(cleanup.findings.some(finding => finding.code === 'possibly_unused_public_function' && finding.file === 'lib/main.dart'));

  const syncedPubspec = fs.readFileSync(path.join(project, 'pubspec.yaml'), 'utf8');
  fs.writeFileSync(path.join(project, 'pubspec.yaml'), `${syncedPubspec}\ndependencies:\n  collection: any\n`);
  const packageCleanup = await CodeCleanupAssistant.scan(project);
  assert.ok(packageCleanup.unusedPackages.some(pkg => pkg.name === 'collection'));
  fs.writeFileSync(path.join(project, 'pubspec.yaml'), syncedPubspec);

  const mainPath = path.join(project, 'lib', 'main.dart');
  fs.writeFileSync(
    mainPath,
    fs.readFileSync(mainPath, 'utf8')
      .replace('void _unusedFeature() {}\n', '')
      .replace('void unusedPublicFeature() {}\n', '')
  );

  // Test resolution variants (2.0x, 3.0x)
  fs.mkdirSync(path.join(project, 'assets', 'images', '2.0x'), { recursive: true });
  fs.mkdirSync(path.join(project, 'assets', 'images', '3.0x'), { recursive: true });
  fs.writeFileSync(path.join(project, 'assets', 'images', '2.0x', 'new_logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(project, 'assets', 'images', '3.0x', 'new_logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const variantScan = await AssetAssistant.scan(project);
  const logoAsset = variantScan.files.find(f => f.path === 'assets/images/new_logo.png');
  assert.ok(logoAsset, 'Base logo asset should exist');
  assert.ok(logoAsset.variants && logoAsset.variants.length === 2, 'Should detect 2 variants for logo');
  assert.strictEqual(logoAsset.variants[0].ratio, '2.0x');
  assert.strictEqual(logoAsset.variants[1].ratio, '3.0x');

  const variant2x = variantScan.files.find(f => f.path === 'assets/images/2.0x/new_logo.png');
  assert.ok(variant2x.isVariant);
  assert.strictEqual(variant2x.parentPath, 'assets/images/new_logo.png');
  assert.strictEqual(variant2x.used, true, 'Variant should mirror parent used status');
  assert.ok(!variantScan.missingFromPubspec.includes('assets/images/2.0x/new_logo.png'), 'Variants must not be marked missing from pubspec');

  const variantConstants = await AssetAssistant.generateConstants(project, variantScan.files);
  const variantDart = fs.readFileSync(variantConstants.outputPath, 'utf8');
  assert.ok(!variantDart.includes('2.0x'), 'Variants should not have duplicate constants generated');

  // Test toSnakeCase
  assert.strictEqual(AssetAssistant.toSnakeCase('Hero Banner (1).PNG'), 'hero_banner_1.png');
  assert.strictEqual(AssetAssistant.toSnakeCase('myAppLogo.svg'), 'my_app_logo.svg');

  // Test replaceAssetDeclaration
  const testYaml = 'flutter:\n  assets:\n    - assets/images/logo.png\n';
  const replacedYaml = AssetAssistant.replaceAssetDeclaration(testYaml, 'assets/images/logo.png', 'assets/images/logo.webp');
  assert.ok(replacedYaml.includes('assets/images/logo.webp'));

  // Test deleteAssetFiles
  const delResult = await AssetAssistant.deleteAssetFiles(project, ['assets/images/unused_banner.png']);
  assert.strictEqual(delResult.deleted.length, 1);
  assert.ok(!fs.existsSync(path.join(project, 'assets', 'images', 'unused_banner.png')));

  console.log(`Asset Assistant tests passed. Fixture: ${project}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
