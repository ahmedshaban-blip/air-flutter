import * as vscode from 'vscode'
import { SigningKeyGenerator, SigningKeyOptions } from '../../../domain/signing-key-generator'
import { PanelHandlerContext } from './panelCompatHandler'

export class PanelSigningKeyHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  public async openSigningKeyModal(): Promise<void> {
    await this.ctx.openFlutterPanel()
    this.ctx.getPanel()?.webview.postMessage({
      command: 'openSigningKeyModal',
      projectPath: this.ctx.getInitialProjectPath()
    })
  }

  public async selectSigningKeyProject(): Promise<void> {
    const folders = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Flutter Project'
    })
    if (folders?.[0]) {
      this.ctx.getPanel()?.webview.postMessage({
        command: 'signingKeyProjectPath',
        path: folders[0].fsPath
      })
    }
  }

  public async createSigningKey(options: SigningKeyOptions): Promise<void> {
    try {
      this.ctx.postStatus('🔐 Creating Android signing key…', 'info')
      const generatedKey = await SigningKeyGenerator.generate(options)
      this.ctx.getPanel()?.webview.postMessage({ command: 'signingKeyCreated', result: generatedKey })
      this.ctx.postStatus(`✅ Signing key created at ${generatedKey.relativeKeyPath}`, 'success')
      vscode.window.showInformationMessage(`Signing key created: ${generatedKey.relativeKeyPath}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.ctx.getPanel()?.webview.postMessage({ command: 'signingKeyFailed', message })
      this.ctx.postStatus(`❌ Signing key creation failed: ${message}`, 'error')
      this.ctx.showErrorMessage(`Signing key creation failed: ${message}`)
    }
  }
}
