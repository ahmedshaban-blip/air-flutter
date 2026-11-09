import { getSidebarWebviewHtml } from './sidebarHtml'
import * as vscode from 'vscode'
import * as path from 'path'
import * as crypto from 'crypto'
import { AndroidDeviceManager } from '../../domain/android-device-manager'
import { DeviceToolsService, DeviceInfoSnapshot } from '../../domain/device-tools'
import { LogcatService, LogcatLine, LogPriority, DEFAULT_LOG_PRIORITY } from '../../domain/logcat'
import { AppStateWiper, WipeOperation } from '../../domain/app-state-wiper'
import { LocalhostBridge } from '../../domain/localhost-bridge'
import {
  isMirrorAudioRoute,
  isMirrorPerformanceProfile,
  normalizeMirrorPerformanceProfile,
  MirroringState
} from '../../domain/mirror-profile'

interface SidebarMessage {
  command?: string
  id?: string
  url?: string
  serial?: string
  filter?: string
  query?: string
  text?: string
  priority?: LogPriority
  operation?: WipeOperation
  packageId?: string
  port?: number
  mode?: string
  audioRoute?: string
  performanceProfile?: string
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
  private readonly wiper: AppStateWiper
  private readonly localhostBridge: LocalhostBridge

  private infoTimer?: NodeJS.Timeout
  private infoInFlight = false
  private watchedSerial?: string
  private lastInfoJson = ''
  private lastRecordingState: { isRecording: boolean; duration: number } = { isRecording: false, duration: 0 }
  private lastMirroringState: MirroringState = { isMirroring: false, displayOff: false }
  /** Last package the user confirmed for the watched device, shown in the UI. */
  private lastWipePackage?: string

