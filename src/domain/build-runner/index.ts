import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

export interface BuildRunnerOptions {
  watch?: boolean;
  deleteConflictingOutputs?: boolean;
  buildFilter?: string;
  cwd: string;
}

export interface BuildRunnerStatus {
  isRunning: boolean;
  isWatching: boolean;
  pid?: number;
}

export type LogListener = (chunk: string, isError: boolean) => void;
export type StatusListener = (status: BuildRunnerStatus) => void;

export class BuildRunnerService {
  private activeProcess: ChildProcess | null = null;
  private isWatching = false;
  private logListeners: LogListener[] = [];
  private statusListeners: StatusListener[] = [];

  public getStatus(): BuildRunnerStatus {
    return {
      isRunning: this.activeProcess !== null,
      isWatching: this.isWatching,
      pid: this.activeProcess?.pid
    };
  }

  public onLog(listener: LogListener): () => void {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter(l => l !== listener);
    };
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private notifyLog(chunk: string, isError = false): void {
    for (const listener of this.logListeners) {
      try {
        listener(chunk, isError);
      } catch {}
    }
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {}
    }
  }

  public async start(options: BuildRunnerOptions): Promise<void> {
    if (this.activeProcess) {
      throw new Error('A build_runner process is already active. Stop it first.');
    }

    const command = options.watch ? 'watch' : 'build';
    const args = ['run', 'build_runner', command];

    if (options.deleteConflictingOutputs !== false) {
      args.push('--delete-conflicting-outputs');
    }

    if (options.buildFilter && options.buildFilter.trim().length > 0) {
      args.push(`--build-filter=${options.buildFilter.trim()}`);
    }

    this.isWatching = !!options.watch;
    this.notifyLog(`\n>>> dart ${args.join(' ')}\n[Working directory: ${options.cwd}]\n\n`);

    const isWindows = process.platform === 'win32';
    const execCmd = isWindows ? 'dart.bat' : 'dart';

    try {
      this.activeProcess = spawn(execCmd, args, {
        cwd: options.cwd,
        shell: true,
        windowsHide: true,
        env: { ...process.env }
      });
    } catch (err: any) {
      this.isWatching = false;
      this.notifyLog(`Failed to spawn dart: ${err.message}\n`, true);
      this.notifyStatus();
      throw err;
    }

    this.notifyStatus();

    this.activeProcess.stdout?.on('data', data => {
      this.notifyLog(data.toString());
    });

    this.activeProcess.stderr?.on('data', data => {
      this.notifyLog(data.toString(), true);
    });

    this.activeProcess.on('close', code => {
      this.notifyLog(`\n[build_runner exited with code ${code ?? 0}]\n`);
      this.activeProcess = null;
      this.isWatching = false;
      this.notifyStatus();
    });

    this.activeProcess.on('error', err => {
      this.notifyLog(`\n[Process error: ${err.message}]\n`, true);
      this.activeProcess = null;
      this.isWatching = false;
      this.notifyStatus();
    });
  }

  public stop(): boolean {
    if (!this.activeProcess) {
      return false;
    }

    try {
      if (process.platform === 'win32' && this.activeProcess.pid) {
        spawn('taskkill', ['/pid', this.activeProcess.pid.toString(), '/T', '/F']);
      } else {
        this.activeProcess.kill('SIGTERM');
      }
      this.notifyLog('\n[Process stop requested by user]\n');
      return true;
    } catch (err: any) {
      this.notifyLog(`\n[Failed to stop process: ${err.message}]\n`, true);
      return false;
    }
  }

  public clearCache(projectRoot: string): { ok: boolean; message: string; deletedPath?: string } {
    const buildCachePath = path.join(projectRoot, '.dart_tool', 'build');
    if (!fs.existsSync(buildCachePath)) {
      return { ok: true, message: 'No .dart_tool/build cache found. Already clean.' };
    }

    try {
      fs.rmSync(buildCachePath, { recursive: true, force: true });
      return {
        ok: true,
        message: 'Successfully removed .dart_tool/build cache.',
        deletedPath: buildCachePath
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `Failed to remove cache: ${err.message}`
      };
    }
  }
}

