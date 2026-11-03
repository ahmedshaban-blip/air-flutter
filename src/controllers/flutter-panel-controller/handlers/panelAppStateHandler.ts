import * as vscode from 'vscode';
import {
  AppStateWiper,
  InstalledPackage,
  WipeOperation
} from '../../../domain/app-state-wiper';
import { PanelHandlerContext } from './panelCompatHandler';

export interface PanelAppStateContext extends PanelHandlerContext {
  getActiveDeviceSerial(): string | undefined;
  getADBExecutable(): Promise<string>;
}

interface ResolvedPackage {
  packageId: string;
  serial: string;
  source: 'gradle' | 'installed' | 'manual';
}

const OPERATION_LABELS: Record<WipeOperation, string> = {
  cache: 'Clear cache',
  databases: 'Reset databases',
  factory: 'Factory reset',
  'all-data': 'Clear all data'
};

/**
 * Panel + sidebar handler for the Deep Storage & Cache Wiper.
 *
 * Resolves the app package (gradle auto-detect, installed picker, or manual),
 * runs the requested wipe on one explicit device, and reports progress back to
 * whichever webview asked for it.
 */
export class PanelAppStateHandler {
  private readonly wiper: AppStateWiper;
  /** Remembers the confirmed package per device within a session. */
  private readonly lastPackageBySerial = new Map<string, string>();

  constructor(
    private readonly ctx: PanelAppStateContext,
    wiper: AppStateWiper
  ) {
    this.wiper = wiper;
  }