  constructor(
    private readonly context: vscode.ExtensionContext,
    deviceManager = new AndroidDeviceManager(context.globalState),
    localhostBridge = new LocalhostBridge(context.globalState, deviceManager)
  ) {
    this.deviceManager = deviceManager
    this.localhostBridge = localhostBridge
    this.deviceTools = new DeviceToolsService(context.globalState, this.deviceManager)
    this.logcat = new LogcatService(context.globalState)
    this.wiper = new AppStateWiper(context.globalState, this.deviceManager)
    context.subscriptions.push(
      this.localhostBridge.onDidChange(() => this.pushLocalhostBridgeState())
    )
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

  public updateMirroringState(state: MirroringState): void {
    this.lastMirroringState = state
    this.view?.webview.postMessage({ command: 'mirroringState', ...state })
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
      const tracked = this.shouldTrackSidebarOperation(message.command)
      if (tracked) {
        this.post({ command: 'sidebarOperation', loading: true, operation: message.command })
      }
      try {
        await this.handleMessage(message)
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        this.post({ command: 'toolResult', ok: false, message: text })
      } finally {
        if (tracked) {
          this.post({ command: 'sidebarOperation', loading: false, operation: message.command })
        }
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

  private shouldTrackSidebarOperation(command?: string): command is string {
    return typeof command === 'string' && ![
      'applyFilter',
      'clearLog',
      'copyLog',
      'open'
    ].includes(command)
  }

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
        this.pushWipeState()
        this.pushLocalhostBridgeState()
        this.view?.webview.postMessage({
          command: 'recordingState',
          isRecording: this.lastRecordingState.isRecording,
          duration: this.lastRecordingState.duration
        })
        this.updateMirroringState(this.lastMirroringState)
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
      case 'toggleScreenPower':
        await this.runToggleScreenPower()
        break
      case 'startMirror':
        await this.runMirror(message.mode, message.audioRoute, message.performanceProfile)
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
      case 'signingKey':
        await vscode.commands.executeCommand('airFlutter.openSigningKeyModal')
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
      case 'toggleOffline':
        await vscode.commands.executeCommand('airFlutter.toggleOfflineMode')
        break
      case 'toggleSlowNetwork':
        await vscode.commands.executeCommand('airFlutter.toggleSlowNetwork')
        break
      case 'agentEngine':
        await vscode.commands.executeCommand('airFlutter.openAgentScaffoldingModal')
        break
      case 'mcpHub':
        await vscode.commands.executeCommand('airFlutter.openMcpHub')
        break
      case 'compatDoctor':
        await this.openCompatDoctorInPanel()
        break
      case 'mockGps':
        await vscode.commands.executeCommand('airFlutter.openMockGpsModal')
        break
      case 'toggleDebugPaint':
        await vscode.commands.executeCommand('airFlutter.toggleDebugPaint')
        break
      case 'togglePerfOverlay':
        await vscode.commands.executeCommand('airFlutter.togglePerformanceOverlay')
        break
      case 'toggleSlowMotion':
        await vscode.commands.executeCommand('airFlutter.toggleSlowAnimations')
        break
      case 'toggleRepaintRainbow':
        await vscode.commands.executeCommand('airFlutter.toggleRepaintRainbow')
        break
      case 'debugOverlaysModal':
        await vscode.commands.executeCommand('airFlutter.openDebugOverlaysModal')
        break
      case 'inspectStorage':
        await vscode.commands.executeCommand('airFlutter.openStorageInspectorModal', this.lastWipePackage)
        break
      case 'apkSize':
        await vscode.commands.executeCommand('airFlutter.openApkSizeModal')
        break
      case 'pubHealth':
        await vscode.commands.executeCommand('airFlutter.openPubHealthModal')
        break
      case 'pushTester':
        await vscode.commands.executeCommand('airFlutter.openFlutterPanel')
        break
      case 'wipeApp':
        await this.runWipe(
          (message.operation as WipeOperation) || 'cache',
          message.packageId
        )
        break
      case 'pickWipePackage':
        await this.runPickWipePackage()
        break
      case 'applyLocalhostBridge':
        await this.runLocalhostBridge('apply', message.port)
        break
      case 'refreshLocalhostBridge':
        await this.refreshLocalhostBridge()
        break
      case 'removeLocalhostBridge':
        await this.runLocalhostBridge('remove', message.port)
        break
      case 'removeAllLocalhostBridges':
        await this.runLocalhostBridge('removeAll')
        break
      default:
        break
    }
  }

  // --- Deep storage & cache wiper ------------------------------------------

  /**
   * Resolves the package to wipe, then runs the requested operation on the
   * watched device. The package comes from the webview when the user picked
   * one; otherwise it is auto-detected from android/app/build.gradle.
   */
  private async runWipe(operation: WipeOperation, packageId?: string): Promise<void> {
    const serial = await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.post({ command: 'toolResult', ok: false, message: 'No online phone found.' })
      return
    }

    let target = packageId || this.lastWipePackage
    if (!target) {
      target = await this.resolveWipePackage(serial)
      if (!target) {
        return
      }
    }

    const confirmed = await this.confirmWipe(operation, target, serial)
    if (!confirmed) {
      this.post({ command: 'toolResult', ok: true, message: 'Reset cancelled.' })
      return
    }

    this.post({ command: 'toolBusy', tool: 'wipe', busy: true })
    this.post({ command: 'toolProgress', message: `Resetting ${target} (${operation})…` })

    try {
      const result =
        operation === 'factory' || operation === 'all-data'
          ? await this.wiper.clearAllData(serial, target, { restart: true })
          : operation === 'cache'
            ? await this.wiper.clearCache(serial, target, { restart: true })
            : await this.wiper.clearDatabases(serial, target, { restart: true })

      this.lastWipePackage = target
      const detail = result.warnings.length > 0
        ? `${result.message} ${result.warnings.join(' ')}`
        : result.message

      this.post({
        command: 'toolResult',
        ok: result.warnings.length === 0,
        message: detail
      })
      this.post({ command: 'wipeState', packageId: target })
      this.lastInfoJson = ''
      await this.pollDeviceInfo(true)
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Reset failed: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'wipe', busy: false })
    }
  }

  private async runPickWipePackage(): Promise<void> {
    const serial = await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.post({ command: 'toolResult', ok: false, message: 'No online phone found.' })
      return
    }
    const picked = await this.resolveWipePackage(serial)
    if (picked) {
      this.lastWipePackage = picked
      this.post({ command: 'wipeState', packageId: picked })
      this.post({ command: 'toolResult', ok: true, message: `Target package set to ${picked}.` })
    }
  }

  /**
   * Auto-detects the applicationId from the workspace, falling back to a picker
   * that lists installed third-party packages and a manual entry option.
   */
  private async resolveWipePackage(serial: string): Promise<string | undefined> {
    const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    const detected = projectPath ? AppStateWiper.readApplicationId(projectPath) : undefined

    const items: Array<vscode.QuickPickItem & { value?: string; action?: string }> = []
    if (detected && !AppStateWiper.isLikelySystemPackage(detected)) {
      items.push({
        label: `$(rocket) ${detected}`,
        description: 'detected from android/app/build.gradle',
        value: detected
      })
    }
    items.push({
      label: '$(list-unordered) Choose from installed packages…',
      description: 'pm list packages -3',
      action: 'list'
    })
    items.push({
      label: '$(pencil) Enter package manually…',
      description: 'type an applicationId',
      action: 'manual'
    })

    const choice = await vscode.window.showQuickPick(items, {
      title: 'Select the app package to reset',
      placeHolder: detected ? `Detected: ${detected}` : 'Pick a package for the Wiper',
      ignoreFocusOut: true
    })
    if (!choice) {
      return undefined
    }
    if (choice.value) {
      return choice.value
    }
    if (choice.action === 'manual') {
      return this.promptManualPackage(detected)
    }

    try {
      const installed = await this.wiper.listInstalledPackages(serial, true)
      if (installed.length === 0) {
        return this.promptManualPackage(detected)
      }
      const picked = await vscode.window.showQuickPick(
        installed.map(pkg => ({ label: `$(package) ${pkg.id}`, description: pkg.shortName, value: pkg.id })),
        { title: 'Installed packages on the device', ignoreFocusOut: true, matchOnDescription: true }
      )
      return picked?.value
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Could not list packages: ${error instanceof Error ? error.message : String(error)}`
      })
      return undefined
    }
  }

  private async promptManualPackage(detected?: string): Promise<string | undefined> {
    const input = await vscode.window.showInputBox({
      title: 'Enter the applicationId to reset',
      prompt: 'For example com.example.myapp',
      value: detected || '',
      ignoreFocusOut: true,
      validateInput: value => {
        if (!AppStateWiper.isValidPackageId(value.trim())) {
          return 'Enter a valid Android package id (letters, digits, dots).'
        }
        if (AppStateWiper.isLikelySystemPackage(value.trim())) {
          return 'That looks like a system package and cannot be reset.'
        }
        return undefined
      }
    })
    const trimmed = input?.trim()
    return trimmed ? trimmed : undefined
  }

  private async confirmWipe(
    operation: WipeOperation,
    packageId: string,
    serial: string
  ): Promise<boolean> {
    const destructive = operation === 'factory' || operation === 'all-data'
    const label = destructive
      ? 'Factory reset (pm clear)'
      : operation === 'cache'
        ? 'Clear cache only'
        : 'Reset databases only'
    const detail = destructive
      ? `Erases ALL app data for ${packageId} on ${serial}, like a fresh install. This cannot be undone.`
      : `Targets ${operation === 'cache' ? 'cache/' : 'databases/'} for ${packageId} on ${serial}. Falls back to a full pm clear when the build is not debuggable.`

    const picked = await vscode.window.showWarningMessage(
      `${label} — ${packageId}?`,
      { modal: true, detail },
      destructive ? 'Erase everything' : 'Continue'
    )
    return picked === (destructive ? 'Erase everything' : 'Continue')
  }

  private async openCompatDoctorInPanel(): Promise<void> {
    this.post({ command: 'toolBusy', tool: 'compatDoctor', busy: true })
    this.post({
      command: 'toolProgress',
      message: 'Opening Flutter Compatibility Doctor & Auto-Fixer…'
    })
    try {
      await vscode.commands.executeCommand('airFlutter.openCompatDoctorModal')
      this.post({
        command: 'toolResult',
        ok: true,
        message: 'Flutter Compatibility Doctor & Auto-Fixer opened in the panel.'
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'compatDoctor', busy: false })
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
          const disconnectedSerial = this.watchedSerial
          this.watchedSerial = undefined
          this.lastInfoJson = ''
          this.lastWipePackage = undefined
          this.post({ command: 'deviceInfo', info: null })
          this.pushWipeState()
          if (disconnectedSerial) {
            await this.localhostBridge.cleanupDevice(disconnectedSerial)
          }
          this.pushLocalhostBridgeState()
        }
        return
      }

      if (this.watchedSerial !== serial) {
        this.watchedSerial = serial
        this.lastInfoJson = ''
        // A different phone is now active; its remembered package no longer applies.
        this.lastWipePackage = undefined
        this.pushWipeState()
        await this.refreshLocalhostBridge()
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

  /** Sends the package the Wiper will target, auto-detecting it when unset. */
  private pushWipeState(): void {
    let packageId = this.lastWipePackage
    if (!packageId) {
      const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      const detected = projectPath ? AppStateWiper.readApplicationId(projectPath) : undefined
      if (detected && !AppStateWiper.isLikelySystemPackage(detected)) {
        packageId = detected
      }
    }
    this.post({ command: 'wipeState', packageId: packageId || '' })
  }

  private pushLocalhostBridgeState(): void {
    this.post({
      command: 'localhostBridgeState',
      deviceId: this.watchedSerial || '',
      rules: this.watchedSerial
        ? this.localhostBridge.getRules().filter(rule => rule.deviceId === this.watchedSerial)
        : []
    })
  }

  private async refreshLocalhostBridge(): Promise<void> {
    if (!this.watchedSerial) {
      this.pushLocalhostBridgeState()
      return
    }
    try {
      await this.localhostBridge.refreshDevice(this.watchedSerial)
      this.pushLocalhostBridgeState()
    } catch (error) {
      this.reportLocalhostBridgeError('Could not inspect reverse ports', error)
    }
  }

  private async runLocalhostBridge(
    action: 'apply' | 'remove' | 'removeAll',
    port?: number
  ): Promise<void> {
    const serial = this.watchedSerial || await this.deviceTools.listConnectedSerial()
    if (!serial) {
      this.reportLocalhostBridgeError('Localhost Bridge', new Error('No online phone found.'))
      return
    }

    this.post({ command: 'toolBusy', tool: 'localhostBridge', busy: true })
    try {
      if (action === 'apply') {
        await this.localhostBridge.apply(serial, Number(port))
      } else if (action === 'remove') {
        await this.localhostBridge.remove(serial, Number(port))
      } else {
        await this.localhostBridge.removeAll(serial)
      }
      const message = action === 'apply'
        ? `Localhost tcp:${port} linked to ${serial}.`
        : action === 'remove'
          ? `Unlinked tcp:${port} from ${serial}.`
          : `Removed all reverse ports from ${serial}.`
      this.post({ command: 'toolResult', ok: true, message })
      vscode.window.showInformationMessage(message)
    } catch (error) {
      this.reportLocalhostBridgeError('Localhost Bridge failed', error)
    } finally {
      this.post({ command: 'toolBusy', tool: 'localhostBridge', busy: false })
    }
  }

  private reportLocalhostBridgeError(prefix: string, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error)
    const message = `${prefix}: ${detail}`
    this.post({ command: 'toolResult', ok: false, message })
    vscode.window.showErrorMessage(message)
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
    this.post({ command: 'toolBusy', tool: 'wake', busy: true })
    try {
      const serial = await vscode.commands.executeCommand<string>('airFlutter.wakeScreen')
      this.post({
        command: 'toolResult',
        ok: true,
        message: `Screen woken for ${serial}.`
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

  private async runToggleScreenPower(): Promise<void> {
    this.post({ command: 'toolBusy', tool: 'wake', busy: true })
    try {
      const state = await vscode.commands.executeCommand<MirroringState>('airFlutter.toggleScreenPower')
      this.updateMirroringState(state)
      this.lastInfoJson = ''
      await this.pollDeviceInfo(true)
      this.post({
        command: 'toolResult',
        ok: true,
        message: state.displayOff ? 'Phone display turned off.' : 'Phone display woken.'
      })
    } catch (error) {
      this.post({
        command: 'toolResult',
        ok: false,
        message: `Could not change display power: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      this.post({ command: 'toolBusy', tool: 'wake', busy: false })
    }
  }

  private async runMirror(
    mode?: string,
    audioRoute?: string,
    performanceProfile?: string
  ): Promise<void> {
    if (!isMirrorAudioRoute(audioRoute) || !isMirrorPerformanceProfile(performanceProfile)) {
      throw new Error('Choose a valid audio route and mirroring profile.')
    }
    let command: string
    if (mode === 'keyboard') {
      command = 'airFlutter.mirrorWithKeyboard'
    } else if (mode === 'standard') {
      command = 'airFlutter.startScreenMirroring'
    } else {
      throw new Error('Unknown mirroring mode.')
    }
    await vscode.commands.executeCommand(command, {
      audioRoute,
      performanceProfile: normalizeMirrorPerformanceProfile(performanceProfile)
    })
    this.post({ command: 'toolResult', ok: true, message: 'Mirroring session launched.' })
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
    return getSidebarWebviewHtml(webview, styleUri, scriptUri, version, this.context.extensionPath);
  }
}
