const assert = require('assert');
const { StorageInspectorService, KNOWN_STORAGE_PRESETS } = require('../out/domain/storage-inspector');

(async () => {
  console.log('🧪 Testing StorageInspectorService...');

  // 1. Presets
  assert.strictEqual(KNOWN_STORAGE_PRESETS.length >= 3, true);
  assert.strictEqual(KNOWN_STORAGE_PRESETS[0].id, 'shared_preferences');

  // 2. parseLsOutput & detectCategory
  const sampleLs = `
/data/data/com.example.app:
total 24
drwxrwx--x  5 u0_a123 u0_a123 4096 2026-11-08 20:00 app_flutter
drwxrwx--x  2 u0_a123 u0_a123 4096 2026-11-08 20:00 cache
drwxrwx--x  2 u0_a123 u0_a123 4096 2026-11-08 20:00 databases
drwxrwx--x  2 u0_a123 u0_a123 4096 2026-11-08 20:00 shared_prefs

/data/data/com.example.app/shared_prefs:
total 16
-rw-rw----  1 u0_a123 u0_a123 1024 2026-11-08 20:00 FlutterSharedPreferences.xml
-rw-rw----  1 u0_a123 u0_a123  512 2026-11-08 20:00 analytics_prefs.xml

/data/data/com.example.app/databases:
total 32
-rw-rw----  1 u0_a123 u0_a123 16384 2026-11-08 20:00 app_database.db
-rw-rw----  1 u0_a123 u0_a123  8192 2026-11-08 20:00 app_database.db-wal

/data/data/com.example.app/app_flutter:
total 16
-rw-rw----  1 u0_a123 u0_a123  4096 2026-11-08 20:00 user_box.hive
`;

  const files = StorageInspectorService.parseLsOutput(sampleLs);
  assert.strictEqual(files.length >= 5, true);

  const sharedPrefsFile = files.find(f => f.name === 'FlutterSharedPreferences.xml');
  assert.ok(sharedPrefsFile);
  assert.strictEqual(sharedPrefsFile.category, 'shared_prefs');
  assert.strictEqual(sharedPrefsFile.sizeBytes, 1024);

  const dbFile = files.find(f => f.name === 'app_database.db');
  assert.ok(dbFile);
  assert.strictEqual(dbFile.category, 'sqlite');

  const hiveFile = files.find(f => f.name === 'user_box.hive');
  assert.ok(hiveFile);
  assert.strictEqual(hiveFile.category, 'hive_isar');

  // 3. SharedPreferences XML parsing
  const xml = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="flutter.user_token">abc-123-xyz</string>
    <int name="flutter.theme_mode" value="2" />
    <boolean name="flutter.is_logged_in" value="true" />
</map>`;

  const prefItems = StorageInspectorService.parseSharedPrefsXml(xml);
  assert.strictEqual(prefItems.length, 3);
  assert.strictEqual(prefItems[0].key, 'flutter.user_token');
  assert.strictEqual(prefItems[0].value, 'abc-123-xyz');
  assert.strictEqual(prefItems[0].type, 'string');
  assert.strictEqual(prefItems[1].key, 'flutter.theme_mode');
  assert.strictEqual(prefItems[1].value, '2');
  assert.strictEqual(prefItems[2].value, 'true');

  // 4. SharedPreferences XML building
  const builtXml = StorageInspectorService.buildSharedPrefsXml(prefItems);
  assert.match(builtXml, /<string name="flutter\.user_token">abc-123-xyz<\/string>/);
  assert.match(builtXml, /<int name="flutter\.theme_mode" value="2" \/>/);

  // 5. SQLite parsing
  const sqliteRaw = `
id = 1
name = Alice
email = alice@example.com

id = 2
name = Bob
email = bob@example.com
`;

  const queryResult = StorageInspectorService.parseSqliteLineOutput(sqliteRaw);
  assert.strictEqual(queryResult.totalCount, 2);
  assert.deepStrictEqual(queryResult.columns.sort(), ['email', 'id', 'name']);
  assert.strictEqual(queryResult.rows[0].name, 'Alice');
  assert.strictEqual(queryResult.rows[1].name, 'Bob');

  // 6. Service interaction with mock runner
  const calls = [];
  const service = new StorageInspectorService(
    async () => 'adb',
    async (exe, args) => {
      calls.push({ exe, args });
      return { stdout: sampleLs, stderr: '' };
    }
  );

  const inspected = await service.listStorageFiles('serial1', 'com.example.app', 'auto');
  assert.strictEqual(inspected.packageId, 'com.example.app');
  assert.strictEqual(inspected.files.length >= 5, true);

  // Presets filtering
  const filtered = await service.listStorageFiles('serial1', 'com.example.app', 'presets', ['shared_preferences']);
  assert.strictEqual(filtered.files.every(f => f.category === 'shared_prefs'), true);

  console.log('✅ StorageInspectorService tests passed!');
})();

