const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BugReportPackager } = require('../out/domain/bug-report-packager');

class FakeRunner {
  async run(args) {
    const command = args.join(' ');
    if (command.includes('logcat')) {
      return [
        '11-04 10:00:00.000  123  123 E AndroidRuntime: password=hunter2',
        '11-04 10:00:00.001  123  123 E Flutter: Authorization: Bearer abc.def.ghi',
        '11-04 10:00:00.002  123  123 E Flutter: api_key=secret-value',
        '11-04 10:00:00.003  123  123 E Flutter: {"refresh_token":"json-secret"}'
      ].join('\n');
    }
    if (command.includes('getprop')) {
      return [
        '[ro.product.manufacturer]: [Google]',
        '[ro.product.model]: [Pixel 8]',
        '[ro.build.version.release]: [15]',
        '[ro.build.version.sdk]: [35]'
      ].join('\n');
    }
    if (command.includes('wm size')) return 'Physical size: 1080x2400\n';
    if (command.includes('dumpsys battery')) return 'status: 2\nlevel: 87\n';
    return '';
  }

  async captureScreenshot(_serial, destination) {
    fs.writeFileSync(destination, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
}

(async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-report-'));
  const result = await new BugReportPackager(new FakeRunner()).create(workspace, 'device-1');

  assert(fs.existsSync(result.screenshotPath), 'screenshot should be saved');
  assert(fs.existsSync(result.reportPath), 'Markdown report should be saved');
  assert(result.elapsedMilliseconds < 3000, 'capture should complete within three seconds');
  assert(result.markdown.includes('Google Pixel 8 (Android 15, API 35)'));
  assert(result.markdown.includes('1080x2400'));
  assert(result.markdown.includes('87% (Charging)'));
  assert(!result.markdown.includes('hunter2'));
  assert(!result.markdown.includes('abc.def.ghi'));
  assert(!result.markdown.includes('secret-value'));
  assert(!result.markdown.includes('json-secret'));
  assert(result.markdown.includes('password=***'));
  assert(result.markdown.includes('Authorization: ***'));
  assert(result.markdown.includes('api_key=***'));
  assert(result.markdown.includes('"refresh_token":"***"'));

  const parsed = BugReportPackager.parseDeviceDiagnostics(
    '[ro.product.manufacturer]: [Samsung]\n[ro.product.model]: [S24]',
    'Physical size: 1080x2340\nOverride size: 720x1560',
    'status: 3\nlevel: 42'
  );
  assert.strictEqual(parsed.resolution, '720x1560');
  assert.strictEqual(parsed.battery, '42% (Discharging)');

  console.log(`Bug report packager tests passed. Fixture: ${workspace}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
