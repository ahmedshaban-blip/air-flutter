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

    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X9Z4WQAAAABJRU5ErkJggg==';
    const pngAtSize = size => {
        const png = Buffer.from(tinyPng.split(',')[1], 'base64');
        png.writeUInt32BE(size, 16);
        png.writeUInt32BE(size, 20);
        return `data:image/png;base64,${png.toString('base64')}`;
    };
    fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'ios', 'Runner'), { recursive: true });
    const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
    const legacySizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
    const adaptiveSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
    const densityIcons = densities.map(density => ({ density, base64Png: pngAtSize(legacySizes[density]) }));
    const adaptiveIcons = densities.map(density => ({ density, base64Png: pngAtSize(adaptiveSizes[density]) }));
    const iosDefinitions = [
        ['Icon-App-20x20@2x.png', 'iphone', '20x20', '2x'],
        ['Icon-App-20x20@3x.png', 'iphone', '20x20', '3x'],
        ['Icon-App-29x29@2x.png', 'iphone', '29x29', '2x'],
        ['Icon-App-29x29@3x.png', 'iphone', '29x29', '3x'],
        ['Icon-App-40x40@2x.png', 'iphone', '40x40', '2x'],
        ['Icon-App-40x40@3x.png', 'iphone', '40x40', '3x'],
        ['Icon-App-60x60@2x.png', 'iphone', '60x60', '2x'],
        ['Icon-App-60x60@3x.png', 'iphone', '60x60', '3x'],
        ['Icon-App-20x20@1x.png', 'ipad', '20x20', '1x'],
        ['Icon-App-20x20@2x-ipad.png', 'ipad', '20x20', '2x'],
        ['Icon-App-29x29@1x.png', 'ipad', '29x29', '1x'],
        ['Icon-App-29x29@2x-ipad.png', 'ipad', '29x29', '2x'],
        ['Icon-App-40x40@1x.png', 'ipad', '40x40', '1x'],
        ['Icon-App-40x40@2x-ipad.png', 'ipad', '40x40', '2x'],
        ['Icon-App-76x76@1x.png', 'ipad', '76x76', '1x'],
        ['Icon-App-76x76@2x.png', 'ipad', '76x76', '2x'],
        ['Icon-App-83.5x83.5@2x.png', 'ipad', '83.5x83.5', '2x'],
        ['Icon-App-1024x1024@1x.png', 'ios-marketing', '1024x1024', '1x']
    ].map(([filename, idiom, size, scale]) => ({
        filename,
        idiom,
        size,
        scale,
        base64Png: pngAtSize(Math.round(Number.parseFloat(size) * Number.parseInt(scale, 10)))
    }));
    const applyRes = isService.applyIconStudio({
        projectRoot: tmpDir,
        mode: 'native',
        applyAndroid: true,
        applyIos: true,
        backgroundColorHex: '#123456',
        legacyIcons: densityIcons,
        adaptiveForegroundIcons: adaptiveIcons,
        adaptiveBackgroundIcons: adaptiveIcons,
        adaptiveMonochromeIcons: adaptiveIcons,
        iosIcons: iosDefinitions
    });
    assert.strictEqual(applyRes.ok, true, applyRes.message);
    assert.ok(fs.existsSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-anydpi-v26', 'ic_launcher.xml')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher_foreground.png')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher_background.png')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher_monochrome.png')));
    const themedXml = fs.readFileSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-anydpi-v33', 'ic_launcher.xml'), 'utf8');
    assert.ok(themedXml.includes('<monochrome'), 'Android v33 adaptive icon should include a monochrome layer');
    assert.ok(fs.existsSync(path.join(tmpDir, 'ios', 'Runner', 'Assets.xcassets', 'AppIcon.appiconset', 'Contents.json')));
    assert.ok(fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8').includes('.air-flutter/backups/'));
    assert.ok(applyRes.backupPath && fs.existsSync(path.join(applyRes.backupPath, 'manifest.json')));

    const restoreRes = isService.restoreLatestBackup(tmpDir);
    assert.strictEqual(restoreRes.ok, true, restoreRes.message);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher_foreground.png')), false);

    const packageRes = isService.applyIconStudio({
        projectRoot: tmpDir,
        mode: 'packages',
        applyAndroid: true,
        applyIos: true,
        backgroundColorHex: '#654321',
        androidLegacyMasterBase64: pngAtSize(1024),
        androidForegroundMasterBase64: pngAtSize(1024),
        androidBackgroundMasterBase64: pngAtSize(1024),
        androidMonochromeMasterBase64: pngAtSize(1024),
        iosMasterBase64: pngAtSize(1024)
    });
    assert.strictEqual(packageRes.ok, true, packageRes.message);
    assert.ok(fs.existsSync(path.join(tmpDir, 'assets', 'air_flutter_icon', 'android_background.png')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'assets', 'air_flutter_icon', 'android_monochrome.png')));
    const packagePubspec = fs.readFileSync(pubspecPath, 'utf8');
    assert.ok(packagePubspec.includes('adaptive_icon_background: "assets/air_flutter_icon/android_background.png"'));
    assert.ok(packagePubspec.includes('adaptive_icon_monochrome: "assets/air_flutter_icon/android_monochrome.png"'));
    assert.ok(packagePubspec.includes('adaptive_icon_foreground_inset: 0'));

    const existingSplashMarker = path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'drawable', 'launch_background.xml');
    fs.mkdirSync(path.dirname(existingSplashMarker), { recursive: true });
    fs.writeFileSync(existingSplashMarker, 'before-splash');
    const splashPrepareRes = isService.prepareSplashStudio({
        projectRoot: tmpDir,
        imageBase64: pngAtSize(1024),
        backgroundColorHex: '#ABCDEF',
        fullscreen: true
    });
    assert.strictEqual(splashPrepareRes.ok, true, splashPrepareRes.message);
    assert.ok(fs.existsSync(path.join(tmpDir, 'assets', 'air_flutter_icon', 'splash.png')));
    const splashPubspec = fs.readFileSync(pubspecPath, 'utf8');
    assert.ok(splashPubspec.includes('flutter_native_splash:'));
    assert.ok(splashPubspec.includes('image: "assets/air_flutter_icon/splash.png"'));
    fs.writeFileSync(existingSplashMarker, 'after-splash');
    fs.writeFileSync(path.join(path.dirname(existingSplashMarker), 'generated-only.xml'), 'generated');
    const splashRestore = isService.restoreBackup(tmpDir, splashPrepareRes.backupPath);
    assert.strictEqual(splashRestore.ok, true, splashRestore.message);
    assert.strictEqual(fs.readFileSync(existingSplashMarker, 'utf8'), 'before-splash');
    assert.strictEqual(fs.existsSync(path.join(path.dirname(existingSplashMarker), 'generated-only.xml')), false);

    const validConversion = isService.validateConvertedIcon(pngAtSize(1024));
    assert.deepStrictEqual(validConversion, { ok: true, width: 1024, height: 1024 });
    assert.throws(
        () => isService.validateConvertedIcon(pngAtSize(512)),
        /expected 1024×1024/,
        'Host must reject a converted payload that is not 1024×1024'
    );
    assert.throws(
        () => isService.validateConvertedIcon('data:image/png;base64,bm90LWEtcG5n'),
        /not a valid PNG/,
        'Host must reject a converted payload without a PNG signature'
    );
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
assert.ok(document.getElementById('iconValidationChecklist'), 'iconValidationChecklist must exist');
assert.ok(document.getElementById('iconInspectionCanvas'), 'iconInspectionCanvas must exist');
assert.ok(document.getElementById('confirmIconApplyBtn'), 'confirmIconApplyBtn must exist');
assert.ok(document.querySelector('[data-icon-preview="samsung"]'), 'Samsung launcher preview must exist');
assert.ok(document.querySelector('[data-icon-preview="xiaomi"]'), 'Xiaomi launcher preview must exist');
assert.ok(document.getElementById('iconBackgroundFileInput'), 'iconBackgroundFileInput must exist');
assert.ok(document.getElementById('iconMonochromeFileInput'), 'iconMonochromeFileInput must exist');
assert.ok(document.querySelector('[data-icon-preview="themed"]'), 'Android themed icon preview must exist');
assert.ok(document.getElementById('splashFileInput'), 'splashFileInput must exist');
assert.ok(document.getElementById('confirmSplashApplyBtn'), 'confirmSplashApplyBtn must exist');
assert.ok(document.querySelector('[data-splash-preview="android12"]'), 'Android 12 splash preview must exist');
assert.ok(document.querySelector('[data-splash-preview="iosSplash"]'), 'iOS splash preview must exist');
assert.ok(document.getElementById('iconConvertModal'), 'iconConvertModal must exist');
assert.ok(document.getElementById('iconConvertSourceCanvas'), 'iconConvertSourceCanvas must exist');
assert.ok(document.getElementById('iconConvertResultCanvas'), 'iconConvertResultCanvas must exist');
assert.ok(document.getElementById('confirmIconConvertBtn'), 'confirmIconConvertBtn must exist');
assert.ok(document.getElementById('cancelIconConvertBtn'), 'cancelIconConvertBtn must exist');
assert.ok(document.getElementById('iconConvertTransparentCheckbox'), 'Transparent padding toggle must exist');
assert.ok(document.querySelector('input[name="iconConvertMode"][value="fit"]'), 'Fit mode must exist');
assert.ok(document.querySelector('input[name="iconConvertMode"][value="cover"]'), 'Cover mode must exist');
for (const inputId of ['iconFileInput', 'iosIconFileInput', 'iconBackgroundFileInput', 'iconMonochromeFileInput', 'splashFileInput']) {
    const accept = document.getElementById(inputId)?.getAttribute('accept') || '';
    assert.ok(accept.includes('image/jpeg') && accept.includes('image/webp'), `${inputId} must accept JPEG and WebP`);
}

