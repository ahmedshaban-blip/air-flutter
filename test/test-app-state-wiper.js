const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AppStateWiper } = require('../out/domain/app-state-wiper');

(async () => {
  // --- package-id validation -------------------------------------------------
  assert.strictEqual(AppStateWiper.isValidPackageId('com.example.myapp'), true);
  assert.strictEqual(AppStateWiper.isValidPackageId('com.example.my_app2'), true);
  assert.strictEqual(AppStateWiper.isValidPackageId('a.b.c'), true);

  assert.strictEqual(AppStateWiper.isValidPackageId(''), false, 'empty must be rejected');
  assert.strictEqual(AppStateWiper.isValidPackageId('   '), false);
  assert.strictEqual(AppStateWiper.isValidPackageId('com'), false, 'single segment rejected');
  assert.strictEqual(AppStateWiper.isValidPackageId('.com.app'), false);
  assert.strictEqual(AppStateWiper.isValidPackageId('com.example.app;rm -rf /'), false);
  assert.strictEqual(AppStateWiper.isValidPackageId('com.exa mple.app'), false);
  assert.strictEqual(AppStateWiper.isValidPackageId('com.1example.app'), false);
  assert.strictEqual(AppStateWiper.isValidPackageId(null), false);
  assert.strictEqual(AppStateWiper.isValidPackageId(undefined), false);
  console.log('✅ Package id validation verified');

  // --- system package detection ---------------------------------------------
  assert.strictEqual(AppStateWiper.isLikelySystemPackage('com.android.settings'), true);
  assert.strictEqual(AppStateWiper.isLikelySystemPackage('android'), true);
  assert.strictEqual(AppStateWiper.isLikelySystemPackage('com.google.android.gms'), true);
  assert.strictEqual(AppStateWiper.isLikelySystemPackage('com.samsung.android.app'), true);
  assert.strictEqual(AppStateWiper.isLikelySystemPackage('com.example.myapp'), false);
  assert.strictEqual(AppStateWiper.isLikelySystemPackage('io.flutter.demo'), false);
  console.log('✅ System package guard verified');

  // --- applicationId extraction ---------------------------------------------
  assert.strictEqual(
    AppStateWiper.extractApplicationId('android {\n applicationId "com.example.groovy"\n}'),
    'com.example.groovy'
  );
  assert.strictEqual(
    AppStateWiper.extractApplicationId("applicationId 'com.example.single'"),
    'com.example.single'
  );
  assert.strictEqual(
    AppStateWiper.extractApplicationId('applicationId = "com.example.kts"'),
    'com.example.kts'
  );
  assert.strictEqual(
    AppStateWiper.extractApplicationId('applicationId = "com.example.kts.flavor"'),
    'com.example.kts.flavor'
  );
  // A commented-out line should still yield a match, but an invalid first id is
  // skipped in favour of the next valid one.
  assert.strictEqual(
    AppStateWiper.extractApplicationId('applicationId ""\napplicationId "com.example.valid"'),
    'com.example.valid'
  );
  assert.strictEqual(AppStateWiper.extractApplicationId('namespace "com.example.ns"'), undefined);
  assert.strictEqual(AppStateWiper.extractApplicationId(''), undefined);
  console.log('✅ applicationId extraction (Groovy & Kotlin DSL) verified');

  // --- project-level resolution ---------------------------------------------
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-wipe-'));
  fs.mkdirSync(path.join(project, 'android', 'app'), { recursive: true });
  fs.writeFileSync(
    path.join(project, 'android', 'app', 'build.gradle'),
    'android {\n    defaultConfig {\n        applicationId "com.example.from_gradle"\n    }\n}\n'
  );
  assert.strictEqual(
    AppStateWiper.readApplicationId(project),
    'com.example.from_gradle'
  );

  // Kotlin DSL takes over when the Groovy file is absent.
  const ktsProject = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-wipe-kts-'));
  fs.mkdirSync(path.join(ktsProject, 'android', 'app'), { recursive: true });
  fs.writeFileSync(
    path.join(ktsProject, 'android', 'app', 'build.gradle.kts'),
    'android {\n    defaultConfig {\n        applicationId = "com.example.from_kts"\n    }\n}\n'
  );
  assert.strictEqual(AppStateWiper.readApplicationId(ktsProject), 'com.example.from_kts');

  // Missing android folder resolves to undefined, never throws.
  const emptyProject = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-wipe-empty-'));
  assert.strictEqual(AppStateWiper.readApplicationId(emptyProject), undefined);
  console.log('✅ Project applicationId resolution verified');

  console.log(`App state wiper tests passed. Fixtures: ${project}, ${ktsProject}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
