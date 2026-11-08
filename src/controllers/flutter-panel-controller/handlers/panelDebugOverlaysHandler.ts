import * as vscode from 'vscode';
import {
  FlutterDebugOverlaysService,
  FlutterOverlayType,
  OVERLAY_HOTKEYS
} from '../../../domain/flutter-debug-overlays';
import { PanelDeviceContext } from './panelNetworkHandler';

export class PanelDebugOverlaysHandler {
  private readonly service: FlutterDebugOverlaysService;

  constructor(
    private readonly ctx: PanelDeviceContext,
    sendKeystroke?: (char: string) => Promise<boolean>
  ) {
    this.service = new FlutterDebugOverlaysService(sendKeystroke);
  }

  public async openModal(): Promise<void> {
    await this.ctx.openFlutterPanel();
    const panel = this.ctx.getPanel();
    if (!panel) return;

    panel.webview.postMessage({
      command: 'openDebugOverlaysModal',
      data: {
        state: this.service.getState(),
        meta: OVERLAY_HOTKEYS
      }
    });
  }

  public postState(): void {
    const panel = this.ctx.getPanel();
    if (!panel) return;
    panel.webview.postMessage({
      command: 'debugOverlaysState',
      state: this.service.getState(),
      meta: OVERLAY_HOTKEYS
    });
  }

  public async toggleOverlay(overlay: FlutterOverlayType): Promise<void> {
    const panel = this.ctx.getPanel();
    try {
      const result = await this.service.toggleOverlay(overlay);
      const meta = OVERLAY_HOTKEYS[overlay];
      const statusText = result.enabled ? 'enabled' : 'disabled';
      this.ctx.showSuccessMessage(`${meta.name} ${statusText} (keystroke: "${result.hotkey}")`);
      this.ctx.postStatus(`Flutter Overlay: ${meta.name} ${statusText}`, 'success');

      panel?.webview.postMessage({
        command: 'debugOverlaysState',
        state: result.state,
        meta: OVERLAY_HOTKEYS
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to toggle overlay: ${msg}`);
      this.ctx.postStatus(`Failed to toggle overlay: ${msg}`, 'error');
    }
  }

  public resetAll(): void {
    const panel = this.ctx.getPanel();
    const state = this.service.resetAll();
    panel?.webview.postMessage({
      command: 'debugOverlaysState',
      state,
      meta: OVERLAY_HOTKEYS
    });
    this.ctx.showSuccessMessage('Reset all Flutter debug overlays');
  }
}

