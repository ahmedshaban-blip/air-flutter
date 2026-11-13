import * as fs from 'fs';
import * as path from 'path';

export type AndroidDensity = 'mdpi' | 'hdpi' | 'xhdpi' | 'xxhdpi' | 'xxxhdpi';

export interface IconDensityData {
  density: AndroidDensity;
  base64Png: string;
}

export interface IosIconData {
  filename: string;
  idiom: 'iphone' | 'ipad' | 'ios-marketing';
  size: string;
  scale: string;
  base64Png: string;
}

export interface NativeIconPayload {
  projectRoot: string;
  master1024Base64?: string;
  densities?: IconDensityData[];
  backgroundColorHex?: string;
}

export interface LauncherIconsConfigOptions {
  projectRoot: string;
  imagePath: string;
  android?: boolean;
  ios?: boolean;
  backgroundColorHex?: string;
  adaptiveIconBackground?: string;
  androidImagePath?: string;
  iosImagePath?: string;
  adaptiveForegroundPath?: string;
  adaptiveMonochromePath?: string;
  /** Absolute asset path used when the adaptive background is an image or a rasterized gradient. */
  adaptiveBackgroundPath?: string;
  /** True when the adaptive background is image/gradient, so a PNG must be referenced instead of a color. */
  adaptiveBackgroundIsRaster?: boolean;
  /**
   * Full flutter_launcher_icons configuration. When present every defined key is
   * written verbatim, giving the panel complete control over the generated block.
   * Studio-owned image paths are still injected as defaults for any path the user
   * left blank, so a generated icon set always resolves.
   */
  config?: LauncherIconsConfig;
}

export interface NativeSplashConfigOptions {
  projectRoot: string;
  imagePath: string;
  backgroundColorHex: string;
  fullscreen?: boolean;
  /** Optional full-screen background image (legacy Android + iOS only). */
  backgroundImagePath?: string;
}

/** Web platform block of flutter_launcher_icons. */
export interface LauncherIconsWebConfig {
  generate?: boolean;
  image_path?: string;
  background_color?: string;
  theme_color?: string;
}

/** Windows platform block of flutter_launcher_icons. */
export interface LauncherIconsWindowsConfig {
  generate?: boolean;
  image_path?: string;
  /** 48 <= icon_size <= 256. */
  icon_size?: number;
}

/** macOS platform block of flutter_launcher_icons. */
export interface LauncherIconsMacosConfig {
  generate?: boolean;
  image_path?: string;
}

/**
 * The complete flutter_launcher_icons 0.14.x configuration surface. Every field is
 * optional; undefined means "not written", so the generated pubspec stays minimal.
 * Keys mirror the package's own key names so the mapping is obvious.
 */
export interface LauncherIconsConfig {
  image_path?: string;
  android?: boolean | string;
  ios?: boolean | string;
  image_path_android?: string;
  image_path_ios?: string;
  min_sdk_android?: number;
  adaptive_icon_background?: string;
  adaptive_icon_foreground?: string;
  adaptive_icon_foreground_inset?: number;
  adaptive_icon_monochrome?: string;
  remove_alpha_ios?: boolean;
  background_color_ios?: string;
  desaturate_tinted_to_grayscale_ios?: boolean;
  image_path_ios_dark_transparent?: string;
  image_path_ios_tinted_grayscale?: string;
  web?: LauncherIconsWebConfig;
  windows?: LauncherIconsWindowsConfig;
  macos?: LauncherIconsMacosConfig;
}

/** Android 12+ splash sub-block (icon-background model, no background image). */
export interface Android12Config {
  color?: string;
  color_dark?: string;
  image?: string;
  image_dark?: string;
  icon_background_color?: string;
  icon_background_color_dark?: string;
  branding?: string;
  branding_dark?: string;
}

/**
 * The complete flutter_native_splash 2.4.x configuration surface. Every field is
 * optional; undefined means "not written", so the generated pubspec stays minimal.
 * Keys mirror the package's own key names so the mapping is obvious.
 */
export interface SplashConfig {
  // Platform toggles
  android?: boolean;
  ios?: boolean;
  web?: boolean;
  // General appearance (all platforms except Android 12+)
  color?: string;
  color_dark?: string;
  background_image?: string;
  background_image_dark?: string;
  image?: string;
  image_dark?: string;
  branding?: string;
  branding_dark?: string;
  branding_mode?: 'bottom' | 'bottomRight' | 'bottomLeft';
  branding_bottom_padding?: number;
  fullscreen?: boolean;
  android_gravity?: string;
  ios_content_mode?: string;
  web_image_mode?: string;
  android_screen_orientation?: string;
  android_min_sdk?: number;
  info_plist_files?: string[];
  // Platform-specific color overrides
  color_android?: string;
  color_dark_android?: string;
  color_ios?: string;
  color_dark_ios?: string;
  color_web?: string;
  color_dark_web?: string;
  // Platform-specific background-image overrides
  background_image_android?: string;
  background_image_dark_android?: string;
  background_image_ios?: string;
  background_image_dark_ios?: string;
  background_image_web?: string;
  background_image_dark_web?: string;
  // Platform-specific image overrides
  image_android?: string;
  image_dark_android?: string;
  image_ios?: string;
  image_dark_ios?: string;
  image_web?: string;
  image_dark_web?: string;
  // Platform-specific branding overrides
  branding_android?: string;
  branding_dark_android?: string;
  branding_ios?: string;
  branding_dark_ios?: string;
  branding_web?: string;
  branding_dark_web?: string;
  branding_bottom_padding_android?: number;
  branding_bottom_padding_ios?: number;
  // Android 12+ block
  android_12?: Android12Config;
}

export interface IconStudioApplyOptions {
  projectRoot: string;
  mode: 'native' | 'packages';
  applyAndroid: boolean;
  applyIos: boolean;
  backgroundColorHex: string;
  /** Full flutter_launcher_icons option set, used in `packages` mode. */
  launcherIconsConfig?: LauncherIconsConfig;
  legacyIcons?: IconDensityData[];
  adaptiveForegroundIcons?: IconDensityData[];
  adaptiveBackgroundIcons?: IconDensityData[];
  adaptiveMonochromeIcons?: IconDensityData[];
  iosIcons?: IosIconData[];
  androidLegacyMasterBase64?: string;
  androidForegroundMasterBase64?: string;
  androidBackgroundMasterBase64?: string;
  androidMonochromeMasterBase64?: string;
  iosMasterBase64?: string;
}

export interface IconStudioApplyResult {
  ok: boolean;
  message: string;
  backupPath?: string;
  writtenFiles: string[];
  error?: string;
}

interface BackupManifestEntry {
  relativePath: string;
  existed: boolean;
}

