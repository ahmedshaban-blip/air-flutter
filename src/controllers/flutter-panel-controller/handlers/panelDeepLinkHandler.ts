import * as vscode from 'vscode';
import { DeepLinkHistory, DeepLinkIntentStudio } from '../../../domain/deep-link-intent-studio';
import { PanelDeviceContext } from './panelNetworkHandler';

const PRESET_KEY = 'deepLinkIntentStudio.presets';

export interface DeepLinkPreset {
  name: string;
  uri: string;
  packageName?: string;
}

export class PanelDeepLinkHandler {
  private readonly history: DeepLinkHistory;

  constructor(
    private readonly ctx: PanelDeviceContext,
    workspaceState: vscode.Memento,
    private readonly globalState: vscode.Memento,
    private readonly studio: DeepLinkIntentStudio
  ) {
    this.history = new DeepLinkHistory(workspaceState);
  }

  public load(): void {
    const projectPath = this.ctx.getInitialProjectPath();
    this.ctx.getPanel()?.webview.postMessage({
      command: 'deepLinkStudioState',
      suggestions: projectPath ? DeepLinkIntentStudio.detectManifestLinks(projectPath) : [],
      recentUris: this.history.list(),
      presets: this.globalState.get<DeepLinkPreset[]>(PRESET_KEY, [])
    });
  }

  public async dispatch(uri: unknown, deviceId?: unknown, packageName?: unknown): Promise<void> {
    const targetDevice = typeof deviceId === 'string' && deviceId
      ? deviceId
      : this.ctx.getActiveDeviceSerial();
    try {
      const result = await this.studio.dispatch({
        deviceId: targetDevice || '',
        uri: typeof uri === 'string' ? uri : '',
        packageName: typeof packageName === 'string' ? packageName : undefined
      });
      const recentUris = await this.history.remember(DeepLinkIntentStudio.validateUri(uri));
      this.ctx.postStatus(`${result.summary}${result.output ? ` ADB: ${this.compact(result.output)}` : ''}`, result.ok ? 'success' : 'error');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'deepLinkDispatchResult',
        result,
        recentUris
      });
      if (result.ok) this.ctx.showSuccessMessage(result.summary);
      else this.ctx.showErrorMessage(result.summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.postStatus(`Deep link dispatch failed: ${message}`, 'error');
      this.ctx.showErrorMessage(message);
      this.ctx.getPanel()?.webview.postMessage({ command: 'deepLinkDispatchError', message });
    }
  }

  public async savePreset(name: unknown, uri: unknown, packageName?: unknown): Promise<void> {
    try {
      if (typeof name !== 'string' || !name.trim()) throw new Error('Enter a preset name.');
      const cleanUri = DeepLinkIntentStudio.validateUri(uri);
      const cleanPackage = DeepLinkIntentStudio.validatePackageName(packageName);
      const cleanName = name.trim().slice(0, 80);
      const presets = this.globalState.get<DeepLinkPreset[]>(PRESET_KEY, []);
      const next = [
        { name: cleanName, uri: cleanUri, ...(cleanPackage ? { packageName: cleanPackage } : {}) },
        ...presets.filter(preset => preset.name.toLocaleLowerCase() !== cleanName.toLocaleLowerCase())
      ];
      await this.globalState.update(PRESET_KEY, next);
      this.ctx.getPanel()?.webview.postMessage({ command: 'deepLinkPresetsUpdated', presets: next });
      this.ctx.postStatus(`Saved deep link preset “${cleanName}”.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.getPanel()?.webview.postMessage({ command: 'deepLinkDispatchError', message });
      this.ctx.showErrorMessage(message);
    }
  }

  public async deletePreset(name: unknown): Promise<void> {
    if (typeof name !== 'string') return;
    const next = this.globalState.get<DeepLinkPreset[]>(PRESET_KEY, []).filter(preset => preset.name !== name);
    await this.globalState.update(PRESET_KEY, next);
    this.ctx.getPanel()?.webview.postMessage({ command: 'deepLinkPresetsUpdated', presets: next });
  }

  public async dispatchPush(payload: { title: string; body: string; deepLink?: string }, packageName?: string, deviceId?: string): Promise<void> {
    const targetDevice = deviceId || this.ctx.getActiveDeviceSerial();
    const panel = this.ctx.getPanel();
    if (!targetDevice) {
      panel?.webview.postMessage({
        command: 'pushNotificationState',
        status: 'error',
        error: 'No active device connected.'
      });
      return;
    }

    try {
      panel?.webview.postMessage({
        command: 'pushNotificationState',
        status: 'loading',
        message: 'Broadcasting test push notification…'
      });

      const res = await this.studio.dispatchPush({
        deviceId: targetDevice,
        packageName: packageName || 'com.example.app',
        payload
      });

      panel?.webview.postMessage({
        command: 'pushNotificationState',
        status: res.ok ? 'success' : 'error',
        result: res
      });

      if (res.ok) {
        this.ctx.showSuccessMessage(res.summary);
      } else {
        this.ctx.showErrorMessage(res.summary);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      panel?.webview.postMessage({
        command: 'pushNotificationState',
        status: 'error',
        error: msg
      });
      this.ctx.showErrorMessage(`Push test failed: ${msg}`);
    }
  }

  private compact(output: string): string {
    return output.replace(/\s+/g, ' ').trim().slice(0, 500);
  }
}
