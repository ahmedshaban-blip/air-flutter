const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { JSDOM } = require('jsdom');

console.log('🧪 Starting test-new-tools-suite.js...');

// --- 1. Test Domain Services ---
const { BuildRunnerService } = require('../out/domain/build-runner');
const { IconSplashStudioService } = require('../out/domain/icon-splash-studio');
const { DeviceEnvironmentService } = require('../out/domain/device-environment');
const { LocalizationStudioService } = require('../out/domain/localization-studio');
const { SslDoctorService } = require('../out/domain/ssl-doctor');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-test-'));

try {
    // 1.1 BuildRunnerService tests
    const brService = new BuildRunnerService();
    assert.strictEqual(brService.getStatus().isRunning, false, 'BuildRunner should initially be idle');
    const cacheRes = brService.clearCache(tmpDir);
    assert.strictEqual(cacheRes.ok, true, 'Clear cache should succeed on clean dir');
    console.log('✅ BuildRunnerService tests passed.');

    // 1.2 IconSplashStudioService tests
    const isService = new IconSplashStudioService();
    const pubspecPath = path.join(tmpDir, 'pubspec.yaml');
    fs.writeFileSync(pubspecPath, 'name: test_app\nversion: 1.0.0\n');

    const iconCfgRes = isService.configureFlutterLauncherIcons({
        projectRoot: tmpDir,
        imagePath: 'assets/icon.png',
        backgroundColorHex: '#123456'
    });
    assert.strictEqual(iconCfgRes.ok, true, 'Configure launcher icons should succeed');
    const pubspecAfterIcon = fs.readFileSync(pubspecPath, 'utf8');
    assert.ok(pubspecAfterIcon.includes('flutter_launcher_icons:'), 'pubspec should have launcher icons config');

    const splashCfgRes = isService.configureFlutterNativeSplash({
        projectRoot: tmpDir,
        imagePath: 'assets/icon.png',
        backgroundColorHex: '#FFFFFF',
        fullscreen: true
    });
    assert.strictEqual(splashCfgRes.ok, true, 'Configure native splash should succeed');
    console.log('✅ IconSplashStudioService tests passed.');

    // 1.3 LocalizationStudioService tests
    const locService = new LocalizationStudioService();
    const initLocRes = locService.initWorkspace(tmpDir);
    assert.strictEqual(initLocRes.ok, true, 'Init localization workspace should succeed');
    assert.ok(fs.existsSync(path.join(tmpDir, 'l10n.yaml')), 'l10n.yaml should exist');
    assert.ok(fs.existsSync(path.join(tmpDir, 'lib', 'l10n', 'app_en.arb')), 'app_en.arb should exist');
    assert.ok(fs.existsSync(path.join(tmpDir, 'lib', 'l10n', 'app_ar.arb')), 'app_ar.arb should exist');

    const matrix = locService.getMatrix(tmpDir);
    assert.ok(matrix.locales.includes('en'), 'Matrix should include en locale');
    assert.ok(matrix.locales.includes('ar'), 'Matrix should include ar locale');
    assert.ok(matrix.entries.length > 0, 'Matrix should contain entries');

    const saveKeyRes = locService.saveKey(tmpDir, 'testNewKey', { en: 'Hello', ar: 'مرحبا' });
    assert.strictEqual(saveKeyRes.ok, true, 'Saving key should succeed');

    const aiPrompt = locService.generateAiPrompt(tmpDir, 'fr');
    assert.ok(aiPrompt.includes('Flutter localization translator'), 'AI prompt should be generated properly');
    console.log('✅ LocalizationStudioService tests passed.');

    // 1.4 SslDoctorService tests
    const sslService = new SslDoctorService();
    const initialSslStatus = sslService.getStatus(tmpDir);
    assert.strictEqual(initialSslStatus.hasXmlConfig, false, 'Initial xml config should not exist');

    const applySslRes = sslService.applyNetworkSecurityConfig(tmpDir);
    assert.strictEqual(applySslRes.ok, true, 'Apply network security config should succeed');
    const updatedSslStatus = sslService.getStatus(tmpDir);
    assert.strictEqual(updatedSslStatus.hasXmlConfig, true, 'Updated xml config should exist');

    const devOverridesRes = sslService.generateDevHttpOverrides(tmpDir);
    assert.strictEqual(devOverridesRes.ok, true, 'Generate dev http overrides should succeed');
    assert.ok(fs.existsSync(path.join(tmpDir, 'lib', 'dev_http_overrides.dart')), 'dev_http_overrides.dart should exist');
    console.log('✅ SslDoctorService tests passed.');

    // 1.5 DeviceEnvironmentService tests
    const deService = new DeviceEnvironmentService(
        async () => 'adb',
        async (exec, args) => ({ stdout: '1.0\n', stderr: '' })
    );
    assert.ok(typeof deService.getState === 'function');
    assert.ok(typeof deService.setFontScale === 'function');
    assert.ok(typeof deService.setDarkMode === 'function');
    assert.ok(typeof deService.setBatteryLevel === 'function');
    assert.ok(typeof deService.resetBattery === 'function');
    assert.ok(typeof deService.setLocale === 'function');
    console.log('✅ DeviceEnvironmentService tests passed.');

} finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

