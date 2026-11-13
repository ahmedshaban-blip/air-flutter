import * as vscode from 'vscode';
import {
  IconSplashStudioService,
  IconDensityData,
  IconStudioApplyOptions,
  IosIconData,
  LauncherIconsConfig,
  SplashStudioApplyOptions,
  SplashConfig,
  IconAssetRecord,
  SplashAssetRecord,
  SplashBackgroundFit
} from '../../../domain/icon-splash-studio';
import { PanelHandlerContext } from './panelCompatHandler';
import { runVisibleTask } from '../../../infra/vscode/run-visible-task';

export class PanelIconSplashHandler {
  private readonly service: IconSplashStudioService;

  constructor(private readonly ctx: PanelHandlerContext) {
    this.service = new IconSplashStudioService();
  }

  /** Validates a PNG produced by the webview conversion step. */
  public validateIconAsset(payload: { requestId?: string; base64Png?: string }): void {
    const requestId = payload.requestId;
    const reply = (ok: boolean, message?: string) => {
      this.ctx.getPanel()?.webview.postMessage({
        command: 'iconAssetValidated',
        requestId,
        ok,
        message
      });
    };
    if (!payload.base64Png) {
      reply(false, 'No image payload was provided.');
      return;
    }
    try {
      this.service.validateConvertedIcon(payload.base64Png);
      reply(true);
    } catch (error) {
      reply(false, error instanceof Error ? error.message : String(error));
    }
  }

