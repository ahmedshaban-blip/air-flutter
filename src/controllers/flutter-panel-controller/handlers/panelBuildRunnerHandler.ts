import * as vscode from 'vscode';
import { BuildRunnerService } from '../../../domain/build-runner';
import { PanelHandlerContext } from './panelCompatHandler';
import { runVisibleTask } from '../../../infra/vscode/run-visible-task';

export class PanelBuildRunnerHandler {
  private readonly service: BuildRunnerService;
  private disposeLogListener?: () => void;
  private disposeStatusListener?: () => void;

  constructor(private readonly ctx: PanelHandlerContext) {
    this.service = new BuildRunnerService();

    this.disposeLogListener = this.service.onLog((chunk, isError) => {
      this.ctx.getPanel()?.webview.postMessage({
        command: 'buildRunnerLog',
        chunk,
        isError
      });
    });

    this.disposeStatusListener = this.service.onStatus(status => {
      this.ctx.getPanel()?.webview.postMessage({
        command: 'buildRunnerStatus',
        status
      });
    });
  }

  public dispose(): void {
    this.disposeLogListener?.();
    this.disposeStatusListener?.();
    this.service.stop();
  }

  public async startBuildRunner(options: {
    watch?: boolean;
    deleteConflictingOutputs?: boolean;
    buildFilter?: string;
  }): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    try {
      await this.service.start({
        cwd,
        watch: options.watch,
        deleteConflictingOutputs: options.deleteConflictingOutputs,
        buildFilter: options.buildFilter
      });
      const mode = options.watch ? 'Watching' : 'Building';
      this.ctx.postStatus(`Build Runner: ${mode} started...`, 'info');
    } catch (err: any) {
      this.ctx.showErrorMessage(`Build Runner error: ${err.message}`);
    }
  }

  public stopBuildRunner(): void {
    const stopped = this.service.stop();
    if (stopped) {
      this.ctx.postStatus('Build Runner stopped.', 'info');
    }
  }

  public clearBuildRunnerCache(): void {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    const res = this.service.clearCache(cwd);
    if (res.ok) {
      this.ctx.showSuccessMessage(res.message);
      this.ctx.postStatus(res.message, 'success');
      this.ctx.getPanel()?.webview.postMessage({
        command: 'buildRunnerLog',
        chunk: `\n[Cache Cleanup] ${res.message}\n`,
        isError: false
      });
    } else {
      this.ctx.showErrorMessage(res.message);
      this.ctx.postStatus(res.message, 'error');
    }
  }

  public async openInTerminal(watch: boolean, filter?: string): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No Flutter project workspace is open.');
      return;
    }

    const command = watch ? 'watch' : 'build';
    let cmd = `dart run build_runner ${command} --delete-conflicting-outputs`;
    if (filter && filter.trim().length > 0) {
      cmd += ` --build-filter="${filter.trim()}"`;
    }

    try {
      await runVisibleTask(`Build Runner (${command})`, cmd, cwd);
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }
}

