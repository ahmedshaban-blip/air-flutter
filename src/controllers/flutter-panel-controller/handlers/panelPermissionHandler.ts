import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  ANDROID_PERMISSION_CATALOG,
  AndroidPermissionManager
} from '../../../domain/android-permission-manager';
import { PanelHandlerContext } from './panelCompatHandler';

const NO_CHANGES_MESSAGE = 'Selected permissions already exist in AndroidManifest.xml. No changes made.';

export class PanelPermissionHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  public async handleLoadPermissions(): Promise<void> {
    try {
      const projectPath = this.getAndroidProjectPath();
      if (!projectPath) return this.postUnavailable();
      const manifestState = await AndroidPermissionManager.read(projectPath);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'permissionCatalogLoaded',
        catalog: ANDROID_PERMISSION_CATALOG,
        declaredPermissions: manifestState.declaredPermissions
      });
    } catch (error) {
      this.reportError('Unable to read Android permissions', error);
    }
  }

  public async handleAddPermissions(selectedPermissions?: string[]): Promise<void> {
    try {
      const projectPath = this.getAndroidProjectPath();
      if (!projectPath) return this.postUnavailable();
      const allowedPermissions = new Set(ANDROID_PERMISSION_CATALOG.map(permission => permission.name));
      const candidates = (selectedPermissions || []).filter(permission => allowedPermissions.has(permission));
      const injection = await AndroidPermissionManager.inject(projectPath, candidates);

      if (!injection.changed) {
        this.ctx.postStatus(NO_CHANGES_MESSAGE, 'info');
        vscode.window.showInformationMessage(NO_CHANGES_MESSAGE);
        this.ctx.getPanel()?.webview.postMessage({
          command: 'permissionsUnchanged',
          message: NO_CHANGES_MESSAGE,
          declaredPermissions: injection.declaredPermissions
        });
        return;
      }

      const message = `Added ${injection.addedPermissions.length} permission(s) to AndroidManifest.xml.`;
      this.ctx.postStatus(message, 'success');
      this.ctx.showSuccessMessage(message);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'permissionsAdded',
        message,
        addedPermissions: injection.addedPermissions,
        declaredPermissions: injection.declaredPermissions
      });
    } catch (error) {
      this.reportError('Unable to update Android permissions', error);
    }
  }

  private getAndroidProjectPath(): string | undefined {
    const projectPath = this.ctx.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) return undefined;
    const manifestPath = path.join(projectPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    return fs.existsSync(manifestPath) ? projectPath : undefined;
  }

  private postUnavailable(): void {
    this.ctx.getPanel()?.webview.postMessage({
      command: 'permissionCatalogUnavailable',
      message: 'Open a Flutter project with an Android platform to manage permissions.'
    });
  }

  private reportError(prefix: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.ctx.showErrorMessage(`${prefix}: ${message}`);
    this.ctx.postStatus(`${prefix}: ${message}`, 'error');
    this.ctx.getPanel()?.webview.postMessage({ command: 'permissionCatalogError', message });
  }
}
