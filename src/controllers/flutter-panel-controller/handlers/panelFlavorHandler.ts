import * as vscode from 'vscode';
import { FlavorManager } from '../../../domain/flavor-manager';
import { WorkflowGenerator } from '../../../domain/workflow-generator';
import { PanelHandlerContext } from './panelCompatHandler';
import { runVisibleTask } from '../../../infra/vscode/run-visible-task';

export class PanelFlavorHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  public async openFlavorsModal(projectPath?: string): Promise<void> {
    await this.ctx.openFlutterPanel();
    const initialPath = projectPath || this.ctx.getInitialProjectPath();
    const panel = this.ctx.getPanel();
    if (panel) {
      panel.webview.postMessage({
        command: 'openFlavorsModal',
        projectPath: initialPath
      });
    }
    if (initialPath) {
      await this.handleDetectFlavors(initialPath);
    }
  }

  public async selectFlavorsProject(): Promise<void> {
    const folders = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Flutter Project Folder'
    });

    if (folders && folders[0]) {
      const selectedPath = folders[0].fsPath;
      const validation = WorkflowGenerator.validateProject(selectedPath);
      if (!validation.valid) {
        this.ctx.showErrorMessage(validation.error || 'Invalid Flutter project folder.');
        return;
      }
      this.ctx.getPanel()?.webview.postMessage({
        command: 'openFlavorsModal',
        projectPath: selectedPath
      });
      await this.handleDetectFlavors(selectedPath);
    }
  }

  public async handleDetectFlavors(projectPath?: string): Promise<void> {
    const targetPath = projectPath || this.ctx.getInitialProjectPath() || '';
    try {
      const result = await FlavorManager.detectFlavors(targetPath);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'flavorsDetected',
        data: result
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.postStatus(`⚠️ Flavors detection warning: ${msg}`, 'warning');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'flavorsDetected',
        data: { hasFlavors: false, flavors: [], error: msg }
      });
    }
  }

  public async handleSetupFlavors(projectPath?: string, flavors?: string[]): Promise<void> {
    const targetPath = projectPath || this.ctx.getInitialProjectPath() || '';
    try {
      this.ctx.postStatus('🪄 Setting up Flutter flavors...', 'info');
      const result = await FlavorManager.setupFlavors(targetPath, flavors || ['dev', 'staging', 'prod']);
      this.ctx.postStatus(`✅ Flavors configured! Created ${result.createdFiles.length} entrypoints.`, 'success');
      vscode.window.showInformationMessage(`✅ Flavors configured successfully! (${result.createdFiles.join(', ')})`);
      await this.handleDetectFlavors(targetPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Flavors setup failed: ${msg}`);
      this.ctx.postStatus(`❌ Flavors setup failed: ${msg}`, 'error');
    }
  }

  public async handleRunFlavor(projectPath?: string, flavor?: string, target?: string): Promise<void> {
    if (!flavor) {
      this.ctx.showErrorMessage('No flavor selected to run.');
      return;
    }
    const targetPath = projectPath || this.ctx.getInitialProjectPath();
    const targetArg = target ? ` -t ${target}` : '';
    this.ctx.postStatus(`▶️ Running flavor "${flavor}" in terminal...`, 'info');
    try {
      await runVisibleTask(`Run ${flavor}`, `flutter run --flavor ${flavor}${targetArg}`, targetPath);
      this.ctx.postStatus(`✅ Flavor "${flavor}" finished.`, 'success');
    } catch (error) {
      this.reportTaskError(`Running flavor "${flavor}" failed`, error);
    }
  }

  public async handleBuildFlavorApk(projectPath?: string, flavor?: string, target?: string): Promise<void> {
    if (!flavor) {
      this.ctx.showErrorMessage('No flavor selected to build.');
      return;
    }
    const targetPath = projectPath || this.ctx.getInitialProjectPath();
    const targetArg = target ? ` -t ${target}` : '';
    this.ctx.postStatus(`🚀 Building APK for flavor "${flavor}" in terminal...`, 'info');
    try {
      await runVisibleTask(`Build APK - ${flavor}`, `flutter build apk --flavor ${flavor}${targetArg}`, targetPath);
      this.ctx.postStatus(`✅ APK build for "${flavor}" completed.`, 'success');
      await this.handleDetectFlavors(targetPath);
    } catch (error) {
      this.reportTaskError(`APK build for "${flavor}" failed`, error);
    }
  }

  public async handleBuildAllFlavors(projectPath?: string, flavors?: string[]): Promise<void> {
    if (!flavors || flavors.length === 0) {
      this.ctx.showErrorMessage('No flavors available to build.');
      return;
    }
    const targetPath = projectPath || this.ctx.getInitialProjectPath();
    this.ctx.postStatus(`🚀 Batch building ${flavors.length} flavors in terminal...`, 'info');
    try {
      for (const flavor of flavors) {
        await runVisibleTask(`Build APK - ${flavor}`, `flutter build apk --flavor ${flavor}`, targetPath);
      }
      this.ctx.postStatus(`✅ Built ${flavors.length} flavor APKs.`, 'success');
      await this.handleDetectFlavors(targetPath);
    } catch (error) {
      this.reportTaskError('Batch flavor build failed', error);
    }
  }

  private reportTaskError(prefix: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.ctx.showErrorMessage(`${prefix}: ${message}`);
    this.ctx.postStatus(`❌ ${prefix}: ${message}`, 'error');
  }
}
