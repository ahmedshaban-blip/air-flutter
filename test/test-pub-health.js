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
    assert.strictEqual(executed.length, 2);
    assert.strictEqual(executed[0].exe, 'flutter');
    assert.deepStrictEqual(executed[0].args, ['pub', 'outdated', '--json']);
    assert.strictEqual(executed[1].exe, 'flutter');
    assert.deepStrictEqual(executed[1].args, ['pub', 'deps', '--json']);
    assert.strictEqual(executed[0].cwd, tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Test pubspec syntax error parser
  const userErrorOutput = `flutter pub outdated failed: Command failed: flutter pub outdated --json Error on line 32, column 5 of pubspec.yaml: A dependency may only have one source. ╷ 32 │ ┌ sdk: flutter 33 │ │ # Arabic and RTL localization delegates for Material/Cupertino widgets. 34 │ │ assets: 35 │ │ - assets/4k.webp 50 │ │ flutter_localizations: │ └──^ ╵ Failed to update packages.`;

  const diagnostics = PubHealthService.parsePubspecError(userErrorOutput, '/dummy/project');
  assert.ok(diagnostics, 'Diagnostics should not be null');
  assert.strictEqual(diagnostics.isPubspecError, true);
  assert.strictEqual(diagnostics.line, 32);
  assert.strictEqual(diagnostics.column, 5);
  assert.ok(diagnostics.title.includes('Line 32'));
  assert.ok(diagnostics.suggestion.includes('assets:'));
  assert.ok(diagnostics.suggestion.includes('flutter:'));

  // Test deps parser and parent package mapping
  const sampleDepsJson = JSON.stringify({
    root: 'my_app',
    packages: [
      {
        name: 'my_app',
        kind: 'root',
        dependencies: ['supabase_flutter', 'mockito']
      },
      {
        name: 'supabase_flutter',
        kind: 'direct',
        dependencies: ['sqflite_common', 'shared_preferences_foundation']
      },
      {
        name: 'mockito',
        kind: 'dev',
        dependencies: ['test_api']
      },
      {
        name: 'test_api',
        kind: 'transitive',
        dependencies: ['stack_trace']
      }
    ]
  });

  const parentMap = PubHealthService.parsePubDepsJson(sampleDepsJson);
  assert.ok(parentMap.has('sqflite_common'));
  assert.deepStrictEqual(parentMap.get('sqflite_common'), ['supabase_flutter']);
  assert.deepStrictEqual(parentMap.get('test_api'), ['mockito']);
  assert.deepStrictEqual(parentMap.get('stack_trace'), ['test_api']);

  // Test parsePubOutdatedJson with parentMap
  const sampleWithTransitive = JSON.stringify({
    packages: [
      {
        package: 'test_api',
        kind: 'transitive',
        current: { version: '0.7.12' },
        upgradable: { version: '0.7.12' },
        latest: { version: '0.7.15' }
      }
    ]
  });
  const summaryTransitive = PubHealthService.parsePubOutdatedJson(sampleWithTransitive, parentMap);
  assert.strictEqual(summaryTransitive.packages[0].name, 'test_api');
  assert.deepStrictEqual(summaryTransitive.packages[0].parentPackages, ['mockito']);

  // Test updatePackages and upgradeTransitivePackage
  const updateCmds = [];
  const testTmp = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'flutter-test-update-'));
  fs.writeFileSync(pathMod.join(testTmp, 'pubspec.yaml'), 'name: fixture\n');

  try {
    const updateService = new PubHealthService(async (exe, args, cwd) => {
      updateCmds.push({ exe, args, cwd });
      return { stdout: 'Package updated', stderr: '' };
    });

    await updateService.updatePackages(testTmp, [
      { name: 'dio', version: '5.9.0', isDev: false },
      { name: 'flutter_lints', version: '6.0.0', isDev: true }
    ]);

    assert.strictEqual(updateCmds.length, 2);
    assert.deepStrictEqual(updateCmds[0].args, ['pub', 'add', 'dio:^5.9.0']);
    assert.deepStrictEqual(updateCmds[1].args, ['pub', 'add', '--dev', 'flutter_lints:^6.0.0']);

    await updateService.upgradeTransitivePackage(testTmp, 'test_api');
    assert.strictEqual(updateCmds.length, 3);
    assert.deepStrictEqual(updateCmds[2].args, ['pub', 'upgrade', 'test_api']);
  } finally {
    fs.rmSync(testTmp, { recursive: true, force: true });
  }

  console.log('✅ PubHealthService tests passed!');
})();