// --- 2. Test Panel Markup and 10 Top Tabs in panelHtml.ts ---
console.log('🧪 Verifying panelHtml.ts top tabs contract...');
const panelSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.ts'),
    'utf8'
);

const expectedTabs = [
    'workspace',
    'assets',
    'cleanup',
    'permissions',
    'deep-links',
    'build-runner',
    'icon-splash',
    'device-env',
    'localization',
    'ssl-proxy'
];

expectedTabs.forEach(tab => {
    assert.ok(
        panelSource.includes(`data-panel-tab="${tab}"`),
        `panelHtml.ts must define data-panel-tab="${tab}"`
    );
});
console.log('✅ All 10 top tabs are registered in panelHtml.ts.');

// --- 3. Test Webview DOM & Views Execution ---
console.log('🧪 Testing HTML Views & Webview Modules...');
const { getBuildRunnerViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/buildRunnerViewHtml');
const { getIconSplashViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/iconSplashViewHtml');
const { getDeviceEnvironmentViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/deviceEnvironmentViewHtml');
const { getLocalizationViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/localizationViewHtml');
const { getSslDoctorViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/sslDoctorViewHtml');

const fullViewsHtml = `<!DOCTYPE html><html><body>
    ${getBuildRunnerViewHtml()}
    ${getIconSplashViewHtml()}
    ${getDeviceEnvironmentViewHtml()}
    ${getLocalizationViewHtml()}
    ${getSslDoctorViewHtml()}
</body></html>`;

const dom = new JSDOM(fullViewsHtml, { runScripts: 'outside-only' });
const { window } = dom;
const { document } = window;

// 3.1 Verify Build Runner DOM elements
assert.ok(document.getElementById('brRunBuildBtn'), 'brRunBuildBtn must exist');
assert.ok(document.getElementById('brRunWatchBtn'), 'brRunWatchBtn must exist');
assert.ok(document.getElementById('brStopBtn'), 'brStopBtn must exist');
assert.ok(document.getElementById('brCleanCacheBtn'), 'brCleanCacheBtn must exist');
assert.ok(document.getElementById('brOutputLog'), 'brOutputLog must exist');

// 3.2 Verify Icon & Splash DOM elements
assert.ok(document.getElementById('iconDropZone'), 'iconDropZone must exist');
assert.ok(document.getElementById('deployNativeIconsBtn'), 'deployNativeIconsBtn must exist');
assert.ok(document.getElementById('configLauncherIconsBtn'), 'configLauncherIconsBtn must exist');
assert.ok(document.getElementById('configNativeSplashBtn'), 'configNativeSplashBtn must exist');

// 3.3 Verify Device Environment DOM elements
assert.ok(document.getElementById('deRefreshBtn'), 'deRefreshBtn must exist');
assert.ok(document.getElementById('deFontScaleSlider'), 'deFontScaleSlider must exist');
assert.ok(document.getElementById('deDarkModeOnBtn'), 'deDarkModeOnBtn must exist');
assert.ok(document.getElementById('deResetBatteryBtn'), 'deResetBatteryBtn must exist');
assert.ok(document.getElementById('deRotateAutoBtn'), 'deRotateAutoBtn must exist');

// 3.4 Verify Localization DOM elements
assert.ok(document.getElementById('locScanBtn'), 'locScanBtn must exist');
assert.ok(document.getElementById('locAddKeyModalBtn'), 'locAddKeyModalBtn must exist');
assert.ok(document.getElementById('locCopyAiPromptBtn'), 'locCopyAiPromptBtn must exist');
assert.ok(document.getElementById('locRunGenBtn'), 'locRunGenBtn must exist');
assert.ok(document.getElementById('locTableContainer'), 'locTableContainer must exist');

// 3.5 Verify SSL Doctor DOM elements
assert.ok(document.getElementById('sslRefreshBtn'), 'sslRefreshBtn must exist');
assert.ok(document.getElementById('sslApplyConfigBtn'), 'sslApplyConfigBtn must exist');
assert.ok(document.getElementById('sslGenerateOverridesBtn'), 'sslGenerateOverridesBtn must exist');
assert.ok(document.getElementById('sslCopySnippetBtn'), 'sslCopySnippetBtn must exist');
assert.ok(document.getElementById('sslApplyProxyBtn'), 'sslApplyProxyBtn must exist');

console.log('🎉 All 10 tabs, DOM elements, and view templates verified successfully!');
