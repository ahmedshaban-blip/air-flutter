import * as vscode from 'vscode';
import { CompatibilityModule } from '../../../features/compatibility';
import { CompatibilityEngine } from '../../../features/compatibility/services/compatibilityEngine';
import { StackDiffItem } from '../../../features/compatibility/models/types';

export interface PanelHandlerContext {
  getPanel(): vscode.WebviewPanel | undefined;
  getInitialProjectPath(): string | undefined;
  postStatus(message: string, type: 'info' | 'success' | 'warning' | 'error'): void;
  showErrorMessage(message: string): void;
  showSuccessMessage(message: string): void;
  openFlutterPanel(): Promise<void>;
}

export class PanelCompatHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  public async openCompatDoctorModal(targetPath?: string): Promise<void> {
    await this.ctx.openFlutterPanel();
    const initialPath = targetPath || this.ctx.getInitialProjectPath();
    const panel = this.ctx.getPanel();
    if (panel) {
      panel.webview.postMessage({
        command: 'openCompatDoctorModal',
        projectPath: initialPath
      });
      await this.handleRunCompatDoctorScan(initialPath);
    }
  }

  public async selectCompatProject(): Promise<void> {
    const folders = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Flutter Project for Compatibility Scan'
    });

    if (folders && folders[0]) {
      const selectedPath = folders[0].fsPath;
      this.ctx.getPanel()?.webview.postMessage({
        command: 'compatProjectSelected',
        path: selectedPath
      });
      await this.handleRunCompatDoctorScan(selectedPath);
    }
  }

  public async handleRunCompatDoctorScan(projectPath?: string): Promise<void> {
    try {
      this.ctx.getPanel()?.webview.postMessage({ command: 'compatDoctorLoading', loading: true });
      const target = (projectPath && projectPath.trim().length > 0) ? projectPath.trim() : this.ctx.getInitialProjectPath();
      const report = await CompatibilityModule.runScan(target);
      const availableVersions = CompatibilityEngine.getAvailableVersions();
      const rules = CompatibilityEngine.getMatrix().android.rules;
      this.ctx.getPanel()?.webview.postMessage({
        command: 'compatDoctorReport',
        report,
        availableVersions,
        rules
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.ctx.showErrorMessage(`Compatibility scan failed: ${msg}`);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'compatDoctorReport',
        report: null,
        error: msg
      });
    }
  }

  public async handleApplyCompatUpgrades(projectPath?: string): Promise<void> {
    try {
      const target = (projectPath && projectPath.trim().length > 0) ? projectPath.trim() : this.ctx.getInitialProjectPath();
      const success = await CompatibilityModule.upgradeBuildStackCommand(target);
      if (success) {
        await this.handleRunCompatDoctorScan(target);
      } else {
        this.ctx.getPanel()?.webview.postMessage({ command: 'compatDoctorLoading', loading: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.ctx.showErrorMessage(`Upgrade failed: ${msg}`);
      this.ctx.getPanel()?.webview.postMessage({ command: 'compatDoctorLoading', loading: false });
    }
  }

  public async handleApplyCustomStack(projectPath?: string, diffs?: StackDiffItem[]): Promise<void> {
    try {
      this.ctx.getPanel()?.webview.postMessage({ command: 'compatDoctorLoading', loading: true });
      const target = (projectPath && projectPath.trim().length > 0) ? projectPath.trim() : this.ctx.getInitialProjectPath();
      if (!diffs || diffs.length === 0) {
        this.ctx.getPanel()?.webview.postMessage({ command: 'compatDoctorLoading', loading: false });
        return;
      }
      const success = await CompatibilityModule.applyCustomDiffs(diffs, target);
      if (success) {
        await this.handleRunCompatDoctorScan(target);
      } else {
        this.ctx.getPanel()?.webview.postMessage({ command: 'compatDoctorLoading', loading: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.ctx.showErrorMessage(`Failed to apply custom stack: ${msg}`);
      this.ctx.getPanel()?.webview.postMessage({ command: 'compatDoctorLoading', loading: false });
    }
  }
}

