const assert = require('assert');
const { PubHealthService } = require('../out/domain/pub-health');

(async () => {
  console.log('🧪 Testing PubHealthService...');

  const sampleJson = JSON.stringify({
    packages: [
      {
        package: 'http',
        kind: 'direct',
        current: { version: '0.13.5' },
        upgradable: { version: '0.13.6' },
        resolvable: { version: '1.2.0' },
        latest: { version: '1.2.0' }
      },
      {
        package: 'path',
        kind: 'direct',
        current: { version: '1.9.0' },
        upgradable: { version: '1.9.0' },
        resolvable: { version: '1.9.0' },
        latest: { version: '1.9.0' }
      },
      {
        package: 'shared_preferences',
        kind: 'direct',
        current: { version: '2.0.15' },
        upgradable: { version: '2.0.15' },
        resolvable: { version: '2.2.0' },
        latest: { version: '2.2.0' }
      }
    ]
  });

  const summary = PubHealthService.parsePubOutdatedJson(sampleJson);
  assert.strictEqual(summary.total, 3);
  assert.strictEqual(summary.upToDateCount, 1); // path
  assert.strictEqual(summary.upgradableCount, 1); // http
  assert.strictEqual(summary.majorUpdateCount, 1); // shared_preferences

  const httpPkg = summary.packages.find(p => p.name === 'http');
  assert.ok(httpPkg);
  assert.strictEqual(httpPkg.status, 'upgradable');

  const pathPkg = summary.packages.find(p => p.name === 'path');
  assert.ok(pathPkg);
  assert.strictEqual(pathPkg.status, 'up_to_date');

  const spPkg = summary.packages.find(p => p.name === 'shared_preferences');
  assert.ok(spPkg);
  assert.strictEqual(spPkg.status, 'major_update');

  // Test missing pubspec.yaml guard
  const service = new PubHealthService();
  await assert.rejects(
    () => service.checkHealth(__dirname),
    /missing pubspec\.yaml/
  );

  // Test with mock process
  const executed = [];
  const mockService = new PubHealthService(async (exe, args, cwd) => {
    executed.push({ exe, args, cwd });
    return { stdout: sampleJson, stderr: '' };
  });

  // Create temporary fixture with pubspec.yaml
  const os = require('os');
  const fs = require('fs');
  const pathMod = require('path');
  const tmpDir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'flutter-fixture-'));
  fs.writeFileSync(pathMod.join(tmpDir, 'pubspec.yaml'), 'name: fixture\n');

  try {
    const res = await mockService.checkHealth(tmpDir);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(executed.length, 1);
    assert.strictEqual(executed[0].exe, 'flutter');
    assert.deepStrictEqual(executed[0].args, ['pub', 'outdated', '--json']);
    assert.strictEqual(executed[0].cwd, tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('✅ PubHealthService tests passed!');
})();

