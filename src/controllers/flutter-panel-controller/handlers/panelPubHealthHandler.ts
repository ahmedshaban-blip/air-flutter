import * as vscode from 'vscode';
import { PubHealthService } from '../../../domain/pub-health';
import { PanelDeviceContext } from './panelNetworkHandler';

export class PanelPubHealthHandler {
  private readonly service = new PubHealthService();

  constructor(private readonly ctx: PanelDeviceContext) {}

  public async openModal(): Promise<void> {
    await this.ctx.openFlutterPanel();
    const panel = this.ctx.getPanel();
    if (!panel) return;

    panel.webview.postMessage({
      command: 'openPubHealthModal',
      data: {
        projectPath: this.ctx.getInitialProjectPath() || ''
      }
    });

    await this.checkHealth();
  }

  public async checkHealth(): Promise<void> {
    const panel = this.ctx.getPanel();
    const projectPath = this.ctx.getInitialProjectPath();
    if (!projectPath) {
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'error',
        error: 'No active Flutter workspace found.'
      });
      return;
    }

    try {
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'loading',
        message: 'Running flutter pub outdated --json…'
      });

      const summary = await this.service.checkHealth(projectPath);

      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'success',
        summary
      });
      this.ctx.postStatus(`Pub health check complete: ${summary.upgradableCount} upgradable, ${summary.majorUpdateCount} major updates`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'error',
        error: msg
      });
      this.ctx.showErrorMessage(`Pub health check failed: ${msg}`);
    }
  }

  public async runPubUpgrade(): Promise<void> {
    const projectPath = this.ctx.getInitialProjectPath();
    if (!projectPath) return;

    const term = vscode.window.createTerminal({ name: 'Flutter Pub Upgrade', cwd: projectPath });
    term.show();
    term.sendText('flutter pub upgrade');
    this.ctx.showSuccessMessage('Running "flutter pub upgrade" in terminal…');
  }
}

