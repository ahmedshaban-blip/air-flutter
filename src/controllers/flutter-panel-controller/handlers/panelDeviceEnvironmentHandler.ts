import * as vscode from 'vscode';
import { DeviceEnvironmentService } from '../../../domain/device-environment';
import { PanelDeviceContext } from './panelNetworkHandler';

export class PanelDeviceEnvironmentHandler {
  private readonly service: DeviceEnvironmentService;

  constructor(private readonly ctx: PanelDeviceContext) {
    this.service = new DeviceEnvironmentService(() => this.ctx.getADBExecutable());
  }

  private resolveSerial(): string | undefined {
    return this.ctx.getActiveDeviceSerial();
  }

  public async fetchState(): Promise<void> {
    const serial = this.resolveSerial();
    const panel = this.ctx.getPanel();
    if (!serial) {
      panel?.webview.postMessage({
        command: 'deviceEnvironmentState',
        data: null,
        error: 'No active device connected.'
      });
      return;
    }

    try {
      const state = await this.service.getState(serial);
      panel?.webview.postMessage({
        command: 'deviceEnvironmentState',
        data: state
      });
    } catch (err: any) {
      panel?.webview.postMessage({
        command: 'deviceEnvironmentState',
        data: null,
        error: err.message
      });
    }
  }

  public async setFontScale(scale: number): Promise<void> {
    const serial = this.resolveSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No active device connected.');
      return;
    }
    try {
      await this.service.setFontScale(serial, scale);
      this.ctx.postStatus(`Device font scale set to ${scale}x`, 'info');
      await this.fetchState();
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }

  public async setDarkMode(enabled: boolean): Promise<void> {
    const serial = this.resolveSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No active device connected.');
      return;
    }
    try {
      await this.service.setDarkMode(serial, enabled);
      this.ctx.postStatus(`Device UI night mode set to ${enabled ? 'ON' : 'OFF'}`, 'info');
      await this.fetchState();
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }

  public async setBatteryLevel(level: number, charging = false): Promise<void> {
    const serial = this.resolveSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No active device connected.');
      return;
    }
    try {
      await this.service.setBatteryLevel(serial, level, charging);
      this.ctx.postStatus(`Simulated device battery set to ${level}% (${charging ? 'Charging' : 'Unplugged'})`, 'info');
      await this.fetchState();
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }

  public async resetBattery(): Promise<void> {
    const serial = this.resolveSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No active device connected.');
      return;
    }
    try {
      await this.service.resetBattery(serial);
      this.ctx.postStatus('Reset simulated battery to actual hardware state.', 'success');
      await this.fetchState();
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }

  public async setLocale(localeTag: string): Promise<void> {
    const serial = this.resolveSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No active device connected.');
      return;
    }
    try {
      await this.service.setLocale(serial, localeTag);
      this.ctx.postStatus(`Device locale set to ${localeTag}`, 'info');
      await this.fetchState();
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }

  public async setDensity(dpi: number | 'reset'): Promise<void> {
    const serial = this.resolveSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No active device connected.');
      return;
    }
    try {
      await this.service.setDensity(serial, dpi);
      this.ctx.postStatus(`Device display density updated (${dpi})`, 'info');
      await this.fetchState();
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }

  public async setRotation(rotation: 0 | 1 | 'auto'): Promise<void> {
    const serial = this.resolveSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No active device connected.');
      return;
    }
    try {
      await this.service.setRotation(serial, rotation);
      this.ctx.postStatus(`Device screen rotation set to ${rotation}`, 'info');
      await this.fetchState();
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }
}

