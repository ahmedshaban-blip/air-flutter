import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CodeCleanupAssistant, CodeCleanupReport } from '../../../domain/code-cleanup-assistant';
import { PanelHandlerContext } from './panelCompatHandler';

export class PanelCodeCleanupHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  public async scan(): Promise<void> {
    try {
      const projectPath = this.requireProjectPath();
      this.ctx.getPanel()?.webview.postMessage({ command: 'codeCleanupLoading', loading: true });
      const report = await CodeCleanupAssistant.scan(projectPath);
      this.ctx.getPanel()?.webview.postMessage({ command: 'codeCleanupReport', report });
      this.ctx.postStatus(`Code cleanup scan found ${this.totalFindings(report)} item(s) to review.`, 'info');
    } catch (error) {
      this.reportError('Code cleanup scan failed', error);
    }
  }

  public async openTarget(relativeFile: string, line = 1, column = 1): Promise<void> {
    try {
      const absoluteFile = this.safeProjectFile(relativeFile);
      const document = await vscode.workspace.openTextDocument(absoluteFile);
      const editor = await vscode.window.showTextDocument(document);
      const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, column - 1));
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      this.reportError('Could not open target', error);
    }
  }

  public async deleteUnusedDartFile(relativeFile: string): Promise<void> {
    try {
      const freshReport = await CodeCleanupAssistant.scan(this.requireProjectPath());
      const approved = freshReport.unusedFiles.some(file => file.file === relativeFile && file.safeToDelete);
      if (!approved) throw new Error('This file is now reachable or no longer qualifies for safe deletion.');
      const absoluteFile = this.safeProjectFile(relativeFile);
      if (!relativeFile.startsWith('lib/') || !relativeFile.endsWith('.dart')) {
        throw new Error('Only scanned unused Dart files under lib/ can be deleted.');
      }
      const choice = await vscode.window.showWarningMessage(
        `Delete the unused Dart file ${relativeFile}? This cannot be undone by Air Flutter.`,
        { modal: true },
        'Delete file'
      );
      if (choice !== 'Delete file') return;
      await fs.promises.unlink(absoluteFile);
      this.ctx.postStatus(`Deleted unused Dart file: ${relativeFile}`, 'success');
      await this.scan();
    } catch (error) {
      this.reportError('Could not delete Dart file', error);
    }
  }

  private safeProjectFile(relativeFile: string): string {
    const root = path.resolve(this.requireProjectPath());
    const absoluteFile = path.resolve(root, relativeFile);
    const relative = path.relative(root, absoluteFile);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('The requested file is outside the Flutter project.');
    }
    return absoluteFile;
  }

  private requireProjectPath(): string {
    const projectPath = this.ctx.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!projectPath) throw new Error('Open a Flutter project workspace first.');
    return projectPath;
  }

  private totalFindings(report: CodeCleanupReport): number {
    return report.findings.length + report.unusedFiles.length + report.unusedPackages.length;
  }

  private reportError(prefix: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.ctx.showErrorMessage(`${prefix}: ${message}`);
    this.ctx.postStatus(`${prefix}: ${message}`, 'error');
    this.ctx.getPanel()?.webview.postMessage({ command: 'codeCleanupError', message });
  }
}
