const assert = require('assert');
const { AssetAssistant } = require('../out/domain/asset-assistant');

const corruptedPubspec = `name: truck_world_store
description: "A new Flutter project."
version: 1.0.0+1

environment:
  sdk: ^3.12.2

dependencies:
  flutter:
    sdk: flutter
  # Arabic and RTL localization delegates for Material/Cupertino widgets.
    assets:
      - assets/4k.webp
      - assets/fonts/NotoKufiArabic-Black.ttf
      - assets/images/background.png
      - assets/images/logo.png
  flutter_localizations:
    sdk: flutter

  cupertino_icons: ^1.0.8

dev_dependencies:
  flutter_test:
    sdk: flutter

flutter:
  uses-material-design: true

  assets:
    - assets/images/
    - .env

  fonts:
    - family: NotoKufiArabic
      fonts:
        - asset: assets/fonts/NotoKufiArabic-Light.ttf
          weight: 300
        - asset: assets/fonts/NotoKufiArabic-Regular.ttf
          weight: 400
`;

console.log('🧪 Testing AssetAssistant with corrupted pubspec...');

// 1. Test parsePubspecLines finds root flutter (indent 0) and assets
const parsed = AssetAssistant['parsePubspecLines'](corruptedPubspec.split(/\r?\n/));
console.log('Parsed flutterLine:', parsed.flutterLine, 'flutterIndent:', parsed.flutterIndent, 'assetsLine:', parsed.assetsLine);
console.log('Parsed entries count:', parsed.entries.length);

assert.strictEqual(parsed.flutterIndent, 0, 'Root flutter section must have 0 indentation');
assert.ok(parsed.flutterLine > 20, 'Root flutter section must be after dependencies');
assert.ok(parsed.entries.includes('assets/images/'), 'Existing assets under root flutter must be parsed');
assert.ok(parsed.entries.includes('assets/fonts/NotoKufiArabic-Light.ttf'), 'Existing font under root flutter fonts must be parsed');

// 2. Test isDeclared for directory prefix and fonts
assert.strictEqual(AssetAssistant['isDeclared']('assets/images/logo.png', parsed.entries), true, 'File under assets/images/ should be declared');
assert.strictEqual(AssetAssistant['isDeclared']('assets/images/background.png', parsed.entries), true, 'File under assets/images/ should be declared');
assert.strictEqual(AssetAssistant['isDeclared']('assets/fonts/NotoKufiArabic-Light.ttf', parsed.entries), true, 'Declared font should be declared');
assert.strictEqual(AssetAssistant['isDeclared']('assets/4k.webp', parsed.entries), false, 'assets/4k.webp is not declared in root');

// 3. Test cleanMisplacedAssetsUnderDependencies
const { cleaned, rescuedAssets } = AssetAssistant['cleanMisplacedAssetsUnderDependencies'](corruptedPubspec);
console.log('Rescued assets:', rescuedAssets);
assert.ok(rescuedAssets.includes('assets/4k.webp'));
assert.ok(!cleaned.includes('    assets:\n      - assets/4k.webp'));

// 4. Test injectAssets cleans dependencies and injects only missing into root flutter: assets:
const updated = AssetAssistant.injectAssets(corruptedPubspec, ['assets/4k.webp']);
const updatedLines = updated.split(/\r?\n/);
const depFlutterIdx = updatedLines.findIndex(l => l.trim() === 'flutter:' && l.startsWith('  '));
const assetsUnderDep = updatedLines.slice(depFlutterIdx, depFlutterIdx + 8).some(l => l.includes('assets:'));

assert.strictEqual(assetsUnderDep, false, 'assets: MUST NOT exist under dependencies: flutter:');
assert.ok(updated.includes('    - assets/4k.webp'), 'assets/4k.webp must be injected under root assets:');

// 5. Test that fonts are NEVER injected into assets:
assert.ok(!updated.includes('NotoKufiArabic-Black.ttf'), 'Undeclared font MUST NOT be injected into assets:');
assert.ok(!updated.includes('NotoKufiArabic-Thin.ttf'), 'Undeclared font MUST NOT be injected into assets:');

// 6. Test inferFontDetails
const fontInfo = AssetAssistant.inferFontDetails('assets/fonts/NotoKufiArabic-Black.ttf');
assert.strictEqual(fontInfo.family, 'NotoKufiArabic');
assert.strictEqual(fontInfo.weight, 900);

const thinFont = AssetAssistant.inferFontDetails('assets/fonts/NotoKufiArabic-Thin.ttf');
assert.strictEqual(thinFont.family, 'NotoKufiArabic');
assert.strictEqual(thinFont.weight, 100);

// 7. Test injectFonts properly inserts font into existing family under flutter: fonts:
const fontInjected = AssetAssistant.injectFonts(cleaned, ['assets/fonts/NotoKufiArabic-Black.ttf']);
assert.ok(fontInjected.includes('- asset: assets/fonts/NotoKufiArabic-Black.ttf'));
assert.ok(fontInjected.includes('weight: 900'));
// Make sure it did NOT create duplicate family
const famMatches = fontInjected.match(/family:\s*NotoKufiArabic/g);
assert.strictEqual(famMatches.length, 1, 'Should only have one NotoKufiArabic family');

// 8. Test addSelectedToPubspec with selective images and fonts
const selectiveResult = AssetAssistant.addSelectedToPubspec(cleaned, [
  'assets/4k.webp',
  'assets/fonts/NotoKufiArabic-ExtraBold.ttf'
]);
assert.deepStrictEqual(selectiveResult.addedImages, ['assets/4k.webp']);
assert.deepStrictEqual(selectiveResult.addedFonts, ['assets/fonts/NotoKufiArabic-ExtraBold.ttf']);
assert.ok(selectiveResult.updated.includes('- assets/4k.webp'), 'Image must be in assets:');
assert.ok(selectiveResult.updated.includes('- asset: assets/fonts/NotoKufiArabic-ExtraBold.ttf'), 'Font must be in fonts:');
assert.ok(selectiveResult.updated.includes('weight: 800'), 'Font weight 800 must be inferred');

console.log('✅ All AssetAssistant pubspec tests passed!');