// 3.2b Conversion engine behavior is verified at the end of this file.

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

// --- 4. Conversion engine behavior (async) ---
(async () => {
    window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'iconSplashModule.js'), 'utf8'));
    const conversionStudio = new window.AirFlutterIconSplashModule();
    const fakeFile = (name, bytes, size = bytes.length) => ({
        name,
        size,
        slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer })
    });
    const pngBytes = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0];
    const jpegBytes = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const webpBytes = [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 0, 0, 0, 0];
    const gifBytes = [71, 73, 70, 56, 57, 97, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (const [label, bytes, expected] of [
        ['PNG', pngBytes, 'png'],
        ['JPEG', jpegBytes, 'jpeg'],
        ['WebP', webpBytes, 'webp']
    ]) {
        const result = await conversionStudio.inspectIconStudioSource(fakeFile(`source.${label}`, bytes));
        assert.strictEqual(result.ok, true, `${label} should be accepted`);
        assert.strictEqual(result.format, expected, `${label} should be detected as ${expected}`);
    }

    const gifResult = await conversionStudio.inspectIconStudioSource(fakeFile('anim.gif', gifBytes));
    assert.strictEqual(gifResult.ok, false, 'GIF must be rejected');
    assert.match(gifResult.message, /only PNG, JPEG, and WebP/);

    const oversized = await conversionStudio.inspectIconStudioSource(fakeFile('huge.png', pngBytes, 11 * 1024 * 1024));
    assert.strictEqual(oversized.ok, false, 'Files above 10MB must be rejected');
    assert.match(oversized.message, /exceeds the 10 MB limit/);

    const upscaleWarning = conversionStudio.getIconConversionWarning({ width: 512, height: 512, mode: 'fit' });
    assert.match(upscaleWarning, /Upscaled 2\.0×/, 'Small sources must warn about upscaling');
    const wideWarning = conversionStudio.getIconConversionWarning({ width: 3000, height: 600, mode: 'cover' });
    assert.match(wideWarning, /Wide or tall source/, 'Extreme aspect ratios must warn');
    assert.strictEqual(conversionStudio.getIconConversionWarning({ width: 1024, height: 1024, mode: 'fit' }), '');

    conversionStudio.iconStudioState = {
        conversion: { image: { width: 1600, height: 900 }, mode: 'cover', transparent: true, offsetX: 0, offsetY: 0, color: '#FFFFFF' }
    };
    const convertedCanvas = conversionStudio.renderIconConversionCanvas(1024);
    assert.strictEqual(convertedCanvas.width, 1024, 'Converted canvas must be 1024 wide');
    assert.strictEqual(convertedCanvas.height, 1024, 'Converted canvas must be 1024 tall');
    console.log('✅ Icon conversion engine tests passed.');
})().catch(error => {
    console.error('❌ Icon conversion engine tests failed:', error);
    process.exitCode = 1;
});