  /// Entry point invoked from a webview button. `serial` is optional; when it is
  /// absent the active device is resolved the same way other panel tools do.
  public async handleWipeRequest(
    operation: WipeOperation,
    requestedSerial?: string,
    requestedPackage?: string
  ): Promise<void> {
    try {
      const serial = requestedSerial || this.ctx.getActiveDeviceSerial();
      if (!serial) {
        this.fail('No online device connected.', operation);
        return;
      }

      const packageId = requestedPackage
        ? requestedPackage
        : await this.resolvePackageId(serial);
      if (!packageId) {
        // The user cancelled the picker; nothing to report as an error.
        return;
      }

      // Destructive actions always confirm, naming exactly what will happen.
      const confirmed = await this.confirm(operation, packageId, serial);
      if (!confirmed) {
        this.ctx.getPanel()?.webview.postMessage({
          command: 'appStateCancelled',
          operation
        });
        return;
      }

      this.postState({ busy: true, operation, packageId });

      const result =
        operation === 'factory' || operation === 'all-data'
          ? await this.wiper.clearAllData(serial, packageId, { restart: true })
          : operation === 'cache'
            ? await this.wiper.clearCache(serial, packageId, { restart: true })
            : await this.wiper.clearDatabases(serial, packageId, { restart: true });

      this.lastPackageBySerial.set(serial, packageId);

      const detail = result.warnings.length > 0
        ? `${result.message} ${result.warnings.join(' ')}`
        : result.message;

      this.ctx.postStatus(`✅ ${detail}`, result.warnings.length > 0 ? 'warning' : 'success');
      this.ctx.showSuccessMessage(detail);
      this.postState({ busy: false, operation, packageId, result });
      this.ctx.getPanel()?.webview.postMessage({
        command: 'showToast',
        message: detail,
        type: result.warnings.length > 0 ? 'error' : 'success'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.fail(message, operation);
    }
  }

  /// Resolves the package id: remembered selection, gradle auto-detect, then a
  /// picker that also offers installed packages and manual entry.
  public async resolvePackageId(serial: string): Promise<string | undefined> {
    const remembered = this.lastPackageBySerial.get(serial);
    if (remembered) {
      return remembered;
    }

    const projectPath =
      this.ctx.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const detected = projectPath ? AppStateWiper.readApplicationId(projectPath) : undefined;

    if (detected && !AppStateWiper.isLikelySystemPackage(detected)) {
      return detected;
    }

    return this.pickPackageId(serial, detected);
  }

  /// Shows a QuickPick of detected + installed packages, with manual input.
  public async pickPackageId(
    serial: string,
    detected?: string
  ): Promise<string | undefined> {
    const detectedValue =
      detected ??
      (() => {
        const projectPath =
          this.ctx.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return projectPath ? AppStateWiper.readApplicationId(projectPath) : undefined;
      })();

    const items: Array<vscode.QuickPickItem & { value?: string; action?: string }> = [];

    if (detectedValue) {
      items.push({
        label: `$(rocket) ${detectedValue}`,
        description: 'detected from android/app/build.gradle',
        value: detectedValue
      });
    }

    items.push({
      label: '$(list-unordered) Choose from installed packages…',
      description: 'pm list packages -3',
      action: 'list-installed'
    });
    items.push({
      label: '$(pencil) Enter package manually…',
      description: 'type an applicationId',
      action: 'manual'
    });

    const choice = await vscode.window.showQuickPick(items, {
      title: 'Select the app package to reset',
      placeHolder: detectedValue
        ? `Detected: ${detectedValue}`
        : 'Pick a package for the Wiper',
      ignoreFocusOut: true
    });
    if (!choice) {
      return undefined;
    }
    if (choice.value) {
      return choice.value;
    }

    if (choice.action === 'manual') {
      return this.promptManualPackage(detectedValue);
    }

    // List installed packages on the device.
    let installed: InstalledPackage[] = [];
    try {
      this.postState({ busy: true, phase: 'listing' });
      installed = await this.wiper.listInstalledPackages(serial, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Could not list installed packages: ${message}`);
      this.postState({ busy: false });
      return undefined;
    }
    this.postState({ busy: false });

    if (installed.length === 0) {
      vscode.window.showWarningMessage('No third-party packages were found on the device.');
      return this.promptManualPackage(detectedValue);
    }

    const picked = await vscode.window.showQuickPick(
      installed.map(pkg => ({
        label: `$(package) ${pkg.id}`,
        description: pkg.shortName,
        value: pkg.id
      })),
      {
        title: 'Installed packages on the device',
        placeHolder: 'Select the app to reset',
        ignoreFocusOut: true,
        matchOnDescription: true
      }
    );
    if (!picked) {
      return undefined;
    }

    this.lastPackageBySerial.set(serial, picked.value);
    return picked.value;
  }

  private async promptManualPackage(detected?: string): Promise<string | undefined> {
    const input = await vscode.window.showInputBox({
      title: 'Enter the applicationId to reset',
      prompt: 'For example com.example.myapp',
      value: detected || '',
      ignoreFocusOut: true,
      validateInput: value => {
        if (!AppStateWiper.isValidPackageId(value.trim())) {
          return 'Enter a valid Android package id (letters, digits, dots).';
        }
        if (AppStateWiper.isLikelySystemPackage(value.trim())) {
          return 'That looks like a system package and cannot be reset.';
        }
        return undefined;
      }
    });
    const trimmed = input?.trim();
    return trimmed ? trimmed : undefined;
  }

  /// Quick actions exposed from the command palette.
  public async openWipeQuickPick(serialFallback?: string): Promise<void> {
    const serial = serialFallback || this.ctx.getActiveDeviceSerial();
    if (!serial) {
      this.ctx.showErrorMessage('No online device connected.');
      return;
    }
    const packageId = await this.resolvePackageId(serial);
    if (!packageId) {
      return;
    }
    const choice = await vscode.window.showQuickPick(
      (['cache', 'databases', 'factory'] as WipeOperation[]).map(op => ({
        label:
          op === 'cache'
            ? '$(trash) Clear cache only'
            : op === 'databases'
              ? '$(database) Reset databases only'
              : '$(warning) Factory reset (pm clear)',
        description: op === 'factory' ? 'erases everything' : 'run-as targeted',
        value: op
      })),
      { title: `Reset ${packageId}`, ignoreFocusOut: true }
    );
    if (choice) {
      await this.handleWipeRequest(choice.value, serial, packageId);
    }
  }

  private async confirm(
    operation: WipeOperation,
    packageId: string,
    serial: string
  ): Promise<boolean> {
    const label = OPERATION_LABELS[operation];
    const destructive = operation === 'factory' || operation === 'all-data';
    const detail = destructive
      ? `This erases ALL app data for ${packageId} on ${serial} (like a fresh install) and cannot be undone.`
      : operation === 'cache'
        ? `Removes cached files under cache/ for ${packageId} on ${serial}. Preferences and databases are kept when the build is debuggable.`
        : `Removes local databases for ${packageId} on ${serial}. Preferences are kept when the build is debuggable.`;

    const picked = await vscode.window.showWarningMessage(
      `${label} — ${packageId}?`,
      { modal: true, detail },
      destructive ? 'Erase everything' : 'Continue'
    );
    return picked === (destructive ? 'Erase everything' : 'Continue');
  }

  private postState(payload: Record<string, unknown>): void {
    this.ctx.getPanel()?.webview.postMessage({
      command: 'appStateStatus',
      ...payload
    });
  }

  private fail(message: string, operation: WipeOperation): void {
    const trimmed = message.trim() || 'Wipe failed.';
    this.ctx.showErrorMessage(trimmed);
    this.ctx.postStatus(`❌ ${trimmed}`, 'error');
    this.postState({ busy: false, operation, error: trimmed });
    this.ctx.getPanel()?.webview.postMessage({
      command: 'showToast',
      message: trimmed,
      type: 'error'
    });
  }
}