  public sendProjectInfo(): void {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.getPanel()?.webview.postMessage({
        command: 'iconStudioProjectInfo',
        error: 'No Flutter project workspace is open.'
      });
      return;
    }
    this.ctx.getPanel()?.webview.postMessage({
      command: 'iconStudioProjectInfo',
      ...this.service.getProjectInfo(cwd),
      ...this.buildSavedAssetsPayload(cwd)
    });
  }

  /**
   * Reads the persisted studio state and resolves each stored source image to a
   * data URL so the webview can render thumbnails without extra round-trips.
   */
  private buildSavedAssetsPayload(cwd: string): { savedIcon?: unknown; savedSplash?: unknown } {
    const state = this.service.readState(cwd);
    const toDataUrl = (relativePath?: string): string | undefined => {
      const image = this.service.readStateImage(cwd, relativePath);
      return image.base64 ? `data:image/png;base64,${image.base64}` : undefined;
    };
    const savedIcon = state.icon
      ? {
          ...state.icon,
          foregroundDataUrl: toDataUrl(state.icon.foregroundImagePath),
          backgroundDataUrl: toDataUrl(state.icon.backgroundImagePath),
          monochromeDataUrl: toDataUrl(state.icon.monochromeImagePath)
        }
      : undefined;
    const savedSplash = state.splash
      ? {
          ...state.splash,
          artworkDataUrl: toDataUrl(state.splash.artworkImagePath),
          backgroundDataUrl: toDataUrl(state.splash.backgroundImagePath)
        }
      : undefined;
    return { savedIcon, savedSplash };
  }

  public async applyIconStudio(payload: {
    mode?: 'native' | 'packages';
    applyAndroid?: boolean;
    applyIos?: boolean;
    backgroundColorHex?: string;
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
    /** Full flutter_launcher_icons option set. Written verbatim in packages mode. */
    launcherIconsConfig?: LauncherIconsConfig;
    /** Re-editable record persisted after a successful apply. */
    record?: {
      backgroundMode?: 'color' | 'gradient' | 'image';
      gradientStops?: Array<{ color: string; position: number }>;
      gradientAngle?: number;
      foregroundBase64?: string;
      backgroundBase64?: string;
      monochromeBase64?: string;
    };
  }): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    const mode = payload.mode === 'packages' ? 'packages' : 'native';
    const platforms = [payload.applyAndroid !== false ? 'Android' : '', payload.applyIos !== false ? 'iOS' : '']
      .filter(Boolean)
      .join(' + ');
    const commandSummary = mode === 'packages'
      ? 'This will save generated assets, add flutter_launcher_icons, run flutter pub get, and generate platform icons.'
      : 'This will replace native launcher assets in the selected platforms.';
    const choice = await vscode.window.showWarningMessage(
      `${commandSummary}\n\nTarget: ${platforms || 'No platform selected'}\nA restorable backup will be created first.`,
      { modal: true },
      'Generate & Apply'
    );
    if (choice !== 'Generate & Apply') {
      this.ctx.getPanel()?.webview.postMessage({ command: 'iconStudioApplyCancelled' });
      return;
    }

    const options: IconStudioApplyOptions = {
      projectRoot: cwd,
      mode,
      applyAndroid: payload.applyAndroid !== false,
      applyIos: payload.applyIos !== false,
      backgroundColorHex: /^#[0-9a-f]{6}$/i.test(payload.backgroundColorHex || '')
        ? payload.backgroundColorHex!
        : '#FFFFFF',
      legacyIcons: payload.legacyIcons,
      adaptiveForegroundIcons: payload.adaptiveForegroundIcons,
      adaptiveBackgroundIcons: payload.adaptiveBackgroundIcons,
      adaptiveMonochromeIcons: payload.adaptiveMonochromeIcons,
      iosIcons: payload.iosIcons,
      androidLegacyMasterBase64: payload.androidLegacyMasterBase64,
      androidForegroundMasterBase64: payload.androidForegroundMasterBase64,
      androidBackgroundMasterBase64: payload.androidBackgroundMasterBase64,
      androidMonochromeMasterBase64: payload.androidMonochromeMasterBase64,
      iosMasterBase64: payload.iosMasterBase64,
      launcherIconsConfig: payload.launcherIconsConfig
    };

    this.ctx.postStatus('Creating icon backup and applying generated assets...', 'info');
    const result = this.service.applyIconStudio(options);
    if (!result.ok) {
      this.ctx.showErrorMessage(`App Icon Studio: ${result.message}`);
      this.ctx.getPanel()?.webview.postMessage({ command: 'iconStudioApplied', success: false, message: result.message });
      return;
    }

    try {
      if (mode === 'packages') {
        await runVisibleTask('Install Launcher Icon Generator', 'flutter pub add --dev flutter_launcher_icons', cwd);
        await runVisibleTask('Generate Launcher Icons', 'dart run flutter_launcher_icons', cwd);
      }
      this.persistIconRecord(cwd, options, payload.record);
      const message = `${result.message} Backup: ${result.backupPath}`;
      this.ctx.showSuccessMessage('App icons generated successfully.');
      this.ctx.postStatus(message, 'success');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'iconStudioApplied',
        success: true,
        message: result.message,
        writtenFiles: result.writtenFiles,
        backupPath: result.backupPath,
        mode,
        ...this.buildSavedAssetsPayload(cwd)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rollback = result.backupPath ? this.service.restoreBackup(cwd, result.backupPath) : undefined;
      const recoveryMessage = rollback?.ok
        ? 'Project files were restored from backup.'
        : `Automatic rollback failed${rollback ? `: ${rollback.message}` : '.'}`;
      this.ctx.showErrorMessage(`${message} ${recoveryMessage}`);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'iconStudioApplied',
        success: false,
        message: `${message} ${recoveryMessage}`
      });
    }
  }

  private persistIconRecord(
    cwd: string,
    options: IconStudioApplyOptions,
    record?: {
      backgroundMode?: 'color' | 'gradient' | 'image';
      gradientStops?: Array<{ color: string; position: number }>;
      gradientAngle?: number;
      foregroundBase64?: string;
      backgroundBase64?: string;
      monochromeBase64?: string;
    }
  ): void {
    try {
      const assetRecord: Omit<IconAssetRecord, 'generatedAt'> = {
        mode: options.mode,
        applyAndroid: options.applyAndroid,
        applyIos: options.applyIos,
        backgroundMode: record?.backgroundMode ?? 'color',
        backgroundColorHex: options.backgroundColorHex,
        gradientStops: record?.gradientStops ?? [],
        gradientAngle: record?.gradientAngle ?? 180,
        foregroundImagePath: undefined,
        backgroundImagePath: undefined,
        monochromeImagePath: undefined,
        config: options.launcherIconsConfig
      };
      this.service.saveIconRecord(cwd, assetRecord, {
        foregroundBase64: record?.foregroundBase64,
        backgroundBase64: record?.backgroundBase64,
        monochromeBase64: record?.monochromeBase64
      });
    } catch (error) {
      this.ctx.postStatus(`Icon applied, but the saved preview could not be stored: ${error instanceof Error ? error.message : String(error)}`, 'info');
    }
  }

  private persistSplashRecord(
    cwd: string,
    options: SplashStudioApplyOptions,
    record?: { useAppIcon?: boolean; splashScale?: number; artworkBase64?: string }
  ): void {
    try {
      const assetRecord: Omit<SplashAssetRecord, 'generatedAt'> = {
        backgroundColorHex: options.backgroundColorHex,
        fullscreen: options.fullscreen === true,
        useAppIcon: record?.useAppIcon !== false,
        splashScale: record?.splashScale ?? 45,
        backgroundFit: options.backgroundFit ?? 'cover',
        config: options.config,
        artworkImagePath: undefined,
        backgroundImagePath: undefined
      };
      this.service.saveSplashRecord(cwd, assetRecord, {
        artworkBase64: record?.artworkBase64,
        backgroundBase64: options.backgroundImageBase64
      });
    } catch (error) {
      this.ctx.postStatus(`Splash applied, but the saved preview could not be stored: ${error instanceof Error ? error.message : String(error)}`, 'info');
    }
  }

  /** Deletes one asset: reverts generated files via the newest backup, clears the record. */
  public async deleteAsset(payload: { asset?: 'icon' | 'splash' | 'both' }): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }
    const asset = payload.asset === 'splash' ? 'splash' : payload.asset === 'both' ? 'both' : 'icon';
    const label = asset === 'both' ? 'icon and splash assets' : `${asset} assets`;
    const choice = await vscode.window.showWarningMessage(
      `Delete the generated ${label}? This restores the previous project files from the latest backup and clears the saved studio record.`,
      { modal: true },
      'Delete'
    );
    if (choice !== 'Delete') {
      this.ctx.getPanel()?.webview.postMessage({ command: 'iconSplashDeleteCancelled' });
      return;
    }

    const backup = this.service.restoreLatestBackup(cwd);
    this.service.clearAssetRecord(cwd, asset);
    const message = backup.ok
      ? `Deleted ${label}. ${backup.message}`
      : `Cleared the saved ${label} record, but no backup was available to revert files.`;
    if (backup.ok) this.ctx.showSuccessMessage(message);
    else this.ctx.showErrorMessage(message);
    this.ctx.getPanel()?.webview.postMessage({
      command: 'iconSplashDeleted',
      success: true,
      asset,
      message,
      ...this.buildSavedAssetsPayload(cwd)
    });
  }

  public restoreLatestIcons(): void {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }
    const result = this.service.restoreLatestBackup(cwd);
    if (result.ok) this.ctx.showSuccessMessage(result.message);
    else this.ctx.showErrorMessage(result.message);
    this.ctx.getPanel()?.webview.postMessage({
      command: 'iconStudioRestoreResult',
      success: result.ok,
      message: result.message
    });
  }

  public async applySplashStudio(payload: {
    imageBase64?: string;
    backgroundColorHex?: string;
    fullscreen?: boolean;
    backgroundImageBase64?: string;
    backgroundFit?: SplashBackgroundFit;
    config?: SplashConfig;
    record?: {
      useAppIcon?: boolean;
      splashScale?: number;
      artworkBase64?: string;
    };
  }): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }
    if (!payload.imageBase64) {
      this.ctx.showErrorMessage('Choose or reuse a valid splash image first.');
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      'Generate Android and iOS native splash screens from the approved preview? A restorable platform snapshot will be created first.',
      { modal: true },
      'Generate Splash'
    );
    if (choice !== 'Generate Splash') {
      this.ctx.getPanel()?.webview.postMessage({ command: 'splashStudioApplyCancelled' });
      return;
    }

    const options: SplashStudioApplyOptions = {
      projectRoot: cwd,
      imageBase64: payload.imageBase64,
      backgroundColorHex: /^#[0-9a-f]{6}$/i.test(payload.backgroundColorHex || '')
        ? payload.backgroundColorHex!
        : '#FFFFFF',
      fullscreen: payload.fullscreen !== false,
      backgroundImageBase64: payload.backgroundImageBase64,
      backgroundFit: payload.backgroundFit,
      config: payload.config
    };
    this.ctx.postStatus('Creating splash snapshot and preparing flutter_native_splash...', 'info');
    const result = this.service.prepareSplashStudio(options);
    if (!result.ok) {
      this.ctx.showErrorMessage(result.message);
      this.ctx.getPanel()?.webview.postMessage({ command: 'splashStudioApplied', success: false, message: result.message });
      return;
    }
    try {
      await runVisibleTask('Install Native Splash Generator', 'flutter pub add --dev flutter_native_splash', cwd);
      await runVisibleTask('Generate Native Splash', 'dart run flutter_native_splash:create', cwd);
      this.persistSplashRecord(cwd, options, payload.record);
      const message = 'Android and iOS splash screens generated successfully.';
      this.ctx.showSuccessMessage(message);
      this.ctx.postStatus(`${message} Backup: ${result.backupPath}`, 'success');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'splashStudioApplied',
        success: true,
        message,
        writtenFiles: result.writtenFiles,
        backupPath: result.backupPath,
        ...this.buildSavedAssetsPayload(cwd)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rollback = result.backupPath ? this.service.restoreBackup(cwd, result.backupPath) : undefined;
      const recoveryMessage = rollback?.ok
        ? 'Platform files were restored from the splash snapshot.'
        : `Automatic rollback failed${rollback ? `: ${rollback.message}` : '.'}`;
      this.ctx.showErrorMessage(`${message} ${recoveryMessage}`);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'splashStudioApplied',
        success: false,
        message: `${message} ${recoveryMessage}`
      });
    }
  }

  public async saveNativeIcons(payload: {
    master1024Base64?: string;
    densities?: IconDensityData[];
    backgroundColorHex?: string;
    applyAndroid?: boolean;
    applyIos?: boolean;
  }): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    let androidOk = true;
    let iosOk = true;

    if (payload.applyAndroid !== false) {
      const androidRes = this.service.writeAndroidIcons({
        projectRoot: cwd,
        densities: payload.densities,
        backgroundColorHex: payload.backgroundColorHex
      });
      androidOk = androidRes.ok;
      if (!androidOk) {
        this.ctx.showErrorMessage(`Android icon error: ${androidRes.error}`);
      }
    }

    if (payload.applyIos !== false && payload.master1024Base64) {
      const iosRes = this.service.writeIosIcons({
        projectRoot: cwd,
        master1024Base64: payload.master1024Base64
      });
      iosOk = iosRes.ok;
      if (!iosOk) {
        this.ctx.showErrorMessage(`iOS icon error: ${iosRes.error}`);
      }
    }

    if (androidOk && iosOk) {
      const msg = 'Successfully generated and deployed native App Icons!';
      this.ctx.showSuccessMessage(msg);
      this.ctx.postStatus(msg, 'success');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'iconSplashSaved',
        success: true
      });
    }
  }

  public async configureLauncherIconsYaml(options: {
    imagePath: string;
    backgroundColorHex?: string;
  }): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    const res = this.service.configureFlutterLauncherIcons({
      projectRoot: cwd,
      imagePath: options.imagePath,
      backgroundColorHex: options.backgroundColorHex
    });

    if (res.ok) {
      this.ctx.showSuccessMessage(res.message);
      this.ctx.postStatus(res.message, 'success');
    } else {
      this.ctx.showErrorMessage(res.message);
    }
  }

  public async runLauncherIconsCli(): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    try {
      this.ctx.postStatus('Running flutter_launcher_icons...', 'info');
      await runVisibleTask('Flutter Launcher Icons', 'dart run flutter_launcher_icons', cwd);
      this.ctx.showSuccessMessage('Launcher icons generated via CLI successfully!');
      this.ctx.postStatus('Launcher icons generated via CLI successfully!', 'success');
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }

  public async configureNativeSplashYaml(options: {
    imagePath: string;
    backgroundColorHex: string;
    fullscreen?: boolean;
  }): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    const res = this.service.configureFlutterNativeSplash({
      projectRoot: cwd,
      imagePath: options.imagePath,
      backgroundColorHex: options.backgroundColorHex,
      fullscreen: options.fullscreen
    });

    if (res.ok) {
      this.ctx.showSuccessMessage(res.message);
      this.ctx.postStatus(res.message, 'success');
    } else {
      this.ctx.showErrorMessage(res.message);
    }
  }

  public async runNativeSplashCli(): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    try {
      this.ctx.postStatus('Running flutter_native_splash:create...', 'info');
      await runVisibleTask('Flutter Native Splash', 'dart run flutter_native_splash:create', cwd);
      this.ctx.showSuccessMessage('Native splash screens generated via CLI successfully!');
      this.ctx.postStatus('Native splash screens generated via CLI successfully!', 'success');
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }
}
