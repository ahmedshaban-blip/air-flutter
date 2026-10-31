import { getSidebarWebviewHtml } from './sidebarHtml'
import * as vscode from 'vscode'
import * as path from 'path'
import * as crypto from 'crypto'
import { AndroidDeviceManager } from '../../domain/android-device-manager'
import { DeviceToolsService, DeviceInfoSnapshot } from '../../domain/device-tools'
import { LogcatService, LogcatLine, LogPriority, DEFAULT_LOG_PRIORITY } from '../../domain/logcat'

interface SidebarMessage {
  command?: string
  id?: string
  url?: string
  serial?: string
  filter?: string
  query?: string
  text?: string
  priority?: LogPriority
}

/**
 * The sidebar view under the Air Flutter activity-bar icon.
 *
 * Two jobs: launch the panel, and act as the live window onto the connected
 * phone (state card, logcat, one-shot tools). All logic lives here in the
 * extension host; the webview only renders and forwards intents.
 */
export class SidebarController {
  private view?: vscode.WebviewView
  private readonly deviceManager: AndroidDeviceManager
  private readonly deviceTools: DeviceToolsService
  private readonly logcat: LogcatService

  private infoTimer?: NodeJS.Timeout
  private infoInFlight = false
  private watchedSerial?: string
  private lastInfoJson = ''
  private lastRecordingState: { isRecording: boolean; duration: number } = { isRecording: false, duration: 0 }

  constructor(private readonly context: vscode.ExtensionContext) {
    this.deviceManager = new AndroidDeviceManager(context.globalState)
    this.deviceTools = new DeviceToolsService(context.globalState, this.deviceManager)
    this.logcat = new LogcatService(context.globalState)
  }

  register(): vscode.Disposable {
    const provider = vscode.window.registerWebviewViewProvider(
      'air-flutter-panel',
      { resolveWebviewView: webviewView => this.resolve(webviewView) },
      { webviewOptions: { retainContextWhenHidden: true } }
    )

    if (this.infoTimer) {
      clearInterval(this.infoTimer)
    }
    this.infoTimer = setInterval(() => void this.pollDeviceInfo(), 5000)

    return {
      dispose: () => {
        if (this.infoTimer) {
          clearInterval(this.infoTimer)
          this.infoTimer = undefined
        }
        this.logcat.stop()
        provider.dispose()
      }
    }
  }

  dispose(): void {
    if (this.infoTimer) {
      clearInterval(this.infoTimer)
      this.infoTimer = undefined
    }
    this.logcat.stop()
  }

  public updateRecordingState(isRecording: boolean, duration: number): void {
    this.lastRecordingState = { isRecording, duration }
    this.view?.webview.postMessage({
      command: 'recordingState',
      isRecording,
      duration
    })
  }

