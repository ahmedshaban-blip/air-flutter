import * as vscode from 'vscode';
import {
  IconSplashStudioService,
  IconDensityData,
  LauncherIconsConfigOptions,
  NativeSplashConfigOptions
} from '../../../domain/icon-splash-studio';
import { PanelHandlerContext } from './panelCompatHandler';
import { runVisibleTask } from '../../../infra/vscode/run-visible-task';

export class PanelIconSplashHandler {
  private readonly service: IconSplashStudioService;

  constructor(private readonly ctx: PanelHandlerContext) {
    this.service = new IconSplashStudioService();
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

