import * as vscode from 'vscode'
import { AndroidDevice, AndroidDeviceManager } from '../../domain/android-device-manager'
import {
  AdbDiagnosticRunner,
  BugReportPackager,
  BugReportResult
} from '../../domain/bug-report-packager'
import { ExtController } from '../../infra/extension/ExtensionController'

export class BugReportController extends ExtController {
  private readonly deviceManager: AndroidDeviceManager

  constructor(context: vscode.ExtensionContext) {
    super(context)
    this.deviceManager = new AndroidDeviceManager(context.globalState)
  }

  public async onInit(): Promise<void> {
    this.registerCommand('airFlutter.packageBugReport', () => this.packageBugReport())
  }

  private async packageBugReport(): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!workspaceRoot) {
        throw new Error('Open a Flutter workspace before packaging a bug report.')
      }

      const device = await this.selectDevice()
      if (!device) return

      const adb = await this.deviceManager.getADBExecutable()
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Packaging diagnostics from ${device.name}...`,
          cancellable: false
        },
        () => new BugReportPackager(new AdbDiagnosticRunner(adb)).create(workspaceRoot, device.id)
      )

      await vscode.env.clipboard.writeText(result.markdown)
      await this.showResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      vscode.window.showErrorMessage(`Could not package bug report: ${message}`)
    }
  }

  private async selectDevice(): Promise<AndroidDevice | undefined> {
    const devices = (await this.deviceManager.listDevices()).filter(device => device.state === 'device')
    if (devices.length === 0) {
      throw new Error('No active Android device found. Connect or authorize a device and try again.')
    }
    if (devices.length === 1) return devices[0]

    const selected = await vscode.window.showQuickPick(
      devices.map(device => ({
        label: device.name,
        description: device.id,
        device
      })),
      { placeHolder: 'Select the device for this bug report' }
    )
    return selected?.device
  }

  private async showResult(result: BugReportResult): Promise<void> {
    const duration = (result.elapsedMilliseconds / 1000).toFixed(1)
    const selection = await vscode.window.showInformationMessage(
      `Bug report packaged and copied to the clipboard in ${duration}s.`,
      'Open Report',
      'Open Screenshot Folder',
      'Copy Markdown'
    )

    if (selection === 'Open Report') {
      const document = await vscode.workspace.openTextDocument(result.reportPath)
      await vscode.window.showTextDocument(document)
    } else if (selection === 'Open Screenshot Folder') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(result.screenshotPath))
    } else if (selection === 'Copy Markdown') {
      await vscode.env.clipboard.writeText(result.markdown)
      vscode.window.showInformationMessage('Bug report Markdown copied to the clipboard.')
    }
  }
}
