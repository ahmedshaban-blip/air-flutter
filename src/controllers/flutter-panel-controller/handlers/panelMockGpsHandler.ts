import * as vscode from 'vscode';
import {
  MockGpsService,
  GPS_PRESETS
} from '../../../domain/mock-gps';
import { PanelDeviceContext } from './panelNetworkHandler';

export class PanelMockGpsHandler {
  private readonly service: MockGpsService;

  constructor(private readonly ctx: PanelDeviceContext) {
    this.service = new MockGpsService(() => this.ctx.getADBExecutable());
  }

  private async resolveSerial(serial?: string): Promise<string | undefined> {
    if (serial && serial.trim().length > 0) {
      return serial.trim();
    }
    const ctxSerial = this.ctx.getActiveDeviceSerial();
    if (ctxSerial && ctxSerial.trim().length > 0) {
      return ctxSerial.trim();
    }
    return await this.service.getConnectedDeviceSerial();
  }

  public async openModal(): Promise<void> {
    await this.ctx.openFlutterPanel();
    const panel = this.ctx.getPanel();
    if (!panel) return;

    const serial = await this.resolveSerial();
    panel.webview.postMessage({
      command: 'openMockGpsModal',
      data: {
        serial: serial || '',
        presets: GPS_PRESETS
      }
    });
  }

  public async setLocation(lat: number, lon: number, altitude = 0, targetSerial?: string): Promise<void> {
    const panel = this.ctx.getPanel();
    const serial = await this.resolveSerial(targetSerial);
    if (!serial) {
      this.ctx.showErrorMessage('No active device connected to set GPS location.');
      panel?.webview.postMessage({
        command: 'mockGpsState',
        status: 'error',
        error: 'No active device connected.'
      });
      return;
    }

    try {
      panel?.webview.postMessage({
        command: 'mockGpsState',
        status: 'loading',
        message: `Setting GPS coordinates to (${lat}, ${lon})…`
      });

      const res = await this.service.setLocation(serial, lat, lon, altitude);
      this.ctx.showSuccessMessage(`GPS location updated: ${lat}, ${lon}`);
      this.ctx.postStatus(res.message, 'success');

      panel?.webview.postMessage({
        command: 'mockGpsState',
        status: 'success',
        result: res
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to set GPS: ${msg}`);
      this.ctx.postStatus(`Failed to set GPS: ${msg}`, 'error');
      panel?.webview.postMessage({
        command: 'mockGpsState',
        status: 'error',
        error: msg
      });
    }
  }

  public async resetLocation(targetSerial?: string): Promise<void> {
    const panel = this.ctx.getPanel();
    const serial = await this.resolveSerial(targetSerial);
    if (!serial) {
      panel?.webview.postMessage({
        command: 'mockGpsState',
        status: 'success',
        isReset: true,
        result: {
          ok: true,
          message: 'Coordinates reset to default.'
        }
      });
      return;
    }

    try {
      panel?.webview.postMessage({
        command: 'mockGpsState',
        status: 'loading',
        message: 'Resetting mock GPS to default…'
      });

      const res = await this.service.resetLocation(serial);
      this.ctx.showSuccessMessage(res.message);
      this.ctx.postStatus(res.message, 'success');

      panel?.webview.postMessage({
        command: 'mockGpsState',
        status: 'success',
        isReset: true,
        result: res
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to reset GPS: ${msg}`);
      panel?.webview.postMessage({
        command: 'mockGpsState',
        status: 'error',
        error: msg
      });
    }
  }

  public dispose(): void {
    this.service.dispose();
  }
}

