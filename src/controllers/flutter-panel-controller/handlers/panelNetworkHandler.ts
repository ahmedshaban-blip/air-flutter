import * as vscode from 'vscode';
import { NetworkManager } from '../../../domain/network-manager';
import { SslDoctorService } from '../../../domain/ssl-doctor';
import { PanelHandlerContext } from './panelCompatHandler';

export interface PanelDeviceContext extends PanelHandlerContext {
  getActiveDeviceSerial(): string | undefined;
  getADBExecutable(): Promise<string>;
  notifyOfflineState?(isOffline: boolean): void;
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
        data: {
          proxy: null,
          dnsMode: null,
          dnsSpecifier: null,
          localIp,
          isWireless: false,
          isEmulator: false,
          isOffline: false,
          offlineMode: null,
          activeThrottle: null,
          activeErrorSimulation: null
        }
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
      this.ctx.notifyOfflineState?.(state.isOffline);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.postStatus(`⚠️ Network state check failed: ${msg}`, 'warning');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'networkState',
        data: {
          proxy: null,
          dnsMode: null,
          dnsSpecifier: null,
          localIp,
          isWireless: NetworkManager.isWirelessDevice(serial),
          isEmulator: NetworkManager.isEmulator(serial),
          isOffline: false,
          offlineMode: null,
          activeThrottle: null,
          activeErrorSimulation: null
        }
      });
    }
  }

  public async handleToggleOffline(modePreference?: 'auto' | 'dns_drop' | 'hardware'): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No online device connected.');
      return;
    }

    try {
      const adbPath = await this.ctx.getADBExecutable();
      const currentState = await NetworkManager.getNetworkState(adbPath, serial);
      const targetOffline = !currentState.isOffline;

      const result = await NetworkManager.setOfflineMode(adbPath, serial, targetOffline, modePreference || 'auto');
      this.ctx.notifyOfflineState?.(result.offline);

      if (result.offline) {
        const modeLabel = result.mode === 'dns_drop'
          ? 'Instant Host Drop (Wireless Safe: ADB link 100% intact)'
          : 'Hardware Radio Cut (Wi-Fi & Data Off)';
        this.ctx.postStatus(`📶 Offline Mode ENABLED (${modeLabel})`, 'warning');
        vscode.window.showInformationMessage(`📶 Offline Mode ENABLED (${modeLabel})`);
      } else {
        this.ctx.postStatus('🌐 Online Mode RESTORED', 'success');
        vscode.window.showInformationMessage('🌐 Online Mode RESTORED');
      }

      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to toggle offline mode: ${msg}`);
      this.ctx.postStatus(`❌ Network error: ${msg}`, 'error');
    }
  }

  public async handleGenerateFlutterOverrides(): Promise<void> {
    const projectPath = this.ctx.getInitialProjectPath();
    if (!projectPath) {
      this.ctx.showErrorMessage('No active Flutter workspace found.');
      return;
    }

    try {
      const sslDoctor = new SslDoctorService();
      const res = sslDoctor.generateDevHttpOverrides(projectPath);
      if (res.ok) {
        this.ctx.showSuccessMessage('Created lib/dev_http_overrides.dart! Add HttpOverrides.global = DevHttpOverrides(); in main() to route all Flutter calls through the lab.');
        vscode.window.showInformationMessage('✅ Created lib/dev_http_overrides.dart. Add HttpOverrides.global = DevHttpOverrides(); in main().');
      } else {
        this.ctx.showErrorMessage(`Failed to create overrides: ${res.message}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Error generating overrides: ${msg}`);
    }
  }

  public async handleSetNetworkThrottle(preset: 'normal' | '2g' | '3g' | 'delay3s'): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No online device connected.');
      return;
    }

    try {
      const adbPath = await this.ctx.getADBExecutable();
      const res = await NetworkManager.setNetworkThrottle(adbPath, serial, preset);

      if (preset === 'normal') {
        this.ctx.postStatus('⚡ Network speed restored to NORMAL', 'success');
        vscode.window.showInformationMessage('⚡ Network speed restored to normal.');
      } else {
        const label = preset === 'delay3s' ? '3000ms Latency' : preset.toUpperCase();
        const viaLabel = res.appliedVia === 'emulator' ? 'Emulator network engine' : 'Local Mock Proxy';
        this.ctx.postStatus(`⏳ Network throttled to ${label} via ${viaLabel}`, 'warning');
        vscode.window.showInformationMessage(`⏳ Network throttled to ${label} (${viaLabel})`);
      }

      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to throttle network: ${msg}`);
      this.ctx.postStatus(`❌ Throttle error: ${msg}`, 'error');
    }
  }

  public async handleSimulateError(
    errorType: 'none' | 'connection_refused' | 'http_500' | 'http_404' | 'http_401'
  ): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No online device connected.');
      return;
    }

    try {
      const adbPath = await this.ctx.getADBExecutable();
      await NetworkManager.simulateErrorState(adbPath, serial, errorType);

      if (errorType === 'none') {
        this.ctx.postStatus('✅ Network error simulation CLEARED', 'success');
        vscode.window.showInformationMessage('✅ Network error simulation cleared.');
      } else if (errorType === 'connection_refused') {
        this.ctx.postStatus('💥 Simulating Connection Drop (Immediate SocketException)', 'warning');
        vscode.window.showInformationMessage('💥 Connection Drop simulated (Immediate failure).');
      } else {
        const code = errorType.replace('http_', 'HTTP ');
        this.ctx.postStatus(`🚨 Simulating ${code} Server Error`, 'warning');
        vscode.window.showInformationMessage(`🚨 Simulating ${code} Server Error on all endpoints.`);
      }

      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to simulate error state: ${msg}`);
      this.ctx.postStatus(`❌ Error simulation failed: ${msg}`, 'error');
    }
  }

  public async handleResetNetworkSimulation(): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) return;

    try {
      const adbPath = await this.ctx.getADBExecutable();
      await NetworkManager.clearHttpProxy(adbPath, serial);
      await NetworkManager.setOfflineMode(adbPath, serial, false);
      await NetworkManager.setNetworkThrottle(adbPath, serial, 'normal');
      await NetworkManager.simulateErrorState(adbPath, serial, 'none');

      this.ctx.postStatus('🔄 All network overrides & simulations reset to normal', 'success');
      vscode.window.showInformationMessage('🔄 All network overrides & simulations reset to normal.');
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to reset network simulation: ${msg}`);
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