interface BackupManifest {
  createdAt: string;
  entries: BackupManifestEntry[];
  directories?: BackupManifestEntry[];
}

export interface SplashStudioApplyOptions {
  projectRoot: string;
  imageBase64: string;
  backgroundColorHex: string;
  fullscreen?: boolean;
  /** Optional background-image layer, distinct from the centered splash artwork. */
  backgroundImageBase64?: string;
  /** How the splash background image is baked into the exported PNG. */
  backgroundFit?: SplashBackgroundFit;
  /** Full flutter_native_splash option set. Studio-managed keys (image paths, color, fullscreen) are overridden automatically. */
  config?: SplashConfig;
}

export type SplashBackgroundFit = 'cover' | 'contain' | 'center';

export type IconBackgroundMode = 'color' | 'gradient' | 'image';

export interface GradientStopRecord {
  color: string;
  position: number;
}

/**
 * A re-editable record of one asset the studio generated, persisted as a JSON
 * sidecar so the panel can show and re-open the last icon/splash after reload.
 * Source images are copied next to the sidecar so thumbnails survive.
 */
export interface IconAssetRecord {
  mode: 'native' | 'packages';
  applyAndroid: boolean;
  applyIos: boolean;
  backgroundMode: IconBackgroundMode;
  backgroundColorHex: string;
  gradientStops: GradientStopRecord[];
  gradientAngle: number;
  /** Source images stored relative to the project root. */
  backgroundImagePath?: string;
  monochromeImagePath?: string;
  /** Source image used for the icon foreground, stored relative to the project root. */
  foregroundImagePath?: string;
  /** The complete flutter_launcher_icons option set, so every field can be restored. */
  config?: LauncherIconsConfig;
  generatedAt: string;
}

export interface SplashAssetRecord {
  backgroundColorHex: string;
  fullscreen: boolean;
  useAppIcon: boolean;
  splashScale: number;
  backgroundFit: SplashBackgroundFit;
  /** Centered splash artwork, stored relative to the project root. */
  artworkImagePath?: string;
  /** Full-screen background layer, stored relative to the project root. */
  backgroundImagePath?: string;
  /** The complete flutter_native_splash option set, so every field can be restored. */
  config?: SplashConfig;
  generatedAt: string;
}

export interface IconSplashState {
  version: 1;
  icon?: IconAssetRecord;
  splash?: SplashAssetRecord;
}

const DENSITIES: AndroidDensity[] = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const PACKAGE_ASSET_DIR = 'assets/air_flutter_icon';
const STATE_DIR = '.air-flutter';
const STATE_FILE = 'icon-splash-state.json';
const STATE_IMAGE_DIR = 'icon-splash';
const IOS_ICON_SLOTS = [
  'iphone:20x20:2x', 'iphone:20x20:3x', 'iphone:29x29:2x', 'iphone:29x29:3x',
  'iphone:40x40:2x', 'iphone:40x40:3x', 'iphone:60x60:2x', 'iphone:60x60:3x',
  'ipad:20x20:1x', 'ipad:20x20:2x', 'ipad:29x29:1x', 'ipad:29x29:2x',
  'ipad:40x40:1x', 'ipad:40x40:2x', 'ipad:76x76:1x', 'ipad:76x76:2x',
  'ipad:83.5x83.5:2x', 'ios-marketing:1024x1024:1x'
];

export class IconSplashStudioService {
  private static stripBase64Header(data: string): Buffer {
    const cleaned = data.replace(/^data:image\/\w+;base64,/, '');
    const png = Buffer.from(cleaned, 'base64');
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (png.length < 24 || !png.subarray(0, 8).equals(signature)) {
      throw new Error('Generated image payload is not a valid PNG.');
    }
    return png;
  }

