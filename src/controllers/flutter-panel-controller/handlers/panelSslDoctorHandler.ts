import * as vscode from 'vscode';
import { SslDoctorService } from '../../../domain/ssl-doctor';
import { PanelDeviceContext } from './panelNetworkHandler';

export class PanelSslDoctorHandler {
  private readonly service: SslDoctorService;

  constructor(private readonly ctx: PanelDeviceContext) {
    this.service = new SslDoctorService();
  }

  public async fetchStatus(): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    const panel = this.ctx.getPanel();
    if (!cwd) {
      panel?.webview.postMessage({
        command: 'sslDoctorStatus',
        data: null,
        error: 'No active Flutter workspace.'
      });
      return;
    }

    try {
      const status = this.service.getStatus(cwd);
      panel?.webview.postMessage({
        command: 'sslDoctorStatus',
        data: status
      });
    } catch (err: any) {
      panel?.webview.postMessage({
        command: 'sslDoctorStatus',
        data: null,
        error: err.message
      });
    }
  }

  public async applyNetworkSecurityConfig(): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No active Flutter workspace.');
      return;
    }

    const res = this.service.applyNetworkSecurityConfig(cwd);
    if (res.ok) {
      this.ctx.showSuccessMessage(res.message);
      this.ctx.postStatus(res.message, 'success');
      await this.fetchStatus();
    } else {
      this.ctx.showErrorMessage(res.message);
    }
  }

  public async generateDevHttpOverrides(): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No active Flutter workspace.');
      return;
    }

    const res = this.service.generateDevHttpOverrides(cwd);
    if (res.ok) {
      this.ctx.showSuccessMessage(res.message);
      this.ctx.postStatus(res.message, 'success');
      await this.fetchStatus();
    } else {
      this.ctx.showErrorMessage(res.message);
    }
  }
}

