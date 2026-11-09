import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  ANDROID_PERMISSION_CATALOG,
  AndroidPermissionManager,
  IOS_PERMISSION_CATALOG,
  IosPermissionManager,
  AndroidRuntimePermissionService,
  getPermissionCategories
} from '../../../domain/android-permission-manager';
import { AppStateWiper } from '../../../domain/app-state-wiper';
import { PanelDeviceContext } from './panelNetworkHandler';

const NO_CHANGES_MESSAGE = 'Selected permissions already exist in AndroidManifest.xml. No changes made.';
const NO_CHANGES_IOS_MESSAGE = 'Selected permissions already exist in Info.plist. No changes made.';

export class PanelPermissionHandler {
  private readonly runtimeService: AndroidRuntimePermissionService;

  constructor(private readonly ctx: PanelDeviceContext) {
    this.runtimeService = new AndroidRuntimePermissionService(() => this.ctx.getADBExecutable());
  }

  public async handleLoadRuntimePermissions(packageId?: string): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    const panel = this.ctx.getPanel();

    let effectivePackageId = packageId?.trim();
    if (!effectivePackageId) {
      const projectPath = this.ctx.getInitialProjectPath();
      if (projectPath) {
        effectivePackageId = AppStateWiper.readApplicationId(projectPath) || '';
      }
    }

    if (!serial) {
      panel?.webview.postMessage({
        command: 'runtimePermissionsState',
        status: 'error',
        error: 'No active device connected to query runtime permissions.',
        packageId: effectivePackageId || ''
      });
      return;
    }

    if (!effectivePackageId) {
      panel?.webview.postMessage({
        command: 'runtimePermissionsState',
        status: 'error',
        error: 'Unable to detect application ID. Please run the app or specify package ID.',
        packageId: ''
      });
      return;
    }

    try {
      panel?.webview.postMessage({
        command: 'runtimePermissionsState',
        status: 'loading',
        message: `Querying runtime permissions for ${effectivePackageId}…`,
        packageId: effectivePackageId
      });

      const permissions = await this.runtimeService.getPermissions(serial, effectivePackageId);

      panel?.webview.postMessage({
        command: 'runtimePermissionsState',
        status: 'success',
        permissions,
        packageId: effectivePackageId,
        serial
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      panel?.webview.postMessage({
        command: 'runtimePermissionsState',
        status: 'error',
        error: msg,
        packageId: effectivePackageId
      });
    }
  }

  public async handleGrantPermission(packageId: string, permission: string): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) return;
    try {
      const ok = await this.runtimeService.grantPermission(serial, packageId, permission);
      if (ok) {
        this.ctx.showSuccessMessage(`Granted ${permission}`);
        await this.handleLoadRuntimePermissions(packageId);
      } else {
        this.ctx.showErrorMessage(`Failed to grant ${permission}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Error granting permission: ${msg}`);
    }
  }