  private static assertPngSize(data: string, expectedWidth: number, expectedHeight = expectedWidth): void {
    const png = IconSplashStudioService.stripBase64Header(data);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== expectedWidth || height !== expectedHeight) {
      throw new Error(`Generated PNG is ${width}×${height}; expected ${expectedWidth}×${expectedHeight}.`);
    }
  }

  /** Verifies a browser-converted payload before the studio accepts it as a source. */
  public validateConvertedIcon(data: string): { ok: true; width: number; height: number } {
    IconSplashStudioService.assertPngSize(data, 1024);
    return { ok: true, width: 1024, height: 1024 };
  }

  private static normalizeRelativePath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.split('/').includes('..')) {
      throw new Error(`Unsafe generated path: ${relativePath}`);
    }
    return normalized;
  }

  private static writeBase64File(projectRoot: string, relativePath: string, data: string): void {
    const safePath = IconSplashStudioService.normalizeRelativePath(relativePath);
    const destination = path.join(projectRoot, ...safePath.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, IconSplashStudioService.stripBase64Header(data));
  }

  private static writeTextFile(projectRoot: string, relativePath: string, content: string): void {
    const safePath = IconSplashStudioService.normalizeRelativePath(relativePath);
    const destination = path.join(projectRoot, ...safePath.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content, 'utf8');
  }

  private static androidIconPath(density: AndroidDensity, filename: string): string {
    return `android/app/src/main/res/mipmap-${density}/${filename}`;
  }

  private static adaptiveXml(backgroundResource: string, includeMonochrome: boolean): string {
    const monochrome = includeMonochrome
      ? '\n    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />'
      : '';
    return `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="${backgroundResource}" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />${monochrome}\n</adaptive-icon>\n`;
  }

  private static assertDensitySet(icons: IconDensityData[], label: string): void {
    const received = icons.map(icon => icon.density);
    const missing = DENSITIES.filter(density => !received.includes(density));
    const duplicates = received.filter((density, index) => received.indexOf(density) !== index);
    if (missing.length || duplicates.length || icons.length !== DENSITIES.length) {
      throw new Error(`${label} must contain exactly one PNG for every Android density.`);
    }
  }

  private updateAndroidBackgroundColor(projectRoot: string, color: string): void {
    const relativePath = 'android/app/src/main/res/values/colors.xml';
    const destination = path.join(projectRoot, ...relativePath.split('/'));
    const colorEntry = `<color name="ic_launcher_background">${color}</color>`;
    let content = fs.existsSync(destination)
      ? fs.readFileSync(destination, 'utf8')
      : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';

    if (content.includes('name="ic_launcher_background"')) {
      content = content.replace(/<color\s+name="ic_launcher_background">.*?<\/color>/, colorEntry);
    } else if (content.includes('</resources>')) {
      content = content.replace('</resources>', `    ${colorEntry}\n</resources>`);
    } else {
      throw new Error('android colors.xml does not contain a closing </resources> element.');
    }
    IconSplashStudioService.writeTextFile(projectRoot, relativePath, content);
  }

  public getProjectInfo(projectRoot: string): { appName: string; latestBackupPath?: string } {
    let appName = path.basename(projectRoot);
    const pubspecPath = path.join(projectRoot, 'pubspec.yaml');
    if (fs.existsSync(pubspecPath)) {
      const match = fs.readFileSync(pubspecPath, 'utf8').match(/^name:\s*([\w-]+)/m);
      if (match?.[1]) appName = match[1];
    }
    const backups = this.listBackups(projectRoot);
    return { appName, latestBackupPath: backups[0] };
  }

  // --- Persisted studio state (re-editable "Your current assets") -----------------

  private stateFilePath(projectRoot: string): string {
    return path.join(projectRoot, STATE_DIR, STATE_FILE);
  }

  /** Reads the persisted studio state, returning an empty object when absent/corrupt. */
  public readState(projectRoot: string): IconSplashState {
    const file = this.stateFilePath(projectRoot);
    if (!fs.existsSync(file)) return { version: 1 };
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as IconSplashState;
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return { version: 1 };
      return parsed;
    } catch {
      return { version: 1 };
    }
  }

  private writeState(projectRoot: string, state: IconSplashState): void {
    const file = this.stateFilePath(projectRoot);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    this.ensureStateIgnored(projectRoot);
  }

  /**
   * Copies an uploaded base64 image into the state folder and returns its
   * project-relative path, so thumbnails and re-edit survive panel reloads.
   */
  private storeStateImage(projectRoot: string, slot: string, data: string): string {
    const safeSlot = slot.replace(/[^\w-]/g, '');
    IconSplashStudioService.writeBase64File(projectRoot, `${STATE_DIR}/${STATE_IMAGE_DIR}/${safeSlot}.png`, data);
    return `${STATE_DIR}/${STATE_IMAGE_DIR}/${safeSlot}.png`;
  }

  private removeStateImages(projectRoot: string, keep: Array<string | undefined>): void {
    const dir = path.join(projectRoot, STATE_DIR, STATE_IMAGE_DIR);
    if (!fs.existsSync(dir)) return;
    const keepNames = new Set(
      keep.filter((entry): entry is string => Boolean(entry)).map(entry => path.basename(entry))
    );
    for (const name of fs.readdirSync(dir)) {
      if (!keepNames.has(name)) fs.rmSync(path.join(dir, name), { force: true });
    }
    if (!fs.readdirSync(dir).length) fs.rmSync(dir, { recursive: true, force: true });
  }

  private ensureStateIgnored(projectRoot: string): void {
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const rule = '.air-flutter/icon-splash/';
    const content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    const lines = content.split(/\r?\n/).map(line => line.trim());
    if (!lines.includes(rule)) {
      fs.writeFileSync(gitignorePath, `${content.trimEnd()}${content.trim() ? '\n' : ''}${rule}\n`, 'utf8');
    }
  }

  /** Byte size of a project-relative file, when it exists. */
  private stateImageSize(projectRoot: string, relativePath?: string): number {
    if (!relativePath) return 0;
    const file = path.join(projectRoot, ...relativePath.split('/'));
    return fs.existsSync(file) ? fs.statSync(file).size : 0;
  }

  public saveIconRecord(projectRoot: string, record: Omit<IconAssetRecord, 'generatedAt'>, images: {
    foregroundBase64?: string;
    backgroundBase64?: string;
    monochromeBase64?: string;
  }): void {
    const state = this.readState(projectRoot);
    const stored: IconAssetRecord = {
      ...record,
      gradientStops: record.gradientStops.map(stop => ({ color: stop.color, position: stop.position })),
      foregroundImagePath: images.foregroundBase64
        ? this.storeStateImage(projectRoot, 'icon-foreground', images.foregroundBase64)
        : state.icon?.foregroundImagePath,
      backgroundImagePath: images.backgroundBase64
        ? this.storeStateImage(projectRoot, 'icon-background', images.backgroundBase64)
        : record.backgroundMode === 'image'
          ? state.icon?.backgroundImagePath
          : undefined,
      monochromeImagePath: images.monochromeBase64
        ? this.storeStateImage(projectRoot, 'icon-monochrome', images.monochromeBase64)
        : state.icon?.monochromeImagePath,
      generatedAt: new Date().toISOString()
    };
    state.icon = stored;
    this.writeState(projectRoot, state);
    this.removeStateImages(projectRoot, [
      stored.foregroundImagePath,
      stored.backgroundImagePath,
      stored.monochromeImagePath,
      state.splash?.artworkImagePath,
      state.splash?.backgroundImagePath
    ]);
  }

  public saveSplashRecord(projectRoot: string, record: Omit<SplashAssetRecord, 'generatedAt'>, images: {
    artworkBase64?: string;
    backgroundBase64?: string;
  }): void {
    const state = this.readState(projectRoot);
    const stored: SplashAssetRecord = {
      ...record,
      artworkImagePath: images.artworkBase64
        ? this.storeStateImage(projectRoot, 'splash-artwork', images.artworkBase64)
        : record.useAppIcon
          ? state.splash?.artworkImagePath
          : undefined,
      backgroundImagePath: images.backgroundBase64
        ? this.storeStateImage(projectRoot, 'splash-background', images.backgroundBase64)
        : state.splash?.backgroundImagePath,
      generatedAt: new Date().toISOString()
    };
    state.splash = stored;
    this.writeState(projectRoot, state);
    this.removeStateImages(projectRoot, [
      stored.artworkImagePath,
      stored.backgroundImagePath,
      state.icon?.foregroundImagePath,
      state.icon?.backgroundImagePath,
      state.icon?.monochromeImagePath
    ]);
  }

  /** Clears one asset from the persisted state, pruning now-unused source images. */
  public clearAssetRecord(projectRoot: string, asset: 'icon' | 'splash' | 'both'): void {
    const state = this.readState(projectRoot);
    if (asset === 'icon' || asset === 'both') delete state.icon;
    if (asset === 'splash' || asset === 'both') delete state.splash;
    if (asset === 'both') {
      this.writeState(projectRoot, { version: 1 });
      this.removeStateImages(projectRoot, []);
      return;
    }
    this.writeState(projectRoot, state);
    this.removeStateImages(projectRoot, [
      state.icon?.foregroundImagePath,
      state.icon?.backgroundImagePath,
      state.icon?.monochromeImagePath,
      state.splash?.artworkImagePath,
      state.splash?.backgroundImagePath
    ]);
  }

  /** Base64 payload + byte size for a stored source image, for webview thumbnails. */
  public readStateImage(projectRoot: string, relativePath?: string): { base64?: string; bytes: number } {
    if (!relativePath) return { bytes: 0 };
    const file = path.join(projectRoot, ...relativePath.split('/'));
    if (!fs.existsSync(file)) return { bytes: 0 };
    return { base64: fs.readFileSync(file).toString('base64'), bytes: this.stateImageSize(projectRoot, relativePath) };
  }

  public applyIconStudio(options: IconStudioApplyOptions): IconStudioApplyResult {
    const writtenFiles: string[] = [];
    let backupPath: string | undefined;
    try {
      if (!fs.existsSync(path.join(options.projectRoot, 'pubspec.yaml'))) {
        return { ok: false, message: 'pubspec.yaml not found', writtenFiles };
      }
      if (!options.applyAndroid && !options.applyIos) {
        return { ok: false, message: 'Select Android, iOS, or both.', writtenFiles };
      }
      if (options.applyAndroid && !fs.existsSync(path.join(options.projectRoot, 'android', 'app', 'src', 'main'))) {
        return { ok: false, message: 'The selected project does not contain an Android app.', writtenFiles };
      }
      if (options.applyIos && !fs.existsSync(path.join(options.projectRoot, 'ios', 'Runner'))) {
        return { ok: false, message: 'The selected project does not contain an iOS Runner target.', writtenFiles };
      }

      const targetFiles = this.collectIconTargetFiles(options);
      backupPath = this.createBackup(options.projectRoot, targetFiles);
      this.ensureBackupIgnored(options.projectRoot);

      if (options.mode === 'native') {
        if (options.applyAndroid) this.writeNativeAndroid(options, writtenFiles);
        if (options.applyIos) this.writeNativeIos(options, writtenFiles);
      } else {
        this.writePackageIconAssets(options, writtenFiles);
        const configResult = this.configureFlutterLauncherIcons({
          projectRoot: options.projectRoot,
          imagePath: `${PACKAGE_ASSET_DIR}/android_legacy.png`,
          android: options.applyAndroid,
          ios: options.applyIos,
          androidImagePath: `${PACKAGE_ASSET_DIR}/android_legacy.png`,
          iosImagePath: `${PACKAGE_ASSET_DIR}/ios_icon.png`,
          adaptiveForegroundPath: `${PACKAGE_ASSET_DIR}/android_foreground.png`,
          adaptiveIconBackground: options.androidBackgroundMasterBase64
            ? `${PACKAGE_ASSET_DIR}/android_background.png`
            : options.backgroundColorHex,
          adaptiveBackgroundPath: `${PACKAGE_ASSET_DIR}/android_background.png`,
          adaptiveBackgroundIsRaster: Boolean(options.androidBackgroundMasterBase64),
          adaptiveMonochromePath: `${PACKAGE_ASSET_DIR}/android_monochrome.png`,
          backgroundColorHex: options.backgroundColorHex,
          config: options.launcherIconsConfig
        });
        if (!configResult.ok) throw new Error(configResult.message);
        writtenFiles.push('pubspec.yaml');
      }

      this.pruneBackups(options.projectRoot, 5);
      return {
        ok: true,
        message: `Generated ${writtenFiles.length} icon files.`,
        backupPath,
        writtenFiles
      };
    } catch (error) {
      if (backupPath) this.restoreBackup(options.projectRoot, backupPath);
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error.message : String(error),
        writtenFiles,
        backupPath
      };
    }
  }

  private collectIconTargetFiles(options: IconStudioApplyOptions): string[] {
    const targets = new Set<string>(['.gitignore']);
    if (options.mode === 'packages') {
      targets.add('pubspec.yaml');
      targets.add('pubspec.lock');
      if (options.applyAndroid) {
        targets.add(`${PACKAGE_ASSET_DIR}/android_legacy.png`);
        targets.add(`${PACKAGE_ASSET_DIR}/android_foreground.png`);
        targets.add(`${PACKAGE_ASSET_DIR}/android_monochrome.png`);
        if (options.androidBackgroundMasterBase64) targets.add(`${PACKAGE_ASSET_DIR}/android_background.png`);
      }
      if (options.applyIos) targets.add(`${PACKAGE_ASSET_DIR}/ios_icon.png`);
      return [...targets];
    }

    if (options.applyAndroid) {
      for (const density of DENSITIES) {
        targets.add(IconSplashStudioService.androidIconPath(density, 'ic_launcher.png'));
        targets.add(IconSplashStudioService.androidIconPath(density, 'ic_launcher_round.png'));
        targets.add(IconSplashStudioService.androidIconPath(density, 'ic_launcher_foreground.png'));
        if (options.adaptiveBackgroundIcons?.length) {
          targets.add(IconSplashStudioService.androidIconPath(density, 'ic_launcher_background.png'));
        }
        targets.add(IconSplashStudioService.androidIconPath(density, 'ic_launcher_monochrome.png'));
      }
      targets.add('android/app/src/main/res/values/colors.xml');
      targets.add('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml');
      targets.add('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml');
      targets.add('android/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml');
      targets.add('android/app/src/main/res/mipmap-anydpi-v33/ic_launcher_round.xml');
    }
    if (options.applyIos) {
      for (const icon of options.iosIcons || []) {
        targets.add(`ios/Runner/Assets.xcassets/AppIcon.appiconset/${icon.filename}`);
      }
      targets.add('ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json');
    }
    return [...targets];
  }

  private writeNativeAndroid(options: IconStudioApplyOptions, writtenFiles: string[]): void {
    if (!options.legacyIcons?.length || !options.adaptiveForegroundIcons?.length) {
      throw new Error('Android icon exports are incomplete. Re-open the preview and try again.');
    }
    IconSplashStudioService.assertDensitySet(options.legacyIcons, 'Legacy icons');
    IconSplashStudioService.assertDensitySet(options.adaptiveForegroundIcons, 'Adaptive foreground icons');
    if (options.adaptiveBackgroundIcons?.length) {
      IconSplashStudioService.assertDensitySet(options.adaptiveBackgroundIcons, 'Adaptive background icons');
    }
    if (options.adaptiveMonochromeIcons?.length) {
      IconSplashStudioService.assertDensitySet(options.adaptiveMonochromeIcons, 'Adaptive monochrome icons');
    }
    const legacySizes: Record<AndroidDensity, number> = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
    const adaptiveSizes: Record<AndroidDensity, number> = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
    for (const icon of options.legacyIcons) {
      IconSplashStudioService.assertPngSize(icon.base64Png, legacySizes[icon.density]);
      for (const filename of ['ic_launcher.png', 'ic_launcher_round.png']) {
        const relativePath = IconSplashStudioService.androidIconPath(icon.density, filename);
        IconSplashStudioService.writeBase64File(options.projectRoot, relativePath, icon.base64Png);
        writtenFiles.push(relativePath);
      }
    }
    for (const icon of options.adaptiveForegroundIcons) {
      IconSplashStudioService.assertPngSize(icon.base64Png, adaptiveSizes[icon.density]);
      const relativePath = IconSplashStudioService.androidIconPath(icon.density, 'ic_launcher_foreground.png');
      IconSplashStudioService.writeBase64File(options.projectRoot, relativePath, icon.base64Png);
      writtenFiles.push(relativePath);
    }
    for (const icon of options.adaptiveBackgroundIcons || []) {
      IconSplashStudioService.assertPngSize(icon.base64Png, adaptiveSizes[icon.density]);
      const relativePath = IconSplashStudioService.androidIconPath(icon.density, 'ic_launcher_background.png');
      IconSplashStudioService.writeBase64File(options.projectRoot, relativePath, icon.base64Png);
      writtenFiles.push(relativePath);
    }
    const monochromeIcons = options.adaptiveMonochromeIcons || options.adaptiveForegroundIcons;
    for (const icon of monochromeIcons) {
      IconSplashStudioService.assertPngSize(icon.base64Png, adaptiveSizes[icon.density]);
      const relativePath = IconSplashStudioService.androidIconPath(icon.density, 'ic_launcher_monochrome.png');
      IconSplashStudioService.writeBase64File(options.projectRoot, relativePath, icon.base64Png);
      writtenFiles.push(relativePath);
    }
    const backgroundResource = options.adaptiveBackgroundIcons?.length
      ? '@mipmap/ic_launcher_background'
      : '@color/ic_launcher_background';
    if (!options.adaptiveBackgroundIcons?.length) {
      this.updateAndroidBackgroundColor(options.projectRoot, options.backgroundColorHex);
      writtenFiles.push('android/app/src/main/res/values/colors.xml');
    }

    const xml = IconSplashStudioService.adaptiveXml(backgroundResource, false);
    for (const filename of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      const relativePath = `android/app/src/main/res/mipmap-anydpi-v26/${filename}`;
      IconSplashStudioService.writeTextFile(options.projectRoot, relativePath, xml);
      writtenFiles.push(relativePath);
    }
    const themedXml = IconSplashStudioService.adaptiveXml(backgroundResource, true);
    for (const filename of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      const relativePath = `android/app/src/main/res/mipmap-anydpi-v33/${filename}`;
      IconSplashStudioService.writeTextFile(options.projectRoot, relativePath, themedXml);
      writtenFiles.push(relativePath);
    }
  }

  private writeNativeIos(options: IconStudioApplyOptions, writtenFiles: string[]): void {
    if (!options.iosIcons?.length) {
      throw new Error('iOS icon exports are incomplete. Re-open the preview and try again.');
    }
    const receivedSlots = options.iosIcons.map(icon => `${icon.idiom}:${icon.size}:${icon.scale}`);
    if (receivedSlots.length !== IOS_ICON_SLOTS.length || IOS_ICON_SLOTS.some(slot => !receivedSlots.includes(slot))) {
      throw new Error('iOS export must contain the complete AppIcon asset catalog.');
    }
    const iconDir = 'ios/Runner/Assets.xcassets/AppIcon.appiconset';
    for (const icon of options.iosIcons) {
      const logicalSize = Number.parseFloat(icon.size.split('x')[0]);
      const scale = Number.parseInt(icon.scale, 10);
      IconSplashStudioService.assertPngSize(icon.base64Png, Math.round(logicalSize * scale));
      const relativePath = `${iconDir}/${icon.filename}`;
      IconSplashStudioService.writeBase64File(options.projectRoot, relativePath, icon.base64Png);
      writtenFiles.push(relativePath);
    }
    const contents = {
      images: options.iosIcons.map(({ filename, idiom, size, scale }) => ({ filename, idiom, size, scale })),
      info: { author: 'xcode', version: 1 }
    };
    IconSplashStudioService.writeTextFile(
      options.projectRoot,
      `${iconDir}/Contents.json`,
      `${JSON.stringify(contents, null, 2)}\n`
    );
    writtenFiles.push(`${iconDir}/Contents.json`);
  }

  private writePackageIconAssets(options: IconStudioApplyOptions, writtenFiles: string[]): void {
    if (options.applyAndroid) {
      if (!options.androidLegacyMasterBase64 || !options.androidForegroundMasterBase64) {
        throw new Error('Android package assets are incomplete.');
      }
      IconSplashStudioService.assertPngSize(options.androidLegacyMasterBase64, 1024);
      IconSplashStudioService.assertPngSize(options.androidForegroundMasterBase64, 1024);
      if (options.androidBackgroundMasterBase64) {
        IconSplashStudioService.assertPngSize(options.androidBackgroundMasterBase64, 1024);
      }
      if (options.androidMonochromeMasterBase64) {
        IconSplashStudioService.assertPngSize(options.androidMonochromeMasterBase64, 1024);
      }
      const monochrome = options.androidMonochromeMasterBase64 || options.androidForegroundMasterBase64;
      const assets: Array<[string, string]> = [
        [`${PACKAGE_ASSET_DIR}/android_legacy.png`, options.androidLegacyMasterBase64],
        [`${PACKAGE_ASSET_DIR}/android_foreground.png`, options.androidForegroundMasterBase64],
        [`${PACKAGE_ASSET_DIR}/android_monochrome.png`, monochrome]
      ];
      if (options.androidBackgroundMasterBase64) {
        assets.push([`${PACKAGE_ASSET_DIR}/android_background.png`, options.androidBackgroundMasterBase64]);
      }
      for (const [relativePath, data] of assets) {
        IconSplashStudioService.writeBase64File(options.projectRoot, relativePath, data);
        writtenFiles.push(relativePath);
      }
    }
    if (options.applyIos) {
      if (!options.iosMasterBase64) throw new Error('iOS package asset is incomplete.');
      IconSplashStudioService.assertPngSize(options.iosMasterBase64, 1024);
      const relativePath = `${PACKAGE_ASSET_DIR}/ios_icon.png`;
      IconSplashStudioService.writeBase64File(options.projectRoot, relativePath, options.iosMasterBase64);
      writtenFiles.push(relativePath);
    }
  }

  public writeAndroidIcons(payload: NativeIconPayload): { ok: boolean; count: number; error?: string } {
    try {
      const resDir = path.join(payload.projectRoot, 'android', 'app', 'src', 'main', 'res');
      if (!fs.existsSync(resDir)) {
        return { ok: false, count: 0, error: 'Could not find android/app/src/main/res directory.' };
      }
      let count = 0;
      for (const item of payload.densities || []) {
        const relativePath = IconSplashStudioService.androidIconPath(item.density, 'ic_launcher.png');
        IconSplashStudioService.writeBase64File(payload.projectRoot, relativePath, item.base64Png);
        count++;
      }
      if (payload.backgroundColorHex) this.updateAndroidBackgroundColor(payload.projectRoot, payload.backgroundColorHex);
      return { ok: true, count };
    } catch (error) {
      return { ok: false, count: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }

  public writeIosIcons(payload: NativeIconPayload): { ok: boolean; error?: string } {
    try {
      if (payload.master1024Base64) {
        IconSplashStudioService.writeBase64File(
          payload.projectRoot,
          'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png',
          payload.master1024Base64
        );
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Serializes the flutter_launcher_icons block. Only defined keys are written, so
   * untouched options never clutter the pubspec. Booleans are written explicitly.
   */
  private serializeLauncherIconsConfig(config: LauncherIconsConfig): string[] {
    const lines: string[] = ['flutter_launcher_icons:'];
    const order: Array<keyof LauncherIconsConfig> = [
      'image_path',
      'android', 'ios',
      'image_path_android', 'image_path_ios',
      'min_sdk_android',
      'adaptive_icon_background', 'adaptive_icon_foreground',
      'adaptive_icon_foreground_inset', 'adaptive_icon_monochrome',
      'remove_alpha_ios', 'background_color_ios', 'desaturate_tinted_to_grayscale_ios',
      'image_path_ios_dark_transparent', 'image_path_ios_tinted_grayscale'
    ];
    for (const key of order) {
      const value = config[key];
      if (value === undefined || value === null || value === '') continue;
      const rendered = typeof value === 'string' ? `"${value}"` : String(value);
      lines.push(`  ${String(key)}: ${rendered}`);
    }
    for (const block of ['web', 'windows', 'macos'] as const) {
      const sub = config[block];
      if (!sub) continue;
      const entries = Object.entries(sub).filter(([, value]) => value !== undefined && value !== null && value !== '');
      if (!entries.length) continue;
      lines.push(`  ${block}:`);
      for (const [key, value] of entries) {
        const rendered = typeof value === 'string' ? `"${value}"` : String(value);
        lines.push(`    ${key}: ${rendered}`);
      }
    }
    return lines;
  }

  public configureFlutterLauncherIcons(options: LauncherIconsConfigOptions): { ok: boolean; message: string } {
    try {
      const pubspecPath = path.join(options.projectRoot, 'pubspec.yaml');
      if (!fs.existsSync(pubspecPath)) return { ok: false, message: 'pubspec.yaml not found' };
      let content = fs.readFileSync(pubspecPath, 'utf8');
      const solidBackground = options.adaptiveIconBackground || options.backgroundColorHex || '#FFFFFF';
      const backgroundIsRaster = options.adaptiveBackgroundIsRaster === true && Boolean(options.adaptiveBackgroundPath);
      const bg = backgroundIsRaster ? options.adaptiveBackgroundPath! : solidBackground;
      const androidPath = options.androidImagePath || options.imagePath;
      const iosPath = options.iosImagePath || options.imagePath;
      const foregroundPath = options.adaptiveForegroundPath || options.imagePath;

      let configBlock: string;
      if (options.config) {
        // Full-control path: honor every user key, filling only blank image paths
        // with the studio-generated masters so the referenced files always exist.
        const merged: LauncherIconsConfig = { ...options.config };
        if (!merged.image_path) merged.image_path = options.imagePath;
        if (options.android !== false) {
          if (!merged.image_path_android) merged.image_path_android = androidPath;
          if (!merged.adaptive_icon_foreground) merged.adaptive_icon_foreground = foregroundPath;
          if (!merged.adaptive_icon_background) merged.adaptive_icon_background = bg;
          if (options.adaptiveMonochromePath && !merged.adaptive_icon_monochrome) {
            merged.adaptive_icon_monochrome = options.adaptiveMonochromePath;
          }
        }
        if (options.ios !== false && !merged.image_path_ios) merged.image_path_ios = iosPath;
        configBlock = this.serializeLauncherIconsConfig(merged).join('\n');
      } else {
        configBlock = [
          'flutter_launcher_icons:',
          `  android: ${options.android === false ? 'false' : '"launcher_icon"'}`,
          `  ios: ${options.ios !== false}`,
          `  image_path_android: "${androidPath}"`,
          `  image_path_ios: "${iosPath}"`,
          '  remove_alpha_ios: true',
          '  min_sdk_android: 21',
          `  adaptive_icon_background: "${bg}"`,
          `  adaptive_icon_foreground: "${foregroundPath}"`,
          '  adaptive_icon_foreground_inset: 0',
          ...(options.adaptiveMonochromePath
            ? [`  adaptive_icon_monochrome: "${options.adaptiveMonochromePath}"`]
            : [])
        ].join('\n');
      }
      content = this.replaceTopLevelBlock(content, 'flutter_launcher_icons', configBlock);
      fs.writeFileSync(pubspecPath, content, 'utf8');
      return { ok: true, message: 'Updated pubspec.yaml with flutter_launcher_icons configuration.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Serializes the full flutter_native_splash configuration into a YAML block.
   * Only defined keys are written, so untouched options never clutter the pubspec.
   * Booleans are written explicitly (true/false) so a deliberate `false` survives.
   */
  private serializeSplashConfig(config: SplashConfig): string[] {
    const lines: string[] = ['flutter_native_splash:'];
    const scalar = (key: keyof SplashConfig, value: unknown, quote = false): void => {
      if (value === undefined || value === null || value === '') return;
      const rendered = typeof value === 'string' && quote ? `"${value}"` : String(value);
      lines.push(`  ${String(key)}: ${rendered}`);
    };
    // Key order mirrors the package's documented order for familiarity.
    const order: Array<keyof SplashConfig> = [
      'android', 'ios', 'web',
      'color', 'color_dark',
      'background_image', 'background_image_dark',
      'image', 'image_dark',
      'branding', 'branding_dark', 'branding_mode', 'branding_bottom_padding',
      'fullscreen',
      'android_gravity', 'ios_content_mode', 'web_image_mode',
      'android_screen_orientation', 'android_min_sdk',
      'color_android', 'color_dark_android', 'color_ios', 'color_dark_ios', 'color_web', 'color_dark_web',
      'background_image_android', 'background_image_dark_android',
      'background_image_ios', 'background_image_dark_ios',
      'background_image_web', 'background_image_dark_web',
      'image_android', 'image_dark_android', 'image_ios', 'image_dark_ios', 'image_web', 'image_dark_web',
      'branding_android', 'branding_dark_android', 'branding_ios', 'branding_dark_ios', 'branding_web', 'branding_dark_web',
      'branding_bottom_padding_android', 'branding_bottom_padding_ios'
    ];
    const colorKeys = new Set<string>([
      'color', 'color_dark', 'color_android', 'color_dark_android', 'color_ios', 'color_dark_ios', 'color_web', 'color_dark_web'
    ]);
    for (const key of order) {
      const value = config[key];
      scalar(key, value, colorKeys.has(String(key)));
    }
    if (config.info_plist_files?.length) {
      lines.push('  info_plist_files:');
      for (const file of config.info_plist_files) lines.push(`    - '${file}'`);
    }
    const a12 = config.android_12;
    if (a12 && Object.values(a12).some(value => value !== undefined && value !== '')) {
      lines.push('  android_12:');
      const a12Order: Array<keyof Android12Config> = [
        'color', 'color_dark', 'image', 'image_dark',
        'icon_background_color', 'icon_background_color_dark', 'branding', 'branding_dark'
      ];
      const a12Colors = new Set(['color', 'color_dark', 'icon_background_color', 'icon_background_color_dark']);
      for (const key of a12Order) {
        const value = a12[key];
        if (value === undefined || value === null || value === '') continue;
        lines.push(`    ${String(key)}: ${a12Colors.has(String(key)) ? `"${value}"` : value}`);
      }
    }
    return lines;
  }

  /** Writes the complete splash configuration into the pubspec flutter_native_splash block. */
  public configureSplashConfig(projectRoot: string, config: SplashConfig): { ok: boolean; message: string } {
    try {
      const pubspecPath = path.join(projectRoot, 'pubspec.yaml');
      if (!fs.existsSync(pubspecPath)) return { ok: false, message: 'pubspec.yaml not found' };
      const content = fs.readFileSync(pubspecPath, 'utf8');
      const block = this.serializeSplashConfig(config).join('\n');
      const updated = this.replaceTopLevelBlock(content, 'flutter_native_splash', block);
      fs.writeFileSync(pubspecPath, updated, 'utf8');
      return { ok: true, message: 'Updated pubspec.yaml with flutter_native_splash configuration.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  public configureFlutterNativeSplash(options: NativeSplashConfigOptions): { ok: boolean; message: string } {
    try {
      const pubspecPath = path.join(options.projectRoot, 'pubspec.yaml');
      if (!fs.existsSync(pubspecPath)) return { ok: false, message: 'pubspec.yaml not found' };
      let content = fs.readFileSync(pubspecPath, 'utf8');
      const color = options.backgroundColorHex || '#FFFFFF';
      const configBlock = [
        'flutter_native_splash:',
        `  color: "${color}"`,
        `  image: "${options.imagePath}"`,
        ...(options.backgroundImagePath ? [`  background_image: "${options.backgroundImagePath}"`] : []),
        '  android_12:',
        `    image: "${options.imagePath}"`,
        `    icon_background_color: "${color}"`,
        '  web: false',
        `  fullscreen: ${options.fullscreen === true}`
      ].join('\n');
      content = this.replaceTopLevelBlock(content, 'flutter_native_splash', configBlock);
      fs.writeFileSync(pubspecPath, content, 'utf8');
      return { ok: true, message: 'Updated pubspec.yaml with flutter_native_splash configuration.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * The studio owns the foreground image, background image, base color and fullscreen
   * toggle, so their config values always reflect what was just rendered. Every other
   * key passes through untouched, giving the user full control of the rest.
   */
  private mergeManagedSplashConfig(
    config: SplashConfig,
    managed: {
      imagePath: string;
      backgroundColorHex: string;
      fullscreen?: boolean;
      backgroundImagePath?: string;
    }
  ): SplashConfig {
    const merged: SplashConfig = { ...config };
    merged.image = managed.imagePath;
    if (managed.backgroundImagePath) merged.background_image = managed.backgroundImagePath;
    else delete merged.background_image;
    // Only set the base color when no background image takes over that layer.
    if (!managed.backgroundImagePath) merged.color = managed.backgroundColorHex;
    else delete merged.color;
    merged.fullscreen = managed.fullscreen === true;
    merged.android_12 = {
      ...(merged.android_12 || {}),
      image: merged.android_12?.image || managed.imagePath,
      icon_background_color: merged.android_12?.icon_background_color || managed.backgroundColorHex
    };
    return merged;
  }

  public prepareSplashStudio(options: SplashStudioApplyOptions): IconStudioApplyResult {
    const writtenFiles: string[] = [];
    let backupPath: string | undefined;
    try {
      if (!fs.existsSync(path.join(options.projectRoot, 'pubspec.yaml'))) {
        return { ok: false, message: 'pubspec.yaml not found', writtenFiles };
      }
      IconSplashStudioService.assertPngSize(options.imageBase64, 1024);
      if (options.backgroundImageBase64) {
        IconSplashStudioService.assertPngSize(options.backgroundImageBase64, 1024);
      }
      backupPath = this.createBackup(
        options.projectRoot,
        [
          'pubspec.yaml',
          'pubspec.lock',
          '.gitignore',
          `${PACKAGE_ASSET_DIR}/splash.png`,
          `${PACKAGE_ASSET_DIR}/splash_background.png`,
          'ios/Runner/Base.lproj/LaunchScreen.storyboard',
          'ios/Runner/Info.plist'
        ],
        [
          'android/app/src/main/res',
          'ios/Runner/Assets.xcassets'
        ]
      );
      this.ensureBackupIgnored(options.projectRoot);
      IconSplashStudioService.writeBase64File(
        options.projectRoot,
        `${PACKAGE_ASSET_DIR}/splash.png`,
        options.imageBase64
      );
      writtenFiles.push(`${PACKAGE_ASSET_DIR}/splash.png`);
      if (options.backgroundImageBase64) {
        IconSplashStudioService.writeBase64File(
          options.projectRoot,
          `${PACKAGE_ASSET_DIR}/splash_background.png`,
          options.backgroundImageBase64
        );
        writtenFiles.push(`${PACKAGE_ASSET_DIR}/splash_background.png`);
      }
      const imagePath = `${PACKAGE_ASSET_DIR}/splash.png`;
      const backgroundImagePath = options.backgroundImageBase64 ? `${PACKAGE_ASSET_DIR}/splash_background.png` : undefined;
      const configResult = options.config
        ? this.configureSplashConfig(options.projectRoot, this.mergeManagedSplashConfig(options.config, {
            imagePath,
            backgroundColorHex: options.backgroundColorHex,
            fullscreen: options.fullscreen,
            backgroundImagePath
          }))
        : this.configureFlutterNativeSplash({
            projectRoot: options.projectRoot,
            imagePath,
            backgroundColorHex: options.backgroundColorHex,
            fullscreen: options.fullscreen,
            backgroundImagePath
          });
      if (!configResult.ok) throw new Error(configResult.message);
      writtenFiles.push('pubspec.yaml');
      this.pruneBackups(options.projectRoot, 5);
      return {
        ok: true,
        message: 'Prepared flutter_native_splash assets and configuration.',
        backupPath,
        writtenFiles
      };
    } catch (error) {
      if (backupPath) this.restoreBackup(options.projectRoot, backupPath);
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error.message : String(error),
        writtenFiles,
        backupPath
      };
    }
  }

  /**
   * Insert or replace a top-level YAML mapping block (`key:` and its indented
   * body) while leaving every other top-level key untouched.
   *
   * Implemented as a line scan rather than a regex: a lazy `[\s\S]*?` lookahead
   * such as `(?=^\S|\s*$)` matches zero characters right after `key:`, so the
   * old regex replaced only the bare key line and orphaned the old body,
   * producing a "Duplicate mapping key" error in the resulting pubspec.yaml.
   */
  private replaceTopLevelBlock(content: string, key: string, block: string): string {
    const lines = content.split('\n');
    const startPattern = new RegExp(`^${key}:[ \\t]*(?:#.*)?$`);

    const start = lines.findIndex(line => startPattern.test(line));
    if (start !== -1) {
      // A top-level block spans until the next non-blank, non-indented line.
      let end = start + 1;
      while (end < lines.length && (lines[end].trim() === '' || /^[ \t]/.test(lines[end]))) {
        end += 1;
      }
      // Keep the blank lines that trail the block for stable spacing.
      let endTrimmed = end;
      while (endTrimmed > start + 1 && lines[endTrimmed - 1].trim() === '') endTrimmed -= 1;
      const replacement = block.split('\n').concat(end > endTrimmed ? [''] : []);
      lines.splice(start, endTrimmed - start, ...replacement);
      return lines.join('\n');
    }

    return `${content.trimEnd()}\n\n${block}\n`;
  }

  public restoreLatestBackup(projectRoot: string): { ok: boolean; message: string; backupPath?: string } {
    const latest = this.listBackups(projectRoot)[0];
    if (!latest) return { ok: false, message: 'No App Icon Studio backup is available.' };
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(latest, 'manifest.json'), 'utf8')) as BackupManifest;
      this.restoreManifest(projectRoot, latest, manifest);
      return { ok: true, message: `Restored generated assets from ${path.basename(latest)}.`, backupPath: latest };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error), backupPath: latest };
    }
  }

  public restoreBackup(projectRoot: string, backupPath: string): { ok: boolean; message: string } {
    const backupRoot = path.resolve(projectRoot, '.air-flutter', 'backups', 'icons');
    const resolved = path.resolve(backupPath);
    if (!resolved.startsWith(`${backupRoot}${path.sep}`)) {
      return { ok: false, message: 'Backup path is outside this project.' };
    }
    const backups = this.listBackups(projectRoot);
    if (!backups.includes(resolved)) return { ok: false, message: 'Backup does not exist.' };
    const latestName = path.basename(resolved);
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(resolved, 'manifest.json'), 'utf8')) as BackupManifest;
      this.restoreManifest(projectRoot, resolved, manifest);
      return { ok: true, message: `Restored generated assets from ${latestName}.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private restoreManifest(projectRoot: string, backupPath: string, manifest: BackupManifest): void {
    for (const entry of manifest.directories || []) {
      const safe = IconSplashStudioService.normalizeRelativePath(entry.relativePath);
      const destination = path.join(projectRoot, ...safe.split('/'));
      fs.rmSync(destination, { recursive: true, force: true });
      if (entry.existed) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.cpSync(path.join(backupPath, 'directories', ...safe.split('/')), destination, { recursive: true });
      }
    }
    for (const entry of manifest.entries) {
      const safe = IconSplashStudioService.normalizeRelativePath(entry.relativePath);
      const destination = path.join(projectRoot, ...safe.split('/'));
      if (entry.existed) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(backupPath, 'files', ...safe.split('/')), destination);
      } else if (fs.existsSync(destination)) {
        fs.rmSync(destination, { recursive: true, force: true });
      }
    }
  }

  private createBackup(projectRoot: string, relativePaths: string[], directoryPaths: string[] = []): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupRoot = path.join(projectRoot, '.air-flutter', 'backups', 'icons');
    let backupPath = path.join(backupRoot, stamp);
    let suffix = 1;
    while (fs.existsSync(backupPath)) {
      backupPath = path.join(backupRoot, `${stamp}-${suffix++}`);
    }
    const entries: BackupManifestEntry[] = [];
    const directories: BackupManifestEntry[] = [];
    for (const rawPath of relativePaths) {
      const relativePath = IconSplashStudioService.normalizeRelativePath(rawPath);
      const source = path.join(projectRoot, ...relativePath.split('/'));
      const existed = fs.existsSync(source) && fs.statSync(source).isFile();
      entries.push({ relativePath, existed });
      if (existed) {
        const destination = path.join(backupPath, 'files', ...relativePath.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
      }
    }
    for (const rawPath of directoryPaths) {
      const relativePath = IconSplashStudioService.normalizeRelativePath(rawPath);
      const source = path.join(projectRoot, ...relativePath.split('/'));
      const existed = fs.existsSync(source) && fs.statSync(source).isDirectory();
      directories.push({ relativePath, existed });
      if (existed) {
        const destination = path.join(backupPath, 'directories', ...relativePath.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.cpSync(source, destination, { recursive: true });
      }
    }
    fs.mkdirSync(backupPath, { recursive: true });
    const manifest: BackupManifest = { createdAt: new Date().toISOString(), entries, directories };
    fs.writeFileSync(path.join(backupPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return backupPath;
  }

  private ensureBackupIgnored(projectRoot: string): void {
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const rule = '.air-flutter/backups/';
    const content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    const lines = content.split(/\r?\n/).map(line => line.trim());
    if (!lines.includes(rule)) {
      fs.writeFileSync(gitignorePath, `${content.trimEnd()}${content.trim() ? '\n' : ''}${rule}\n`, 'utf8');
    }
  }

  private listBackups(projectRoot: string): string[] {
    const root = path.join(projectRoot, '.air-flutter', 'backups', 'icons');
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root)
      .map(name => path.join(root, name))
      .filter(candidate => fs.statSync(candidate).isDirectory() && fs.existsSync(path.join(candidate, 'manifest.json')))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  }

  private pruneBackups(projectRoot: string, keep: number): void {
    for (const backup of this.listBackups(projectRoot).slice(keep)) {
      fs.rmSync(backup, { recursive: true, force: true });
    }
  }
}
