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

  private resolve(webviewView: vscode.WebviewView) {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))]
    }

    const styleUri = webviewView.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'sidebar.css'))
    )

    webviewView.webview.html = this.html(webviewView.webview, styleUri)

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

  private html(webview: vscode.Webview, styleUri: vscode.Uri): string {
    const version = this.context.extension.packageJSON.version as string
    const nonce = crypto.randomBytes(16).toString('base64')

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>Air Flutter</title>
</head>
<body>
    <header class="sf-masthead">
        <svg class="sf-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="0.75" y="0.75" width="30.5" height="30.5" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
            <path d="M9 9 L17 16 L9 23" fill="none" stroke="var(--accent)" stroke-width="2.6"></path>
            <path d="M20 21 H25" fill="none" stroke="currentColor" stroke-width="2"></path>
        </svg>
        <div class="sf-brand">
            <h1>Air Flutter</h1>
            <p>Wireless debug &amp; run</p>
        </div>
        <span class="sf-version" id="versionChip">v${version}</span>
    </header>

    <div class="sf-actions-top">
        <button class="sf-primary" type="button" data-run="airFlutter.openFlutterPanel">
            Open panel <span class="sf-arrow" aria-hidden="true">&#8594;</span>
        </button>
        <button class="sf-ghost" type="button" data-run="airFlutter.connectWirelessDevice">
            Connect device
        </button>
    </div>

    <!-- Live device info -->
    <section class="sf-card" id="deviceCard" data-state="empty" aria-live="polite">
        <div class="sf-card-head">
            <h2 class="sf-label">Device</h2>
            <button class="sf-icon-btn" type="button" id="refreshInfoBtn" title="Refresh device info" aria-label="Refresh device info">&#8635;</button>
        </div>

        <p class="sf-empty" id="deviceEmpty">No phone connected</p>

        <div class="sf-device" id="deviceBody" hidden>
            <p class="sf-model" id="devModel">&mdash;</p>
            <p class="sf-serial" id="devSerial" title="">&mdash;</p>

            <div class="sf-gauge">
                <span class="sf-gauge-track"><span class="sf-gauge-fill" id="battFill"></span></span>
                <span class="sf-gauge-value" id="battValue">&mdash;</span>
            </div>
            <p class="sf-meta"><span id="battState">battery</span><span class="sf-sep">/</span><span id="battTemp">&mdash;</span></p>

            <dl class="sf-rows">
                <div><dt>Android</dt><dd id="devAndroid">&mdash;</dd></div>
                <div><dt>Network</dt><dd id="devNetwork">&mdash;</dd></div>
                <div><dt>Address</dt><dd id="devIp">&mdash;</dd></div>
                <div><dt>Screen</dt><dd id="devScreen">&mdash;</dd></div>
            </dl>
        </div>
    </section>

    <!-- Developer tools -->
    <section>
        <h2 class="sf-label">Tools</h2>
        <div class="sf-tool-grid">
            <button class="sf-tool" type="button" id="toolScreenshot" data-tool="screenshot" title="Capture device screenshot to workspace">
                <span class="sf-tool-name">Screenshot</span>
                <span class="sf-tool-note">to workspace</span>
            </button>
            <button class="sf-tool" type="button" id="toolWake" data-tool="wake" title="Wake up device screen from sleep">
                <span class="sf-tool-name">Wake screen</span>
                <span class="sf-tool-note">power on display</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolWifi" data-tool="wifi" title="Reboot and restore wireless ADB connection">
                <span class="sf-tool-name">Fix Wi-Fi</span>
                <span class="sf-tool-note">reboot &amp; restore wireless ADB</span>
            </button>
            <button class="sf-tool" type="button" id="toolMirror" data-tool="mirror" title="Standard mirroring: Display on PC &amp; phone">
                <span class="sf-tool-name">Mirror</span>
                <span class="sf-tool-note">Display on PC &amp; phone</span>
            </button>
            <button class="sf-tool" type="button" id="toolMirrorKeys" data-tool="mirrorKeys" title="Eco mode: Phone dark, keyboard active">
                <span class="sf-tool-name">Screen Off + Keys</span>
                <span class="sf-tool-note">Phone dark, keyboard active</span>
            </button>
            <button class="sf-tool" type="button" id="toolStopMirror" data-tool="stopMirror" title="Stop active screen mirroring session">
                <span class="sf-tool-name">Stop mirror</span>
                <span class="sf-tool-note">close scrcpy session</span>
            </button>
            <button class="sf-tool" type="button" id="toolSendText" data-tool="sendText" title="Send clipboard or text to phone's active input">
                <span class="sf-tool-name">Send text</span>
                <span class="sf-tool-note">paste to phone</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolInstallApk" data-tool="installApk" title="Install an APK file to connected phone">
                <span class="sf-tool-name">Install APK</span>
                <span class="sf-tool-note">select &amp; install to device</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolWorkflow" data-tool="workflow" title="Generate GitHub Actions CI/CD workflow for building APK">
                <span class="sf-tool-name">GitHub Workflow</span>
                <span class="sf-tool-note">CI/CD APK build action</span>
            </button>
            <button class="sf-tool" type="button" id="toolRecord" data-tool="record" title="Record device screen to MP4">
                <span class="sf-tool-name">Record Video</span>
                <span class="sf-tool-note">start MP4 recording</span>
            </button>
            <button class="sf-tool" type="button" id="toolFlavors" data-tool="flavors" title="Manage, run, and build Flutter flavors">
                <span class="sf-tool-name">Flavors</span>
                <span class="sf-tool-note">manage &amp; build</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolProxy" data-tool="proxy" title="Configure HTTP Proxy and Private DNS for network traffic inspection">
                <span class="sf-tool-name">Proxy / DNS</span>
                <span class="sf-tool-note">network inspector</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolAgentEngine" data-tool="agentEngine" title="Scaffold AI Sub-Agents and Multi-Agent Workflows">
                <span class="sf-tool-name">AI Agent Engine</span>
                <span class="sf-tool-note">scaffold sub-agents &amp; teams</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolCompatDoctor" data-tool="compatDoctor" title="Run Flutter Compatibility Doctor &amp; Auto-Fixer">
                <span class="sf-tool-name">Compat Doctor</span>
                <span class="sf-tool-note">Gradle, AGP, Java &amp; iOS</span>
            </button>
        </div>
        <p class="sf-tool-msg" id="toolMessage" hidden></p>
    </section>

    <!-- Logcat -->
    <section class="sf-log-section">
        <div class="sf-card-head">
            <h2 class="sf-label">Device log</h2>
            <div class="sf-log-actions">
                <button class="sf-icon-btn" type="button" id="copyLogBtn" title="Copy visible log" aria-label="Copy visible log">&#10064;</button>
                <button class="sf-icon-btn" type="button" id="openLogBtn" title="Open log file" aria-label="Open log file">&#8599;</button>
                <button class="sf-ghost sf-ghost-small" type="button" id="logPause" title="Freeze the view; lines keep buffering">Pause</button>
                <button class="sf-ghost sf-ghost-small" type="button" id="logToggle">Start</button>
            </div>
        </div>

        <div class="sf-tabs" role="tablist">
            <button class="sf-tab is-active" type="button" data-filter="all" role="tab">All</button>
            <button class="sf-tab" type="button" data-filter="flutter" role="tab">Flutter</button>
            <button class="sf-tab" type="button" data-filter="errors" role="tab">Crashes</button>
            <button class="sf-tab" type="button" data-filter="warn" role="tab">Warnings</button>
        </div>

        <div class="sf-log-controls">
            <input class="sf-search" type="search" id="logSearch" placeholder="Filter text" aria-label="Filter log text" spellcheck="false">
            <label class="sf-check">
                <input type="checkbox" id="logFollow" checked>
                <span>Follow</span>
            </label>
            <label class="sf-check" title="Verbose streams every debug line; it is very heavy on a phone in debug mode.">
                <input type="checkbox" id="logVerbose">
                <span>Verbose</span>
            </label>
        </div>

        <div class="sf-log" id="logView" role="log" aria-live="polite">
            <p class="sf-log-empty" id="logPlaceholder">Idle. Press Start to stream logcat.</p>
        </div>

        <p class="sf-log-foot"><span id="logCount">0 lines</span><span class="sf-sep">/</span><span id="logSource">no file</span><span id="logHold" hidden>&#183; paused, <span id="logHeld">0</span> new</span></p>
    </section>

    <!-- Launcher links -->
    <section>
        <h2 class="sf-label">Elsewhere</h2>
        <button class="sf-item" type="button" data-run="airFlutter.showTroubleshootingGuide">
            Device setup guide <span class="sf-arrow" aria-hidden="true">&#8594;</span>
        </button>
        <button class="sf-item" type="button" data-open="https://ahmed-shaban-dev.vercel.app">
            Portfolio <span class="sf-arrow" aria-hidden="true">&#8599;</span>
        </button>
        <button class="sf-item" type="button" data-open="https://www.linkedin.com/in/ahmed-shaban-front-cross">
            LinkedIn <span class="sf-arrow" aria-hidden="true">&#8599;</span>
        </button>
        <button class="sf-item" type="button" data-open="https://github.com/ahmedshaban-blip/air-flutter">
            Source on GitHub <span class="sf-arrow" aria-hidden="true">&#8599;</span>
        </button>
    </section>

    <footer class="sf-footer">
        <span>Ahmed Shaban</span>
        <span class="sf-dot" aria-hidden="true"></span>
        <span>${version}</span>
    </footer>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const MAX_ROWS = 1200;
        const lines = [];
        let activeFilter = 'all';
        let searchText = '';
        let follow = true;

        const logView = document.getElementById('logView');
        const logCount = document.getElementById('logCount');
        const logSource = document.getElementById('logSource');
        const logToggle = document.getElementById('logToggle');
        const logPlaceholder = document.getElementById('logPlaceholder');
        const toolMessage = document.getElementById('toolMessage');
        const ICON = { verbose: 'V', debug: 'D', info: 'I', warn: 'W', error: 'E' };

        function matches(line) {
            if (activeFilter === 'flutter' && !/flutter|dart/i.test(line.tag)) {
                return false;
            }
            if (activeFilter === 'errors' && line.level !== 'error') {
                return false;
            }
            if (activeFilter === 'warn' && line.level !== 'warn' && line.level !== 'error') {
                return false;
            }
            if (searchText && !(line.text + ' ' + line.tag).toLowerCase().includes(searchText)) {
                return false;
            }
            return true;
        }

        function row(line) {
            const element = document.createElement('div');
            element.className = 'sf-log-line lvl-' + line.level;
            const time = document.createElement('span');
            time.className = 'sf-log-time';
            time.textContent = line.time.slice(6);
            const level = document.createElement('span');
            level.className = 'sf-log-level';
            level.textContent = ICON[line.level] || 'I';
            const tag = document.createElement('span');
            tag.className = 'sf-log-tag';
            tag.textContent = line.tag;
            const text = document.createElement('span');
            text.className = 'sf-log-text';
            text.textContent = line.text;
            element.append(time, level, tag, text);
            return element;
        }

        // --- pause: freeze the view, keep collecting in the background ---
        let paused = false;
        let heldSince = 0;

        const logPause = document.getElementById('logPause');
        const logHold = document.getElementById('logHold');
        const logHeld = document.getElementById('logHeld');

        function setPaused(next) {
            paused = next;
            logPause.textContent = paused ? 'Resume' : 'Pause';
            logPause.setAttribute('data-paused', paused ? 'true' : 'false');
            logHold.hidden = !paused;
            if (paused) {
                heldSince = lines.length;
            } else {
                // Catch up on everything that arrived while frozen.
                render();
            }
        }

        logPause.addEventListener('click', function () {
            setPaused(!paused);
        });

        function render() {
            const visible = lines.filter(matches).slice(-MAX_ROWS);
            logView.replaceChildren();
            if (visible.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'sf-log-empty';
                empty.textContent = lines.length === 0
                    ? 'Idle. Press Start to stream logcat.'
                    : 'Nothing matches this filter.';
                logView.append(empty);
            } else {
                const fragment = document.createDocumentFragment();
                visible.forEach(line => fragment.append(row(line)));
                logView.append(fragment);
            }
            logCount.textContent = visible.length + (visible.length === 1 ? ' line' : ' lines');
            if (logHeld) {
                logHeld.textContent = String(Math.max(0, lines.length - heldSince));
            }
            if (follow && !paused && visible.length > 0) {
                logView.scrollTop = logView.scrollHeight;
            }
        }

        function push(incoming) {
            const wasAtBottom = logView.scrollHeight - logView.scrollTop - logView.clientHeight < 40;
            incoming.forEach(line => lines.push(line));
            if (lines.length > MAX_ROWS * 2) {
                lines.splice(0, lines.length - MAX_ROWS * 2);
            }
            if (paused) {
                // Keep the screen still; only the pending counter moves.
                if (logHeld) {
                    logHeld.textContent = String(Math.max(0, lines.length - heldSince));
                }
                return;
            }
            appendRows(incoming);
            if (follow && wasAtBottom) {
                logView.scrollTop = logView.scrollHeight;
            }
        }

        /**
         * Appends to the live view instead of rebuilding it. Rebuilding on every
         * batch made the container look stale mid-frame at very high log rates.
         */
        function appendRows(incoming) {
            const visible = incoming.filter(matches);
            if (visible.length === 0) {
                return;
            }
            const empty = logView.querySelector('.sf-log-empty');
            if (empty) {
                empty.remove();
            }
            const fragment = document.createDocumentFragment();
            visible.slice(-MAX_ROWS).forEach(line => fragment.append(row(line)));
            logView.append(fragment);

            // Trim from the top so the DOM never grows past the window.
            while (logView.childElementCount > MAX_ROWS) {
                logView.removeChild(logView.firstElementChild);
            }
            logCount.textContent = logView.childElementCount +
                (logView.childElementCount === 1 ? ' line' : ' lines');
        }

        // --- launcher buttons ---
        document.querySelectorAll('[data-run]').forEach(function (button) {
            button.addEventListener('click', function () {
                vscode.postMessage({ command: 'run', id: button.getAttribute('data-run') });
            });
        });
        document.querySelectorAll('[data-open]').forEach(function (button) {
            button.addEventListener('click', function () {
                vscode.postMessage({ command: 'open', url: button.getAttribute('data-open') });
            });
        });

        // --- log controls ---
        document.querySelectorAll('.sf-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                activeFilter = tab.getAttribute('data-filter');
                document.querySelectorAll('.sf-tab').forEach(function (other) {
                    other.classList.toggle('is-active', other === tab);
                });
                if (paused) {
                    // Changing the filter is a read action: resume so the result
                    // is visible instead of silently buffering.
                    setPaused(false);
                }
                render();
            });
        });

        document.getElementById('logSearch').addEventListener('input', function (event) {
            searchText = event.target.value.trim().toLowerCase();
            render();
        });

        document.getElementById('logFollow').addEventListener('change', function (event) {
            follow = event.target.checked;
            if (follow && !paused) {
                logView.scrollTop = logView.scrollHeight;
            }
        });

        logToggle.addEventListener('click', function () {
            const running = logToggle.getAttribute('data-running') === 'true';
            vscode.postMessage({
                command: running ? 'stopLogcat' : 'startLogcat',
                priority: document.getElementById('logVerbose').checked ? 'verbose' : 'normal'
            });
        });

        document.getElementById('logVerbose').addEventListener('change', function (event) {
            vscode.postMessage({
                command: 'setPriority',
                priority: event.target.checked ? 'verbose' : 'normal'
            });
        });

        document.getElementById('copyLogBtn').addEventListener('click', function () {
            const text = Array.from(logView.querySelectorAll('.sf-log-line'))
                .map(function (element) { return element.textContent; })
                .join('\\n');
            vscode.postMessage({ command: 'copyLog', text: text });
        });

        document.getElementById('openLogBtn').addEventListener('click', function () {
            vscode.postMessage({ command: 'openLogFile' });
        });

        // --- device card ---
        function renderInfo(info) {
            const card = document.getElementById('deviceCard');
            if (!info) {
                card.setAttribute('data-state', 'empty');
                document.getElementById('deviceEmpty').hidden = false;
                document.getElementById('deviceBody').hidden = true;
                return;
            }
            card.setAttribute('data-state', 'ready');
            document.getElementById('deviceEmpty').hidden = true;
            document.getElementById('deviceBody').hidden = false;

            document.getElementById('devModel').textContent = info.model || 'Android device';
            const androidValue = (info.androidVersion || '?') +
                (info.apiLevel ? ' / API ' + info.apiLevel : '');
            document.getElementById('devAndroid').textContent = androidValue;
            const networkValue = info.wifiSsid
                ? info.networkType + ' / ' + info.wifiSsid
                : info.networkType;
            document.getElementById('devNetwork').textContent = networkValue;
            document.getElementById('devIp').textContent = info.ipAddress || 'not reported';
            document.getElementById('devScreen').textContent = info.screenOn ? 'awake' : 'asleep';
            const serialLine = document.getElementById('devSerial');
            serialLine.textContent = info.serial;
            serialLine.title = info.serial;

            const level = info.batteryLevel;
            const fill = document.getElementById('battFill');
            if (level === null || level === undefined) {
                fill.style.width = '0%';
                document.getElementById('battValue').textContent = '--%';
            } else {
                fill.style.width = Math.max(0, Math.min(100, level)) + '%';
                fill.classList.toggle('is-low', level <= 15 && info.batteryStatus === 'discharging');
                document.getElementById('battValue').textContent = level + '%';
            }

            document.getElementById('battState').textContent = info.batteryStatus || 'unknown';
            document.getElementById('battTemp').textContent = info.batteryTemperature
                ? info.batteryTemperature.toFixed(1) + ' C'
                : 'n/a';
        }

        document.getElementById('refreshInfoBtn').addEventListener('click', function () {
            vscode.postMessage({ command: 'refreshInfo' });
        });

        // --- tools ---
        function setBusy(tool, busy) {
            const button = document.querySelector('[data-tool="' + tool + '"]');
            if (button) {
                button.classList.toggle('is-busy', busy);
                button.disabled = busy;
                if (busy) {
                    button.classList.remove('is-done');
                }
            }
        }

        function markDone(tool) {
            const button = document.querySelector('[data-tool="' + tool + '"]');
            if (!button) {
                return;
            }
            button.classList.add('is-done');
            setTimeout(function () { button.classList.remove('is-done'); }, 2600);
        }

        let toolMessageTimer;

        function showToolMessage(message, ok, sticky) {
            if (toolMessageTimer) {
                clearTimeout(toolMessageTimer);
                toolMessageTimer = undefined;
            }
            toolMessage.hidden = !message;
            toolMessage.textContent = message || '';
            toolMessage.classList.toggle('is-error', ok === false);
            if (message && !sticky) {
                toolMessageTimer = setTimeout(function () {
                    toolMessage.hidden = true;
                    toolMessage.textContent = '';
                }, 6000);
            }
        }

        [
            ['toolScreenshot', 'screenshot'],
            ['toolWake', 'wake'],
            ['toolWifi', 'fixWifi'],
            ['toolMirror', 'mirror'],
            ['toolMirrorKeys', 'mirrorKeys'],
            ['toolStopMirror', 'stopMirror'],
            ['toolSendText', 'sendText'],
            ['toolInstallApk', 'installApk'],
            ['toolWorkflow', 'workflow'],
            ['toolRecord', 'record'],
            ['toolFlavors', 'flavors'],
            ['toolProxy', 'proxy'],
            ['toolAgentEngine', 'agentEngine'],
            ['toolCompatDoctor', 'compatDoctor']
        ].forEach(function (pair) {
            const button = document.getElementById(pair[0]);
            if (!button) {
                return;
            }
            button.addEventListener('click', function () {
                showToolMessage('', true);
                vscode.postMessage({ command: pair[1] });
            });
        });

        // --- host messages ---
        window.addEventListener('message', function (event) {
            const message = event.data || {};
            switch (message.command) {
                case 'deviceInfo':
                    renderInfo(message.info);
                    break;
                case 'logLines':
                    push(message.lines || []);
                    break;
                case 'logStatus':
                    logToggle.textContent = message.running ? 'Stop' : 'Start';
                    logToggle.setAttribute('data-running', message.running ? 'true' : 'false');
                    if (!message.running && paused) {
                        // The stream is gone; nothing more can arrive.
                        setPaused(false);
                    }
                    logSource.textContent = (message.file ? message.file.split(/[\\\\/]/).pop() : 'no file') +
                        (message.priority === 'verbose' ? ' / verbose' : '');
                    document.getElementById('logVerbose').checked = message.priority === 'verbose';
                    if (Array.isArray(message.lines) && lines.length === 0) {
                        push(message.lines);
                    }
                    if (message.message) {
                        showToolMessage(message.message, false, true);
                    } else if (message.running) {
                        // A clean start clears whatever the last attempt left behind.
                        showToolMessage('', true);
                    }
                    break;
                case 'toolBusy':
                    setBusy(message.tool, Boolean(message.busy));
                    if (!message.busy) {
                        markDone(message.tool);
                    }
                    break;
                case 'toolProgress':
                    showToolMessage(message.message, true, true);
                    break;
                case 'toolResult':
                    showToolMessage(message.message, message.ok);
                    break;
                default:
                    break;
            }
        });

        vscode.postMessage({ command: 'ready' });
    </script>
</body>
</html>`
  }
}
