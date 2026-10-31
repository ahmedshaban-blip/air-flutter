import * as vscode from 'vscode';
import * as path from 'path';
import { AgentScaffolder, AgentScaffoldOptions } from '../../../domain/agent-scaffolder';
import { PanelHandlerContext } from './panelCompatHandler';

export class PanelAgentHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  public async openAgentScaffoldModal(targetPath?: string): Promise<void> {
    await this.ctx.openFlutterPanel();
    const initialPath = targetPath || this.ctx.getInitialProjectPath();
    const panel = this.ctx.getPanel();
    if (panel) {
      panel.webview.postMessage({
        command: 'openAgentScaffoldModal',
        projectPath: initialPath
      });
    }
  }

  public async selectAgentScaffoldProject(): Promise<void> {
    const folders = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Project Directory for Agents'
    });

    if (folders && folders[0]) {
      const selectedPath = folders[0].fsPath;
      this.ctx.getPanel()?.webview.postMessage({
        command: 'agentScaffoldProjectPath',
        path: selectedPath
      });
    }
  }

  public async handleGenerateAgentScaffold(options: AgentScaffoldOptions): Promise<void> {
    try {
      this.ctx.postStatus('🤖 Scaffolding AI Agent specifications…', 'info');
      const workspaceRoot = this.ctx.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const result = await AgentScaffolder.scaffold(options, workspaceRoot);

      this.ctx.getPanel()?.webview.postMessage({
        command: 'agentScaffoldGenerated',
        message: `Successfully scaffolded ${result.createdFiles.length} file(s) into: ${path.basename(result.targetDir)}`
      });

      this.ctx.postStatus(`✅ ${result.summary}`, 'success');
      vscode.window.showInformationMessage(`✅ ${result.summary}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Agent scaffolding failed: ${msg}`);
      this.ctx.postStatus(`❌ Agent scaffolding failed: ${msg}`, 'error');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'addStatusMessage',
        message: `❌ Agent scaffolding failed: ${msg}`,
        type: 'error'
      });
    }
  }
}

