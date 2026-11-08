import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  CodeCleanupAssistant,
  CodeCleanupReport,
  CommentedCodeBlockDetector,
  DetectedCommentedCodeBlock
} from '../../../domain/code-cleanup-assistant';
import { PanelHandlerContext } from './panelCompatHandler';

export class PanelCodeCleanupHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  public async scan(): Promise<void> {
    try {
      const projectPath = this.requireProjectPath();
      this.ctx.getPanel()?.webview.postMessage({ command: 'codeCleanupLoading', loading: true });
      const report = await CodeCleanupAssistant.scan(projectPath, this.openDocumentOverrides(projectPath));
      this.ctx.getPanel()?.webview.postMessage({ command: 'codeCleanupReport', report });
      this.ctx.postStatus(`Code cleanup scan found ${this.totalFindings(report)} item(s) to review.`, 'info');
    } catch (error) {
      this.reportError('Code cleanup scan failed', error);
    }
  }

  public async openTarget(
    relativeFile: string,
    line = 1,
    column = 1,
    endLine?: number
  ): Promise<void> {
    try {
      const absoluteFile = this.safeProjectFile(relativeFile);
      const document = await vscode.workspace.openTextDocument(absoluteFile);
      const editor = await vscode.window.showTextDocument(document);
      const startPos = new vscode.Position(Math.max(0, line - 1), Math.max(0, column - 1));
      const targetEndLine = endLine && endLine >= line ? Math.min(document.lineCount - 1, endLine - 1) : startPos.line;
      const endPos =
        endLine && endLine >= line
          ? document.lineAt(targetEndLine).range.end
          : startPos;
      editor.selection = new vscode.Selection(startPos, endPos);
      editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      this.reportError('Could not open target', error);
    }
  }

  public async removeCommentedBlock(
    relativeFile: string,
    startLine: number,
    endLine = startLine
  ): Promise<void> {
    try {
      const absoluteFile = this.safeProjectFile(relativeFile);
      const document = await vscode.workspace.openTextDocument(absoluteFile);
      const block = this.findMatchingBlockInDocument(document, relativeFile, startLine, endLine);
      if (!block) {
        throw new Error('The commented-out code block has changed or was already modified. Re-scan first.');
      }

      const edit = new vscode.WorkspaceEdit();
      edit.delete(document.uri, this.fullLineDeleteRange(document, block.startLine, block.endLine));
      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        throw new Error('VS Code could not apply the workspace edit.');
      }

      await vscode.window.showTextDocument(document, { preserveFocus: true, preview: false });
      const msg = `Removed commented-out code block (${block.lineCount} line${block.lineCount === 1 ? '' : 's'}) in ${relativeFile}. Press Ctrl+Z to undo.`;
      this.ctx.postStatus(msg, 'success');
      this.ctx.showSuccessMessage(msg);
      await this.scan();
    } catch (error) {
      this.reportError('Could not remove commented-out code block', error);
    }
  }

  public async uncommentBlock(
    relativeFile: string,
    startLine: number,
    endLine = startLine
  ): Promise<void> {
    try {
      const absoluteFile = this.safeProjectFile(relativeFile);
      const document = await vscode.workspace.openTextDocument(absoluteFile);
      const block = this.findMatchingBlockInDocument(document, relativeFile, startLine, endLine);
      if (!block) {
        throw new Error('The commented-out code block has changed or was already modified. Re-scan first.');
      }

      const startZero = Math.max(0, block.startLine - 1);
      const endZero = Math.min(document.lineCount - 1, block.endLine - 1);
      const replaceRange = new vscode.Range(
        new vscode.Position(startZero, 0),
        document.lineAt(endZero).range.end
      );

      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, replaceRange, block.restoredCodeText);
      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        throw new Error('VS Code could not apply the uncomment edit.');
      }

      const editor = await vscode.window.showTextDocument(document, { preserveFocus: false, preview: false });
      const newEndZero = Math.min(document.lineCount - 1, startZero + block.lineCount - 1);
      const selectionRange = new vscode.Range(
        new vscode.Position(startZero, 0),
        document.lineAt(newEndZero).range.end
      );
      editor.selection = new vscode.Selection(selectionRange.start, selectionRange.end);
      editor.revealRange(selectionRange, vscode.TextEditorRevealType.InCenter);

      const msg = `Uncommented ${block.lineCount} line${block.lineCount === 1 ? '' : 's'} in ${relativeFile}. Press Ctrl+Z to undo.`;
      this.ctx.postStatus(msg, 'success');
      this.ctx.showSuccessMessage(msg);
      await this.scan();
    } catch (error) {
      this.reportError('Could not uncomment code block', error);
    }
  }

  public async removeAllCommentedCode(): Promise<void> {
    try {
      const projectPath = this.requireProjectPath();
      const blocks = await CodeCleanupAssistant.scanCommentedCodeBlocks(
        projectPath,
        this.openDocumentOverrides(projectPath)
      );
      if (blocks.length === 0) {
        this.ctx.postStatus('No commented-out code blocks found to remove.', 'info');
        return;
      }

      const totalLines = blocks.reduce((sum, b) => sum + b.lineCount, 0);
      const fileCount = new Set(blocks.map(b => b.file)).size;
      const choice = await vscode.window.showWarningMessage(
        `Remove ${blocks.length} commented-out code block(s) (${totalLines} lines across ${fileCount} file(s))? You can undo with Ctrl+Z.`,
        { modal: true },
        'Remove All Blocks'
      );
      if (choice !== 'Remove All Blocks') return;

      const byFile = new Map<string, DetectedCommentedCodeBlock[]>();
      for (const block of blocks) {
        const list = byFile.get(block.file) ?? [];
        list.push(block);
        byFile.set(block.file, list);
      }

      const edit = new vscode.WorkspaceEdit();
      for (const [relativeFile, fileBlocks] of byFile.entries()) {
        const absoluteFile = this.safeProjectFile(relativeFile);
        const document = await vscode.workspace.openTextDocument(absoluteFile);
        // Sort bottom-to-top so line deletions remain valid within the same document
        const sorted = [...fileBlocks].sort((a, b) => b.startLine - a.startLine);
        for (const block of sorted) {
          edit.delete(document.uri, this.fullLineDeleteRange(document, block.startLine, block.endLine));
        }
      }

      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        throw new Error('VS Code could not apply the bulk workspace edit.');
      }

      const msg = `Removed ${blocks.length} commented-out code block(s) (${totalLines} lines cleaned across ${fileCount} file(s)).`;
      this.ctx.postStatus(msg, 'success');
      this.ctx.showSuccessMessage(msg);
      await this.scan();
    } catch (error) {
      this.reportError('Bulk commented-code cleanup failed', error);
    }
  }

  public async runInteractiveCleanupQuickPick(): Promise<void> {
    try {
      const projectPath = this.requireProjectPath();
      const blocks = await CodeCleanupAssistant.scanCommentedCodeBlocks(
        projectPath,
        this.openDocumentOverrides(projectPath)
      );
      if (blocks.length === 0) {
        vscode.window.showInformationMessage('Air Flutter: Zero commented-out Dart code blocks detected.');
        return;
      }

      const totalLines = blocks.reduce((sum, b) => sum + b.lineCount, 0);
      interface CleanupQuickPickItem extends vscode.QuickPickItem {
        action: 'bulk-remove' | 'inspect-block';
        block?: DetectedCommentedCodeBlock;
      }

      const items: CleanupQuickPickItem[] = [
        {
          label: `$(trash) Remove All Commented-Out Code Blocks (${blocks.length} blocks · ${totalLines} lines)`,
          description: 'Atomic WorkspaceEdit (Undoable)',
          detail: 'Deletes all detected commented-out code blocks while preserving /// docs, // ignore:, and // TODOs.',
          action: 'bulk-remove'
        },
        ...blocks.map<CleanupQuickPickItem>(block => ({
          label: `$(code) ${block.file}:${block.startLine}${block.endLine > block.startLine ? `-${block.endLine}` : ''}`,
          description: `${block.lineCount} line${block.lineCount === 1 ? '' : 's'} · ${Math.round(block.confidenceScore * 100)}% confidence`,
          detail: block.uncommentedText.replace(/\s+/g, ' ').slice(0, 120),
          action: 'inspect-block',
          block
        }))
      ];

      const selected = await vscode.window.showQuickPick(items, {
        title: 'Air Flutter: Commented-Out Code Cleanup',
        placeHolder: 'Select a commented-out code block to Remove, Uncomment, or Preview'
      });
      if (!selected) return;

      if (selected.action === 'bulk-remove') {
        await this.removeAllCommentedCode();
        return;
      }

      const targetBlock = selected.block!;
      await this.openTarget(targetBlock.file, targetBlock.startLine, targetBlock.startColumn, targetBlock.endLine);

      const blockAction = await vscode.window.showQuickPick(
        [
          {
            label: '$(trash) Remove Commented Block',
            description: `Delete lines ${targetBlock.startLine}-${targetBlock.endLine}`,
            id: 'remove' as const
          },
          {
            label: '$(edit) Uncomment Block',
            description: `Restore active Dart code at lines ${targetBlock.startLine}-${targetBlock.endLine}`,
            id: 'uncomment' as const
          },
          {
            label: '$(eye) Keep & Preview Only',
            description: 'Leave block unchanged in editor',
            id: 'preview' as const
          }
        ],
        {
          title: `${targetBlock.file}:${targetBlock.startLine}-${targetBlock.endLine}`,
          placeHolder: 'Choose an action for this commented-out code block'
        }
      );

      if (blockAction?.id === 'remove') {
        await this.removeCommentedBlock(targetBlock.file, targetBlock.startLine, targetBlock.endLine);
      } else if (blockAction?.id === 'uncomment') {
        await this.uncommentBlock(targetBlock.file, targetBlock.startLine, targetBlock.endLine);
      }
    } catch (error) {
      this.reportError('Commented-code cleanup failed', error);
    }
  }

  public async deleteUnusedDartFile(relativeFile: string): Promise<void> {
    try {
      const projectPath = this.requireProjectPath();
      const freshReport = await CodeCleanupAssistant.scan(projectPath, this.openDocumentOverrides(projectPath));
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

  private findMatchingBlockInDocument(
    document: vscode.TextDocument,
    relativeFile: string,
    startLine: number,
    endLine: number
  ): DetectedCommentedCodeBlock | undefined {
    const detected = CommentedCodeBlockDetector.detectInSource(document.getText(), relativeFile);
    return detected.find(b => b.startLine === startLine && b.endLine === endLine);
  }

  private fullLineDeleteRange(
    document: vscode.TextDocument,
    startLineOneBased: number,
    endLineOneBased: number
  ): vscode.Range {
    const startZero = Math.max(0, startLineOneBased - 1);
    const endZero = Math.min(document.lineCount - 1, endLineOneBased - 1);
    if (endZero + 1 < document.lineCount) {
      return new vscode.Range(new vscode.Position(startZero, 0), new vscode.Position(endZero + 1, 0));
    }
    if (startZero > 0) {
      const prevLineEnd = document.lineAt(startZero - 1).range.end;
      return new vscode.Range(prevLineEnd, document.lineAt(endZero).range.end);
    }
    return new vscode.Range(new vscode.Position(0, 0), document.lineAt(endZero).range.end);
  }

  private openDocumentOverrides(projectPath: string): Map<string, string> {
    const root = path.resolve(projectPath);
    const overrides = new Map<string, string>();
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme !== 'file' || !doc.fileName.endsWith('.dart')) continue;
      const abs = path.resolve(doc.uri.fsPath);
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
        overrides.set(rel, doc.getText());
        overrides.set(abs, doc.getText());
      }
    }
    return overrides;
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
