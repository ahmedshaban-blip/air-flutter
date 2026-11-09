import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PubHealthService, PubspecSyntaxError, PubspecDiagnostics } from '../../../domain/pub-health';
import { PanelDeviceContext } from './panelNetworkHandler';

export class PanelPubHealthHandler {
  private readonly service = new PubHealthService();
  private activeProjectPath?: string;

  constructor(private readonly ctx: PanelDeviceContext) {}

  public async openModal(): Promise<void> {
    await this.ctx.openFlutterPanel();
    const panel = this.ctx.getPanel();
    if (!panel) return;

    const initial = this.resolveProjectPath();
    this.activeProjectPath = initial;

    panel.webview.postMessage({
      command: 'openPubHealthModal',
      data: {
        projectPath: initial || ''
      }
    });

    if (initial && fs.existsSync(path.join(initial, 'pubspec.yaml'))) {
      await this.checkHealth(initial);
    } else {
      panel.webview.postMessage({
        command: 'pubHealthState',
        status: 'error',
        error: `The current workspace (${initial ? path.basename(initial) : 'none'}) is not a Flutter project (missing pubspec.yaml). Click "Browse" to choose your Flutter app folder.`
      });
    }
  }

  public async checkHealth(targetPath?: string): Promise<void> {
    const panel = this.ctx.getPanel();
    const projectPath = targetPath || this.activeProjectPath || this.resolveProjectPath();

    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) {
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'error',
        error: 'No pubspec.yaml found in the current workspace. Click "Browse" to select your Flutter project.'
      });
      return;
    }

    try {
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'loading',
        message: 'Running flutter pub outdated --json…'
      });

      const summary = await this.service.checkHealth(projectPath);

      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'success',
        summary,
        projectPath
      });
      this.ctx.postStatus(`Pub health check complete: ${summary.upgradableCount} upgradable, ${summary.majorUpdateCount} major updates`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const diagnostics = error instanceof PubspecSyntaxError
        ? error.diagnostics
        : PubHealthService.parsePubspecError(msg, projectPath);

      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'error',
        error: msg,
        diagnostics
      });
      this.ctx.showErrorMessage(`Pub check: ${msg}`);
    }
  }

  public async openPubspecAtLine(filePath?: string, line = 1, column = 1): Promise<void> {
    const targetFile = filePath || (this.activeProjectPath ? path.join(this.activeProjectPath, 'pubspec.yaml') : undefined);
    if (!targetFile || !fs.existsSync(targetFile)) {
      this.ctx.showErrorMessage('pubspec.yaml file not found.');
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFile));
      const zeroBasedLine = Math.max(0, line - 1);
      const zeroBasedCol = Math.max(0, column - 1);
      const pos = new vscode.Position(zeroBasedLine, zeroBasedCol);
      const selection = new vscode.Selection(pos, pos);

      await vscode.window.showTextDocument(doc, {
        preview: false,
        selection
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.ctx.showErrorMessage(`Failed to open pubspec.yaml: ${err}`);
    }
  }

  public async selectProject(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Flutter Project'
    });

    if (uris && uris.length > 0) {
      const selected = uris[0].fsPath;
      if (fs.existsSync(path.join(selected, 'pubspec.yaml'))) {
        this.activeProjectPath = selected;
        this.ctx.getPanel()?.webview.postMessage({
          command: 'pubHealthProjectPath',
          projectPath: selected
        });
        await this.checkHealth(selected);
      } else {
        this.ctx.showErrorMessage(`Selected folder "${path.basename(selected)}" does not contain a pubspec.yaml file.`);
      }
    }
  }

  public async runPubUpgrade(): Promise<void> {
    const projectPath = this.activeProjectPath || this.resolveProjectPath();
    if (!projectPath) return;

    const term = vscode.window.createTerminal({ name: 'Flutter Pub Upgrade', cwd: projectPath });
    term.show();
    term.sendText('flutter pub upgrade');
    this.ctx.showSuccessMessage('Running "flutter pub upgrade" in terminal…');
  }

  public async updatePackages(packages: Array<{ name: string; version: string; isDev?: boolean }>): Promise<void> {
    const panel = this.ctx.getPanel();
    const projectPath = this.activeProjectPath || this.resolveProjectPath();

    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) {
      this.ctx.showErrorMessage('No pubspec.yaml found in the current workspace.');
      return;
    }

    if (!packages || packages.length === 0) return;

    try {
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'loading',
        message: `Updating ${packages.length} package(s) in pubspec.yaml…`
      });

      await this.service.updatePackages(projectPath, packages);
      this.ctx.showSuccessMessage(`Updated ${packages.length} package(s) successfully!`);
      this.ctx.postStatus(`Updated: ${packages.map(p => p.name).join(', ')}`, 'success');

      await this.checkHealth(projectPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Update failed: ${msg}`);
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'error',
        error: `Failed to update packages: ${msg}`
      });
    }
  }

  public async upgradeTransitivePackage(packageName: string): Promise<void> {
    const panel = this.ctx.getPanel();
    const projectPath = this.activeProjectPath || this.resolveProjectPath();

    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) {
      this.ctx.showErrorMessage('No pubspec.yaml found in the current workspace.');
      return;
    }

    try {
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'loading',
        message: `Upgrading transitive package "${packageName}"…`
      });

      await this.service.upgradeTransitivePackage(projectPath, packageName);
      this.ctx.showSuccessMessage(`Upgraded "${packageName}" successfully.`);
      this.ctx.postStatus(`Upgraded ${packageName}`, 'success');

      await this.checkHealth(projectPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Upgrade failed: ${msg}`);
      panel?.webview.postMessage({
        command: 'pubHealthState',
        status: 'error',
        error: `Failed to upgrade ${packageName}: ${msg}`
      });
    }
  }

  private resolveProjectPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return undefined;

    for (const folder of workspaceFolders) {
      if (fs.existsSync(path.join(folder.uri.fsPath, 'pubspec.yaml'))) {
        return folder.uri.fsPath;
      }
    }

    // Deep scan for nested Flutter projects (e.g., monorepos or nested app folders)
    for (const folder of workspaceFolders) {
      const nested = this.findNestedFlutterProject(folder.uri.fsPath, 3);
      if (nested) return nested;
    }

    return workspaceFolders[0].uri.fsPath;
  }

  private findNestedFlutterProject(dir: string, depth = 3): string | null {
    if (depth < 0 || !fs.existsSync(dir)) return null;
    if (fs.existsSync(path.join(dir, 'pubspec.yaml'))) return dir;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !['.git', 'node_modules', 'build', '.dart_tool', '.vscode', 'ios', 'android', 'windows', 'linux', 'macos', 'web'].includes(e.name)) {
          const sub = this.findNestedFlutterProject(path.join(dir, e.name), depth - 1);
          if (sub) return sub;
        }
      }
    } catch {
      return null;
    }
    return null;
  }
}