  private resolve(webviewView: vscode.WebviewView) {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
      ]
    }

    const styleUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sidebar.css')
    )
    const scriptUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sidebar.js')
    )

    webviewView.webview.html = this.html(webviewView.webview, styleUri, scriptUri)

    webviewView.webview.onDidReceiveMessage(async (message: SidebarMessage) => {
      try {
        await this.handleMessage(message)
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        this.post({ command: 'toolResult', ok: false, message: text })
      }
    })

    webviewView.onDidDispose(() => {
      this.view = undefined
      this.stopInfoPolling()
    })

    void this.pollDeviceInfo(true)
    void this.restoreLogcat()
  }

  // --- message handling ----------------------------------------------------

  private async handleMessage(message: SidebarMessage): Promise<void> {
    switch (message.command) {
      case 'run':
        if (message.id) {
          await vscode.commands.executeCommand(message.id)
        }
        break
      case 'open':
        if (message.url) {
          await vscode.env.openExternal(vscode.Uri.parse(message.url))
        }
        break
      case 'ready':
        await this.pollDeviceInfo(true)
        this.pushLogState()
        this.view?.webview.postMessage({
          command: 'recordingState',
          isRecording: this.lastRecordingState.isRecording,
          duration: this.lastRecordingState.duration
        })
        break
      case 'refreshInfo':
        this.lastInfoJson = ''
        await this.pollDeviceInfo(true)
        break
      case 'startLogcat':
        await this.startLogcat(message.priority)
        break
      case 'stopLogcat':
        this.logcat.stop()
        this.pushLogState()
        break
      case 'setPriority':
        // Restart in place so the new priority takes effect immediately.
        if (this.logcat.isRunning) {
          await this.startLogcat(message.priority)
        } else {
          this.priority = message.priority === 'verbose' ? 'verbose' : DEFAULT_LOG_PRIORITY
          this.pushLogState()
        }
        break
      case 'applyFilter':
      case 'clearLog':
        // Filtering and clearing are view concerns; the host just acknowledges.
        break
      case 'copyLog':
        await vscode.env.clipboard.writeText(message.text ?? '')
        this.post({ command: 'toolResult', ok: true, message: 'Log copied to clipboard.' })
        break
      case 'openLogFile':
        if (this.logcat.logFilePath) {
          const document = await vscode.workspace.openTextDocument(this.logcat.logFilePath)
          await vscode.window.showTextDocument(document, { preview: false })
        }
        break
      case 'screenshot':
        await this.runScreenshot()
        break
      case 'wakeScreen':
        await this.runWakeScreen()
        break
      case 'fixWifi':
        await this.runFixWifi()
        break
      case 'mirror':
        await vscode.commands.executeCommand('airFlutter.startScreenMirroring')
        break
      case 'mirrorOff':
        await vscode.commands.executeCommand('airFlutter.mirrorWithScreenOff')
        break
      case 'mirrorKeys':
        await vscode.commands.executeCommand('airFlutter.mirrorWithKeyboard')
        break
      case 'mirrorVirtual':
        await vscode.commands.executeCommand('airFlutter.mirrorWirelessDisplay')
        break
      case 'stopMirror':
        await this.runStopMirror()
        break
      case 'installApk':
        await this.runInstallApk()
        break
      case 'sendText':
        await this.runSendText()
        break
      case 'workflow':
        await vscode.commands.executeCommand('airFlutter.generateWorkflow')
        break
      case 'record':
        await vscode.commands.executeCommand('airFlutter.toggleScreenRecording')
        break
      case 'flavors':
        await vscode.commands.executeCommand('airFlutter.openFlavorsModal')
        break
      case 'proxy':
        await vscode.commands.executeCommand('airFlutter.openProxyModal')
        break
      case 'agentEngine':
        await vscode.commands.executeCommand('airFlutter.openAgentScaffoldingModal')
        break
      case 'compatDoctor':
        await vscode.commands.executeCommand('airFlutter.runCompatDoctor')
        break
      default:
        break
    }
  }

  // --- live device info ----------------------------------------------------

  private async pollDeviceInfo(force = false): Promise<void> {
    if (!this.view || this.infoInFlight) {
      return
    }

    this.infoInFlight = true
    try {
      const serial = await this.deviceTools.listConnectedSerial()

      if (!serial) {
        if (force || this.watchedSerial) {
          this.watchedSerial = undefined
          this.lastInfoJson = ''
          this.post({ command: 'deviceInfo', info: null })
        }
        return
      }

      if (this.watchedSerial !== serial) {
        this.watchedSerial = serial
        this.lastInfoJson = ''
      }

      const info = await this.deviceTools.getDeviceInfo(serial)
      const json = JSON.stringify(info)
      if (json !== this.lastInfoJson) {
        this.lastInfoJson = json
        this.post({ command: 'deviceInfo', info })
      }
    } catch {
      // Device disappeared mid-read; the next tick will report it as absent.
      this.post({ command: 'deviceInfo', info: null })
    } finally {
      this.infoInFlight = false
    }
  }

  private stopInfoPolling(): void {
    this.infoTimer = undefined
  }

  // --- logcat --------------------------------------------------------------

  private async startLogcat(priority?: LogPriority): Promise<void> {
    const serial = await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: 'No online phone found. Connect one and try again.'
      })
      return
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      this.post({ command: 'toolResult', ok: false, message: 'Open a folder to save the log.' })
      return
    }

    const resolved: LogPriority = priority === 'verbose' ? 'verbose' : DEFAULT_LOG_PRIORITY
      this.priority = resolved

    this.post({ command: 'toolResult', ok: true, message: '' })
    this.post({ command: 'logStatus', running: true, serial, file: undefined, priority: resolved })

    const file = await this.logcat.start(
      serial,
      workspaceRoot,
      {
        onLine: line => this.post({ command: 'logLines', lines: [line] }),
        onEnd: reason => {
          // An empty reason means the user asked to stop: stay quiet.
          this.post({
            command: 'logStatus',
            running: false,
            serial,
            priority: resolved,
            message: reason || undefined
          })
        }
      },
      resolved
    )

    this.post({ command: 'logStatus', running: true, serial, file, priority: resolved })
  }

  private async restoreLogcat(): Promise<void> {
    await this.logcat.loadPersistedTail()
    this.pushLogState()
  }

  private pushLogState(): void {
    this.post({
      command: 'logStatus',
      running: this.logcat.isRunning,
      serial: this.logcat.getSerial(),
      file: this.logcat.logFilePath,
      priority: this.logcat.getPriority(),
      lines: this.logcat.buffer.slice(-400)
    })
  }

  /** Currently selected verbosity, remembered for the next start. */
  private priority: LogPriority = DEFAULT_LOG_PRIORITY

  // --- developer tools -----------------------------------------------------

  private async runScreenshot(): Promise<void> {
    const serial = await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.post({ command: 'toolResult', ok: false, message: 'No online phone found.' })
      return
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      this.post({ command: 'toolResult', ok: false, message: 'Open a folder to save the image.' })
      return
    }

    this.post({ command: 'toolBusy', tool: 'screenshot', busy: true })
    try {
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19)
      const safeSerial = serial.replace(/[^A-Za-z0-9]/g, '-')
      const destination = path.join(
        workspaceRoot,
        '.air-flutter',
        'screenshots',
        `${safeSerial}_${stamp}.png`
      )

      await this.deviceTools.captureScreenshot(serial, destination)
      this.post({
        command: 'toolResult',
        ok: true,
        message: 'Screenshot saved.',
        path: destination
      })

      const relative = path.relative(workspaceRoot, destination)
      const selection = await vscode.window.showInformationMessage(
        `Screenshot saved to ${relative}`,
        'Open',
        'Reveal'
      )
      if (selection === 'Open') {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(destination))
      } else if (selection === 'Reveal') {
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(destination))
      }
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'screenshot', busy: false })
    }
  }

  private async runWakeScreen(): Promise<void> {
    const serial = await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.post({ command: 'toolResult', ok: false, message: 'No online phone found.' })
      return
    }

    this.post({ command: 'toolBusy', tool: 'wake', busy: true })
    try {
      await this.deviceTools.wakeScreen(serial)
      this.post({
        command: 'toolResult',
        ok: true,
        message: 'Screen woken. (💡 If display stays dark during eco mirror, press Alt+Shift+O in mirror window or stop mirror)'
      })
      this.lastInfoJson = ''
      await this.pollDeviceInfo(true)
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Could not wake the screen: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'wake', busy: false })
    }
  }

  private async runStopMirror(): Promise<void> {
    this.post({ command: 'toolBusy', tool: 'stopMirror', busy: true })
    try {
      await vscode.commands.executeCommand('airFlutter.stopScreenMirroring')
      this.post({ command: 'toolResult', ok: true, message: 'Screen mirroring stopped.' })
      this.lastInfoJson = ''
      await this.pollDeviceInfo(true)
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Could not stop mirror: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'stopMirror', busy: false })
    }
  }

  private async runInstallApk(): Promise<void> {
    const serial = await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.post({ command: 'toolResult', ok: false, message: 'No online phone found.' })
      return
    }

    const files = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: 'Install APK to device',
      filters: { 'Android Package': ['apk'] }
    })

    if (!files || !files[0]) {
      return
    }

    const apkPath = files[0].fsPath
    const apkName = path.basename(apkPath)

    this.post({ command: 'toolBusy', tool: 'installApk', busy: true })
    this.post({ command: 'toolResult', ok: true, message: `Installing ${apkName}…` })

    try {
      await this.deviceTools.installApk(serial, apkPath)
      this.post({ command: 'toolResult', ok: true, message: `Installed ${apkName} successfully!` })
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Install failed: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'installApk', busy: false })
    }
  }

  private async runSendText(): Promise<void> {
    const serial = await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.post({ command: 'toolResult', ok: false, message: 'No online phone found.' })
      return
    }

    const clipboardText = await vscode.env.clipboard.readText()
    const input = await vscode.window.showInputBox({
      prompt: 'Enter text to send to active field on phone (or press Enter to send clipboard)',
      value: clipboardText || '',
      placeHolder: 'Text to send to phone'
    })

    if (input === undefined) {
      return
    }

    const textToSend = input || clipboardText
    if (!textToSend) {
      this.post({ command: 'toolResult', ok: false, message: 'No text provided.' })
      return
    }

    this.post({ command: 'toolBusy', tool: 'sendText', busy: true })
    try {
      await this.deviceTools.sendText(serial, textToSend)
      this.post({ command: 'toolResult', ok: true, message: 'Text sent to phone input.' })
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Failed to send text: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'sendText', busy: false })
    }
  }

  private async runFixWifi(): Promise<void> {
    const serial = await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.post({ command: 'toolResult', ok: false, message: 'No online phone found.' })
      return
    }

    const confirm = await vscode.window.showWarningMessage(
      `Re-heal wireless access on ${serial}? The phone reboots and drops off the network for about a minute.`,
      { modal: true },
      'Reboot and re-heal'
    )
    if (confirm !== 'Reboot and re-heal') {
      return
    }

    this.post({ command: 'toolBusy', tool: 'wifi', busy: true })
    try {
      const endpoint = await this.deviceTools.healWifi(serial, message =>
        this.post({ command: 'toolProgress', tool: 'wifi', message })
      )
      this.post({
        command: 'toolResult',
        ok: true,
        message: `Wireless access restored on ${endpoint}.`,
        path: endpoint
      })
      await vscode.commands.executeCommand('airFlutter.openFlutterPanel')
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Wi-Fi heal failed: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'wifi', busy: false })
    }
  }

  // --- webview plumbing ----------------------------------------------------

  private post(message: Record<string, unknown>): void {
    void this.view?.webview.postMessage(message)
  }

  private html(webview: vscode.Webview, styleUri: vscode.Uri, scriptUri: vscode.Uri): string {
    const version = this.context.extension.packageJSON.version as string;
    return getSidebarWebviewHtml(webview, styleUri, scriptUri, version);
  }
}
