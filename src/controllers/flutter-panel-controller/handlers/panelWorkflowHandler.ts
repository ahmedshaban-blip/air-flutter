import * as vscode from 'vscode';
import * as path from 'path';
import { WorkflowGenerator, WorkflowOptions } from '../../../domain/workflow-generator';
import { PanelHandlerContext } from './panelCompatHandler';

export class PanelWorkflowHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  public async openWorkflowModal(): Promise<void> {
    await this.ctx.openFlutterPanel();
    const initialPath = this.ctx.getInitialProjectPath();
    const panel = this.ctx.getPanel();
    if (panel) {
      panel.webview.postMessage({
        command: 'openWorkflowModal',
        projectPath: initialPath
      });
    }
  }

  public async selectWorkflowProject(): Promise<void> {
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
        command: 'workflowProjectPath',
        path: selectedPath
      });
    }
  }

  public async handleGenerateWorkflow(options: WorkflowOptions): Promise<void> {
    try {
      this.ctx.postStatus('⚙️ Generating GitHub Actions workflow…', 'info');
      const result = await WorkflowGenerator.writeWorkflowFiles(options);
      
      this.ctx.getPanel()?.webview.postMessage({
        command: 'workflowGenerated',
        message: result.workflowPaths.length === 1
          ? `GitHub Workflow generated at .github/workflows/${result.workflowPaths[0].split(/[\\/]/).pop()}`
          : 'GitHub Workflows generated: build_apk.yml and build_android.yml'
      });
      this.ctx.postStatus('✅ GitHub Actions workflow generated successfully!', 'success');

      if (result.androidBuildFilePath) {
        vscode.window.showInformationMessage(
          `CI-only Android NDK configured in ${path.basename(result.androidBuildFilePath)}; local builds keep Flutter's default.`
        );
      }

      // Open the generated workflow file in editor
      for (const [index, workflowPath] of result.workflowPaths.entries()) {
        const document = await vscode.workspace.openTextDocument(workflowPath);
        await vscode.window.showTextDocument(document, {
          preview: false,
          viewColumn: index === 0 ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside
        });
      }

      if (result.secretsGuidePath) {
        const choice = await vscode.window.showInformationMessage(
          '✅ GitHub Workflow and Secrets Setup Guide generated!',
          'View Secrets Guide'
        );
        if (choice === 'View Secrets Guide') {
          const guideDoc = await vscode.workspace.openTextDocument(result.secretsGuidePath);
          await vscode.window.showTextDocument(guideDoc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
        }
      } else {
        vscode.window.showInformationMessage('✅ GitHub Actions workflow generated successfully!');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Workflow generation failed: ${msg}`);
      this.ctx.postStatus(`❌ Workflow generation failed: ${msg}`, 'error');
    }
  }
}
