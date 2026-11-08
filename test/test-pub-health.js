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

  console.log('✅ PubHealthService tests passed!');
})();

