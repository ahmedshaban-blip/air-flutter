import * as vscode from 'vscode';
import {
  StorageInspectorService,
  StorageInspectorMode,
  KNOWN_STORAGE_PRESETS
} from '../../../domain/storage-inspector';
import { AppStateWiper } from '../../../domain/app-state-wiper';
import { PanelDeviceContext } from './panelNetworkHandler';

export class PanelStorageInspectorHandler {
  private readonly service: StorageInspectorService;

  constructor(private readonly ctx: PanelDeviceContext) {
    this.service = new StorageInspectorService(() => this.ctx.getADBExecutable());
  }

  public async openModal(packageId?: string): Promise<void> {
    await this.ctx.openFlutterPanel();
    const panel = this.ctx.getPanel();
    if (!panel) return;

    let effectivePackageId = packageId;
    let isAutoDetected = false;
    if (!effectivePackageId) {
      const projectPath = this.ctx.getInitialProjectPath();
      if (projectPath) {
        effectivePackageId = AppStateWiper.readApplicationId(projectPath);
        if (effectivePackageId) {
          isAutoDetected = true;
        }
      }
    }

    const serial = this.ctx.getActiveDeviceSerial();
    panel.webview.postMessage({
      command: 'openStorageInspectorModal',
      data: {
        serial: serial || '',
        packageId: effectivePackageId || '',
        presets: KNOWN_STORAGE_PRESETS,
        isAutoDetected
      }
    });

    const targetSerial = this.resolveSerial(serial);
    if (targetSerial && effectivePackageId) {
      await this.listFiles(targetSerial, effectivePackageId, 'auto', []);
    }
  }

  private resolveSerial(serial?: string): string {
    return (serial && serial.trim().length > 0) ? serial.trim() : (this.ctx.getActiveDeviceSerial() || '');
  }

  public async listFiles(
    serial: string,
    packageId: string,
    mode: StorageInspectorMode = 'auto',
    selectedPresets: string[] = []
  ): Promise<void> {
    const panel = this.ctx.getPanel();
    if (!panel) return;

    const targetSerial = this.resolveSerial(serial);
    if (!targetSerial) {
      panel.webview.postMessage({
        command: 'storageInspectorState',
        status: 'error',
        error: 'No active device selected. Please connect or select an Android device.'
      });
      return;
    }

    try {
      panel.webview.postMessage({
        command: 'storageInspectorState',
        status: 'loading',
        message: 'Reading storage directory via run-as…'
      });

      const result = await this.service.listStorageFiles(targetSerial, packageId, mode, selectedPresets);

      panel.webview.postMessage({
        command: 'storageInspectorState',
        status: 'success',
        result
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        command: 'storageInspectorState',
        status: 'error',
        error: msg
      });
    }
  }

  public async readSharedPreferences(serial: string, packageId: string, fileName: string): Promise<void> {
    const panel = this.ctx.getPanel();
    if (!panel) return;

    const targetSerial = this.resolveSerial(serial);
    if (!targetSerial) {
      panel.webview.postMessage({
        command: 'storageInspectorDetailError',
        fileName,
        error: 'No active device selected.'
      });
      return;
    }

    try {
      panel.webview.postMessage({
        command: 'storageInspectorDetailLoading',
        fileName
      });

      const items = await this.service.readSharedPreferences(targetSerial, packageId, fileName);

      panel.webview.postMessage({
        command: 'storageInspectorSharedPrefsLoaded',
        fileName,
        items
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        command: 'storageInspectorDetailError',
        fileName,
        error: msg
      });
    }
  }

  public async saveSharedPreference(
    serial: string,
    packageId: string,
    fileName: string,
    key: string,
    value: string,
    type: 'string' | 'int' | 'long' | 'float' | 'boolean'
  ): Promise<void> {
    const panel = this.ctx.getPanel();
    const targetSerial = this.resolveSerial(serial);
    if (!targetSerial) {
      this.ctx.showErrorMessage('No active device selected.');
      return;
    }

    try {
      await this.service.setSharedPreference(targetSerial, packageId, fileName, key, value, type);
      this.ctx.showSuccessMessage(`Saved "${key}" in ${fileName}`);
      await this.readSharedPreferences(targetSerial, packageId, fileName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to save preference: ${msg}`);
      panel?.webview.postMessage({
        command: 'storageInspectorDetailError',
        fileName,
        error: msg
      });
    }
  }

  public async deleteSharedPreference(
    serial: string,
    packageId: string,
    fileName: string,
    key: string
  ): Promise<void> {
    const panel = this.ctx.getPanel();
    const targetSerial = this.resolveSerial(serial);
    if (!targetSerial) {
      this.ctx.showErrorMessage('No active device selected.');
      return;
    }

    try {
      await this.service.deleteSharedPreference(targetSerial, packageId, fileName, key);
      this.ctx.showSuccessMessage(`Deleted "${key}" from ${fileName}`);
      await this.readSharedPreferences(targetSerial, packageId, fileName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to delete preference: ${msg}`);
      panel?.webview.postMessage({
        command: 'storageInspectorDetailError',
        fileName,
        error: msg
      });
    }
  }

  public async listSqliteTables(serial: string, packageId: string, dbName: string): Promise<void> {
    const panel = this.ctx.getPanel();
    if (!panel) return;

    const targetSerial = this.resolveSerial(serial);
    if (!targetSerial) {
      panel.webview.postMessage({
        command: 'storageInspectorDetailError',
        dbName,
        error: 'No active device selected.'
      });
      return;
    }

    try {
      panel.webview.postMessage({
        command: 'storageInspectorDetailLoading',
        dbName
      });

      const tables = await this.service.listSqliteTables(targetSerial, packageId, dbName);

      panel.webview.postMessage({
        command: 'storageInspectorTablesLoaded',
        dbName,
        tables
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        command: 'storageInspectorDetailError',
        dbName,
        error: msg
      });
    }
  }

  public async querySqliteTable(
    serial: string,
    packageId: string,
    dbName: string,
    query: string
  ): Promise<void> {
    const panel = this.ctx.getPanel();
    if (!panel) return;

    const targetSerial = this.resolveSerial(serial);
    if (!targetSerial) {
      panel.webview.postMessage({
        command: 'storageInspectorDetailError',
        dbName,
        error: 'No active device selected.'
      });
      return;
    }

    try {
      panel.webview.postMessage({
        command: 'storageInspectorDetailLoading',
        dbName
      });

      const queryResult = await this.service.querySqliteTable(targetSerial, packageId, dbName, query);

      panel.webview.postMessage({
        command: 'storageInspectorQueryLoaded',
        dbName,
        queryResult
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        command: 'storageInspectorDetailError',
        dbName,
        error: msg
      });
    }
  }
}

