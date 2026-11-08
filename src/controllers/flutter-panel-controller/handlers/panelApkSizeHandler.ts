import * as vscode from 'vscode';
import { ApkSizeAnalyzerService } from '../../../domain/apk-size-analyzer';
import { PanelDeviceContext } from './panelNetworkHandler';

export class PanelApkSizeHandler {
  private readonly service = new ApkSizeAnalyzerService();

  constructor(private readonly ctx: PanelDeviceContext) {}

  public async openModal(): Promise<void> {
    await this.ctx.openFlutterPanel();
    const panel = this.ctx.getPanel();
    if (!panel) return;

    const projectPath = this.ctx.getInitialProjectPath();
    const defaultApks = projectPath ? ApkSizeAnalyzerService.findDefaultApks(projectPath) : [];

    panel.webview.postMessage({
      command: 'openApkSizeModal',
      data: {
        defaultApks,
        projectPath: projectPath || ''
      }
    });

    if (defaultApks.length > 0) {
      this.analyze(defaultApks[0]);
    }
  }

  public analyze(apkPath: string): void {
    const panel = this.ctx.getPanel();
    if (!panel) return;

    try {
      panel.webview.postMessage({
        command: 'apkSizeState',
        status: 'loading',
        message: 'Analyzing APK/AAB package structure…'
      });

      const report = this.service.analyzeApkFile(apkPath);

      panel.webview.postMessage({
        command: 'apkSizeState',
        status: 'success',
        report
      });
      this.ctx.postStatus(`Analyzed APK: ${report.fileName} (${(report.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        command: 'apkSizeState',
        status: 'error',
        error: msg
      });
      this.ctx.showErrorMessage(`APK size analysis failed: ${msg}`);
    }
  }

  public async pickAndAnalyze(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Android Packages': ['apk', 'aab'],
        'All Files': ['*']
      },
      openLabel: 'Analyze Package'
    });

    if (uris && uris.length > 0) {
      this.analyze(uris[0].fsPath);
    }
  }
}

