import * as vscode from 'vscode';
import { LocalizationStudioService } from '../../../domain/localization-studio';
import { PanelHandlerContext } from './panelCompatHandler';
import { runVisibleTask } from '../../../infra/vscode/run-visible-task';

export class PanelLocalizationHandler {
  private readonly service: LocalizationStudioService;

  constructor(private readonly ctx: PanelHandlerContext) {
    this.service = new LocalizationStudioService();
  }

  public async fetchMatrix(): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    const panel = this.ctx.getPanel();
    if (!cwd) {
      panel?.webview.postMessage({
        command: 'localizationMatrix',
        data: null,
        error: 'No active Flutter workspace.'
      });
      return;
    }

    try {
      const matrix = this.service.getMatrix(cwd);
      panel?.webview.postMessage({
        command: 'localizationMatrix',
        data: matrix
      });
    } catch (err: any) {
      panel?.webview.postMessage({
        command: 'localizationMatrix',
        data: null,
        error: err.message
      });
    }
  }

  public async saveKey(payload: {
    key: string;
    translations: Record<string, string>;
    metadataDescription?: string;
  }): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No active Flutter workspace.');
      return;
    }

    const res = this.service.saveKey(cwd, payload.key, payload.translations, payload.metadataDescription);
    if (res.ok) {
      this.ctx.postStatus(res.message, 'success');
      await this.fetchMatrix();
    } else {
      this.ctx.showErrorMessage(res.message);
    }
  }

  public async initWorkspace(): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No active Flutter workspace.');
      return;
    }

    const res = this.service.initWorkspace(cwd);
    if (res.ok) {
      this.ctx.showSuccessMessage(res.message);
      this.ctx.postStatus(res.message, 'success');
      await this.fetchMatrix();
    } else {
      this.ctx.showErrorMessage(res.message);
    }
  }

  public async runGenL10n(): Promise<void> {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No active Flutter workspace.');
      return;
    }

    try {
      this.ctx.postStatus('Running flutter gen-l10n...', 'info');
      await runVisibleTask('Flutter Gen-L10n', 'flutter gen-l10n', cwd);
      this.ctx.showSuccessMessage('flutter gen-l10n completed successfully!');
      this.ctx.postStatus('flutter gen-l10n completed successfully!', 'success');
    } catch (err: any) {
      this.ctx.showErrorMessage(err.message);
    }
  }

  public generateAiPrompt(targetLocale: string): void {
    const cwd = this.ctx.getInitialProjectPath();
    if (!cwd) {
      this.ctx.showErrorMessage('No active Flutter workspace.');
      return;
    }

    const prompt = this.service.generateAiPrompt(cwd, targetLocale);
    this.ctx.getPanel()?.webview.postMessage({
      command: 'localizationAiPrompt',
      prompt,
      targetLocale
    });
  }
}

