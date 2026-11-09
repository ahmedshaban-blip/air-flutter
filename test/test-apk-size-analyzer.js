const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { ApkSizeAnalyzerService } = require('../out/domain/apk-size-analyzer');

(async () => {
  console.log('🧪 Testing ApkSizeAnalyzerService...');

  // 1. Categorization
  assert.deepStrictEqual(ApkSizeAnalyzerService.categorizeEntry('lib/arm64-v8a/libapp.so'), { category: 'native_lib', abi: 'arm64-v8a' });
  assert.deepStrictEqual(ApkSizeAnalyzerService.categorizeEntry('lib/armeabi-v7a/libflutter.so'), { category: 'native_lib', abi: 'armeabi-v7a' });
  assert.deepStrictEqual(ApkSizeAnalyzerService.categorizeEntry('classes.dex'), { category: 'dex_code' });
  assert.deepStrictEqual(ApkSizeAnalyzerService.categorizeEntry('classes2.dex'), { category: 'dex_code' });
  assert.deepStrictEqual(ApkSizeAnalyzerService.categorizeEntry('assets/flutter_assets/fonts/Plex.ttf'), { category: 'assets' });
  assert.deepStrictEqual(ApkSizeAnalyzerService.categorizeEntry('resources.arsc'), { category: 'resources' });
  assert.deepStrictEqual(ApkSizeAnalyzerService.categorizeEntry('META-INF/CERT.RSA'), { category: 'other' });

  // 2. Create mock APK file
  const zip = new AdmZip();
  zip.addFile('lib/arm64-v8a/libapp.so', Buffer.alloc(50000, 'a'));
  zip.addFile('lib/arm64-v8a/libflutter.so', Buffer.alloc(30000, 'b'));
  zip.addFile('assets/flutter_assets/icon.png', Buffer.alloc(10000, 'c'));
  zip.addFile('classes.dex', Buffer.alloc(15000, 'd'));
  zip.addFile('AndroidManifest.xml', Buffer.alloc(2000, 'e'));

  const tempApkPath = path.join(os.tmpdir(), `test-mock-app-${Date.now()}.apk`);
  zip.writeZip(tempApkPath);

  try {
    const service = new ApkSizeAnalyzerService();
    const report = service.analyzeApkFile(tempApkPath);

    assert.strictEqual(report.fileName, path.basename(tempApkPath));
    assert.strictEqual(report.totalUncompressedBytes, 107000);
    assert.strictEqual(report.categories.length, 5);

    // Native lib should be largest (80000 bytes out of 107000)
    const nativeCat = report.categories.find(c => c.category === 'native_lib');
    assert.ok(nativeCat);
    assert.strictEqual(nativeCat.size, 80000);
    assert.strictEqual(nativeCat.percentage > 70, true);

    // ABI summary
    assert.strictEqual(report.abis.length, 1);
    assert.strictEqual(report.abis[0].abi, 'arm64-v8a');
    assert.strictEqual(report.abis[0].size, 80000);

    // Top files
    assert.strictEqual(report.topFiles.length, 5);
    assert.strictEqual(report.topFiles[0].path, 'lib/arm64-v8a/libapp.so');

    // 3. Test findDefaultApks recursive discovery
    const mockProjectDir = path.join(os.tmpdir(), `test-flutter-project-${Date.now()}`);
    const flavorDir = path.join(mockProjectDir, 'build', 'app', 'outputs', 'apk', 'staging');
    fs.mkdirSync(flavorDir, { recursive: true });
    const dummyApk = path.join(flavorDir, 'app-staging-release.apk');
    fs.writeFileSync(dummyApk, 'dummy');

    try {
      const found = ApkSizeAnalyzerService.findDefaultApks(mockProjectDir);
      assert.strictEqual(found.length, 1);
      assert.strictEqual(found[0], dummyApk);

      // Test monorepo / parent folder discovery
      const parentDir = path.dirname(mockProjectDir);
      const nestedFound = ApkSizeAnalyzerService.findDefaultApks(parentDir);
      assert.ok(nestedFound.includes(dummyApk), 'Expected nested discovery to find dummyApk');
    } finally {
      fs.rmSync(mockProjectDir, { recursive: true, force: true });
    }
  } finally {
    if (fs.existsSync(tempApkPath)) {
      fs.unlinkSync(tempApkPath);
    }
  }

  console.log('✅ ApkSizeAnalyzerService tests passed!');
})();