  public async handleRevokePermission(packageId: string, permission: string): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial) return;
    try {
      const ok = await this.runtimeService.revokePermission(serial, packageId, permission);
      if (ok) {
        this.ctx.showSuccessMessage(`Revoked ${permission}`);
        await this.handleLoadRuntimePermissions(packageId);
      } else {
        this.ctx.showErrorMessage(`Failed to revoke ${permission}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Error revoking permission: ${msg}`);
    }
  }

  public async handleGrantAllPermissions(packageId: string, permissions: string[]): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial || !packageId || !permissions.length) return;
    try {
      await this.runtimeService.grantAllPermissions(serial, packageId, permissions);
      this.ctx.showSuccessMessage(`Granted ${permissions.length} permission(s)`);
      await this.handleLoadRuntimePermissions(packageId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Error granting permissions: ${msg}`);
    }
  }

  public async handleRevokeAllPermissions(packageId: string, permissions: string[]): Promise<void> {
    const serial = this.ctx.getActiveDeviceSerial();
    if (!serial || !packageId || !permissions.length) return;
    try {
      await this.runtimeService.revokeAllPermissions(serial, packageId, permissions);
      this.ctx.showSuccessMessage(`Revoked ${permissions.length} permission(s)`);
      await this.handleLoadRuntimePermissions(packageId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Error revoking permissions: ${msg}`);
    }
  }

  public async handleLoadPermissions(platform: 'android' | 'ios' = 'android'): Promise<void> {
    try {
      if (platform === 'ios') {
        const projectPath = this.getIosProjectPath();
        if (!projectPath) {
          return this.postUnavailable('Open a Flutter project with an iOS platform (ios/Runner/Info.plist) to manage iOS permissions.');
        }
        const plistState = await IosPermissionManager.read(projectPath);
        this.ctx.getPanel()?.webview.postMessage({
          command: 'permissionCatalogLoaded',
          platform: 'ios',
          catalog: IOS_PERMISSION_CATALOG,
          declaredPermissions: plistState.declaredPermissions,
          categories: getPermissionCategories('ios'),
          hasAndroid: Boolean(this.getAndroidProjectPath()),
          hasIos: true
        });
        return;
      }

      const projectPath = this.getAndroidProjectPath();
      if (!projectPath) return this.postUnavailable();
      const manifestState = await AndroidPermissionManager.read(projectPath);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'permissionCatalogLoaded',
        platform: 'android',
        catalog: ANDROID_PERMISSION_CATALOG,
        declaredPermissions: manifestState.declaredPermissions,
        categories: getPermissionCategories('android'),
        hasAndroid: true,
        hasIos: Boolean(this.getIosProjectPath())
      });
    } catch (error) {
      this.reportError(`Unable to read ${platform === 'ios' ? 'iOS' : 'Android'} permissions`, error);
    }
  }

  public async handleAddPermissions(
    selectedPermissions?: string[],
    platform: 'android' | 'ios' = 'android',
    permissionsMap?: Record<string, string>
  ): Promise<void> {
    try {
      if (platform === 'ios') {
        const projectPath = this.getIosProjectPath();
        if (!projectPath) {
          return this.postUnavailable('Open a Flutter project with an iOS platform to manage permissions.');
        }

        const allowedIos = new Map(IOS_PERMISSION_CATALOG.map(item => [item.name, item.defaultUsageDescription]));
        const toInject: Record<string, string> = {};

        if (permissionsMap && typeof permissionsMap === 'object') {
          for (const [key, desc] of Object.entries(permissionsMap)) {
            if (allowedIos.has(key)) {
              toInject[key] = (typeof desc === 'string' && desc.trim().length > 0) ? desc.trim() : (allowedIos.get(key) || '');
            }
          }
        } else if (Array.isArray(selectedPermissions)) {
          for (const key of selectedPermissions) {
            if (allowedIos.has(key)) {
              toInject[key] = allowedIos.get(key) || '';
            }
          }
        }

        const injection = await IosPermissionManager.inject(projectPath, toInject);
        if (!injection.changed) {
          this.ctx.postStatus(NO_CHANGES_IOS_MESSAGE, 'info');
          vscode.window.showInformationMessage(NO_CHANGES_IOS_MESSAGE);
          this.ctx.getPanel()?.webview.postMessage({
            command: 'permissionsUnchanged',
            platform: 'ios',
            message: NO_CHANGES_IOS_MESSAGE,
            declaredPermissions: injection.declaredPermissions
          });
          return;
        }

        const message = `Added ${injection.addedPermissions.length} permission(s) to Info.plist.`;
        this.ctx.postStatus(message, 'success');
        this.ctx.showSuccessMessage(message);
        this.ctx.getPanel()?.webview.postMessage({
          command: 'permissionsAdded',
          platform: 'ios',
          message,
          addedPermissions: injection.addedPermissions,
          declaredPermissions: injection.declaredPermissions
        });
        return;
      }

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
          platform: 'android',
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
        platform: 'android',
        message,
        addedPermissions: injection.addedPermissions,
        declaredPermissions: injection.declaredPermissions
      });
    } catch (error) {
      this.reportError(`Unable to update ${platform === 'ios' ? 'iOS' : 'Android'} permissions`, error);
    }
  }

  private getAndroidProjectPath(): string | undefined {
    const projectPath = this.ctx.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) return undefined;
    const manifestPath = path.join(projectPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    return fs.existsSync(manifestPath) ? projectPath : undefined;
  }

  private getIosProjectPath(): string | undefined {
    const projectPath = this.ctx.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) return undefined;
    const plistPath = path.join(projectPath, 'ios', 'Runner', 'Info.plist');
    return fs.existsSync(plistPath) ? projectPath : undefined;
  }

  private postUnavailable(message?: string): void {
    this.ctx.getPanel()?.webview.postMessage({
      command: 'permissionCatalogUnavailable',
      message: message || 'Open a Flutter project with an Android platform to manage permissions.'
    });
  }

  private reportError(prefix: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.ctx.showErrorMessage(`${prefix}: ${message}`);
    this.ctx.postStatus(`${prefix}: ${message}`, 'error');
    this.ctx.getPanel()?.webview.postMessage({ command: 'permissionCatalogError', message });
  }
}

