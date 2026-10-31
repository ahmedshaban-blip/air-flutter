import * as vscode from 'vscode';
import { NetworkManager } from '../../../domain/network-manager';
import { PanelHandlerContext } from './panelCompatHandler';

export interface PanelDeviceContext extends PanelHandlerContext {
  getActiveDeviceSerial(): string | undefined;
  getADBExecutable(): Promise<string>;
}

export class PanelNetworkHandler {
  constructor(private readonly ctx: PanelDeviceContext) {}

  public async openProxyModal(): Promise<void> {
    await this.ctx.openFlutterPanel();
    const panel = this.ctx.getPanel();
    if (panel) {
      panel.webview.postMessage({ command: 'openProxyModal' });
    }
    await this.handleGetNetworkState();
  }

  public async handleGetNetworkState(): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    const localIp = NetworkManager.getLocalIp();

    if (!serial) {
      this.ctx.getPanel()?.webview.postMessage({
        command: 'networkState',
        data: { proxy: null, dnsMode: null, dnsSpecifier: null, localIp }
      });
      return;
    }

    try {
      const adbPath = await this.ctx.getADBExecutable();
      const state = await NetworkManager.getNetworkState(adbPath, serial);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'networkState',
        data: state
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.postStatus(`⚠️ Network state check failed: ${msg}`, 'warning');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'networkState',
        data: { proxy: null, dnsMode: null, dnsSpecifier: null, localIp }
      });
    }
  }

  public async handleSetProxy(host?: string, port?: string): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No online device connected.');
      return;
    }
    if (!host || !port) {
      this.ctx.showErrorMessage('Proxy Host and Port are required.');
      return;
    }

    try {
      const adbPath = await this.ctx.getADBExecutable();
      await NetworkManager.setHttpProxy(adbPath, serial, host, port);
      this.ctx.postStatus(`✅ HTTP Proxy set to ${host}:${port}`, 'success');
      vscode.window.showInformationMessage(`✅ HTTP Proxy set to ${host}:${port}`);
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to set HTTP proxy: ${msg}`);
      this.ctx.postStatus(`❌ Proxy error: ${msg}`, 'error');
    }
  }

  public async handleClearProxy(): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No online device connected.');
      return;
    }

    try {
      const adbPath = await this.ctx.getADBExecutable();
      await NetworkManager.clearHttpProxy(adbPath, serial);
      this.ctx.postStatus('✅ HTTP Proxy cleared.', 'success');
      vscode.window.showInformationMessage('✅ HTTP Proxy cleared on device.');
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to clear HTTP proxy: ${msg}`);
      this.ctx.postStatus(`❌ Proxy error: ${msg}`, 'error');
    }
  }

  public async handleSetPrivateDns(host?: string): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No online device connected.');
      return;
    }
    if (!host) {
      this.ctx.showErrorMessage('Private DNS hostname is required.');
      return;
    }

    try {
      const adbPath = await this.ctx.getADBExecutable();
      await NetworkManager.setPrivateDns(adbPath, serial, host);
      this.ctx.postStatus(`✅ Private DNS set to ${host}`, 'success');
      vscode.window.showInformationMessage(`✅ Private DNS set to ${host}`);
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to set Private DNS: ${msg}`);
      this.ctx.postStatus(`❌ DNS error: ${msg}`, 'error');
    }
  }

  public async handleClearPrivateDns(): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No online device connected.');
      return;
    }

    try {
      const adbPath = await this.ctx.getADBExecutable();
      await NetworkManager.clearPrivateDns(adbPath, serial);
      this.ctx.postStatus('✅ Private DNS turned off.', 'success');
      vscode.window.showInformationMessage('✅ Private DNS turned off on device.');
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to clear Private DNS: ${msg}`);
      this.ctx.postStatus(`❌ DNS error: ${msg}`, 'error');
    }
  }
}

