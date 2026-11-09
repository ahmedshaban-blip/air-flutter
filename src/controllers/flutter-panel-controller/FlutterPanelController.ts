import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { ADBBaseController } from '../adb-controller/ADBBaseController';
import { ADBConnection } from '../../domain/adb-wrapper';
import * as appStateKeys from '../../config/global-state-keys';
import { ConsoleInterface } from '../../domain/console/console-interface';
import { NetHelpers } from '../../domain/net-helpers';
import {
  AndroidDevice,
  AndroidDeviceManager,
  NetworkDevice
} from '../../domain/android-device-manager';
import { MirrorOptions, ScreenMirrorManager } from '../../domain/screen-mirror';
import { ScreenPowerService } from '../../domain/screen-power';
import { MirrorLaunchPreferences, MirroringState } from '../../domain/mirror-profile';
import { WorkflowGenerator, WorkflowOptions } from '../../domain/workflow-generator';
import { FlavorManager } from '../../domain/flavor-manager';
import { ScreenRecorder } from '../../domain/screen-recorder';
import { NetworkManager } from '../../domain/network-manager';
import { AgentScaffolder, AgentScaffoldOptions } from '../../domain/agent-scaffolder';
import { CompatibilityModule } from '../../features/compatibility';
import { CompatibilityEngine } from '../../features/compatibility/services/compatibilityEngine';
import { StackDiffItem } from '../../features/compatibility/models/types';
import { getPanelWebviewContent } from './views/panelHtml';
import { getTroubleshootingContent } from './views/troubleshootingHtml';
import { PanelCompatHandler, PanelHandlerContext } from './handlers/panelCompatHandler';
import { PanelFlavorHandler } from './handlers/panelFlavorHandler';
import { PanelNetworkHandler, PanelDeviceContext } from './handlers/panelNetworkHandler';
import { PanelWorkflowHandler } from './handlers/panelWorkflowHandler';
import { PanelAgentHandler } from './handlers/panelAgentHandler';
import { PanelMcpHandler } from './handlers/panelMcpHandler';
import { PanelSigningKeyHandler } from './handlers/panelSigningKeyHandler';
import { PanelAssetHandler } from './handlers/panelAssetHandler';
import { PanelCodeCleanupHandler } from './handlers/panelCodeCleanupHandler';
import { PanelPermissionHandler } from './handlers/panelPermissionHandler';
import { PanelAppStateHandler } from './handlers/panelAppStateHandler';
import { PanelDeepLinkHandler } from './handlers/panelDeepLinkHandler';
import { PanelStorageInspectorHandler } from './handlers/panelStorageInspectorHandler';
import { PanelDebugOverlaysHandler } from './handlers/panelDebugOverlaysHandler';
import { PanelMockGpsHandler } from './handlers/panelMockGpsHandler';
import { PanelApkSizeHandler } from './handlers/panelApkSizeHandler';
import { PanelPubHealthHandler } from './handlers/panelPubHealthHandler';
import { PanelBuildRunnerHandler } from './handlers/panelBuildRunnerHandler';
import { PanelIconSplashHandler } from './handlers/panelIconSplashHandler';
import { PanelDeviceEnvironmentHandler } from './handlers/panelDeviceEnvironmentHandler';
import { PanelLocalizationHandler } from './handlers/panelLocalizationHandler';
import { PanelSslDoctorHandler } from './handlers/panelSslDoctorHandler';
import { SigningKeyOptions } from '../../domain/signing-key-generator';
import { AppStateWiper, WipeOperation } from '../../domain/app-state-wiper';
import { DeepLinkIntentStudio } from '../../domain/deep-link-intent-studio';
import { LocalhostBridge } from '../../domain/localhost-bridge';
import { runVisibleTask } from '../../infra/vscode/run-visible-task';

interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'unauthorized';
  type: 'device' | 'emulator';
  transport: 'usb' | 'wireless' | 'emulator';
}

// FlutterCommand interface removed - using direct command mapping

export class FlutterPanelController extends ADBBaseController {
  private currentPanel: vscode.WebviewPanel | undefined;
  private connectedDevices: Device[] = [];
  private usbDevices: Device[] = [];
  private networkDevices: NetworkDevice[] = [];
  private adbConnection: ADBConnection;
  private deviceManager: AndroidDeviceManager;
  private readonly localhostBridge: LocalhostBridge;
  private screenMirrorManager: ScreenMirrorManager;
  private readonly screenPower = new ScreenPowerService();
  private screenRecorder = new ScreenRecorder();
  private recordingTimer?: NodeJS.Timeout;
  private readonly _onRecordingStateChanged = new vscode.EventEmitter<{ isRecording: boolean; duration: number }>();
  public readonly onRecordingStateChanged = this._onRecordingStateChanged.event;
  private readonly _onMirroringStateChanged = new vscode.EventEmitter<MirroringState>();
  public readonly onMirroringStateChanged = this._onMirroringStateChanged.event;

  public isRecording(): boolean {
    return this.screenRecorder.isRecording();
  }

  public getRecordingDuration(): number {
    return this.screenRecorder.getDurationSeconds();
  }
  private readonly extensionVersion: string;
  private readonly compatHandler: PanelCompatHandler;
  private readonly flavorHandler: PanelFlavorHandler;
  private readonly networkHandler: PanelNetworkHandler;
  private readonly workflowHandler: PanelWorkflowHandler;
  private readonly agentHandler: PanelAgentHandler;
  private readonly mcpHandler: PanelMcpHandler;
  private readonly signingKeyHandler: PanelSigningKeyHandler;
  private readonly assetHandler: PanelAssetHandler;
  private readonly codeCleanupHandler: PanelCodeCleanupHandler;
  private readonly permissionHandler: PanelPermissionHandler;
  private readonly appStateHandler: PanelAppStateHandler;
  private readonly deepLinkHandler: PanelDeepLinkHandler;
  private readonly storageInspectorHandler: PanelStorageInspectorHandler;
  private readonly debugOverlaysHandler: PanelDebugOverlaysHandler;
  private readonly mockGpsHandler: PanelMockGpsHandler;
  private readonly apkSizeHandler: PanelApkSizeHandler;
  private readonly pubHealthHandler: PanelPubHealthHandler;
  private readonly buildRunnerHandler: PanelBuildRunnerHandler;
  private readonly iconSplashHandler: PanelIconSplashHandler;
  private readonly deviceEnvironmentHandler: PanelDeviceEnvironmentHandler;
  private readonly localizationHandler: PanelLocalizationHandler;
  private readonly sslDoctorHandler: PanelSslDoctorHandler;
  private operationSequence = 0;
  private initialLoadPending = false;


  constructor(
    context: vscode.ExtensionContext,
    deviceManager = new AndroidDeviceManager(context.globalState),
    localhostBridge = new LocalhostBridge(context.globalState, deviceManager)
  ) {
    super(context);
    
    // Initialize ADB connection
    const consoleInterface = new ConsoleInterface();
    const netHelper = new NetHelpers();
    this.adbConnection = new ADBConnection(consoleInterface, context.globalState, netHelper);
    this.deviceManager = deviceManager;
    this.localhostBridge = localhostBridge;
    context.subscriptions.push(
      this.localhostBridge.onDidChange(() => this.pushLocalhostBridgeState())
    );
    this.screenMirrorManager = new ScreenMirrorManager(context);
    this.screenMirrorManager.onMirroringStateChanged(event => {
      this.publishMirroringState(event.serial);
    });
    this.extensionVersion = (context.extension.packageJSON.version as string) || 'unknown';

    const handlerCtx: PanelDeviceContext = {
      getPanel: () => this.currentPanel,
      getInitialProjectPath: () => this.getInitialProjectPath(),
      postStatus: (msg, type) => this.postStatus(msg, type),
      showErrorMessage: msg => this.showErrorMessage(msg),
      showSuccessMessage: msg => this.showSuccessMessage(msg),
      openFlutterPanel: () => this.openFlutterPanel(),
      getActiveDeviceSerial: () => this.getActiveDeviceSerial(),
      getADBExecutable: () => this.deviceManager.getADBExecutable()
    };

    this.compatHandler = new PanelCompatHandler(handlerCtx);
    this.flavorHandler = new PanelFlavorHandler(handlerCtx);
    this.networkHandler = new PanelNetworkHandler(handlerCtx);
    this.workflowHandler = new PanelWorkflowHandler(handlerCtx);
    this.agentHandler = new PanelAgentHandler(handlerCtx);
    this.mcpHandler = new PanelMcpHandler(handlerCtx);
    this.signingKeyHandler = new PanelSigningKeyHandler(handlerCtx);
    this.assetHandler = new PanelAssetHandler(handlerCtx);
    this.codeCleanupHandler = new PanelCodeCleanupHandler(handlerCtx);
    this.permissionHandler = new PanelPermissionHandler(handlerCtx);
    this.appStateHandler = new PanelAppStateHandler(handlerCtx, new AppStateWiper(context.globalState, this.deviceManager));
    this.deepLinkHandler = new PanelDeepLinkHandler(
      handlerCtx,
      context.workspaceState,
      context.globalState,
      new DeepLinkIntentStudio(() => this.deviceManager.getADBExecutable())
    );
    this.storageInspectorHandler = new PanelStorageInspectorHandler(handlerCtx);
    this.debugOverlaysHandler = new PanelDebugOverlaysHandler(handlerCtx);
    this.mockGpsHandler = new PanelMockGpsHandler(handlerCtx);
    this.apkSizeHandler = new PanelApkSizeHandler(handlerCtx);
    this.pubHealthHandler = new PanelPubHealthHandler(handlerCtx);
    this.buildRunnerHandler = new PanelBuildRunnerHandler(handlerCtx);
    this.iconSplashHandler = new PanelIconSplashHandler(handlerCtx);
    this.deviceEnvironmentHandler = new PanelDeviceEnvironmentHandler(handlerCtx);
    this.localizationHandler = new PanelLocalizationHandler(handlerCtx);
    this.sslDoctorHandler = new PanelSslDoctorHandler(handlerCtx);
  }

  async onInit() {
    console.log('🚀 FlutterPanelController: Initializing commands...')
    
    // Only register essential commands - remove all others
    this.registerCommand('airFlutter.openFlutterPanel', () => this.openFlutterPanel())
      .registerCommand('airFlutter.connectWirelessDevice', () => this.withNativeProgress('Connecting wireless device…', () => this.connectWirelessDevice()))
      .registerCommand('airFlutter.showConnectedDevices', () => this.withNativeProgress('Refreshing connected devices…', () => this.showConnectedDevices()))
      .registerCommand('airFlutter.showTroubleshootingGuide', () => this.showTroubleshootingGuide())
      .registerCommand('airFlutter.runFlutterDoctor', () => this.withNativeProgress('Running Flutter Doctor…', () => this.flutterDoctor()))
      .registerCommand('airFlutter.getPackages', () => this.withNativeProgress('Getting Flutter packages…', () => this.getPackages()))
      .registerCommand('airFlutter.upgradePackages', () => this.withNativeProgress('Upgrading Flutter packages…', () => this.upgradePackages()))
      .registerCommand('airFlutter.cleanProject', () => this.withNativeProgress('Cleaning Flutter project…', () => this.cleanProject()))
      .registerCommand('airFlutter.runFlutterApp', () => this.withNativeProgress('Running Flutter app…', () => this.runFlutterApp()))
      .registerCommand('airFlutter.buildAPK', () => this.withNativeProgress('Building APK…', () => this.buildAPK()))
      .registerCommand('airFlutter.buildAppBundle', () => this.withNativeProgress('Building App Bundle…', () => this.buildAAB()))
      .registerCommand('airFlutter.startScreenMirroring', (preferences?: MirrorLaunchPreferences) => this.withNativeProgress('Starting screen mirroring…', () => this.selectDeviceToMirror(preferences)))
      .registerCommand('airFlutter.mirrorWithScreenOff', (preferences?: MirrorLaunchPreferences) => this.withNativeProgress('Starting screen mirroring…', () => this.selectDeviceToMirror({ ...preferences, displayOff: true })))
      .registerCommand('airFlutter.mirrorWithKeyboard', (preferences?: MirrorLaunchPreferences) => this.withNativeProgress('Starting keyboard mirroring…', () => this.selectDeviceToMirror({ ...preferences, displayOff: true, hardwareKeyboard: true })))
      .registerCommand('airFlutter.mirrorWirelessDisplay', () => this.withNativeProgress('Starting virtual display…', () => this.selectDeviceToMirror({ wirelessDisplay: true })))
      .registerCommand('airFlutter.stopScreenMirroring', () => this.withNativeProgress('Stopping screen mirroring…', () => this.stopMirroring()))
      .registerCommand('airFlutter.wakeScreen', (deviceId?: string) => this.withNativeProgress('Waking phone display…', () => this.wakeDeviceScreen(deviceId)))
      .registerCommand('airFlutter.toggleScreenPower', () => this.withNativeProgress('Updating phone display…', () => this.toggleMirroredDisplay()))
      .registerCommand('airFlutter.installApk', () => this.withNativeProgress('Installing APK…', () => this.installApkToDevice()))
      .registerCommand('airFlutter.sendTextToDevice', () => this.withNativeProgress('Sending text to phone…', () => this.sendTextToDevice()))
      .registerCommand('airFlutter.setScrcpyPath', () => this.withNativeProgress('Checking scrcpy…', () => this.setScrcpyPath()))
      .registerCommand('airFlutter.generateWorkflow', () => this.openWorkflowModal())
      .registerCommand('airFlutter.openSigningKeyModal', () => this.openSigningKeyModal())
      .registerCommand('airFlutter.openFlavorsModal', () => this.withNativeProgress('Detecting Flutter flavors…', () => this.openFlavorsModal()))
      .registerCommand('airFlutter.openProxyModal', () => this.withNativeProgress('Reading network settings…', () => this.openProxyModal()))
      .registerCommand('airFlutter.toggleOfflineMode', () => this.withNativeProgress('Toggling offline mode…', () => this.networkHandler.handleToggleOffline()))
      .registerCommand('airFlutter.toggleSlowNetwork', () => this.withNativeProgress('Toggling network throttle…', () => this.networkHandler.handleSetNetworkThrottle('delay3s')))
      .registerCommand('airFlutter.toggleScreenRecording', () => this.withNativeProgress('Updating screen recording…', () => this.toggleScreenRecording()))
      .registerCommand('airFlutter.openAgentScaffoldingModal', () => this.openAgentScaffoldModal())
      .registerCommand('airFlutter.openCompatDoctorModal', () => this.withNativeProgress('Scanning Flutter compatibility…', () => this.openCompatDoctorModal()))
      .registerCommand('airFlutter.openMcpHub', () => this.openMcpHubModal())
      .registerCommand('airFlutter.resetAppState', () => this.withNativeProgress('Loading app state tools…', () => this.openAppStateQuickPick()))
      .registerCommand('airFlutter.clearAppCache', () => this.withNativeProgress('Clearing app cache…', () => this.handleWipe('cache')))
      .registerCommand('airFlutter.resetAppDatabases', () => this.withNativeProgress('Resetting app databases…', () => this.handleWipe('databases')))
      .registerCommand('airFlutter.factoryResetApp', () => this.withNativeProgress('Resetting app data…', () => this.handleWipe('factory')))
      .registerCommand('airFlutter.openStorageInspectorModal', (packageId?: string) => this.storageInspectorHandler.openModal(packageId))
      .registerCommand('airFlutter.openDebugOverlaysModal', () => this.debugOverlaysHandler.openModal())
      .registerCommand('airFlutter.toggleDebugPaint', () => this.debugOverlaysHandler.toggleOverlay('debugPaint'))
      .registerCommand('airFlutter.togglePerformanceOverlay', () => this.debugOverlaysHandler.toggleOverlay('performanceOverlay'))
      .registerCommand('airFlutter.toggleSlowAnimations', () => this.debugOverlaysHandler.toggleOverlay('slowAnimations'))
      .registerCommand('airFlutter.toggleRepaintRainbow', () => this.debugOverlaysHandler.toggleOverlay('repaintRainbow'))
      .registerCommand('airFlutter.openMockGpsModal', () => this.mockGpsHandler.openModal())
      .registerCommand('airFlutter.openApkSizeModal', () => this.apkSizeHandler.openModal())
      .registerCommand('airFlutter.openPubHealthModal', () => this.pubHealthHandler.openModal())
      .registerCommand('airFlutter.cleanCommentedCode', () => this.withNativeProgress('Scanning for commented-out Dart code…', () => this.codeCleanupHandler.runInteractiveCleanupQuickPick()))
      .registerCommand('airFlutter.openBuildRunner', async () => {
        await this.openFlutterPanel();
        this.currentPanel?.webview.postMessage({ command: 'selectTab', tab: 'build-runner' });
      })
      .registerCommand('airFlutter.openIconSplashStudio', async () => {
        await this.openFlutterPanel();
        this.currentPanel?.webview.postMessage({ command: 'selectTab', tab: 'icon-splash' });
      })
      .registerCommand('airFlutter.openDeviceEnvironment', async () => {
        await this.openFlutterPanel();
        this.currentPanel?.webview.postMessage({ command: 'selectTab', tab: 'device-env' });
      })
      .registerCommand('airFlutter.openLocalizationStudio', async () => {
        await this.openFlutterPanel();
        this.currentPanel?.webview.postMessage({ command: 'selectTab', tab: 'localization' });
      })
      .registerCommand('airFlutter.openSslDoctor', async () => {
        await this.openFlutterPanel();
        this.currentPanel?.webview.postMessage({ command: 'selectTab', tab: 'ssl-proxy' });
      })
    
    console.log('✅ FlutterPanelController: Essential commands registered successfully')
  }

  private withNativeProgress<T>(title: string, task: () => Promise<T>): Thenable<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
      },
      task
    );
  }

  private getLocalResourceRoots(): vscode.Uri[] {
    const roots: vscode.Uri[] = [
      vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview'),
      vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
    ];

    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        roots.push(folder.uri);
      }
    }

    const initialProject = this.getInitialProjectPath();
    if (initialProject) {
      roots.push(vscode.Uri.file(initialProject));
    }

    return roots;
  }

  private async openFlutterPanel() {
    console.log('🚀 FlutterPanelController: Opening Air Flutter Panel')
    
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.currentPanel) {
      console.log('📱 FlutterPanelController: Panel already exists, revealing...')
      this.currentPanel.reveal(column);
      return;
    }

    console.log('🆕 FlutterPanelController: Creating new webview panel...')
    this.currentPanel = vscode.window.createWebviewPanel(
      'airFlutterPanel',
      '🚀 Air Flutter - Wireless Debug & Run',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableCommandUris: true,
        localResourceRoots: this.getLocalResourceRoots(),
        enableForms: true,
        enableFindWidget: true
      }
    );

    console.log('📝 FlutterPanelController: Setting webview HTML content...')
    this.currentPanel.webview.html = this.getWebviewContent(this.currentPanel);

    // Announce the running extension version so a stale install is obvious
    setTimeout(() => {
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `Air Flutter v${this.extensionVersion} loaded`,
          type: 'info'
        });
      }
    }, 1000);

    this.currentPanel.webview.onDidReceiveMessage(
      async (message) => {
        console.log('📨 FlutterPanelController: Received command:', message?.command)
        const operationId = `panel-${++this.operationSequence}`;
        const trackOperation = this.shouldTrackOperation(message?.command);
        if (trackOperation) {
          this.postOperationLoading(operationId, message, true);
        }
        
        try {
          switch (message.command) {
            case 'panelReady':
              this.currentPanel?.webview.postMessage({
                command: 'operationLoading',
                operationId: 'panel-initial-load',
                operation: 'initialLoad',
                loading: this.initialLoadPending
              });
              break;
            case 'selectTab':
              if (message.tab) {
                this.currentPanel?.webview.postMessage({ command: 'selectTab', tab: message.tab });
              }
              break;
            case 'connectDevice':
              console.log('🔗 FlutterPanelController: Connecting device...')
              await this.handleConnectDevice(message.ip, message.port);
              break;
            case 'runFlutterCommand':
              console.log('⚡ FlutterPanelController: Running Flutter command:', message.commandId)
              await this.handleFlutterCommand(message.commandId);
              break;
            case 'refreshDevices':
              console.log('🔄 FlutterPanelController: Refreshing devices...')
              await this.refreshConnectedDevices();
              this.postStatus(
                this.networkDevices.length > 0
                  ? `🔎 Found ${this.networkDevices.length} reachable wireless device(s).`
                  : '🔎 Scan finished. No phone answered on port 5555 — plug the phone in via USB once and press "Connect wirelessly" to enable wireless ADB.',
                this.networkDevices.length > 0 ? 'success' : 'warning'
              );
              break;
            case 'connectUsbDevice':
              await this.handleConnectUSBDevice(message.deviceId);
              break;
            case 'connectNetworkDevice':
              await this.handleConnectNetworkDevice(message.endpoint);
              break;
            case 'mirrorDevice':
              await this.handleMirrorDevice(message.deviceId, {
                displayOff: message.mode === 'screen-off' || message.mode === 'keyboard',
                hardwareKeyboard: message.mode === 'keyboard',
                wirelessDisplay: message.mode === 'virtual-display',
                audioRoute: message.audioRoute,
                performanceProfile: message.performanceProfile
              });
              break;
            case 'wakeDevice':
              await this.wakeDeviceScreen(message.deviceId);
              break;
            case 'toggleMirrorDisplay':
              await this.toggleMirroredDisplay(message.deviceId);
              break;
            case 'stopMirroring':
              await this.stopMirroring();
              break;
            case 'installApk':
              await this.installApkToDevice();
              break;
            case 'sendText':
              await this.sendTextToDevice();
              break;
            case 'setScrcpyPath':
              await this.setScrcpyPath();
              break;
            case 'openWorkflowModal':
              await this.openWorkflowModal();
              break;
            case 'getWorkflowInitialPath':
              this.currentPanel?.webview.postMessage({
                command: 'workflowProjectPath',
                path: this.getInitialProjectPath()
              });
              break;
            case 'selectWorkflowProject':
              await this.selectWorkflowProject();
              break;
            case 'generateWorkflow':
              await this.handleGenerateWorkflow(message as unknown as WorkflowOptions);
              break;
            case 'openSigningKeyModal':
              await this.openSigningKeyModal();
              break;
            case 'selectSigningKeyProject':
              await this.selectSigningKeyProject();
              break;
            case 'createSigningKey':
              await this.createSigningKey(message as unknown as SigningKeyOptions);
              break;
            case 'openFlavorsModal':
              await this.openFlavorsModal();
              break;
            case 'selectFlavorsProject':
              await this.selectFlavorsProject();
              break;
            case 'detectFlavors':
              await this.handleDetectFlavors(message.projectPath);
              break;
            case 'setupFlavors':
              await this.handleSetupFlavors(message.projectPath, message.flavors);
              break;
            case 'runFlavor':
              await this.handleRunFlavor(message.projectPath, message.flavor, message.target);
              break;
            case 'buildFlavorApk':
              await this.handleBuildFlavorApk(message.projectPath, message.flavor, message.target);
              break;
            case 'buildAllFlavors':
              await this.handleBuildAllFlavors(message.projectPath, message.flavors);
              break;
            case 'openProxyModal':
              await this.openProxyModal();
              break;
            case 'getNetworkState':
              await this.handleGetNetworkState();
              break;
            case 'setProxy':
              await this.handleSetProxy(message.host, message.port);
              break;
            case 'clearProxy':
              await this.handleClearProxy();
              break;
            case 'setPrivateDns':
              await this.handleSetPrivateDns(message.host);
              break;
            case 'clearPrivateDns':
              await this.handleClearPrivateDns();
              break;
            case 'toggleOfflineMode':
              await this.networkHandler.handleToggleOffline(message.forceHardware);
              break;
            case 'setNetworkThrottle':
              await this.networkHandler.handleSetNetworkThrottle(message.preset);
              break;
            case 'simulateNetworkError':
              await this.networkHandler.handleSimulateError(message.errorType);
              break;
            case 'resetNetworkSimulation':
              await this.networkHandler.handleResetNetworkSimulation();
              break;
            case 'toggleScreenRecording':
              await this.toggleScreenRecording();
              break;
            case 'openAgentScaffoldModal':
              await this.openAgentScaffoldModal();
              break;
            case 'selectAgentScaffoldProject':
              await this.selectAgentScaffoldProject();
              break;
            case 'generateAgentScaffold':
              await this.handleGenerateAgentScaffold(message as unknown as AgentScaffoldOptions);
              break;
            case 'openMcpHubModal':
              await this.openMcpHubModal();
              break;
            case 'mcpRequestData':
              // The modal opens immediately in the webview and asks for the
              // catalog; reply with data only, so no open/request loop occurs.
              this.mcpHandler.pushCatalogData(
                typeof message.workspaceRoot === 'string' && message.workspaceRoot.length > 0
                  ? message.workspaceRoot
                  : this.getInitialProjectPath()
              );
              break;
            case 'mcpCheckPrerequisites':
              await this.mcpHandler.handleMcpCheckPrerequisites(
                Array.isArray(message.serverIds) ? message.serverIds : []
              );
              break;
            case 'mcpWrite':
              await this.mcpHandler.handleMcpWrite({
                agentIds: Array.isArray(message.agentIds) ? message.agentIds : [],
                scope: message.scope === 'global' ? 'global' : 'workspace',
                serverIds: Array.isArray(message.serverIds) ? message.serverIds : [],
                parameters: message.parameters && typeof message.parameters === 'object'
                  ? message.parameters
                  : {},
                instructions: message.instructions && typeof message.instructions === 'object'
                  ? message.instructions
                  : {},
                workspaceRoot: typeof message.workspaceRoot === 'string' ? message.workspaceRoot : undefined
              });
              break;
            case 'mcpCompanionStatus':
              await this.mcpHandler.handleCompanionStatus(
                message.serverId,
                typeof message.workspaceRoot === 'string' ? message.workspaceRoot : undefined
              );
              break;
            case 'mcpCompanionInstall':
              await this.mcpHandler.handleCompanionInstall(
                message.serverId,
                typeof message.workspaceRoot === 'string' ? message.workspaceRoot : undefined
              );
              break;
            case 'mcpCompanionGuideFile':
              await this.mcpHandler.handleCompanionGuideFile(
                message.serverId,
                typeof message.workspaceRoot === 'string' ? message.workspaceRoot : undefined
              );
              break;
            case 'openCompatDoctorModal':
              await this.openCompatDoctorModal();
              break;
            case 'selectCompatProject':
              await this.selectCompatProject();
              break;
            case 'runCompatDoctorScan':
              await this.handleRunCompatDoctorScan(message.projectPath);
              break;
            case 'applyCompatUpgrades':
              await this.handleApplyCompatUpgrades(message.projectPath);
              break;
            case 'applyCustomStack':
              await this.handleApplyCustomStack(message.projectPath, message.diffs);
              break;
            case 'scanAssets':
              await this.assetHandler.handleScanAssets();
              break;
            case 'scanAndSyncAssets':
              await this.assetHandler.handleScanAndSyncAssets();
              break;
            case 'generateAssetConstants':
              await this.assetHandler.handleGenerateAssetConstants();
              break;
            case 'deleteUnusedAsset':
              await this.assetHandler.deleteUnusedAsset(message.file);
              break;
            case 'deleteAssetsBatch':
              await this.assetHandler.deleteAssetsBatch(message.files);
              break;
            case 'openAssetInEditor':
              await this.assetHandler.openAssetInEditor(message.file);
              break;
            case 'importAssets':
              await this.assetHandler.importAssets(message.files);
              break;
            case 'addAssetsToPubspec':
              await this.assetHandler.addAssetsToPubspec(message.files);
              break;
            case 'saveOptimizedAsset':
              await this.assetHandler.saveOptimizedAsset(message.originalPath, message.newPath, message.base64);
              break;
            case 'runCodeCleanupScan':
              await this.codeCleanupHandler.scan();
              break;
            case 'openCodeCleanupTarget':
              await this.codeCleanupHandler.openTarget(message.file, message.line, message.column, message.endLine);
              break;
            case 'removeCommentedCodeBlock':
              await this.codeCleanupHandler.removeCommentedBlock(message.file, message.line, message.endLine);
              break;
            case 'uncommentCodeBlock':
              await this.codeCleanupHandler.uncommentBlock(message.file, message.line, message.endLine);
              break;
            case 'removeAllCommentedCode':
              await this.codeCleanupHandler.removeAllCommentedCode();
              break;
            case 'deleteUnusedDartFile':
              await this.codeCleanupHandler.deleteUnusedDartFile(message.file);
              break;
            case 'loadAndroidPermissions':
              await this.permissionHandler.handleLoadPermissions('android');
              break;
            case 'loadPermissions':
              await this.permissionHandler.handleLoadPermissions(message.platform || 'android');
              break;
            case 'addAndroidPermissions':
              await this.permissionHandler.handleAddPermissions(message.selectedPermissions, 'android');
              break;
            case 'addPermissions':
              await this.permissionHandler.handleAddPermissions(
                message.selectedPermissions,
                message.platform || 'android',
                message.permissionsMap
              );
              break;
            case 'clearAppCache':
              await this.handleWipe('cache', message.deviceId, message.packageId);
              break;
            case 'resetAppDatabases':
              await this.handleWipe('databases', message.deviceId, message.packageId);
              break;
            case 'factoryResetApp':
              await this.handleWipe('factory', message.deviceId, message.packageId);
              break;
            case 'clearAllAppData':
              await this.handleWipe('all-data', message.deviceId, message.packageId);
              break;
            case 'pickAppPackage':
              await this.pickAppPackage(message.deviceId);
              break;
            case 'loadDeepLinkStudio':
              this.deepLinkHandler.load();
              break;
            case 'dispatchDeepLink':
              await this.deepLinkHandler.dispatch(message.uri, message.deviceId, message.packageName);
              break;
            case 'saveDeepLinkPreset':
              await this.deepLinkHandler.savePreset(message.name, message.uri, message.packageName);
              break;
            case 'deleteDeepLinkPreset':
              await this.deepLinkHandler.deletePreset(message.name);
              break;
            case 'dispatchPushNotification':
              await this.deepLinkHandler.dispatchPush(message.payload, message.packageName, message.deviceId);
              break;
            case 'loadRuntimePermissions':
              await this.permissionHandler.handleLoadRuntimePermissions(message.packageId);
              break;
            case 'grantRuntimePermission':
              await this.permissionHandler.handleGrantPermission(message.packageId, message.permission);
              break;
            case 'revokeRuntimePermission':
              await this.permissionHandler.handleRevokePermission(message.packageId, message.permission);
              break;
            case 'grantAllRuntimePermissions':
              await this.permissionHandler.handleGrantAllPermissions(message.packageId, message.permissions);
              break;
            case 'revokeAllRuntimePermissions':
              await this.permissionHandler.handleRevokeAllPermissions(message.packageId, message.permissions);
              break;
            case 'openStorageInspectorModal':
              await this.storageInspectorHandler.openModal(message.packageId);
              break;
            case 'storageInspectorListFiles':
              await this.storageInspectorHandler.listFiles(message.serial, message.packageId, message.mode, message.selectedPresets);
              break;
            case 'storageInspectorReadPrefs':
              await this.storageInspectorHandler.readSharedPreferences(message.serial, message.packageId, message.fileName);
              break;
            case 'storageInspectorSavePref':
              await this.storageInspectorHandler.saveSharedPreference(message.serial, message.packageId, message.fileName, message.key, message.value, message.type);
              break;
            case 'storageInspectorDeletePref':
              await this.storageInspectorHandler.deleteSharedPreference(message.serial, message.packageId, message.fileName, message.key);
              break;
            case 'storageInspectorListTables':
              await this.storageInspectorHandler.listSqliteTables(message.serial, message.packageId, message.dbName);
              break;
            case 'storageInspectorQueryTable':
              await this.storageInspectorHandler.querySqliteTable(message.serial, message.packageId, message.dbName, message.query);
              break;
            case 'openDebugOverlaysModal':
              await this.debugOverlaysHandler.openModal();
              break;
            case 'getDebugOverlaysState':
              this.debugOverlaysHandler.postState();
              break;
            case 'toggleDebugOverlay':
              await this.debugOverlaysHandler.toggleOverlay(message.overlay);
              break;
            case 'resetDebugOverlays':
              this.debugOverlaysHandler.resetAll();
              break;
            case 'openMockGpsModal':
              await this.mockGpsHandler.openModal();
              break;
            case 'setMockGpsLocation':
              await this.mockGpsHandler.setLocation(
                Number(message.lat),
                Number(message.lon),
                Number(message.altitude || 0),
                message.serial
              );
              break;
            case 'resetMockGps':
              await this.mockGpsHandler.resetLocation(message.serial);
              break;
            case 'openApkSizeModal':
              await this.apkSizeHandler.openModal();
              break;
            case 'analyzeApkSize':
              this.apkSizeHandler.analyze(message.apkPath);
              break;
            case 'pickAndAnalyzeApk':
              await this.apkSizeHandler.pickAndAnalyze();
              break;
            case 'openPubHealthModal':
              await this.pubHealthHandler.openModal();
              break;
            case 'checkPubHealth':
              await this.pubHealthHandler.checkHealth(message.projectPath);
              break;
            case 'pubHealthSelectProject':
              await this.pubHealthHandler.selectProject();
              break;
            case 'runPubUpgrade':
              await this.pubHealthHandler.runPubUpgrade();
              break;
            case 'openPubspecAtLine':
              await this.pubHealthHandler.openPubspecAtLine(message.filePath, message.line, message.column);
              break;
            case 'updatePubPackages':
              await this.pubHealthHandler.updatePackages(message.packages);
              break;
            case 'upgradeTransitivePubPackage':
              await this.pubHealthHandler.upgradeTransitivePackage(message.packageName);
              break;
            case 'disconnectDevice':
              console.log('❌ FlutterPanelController: Disconnecting device...')
              await this.handleDisconnectDevice(message.deviceId);
              break;
            case 'applyLocalhostBridge':
              await this.applyLocalhostBridge(message.deviceId, Number(message.port));
              break;
            case 'refreshLocalhostBridge':
              await this.refreshLocalhostBridge();
              break;
            case 'removeLocalhostBridge':
              await this.removeLocalhostBridge(message.deviceId, Number(message.port));
              break;
            case 'removeAllLocalhostBridges':
              await this.removeAllLocalhostBridges(message.deviceId);
              break;
            case 'showTroubleshootingGuide':
              console.log('🔧 FlutterPanelController: Showing troubleshooting guide...')
              await this.showTroubleshootingGuide();
              break;
            case 'startBuildRunner':
              await this.buildRunnerHandler.startBuildRunner(message);
              break;
            case 'stopBuildRunner':
              this.buildRunnerHandler.stopBuildRunner();
              break;
            case 'clearBuildRunnerCache':
              this.buildRunnerHandler.clearBuildRunnerCache();
              break;
            case 'openBuildRunnerTerminal':
              await this.buildRunnerHandler.openInTerminal(Boolean(message.watch), message.buildFilter);
              break;
            case 'saveNativeAppIcons':
              await this.iconSplashHandler.saveNativeIcons(message);
              break;
            case 'configureLauncherIconsYaml':
              await this.iconSplashHandler.configureLauncherIconsYaml(message);
              break;
            case 'runLauncherIconsCli':
              await this.iconSplashHandler.runLauncherIconsCli();
              break;
            case 'configureNativeSplashYaml':
              await this.iconSplashHandler.configureNativeSplashYaml(message);
              break;
            case 'runNativeSplashCli':
              await this.iconSplashHandler.runNativeSplashCli();
              break;
            case 'getDeviceEnvironmentState':
              await this.deviceEnvironmentHandler.fetchState();
              break;
            case 'setDeviceFontScale':
              await this.deviceEnvironmentHandler.setFontScale(Number(message.scale));
              break;
            case 'setDeviceDarkMode':
              await this.deviceEnvironmentHandler.setDarkMode(Boolean(message.enabled));
              break;
            case 'setDeviceBatteryLevel':
              await this.deviceEnvironmentHandler.setBatteryLevel(Number(message.level), Boolean(message.charging));
              break;
            case 'resetDeviceBattery':
              await this.deviceEnvironmentHandler.resetBattery();
              break;
            case 'setDeviceLocale':
              await this.deviceEnvironmentHandler.setLocale(String(message.localeTag));
              break;
            case 'setDeviceDensity':
              await this.deviceEnvironmentHandler.setDensity(message.dpi === 'reset' ? 'reset' : Number(message.dpi));
              break;
            case 'setDeviceRotation':
              await this.deviceEnvironmentHandler.setRotation(message.rotation);
              break;
            case 'loadLocalizationMatrix':
              await this.localizationHandler.fetchMatrix();
              break;
            case 'saveLocalizationEntry':
              await this.localizationHandler.saveKey(message);
              break;
            case 'initLocalizationWorkspace':
              await this.localizationHandler.initWorkspace();
              break;
            case 'runGenL10n':
              await this.localizationHandler.runGenL10n();
              break;
            case 'generateAiTranslatePrompt':
              this.localizationHandler.generateAiPrompt(String(message.targetLocale));
              break;
            case 'checkNetworkSecurityStatus':
              await this.sslDoctorHandler.fetchStatus();
              break;
            case 'applyNetworkSecurityConfig':
              await this.sslDoctorHandler.applyNetworkSecurityConfig();
              break;
            case 'generateDevHttpOverridesFile':
              await this.sslDoctorHandler.generateDevHttpOverrides();
              break;
            default:
              console.warn('⚠️ FlutterPanelController: Unknown message command:', message.command)
              break;
          }
        } catch (error) {
          console.error('❌ FlutterPanelController: Error handling message:', error)
          const errorMessage = error instanceof Error ? error.message : String(error)
          this.showErrorMessage(`Error handling message: ${errorMessage}`);
          
          // Send error to webview
          if (this.currentPanel) {
            this.currentPanel.webview.postMessage({
              command: 'addStatusMessage',
              message: `❌ Error: ${errorMessage}`,
              type: 'error'
            });
          }
        } finally {
          if (trackOperation) {
            this.postOperationLoading(operationId, message, false);
          }
        }
      }
    );

    this.currentPanel.onDidDispose(() => {
      console.log('🗑️ FlutterPanelController: Panel disposed')
      this.mockGpsHandler.dispose();
      this.buildRunnerHandler.dispose();
      this.currentPanel = undefined;
    });

    // Initial state hydration uses the indicator already rendered in the HTML.
    console.log('🔄 FlutterPanelController: Performing initial device refresh...')
    const initialOperationId = 'panel-initial-load';
    this.initialLoadPending = true;
    try {
      await this.refreshConnectedDevices();
      this.pushLocalhostBridgeState();
      this.publishMirroringState();
      await this.pushAppStatePackage();
      this.deepLinkHandler.load();
    } finally {
      this.initialLoadPending = false;
      this.currentPanel?.webview.postMessage({
        command: 'operationLoading',
        operationId: initialOperationId,
        operation: 'initialLoad',
        loading: false
      });
    }
    
    console.log('✅ FlutterPanelController: Panel opened successfully')
  }

  /** Detects the applicationId and forwards it so the wiper card can show it. */
  private async pushAppStatePackage(deviceId?: string): Promise<void> {
    const serial = deviceId || this.getActiveDeviceSerial();
    const projectPath = this.getInitialProjectPath();
    const detected = projectPath ? AppStateWiper.readApplicationId(projectPath) : undefined;
    if (detected && !AppStateWiper.isLikelySystemPackage(detected)) {
      this.currentPanel?.webview.postMessage({
        command: 'appStatePackageSelected',
        deviceId: serial,
        packageId: detected
      });
    }
  }

  private getWebviewContent(panel: vscode.WebviewPanel): string {
    return getPanelWebviewContent(this.context, panel, this.extensionVersion);
  }

  private async handleConnectDevice(ip: string, port: string) {
    console.log(`🔗 FlutterPanelController: handleConnectDevice called for ${ip}:${port}`)
    
    try {
      // Use actual ADB to connect to the device
      if (port) {
        await this.context.globalState.update(appStateKeys.lastUsedPort(), port);
      }
      if (ip) {
        await this.context.globalState.update(appStateKeys.lastUsedIP(), ip);
      }
      
      // Show connecting message
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `🔄 Connecting to ${ip}:${port}...`,
          type: 'info'
        });
      }
      
      try {
        // Try to connect using ADB
        const result = await this.adbConnection.ConnectToDevice(ip, port);
        console.log(`ADB Connection result: ${result}`);
        
        // Create device object from successful connection
        const newDevice = {
          id: `${ip}:${port}`,
          name: `Device ${ip}:${port}`,
          status: 'online' as const,
          type: 'device' as const,
          transport: 'wireless' as const
        };

        // Check if device already exists
        const existingDevice = this.connectedDevices.find(d => d.id === newDevice.id);
        if (!existingDevice) {
          this.connectedDevices.push(newDevice);
          console.log(`✅ FlutterPanelController: Device ${ip}:${port} added to connected devices`);
          
          // Update the webview with new device list
          if (this.currentPanel) {
            this.currentPanel.webview.postMessage({
              command: 'updateDevices',
              devices: this.connectedDevices
            });
          }
          
          // Show success message
          vscode.window.showInformationMessage(result);
          
          // Update webview with success message
          if (this.currentPanel) {
            this.currentPanel.webview.postMessage({
              command: 'addStatusMessage',
              message: `✅ ${result}`,
              type: 'success'
            });
          }
        } else {
          console.log(`ℹ️ FlutterPanelController: Device ${ip}:${port} already connected`);
          vscode.window.showInformationMessage(`Device ${ip}:${port} is already connected`);
        }
      } catch (adbError) {
        // Handle ADB not found or connection errors
        if (adbError instanceof Error && adbError.message.includes('ADB not found')) {
          const result = await vscode.window.showErrorMessage(
            'ADB not found. Do you want to set a custom ADB path?',
            'Set ADB Path',
            'Cancel'
          );
          
          if (result === 'Set ADB Path') {
            vscode.commands.executeCommand('airFlutter.setCustomADBPath');
          }
          
          throw new Error('ADB not found. Please install Android SDK or set a custom ADB path.');
        } else if (adbError instanceof Error && (adbError.message.includes('null') || adbError.message.includes('fingerprint'))) {
          // Show troubleshooting guide for device fingerprint issues
          this.showTroubleshootingGuide();
          throw new Error('ADB returned null value - Device fingerprint missing. Please follow the troubleshooting guide.');
        } else {
          throw adbError;
        }
      }
      
      console.log(`✅ FlutterPanelController: Device connection handled for ${ip}:${port}`);
      
      // Refresh device list to show actual connected devices
      await this.refreshConnectedDevices();
      
    } catch (error) {
      console.error(`❌ FlutterPanelController: Failed to handle connection for ${ip}:${port}:`, error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Show troubleshooting guide for specific ADB errors
      if (errorMessage.includes('ADB returned null value') || errorMessage.includes('fingerprint')) {
        this.showTroubleshootingGuide();
      }
      
      this.showErrorMessage(`Failed to connect: ${errorMessage}`);
      
      // Update webview with error message
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `❌ Failed to connect: ${errorMessage}`,
          type: 'error'
        });
      }
    }
  }

  private async handleFlutterCommand(commandId: string) {
    console.log(`⚡ FlutterPanelController: handleFlutterCommand called for command ID: ${commandId}`)
    
    try {
      let commandToExecute = '';
      let commandName = '';
      
      // Map command IDs to actual commands
      switch (commandId) {
        case 'runFlutterDoctor':
          commandToExecute = 'flutter doctor';
          commandName = 'Flutter Doctor';
          break;
        case 'getPackages':
          commandToExecute = 'flutter pub get';
          commandName = 'Get Packages';
          break;
        case 'upgradePackages':
          commandToExecute = 'flutter pub upgrade';
          commandName = 'Upgrade Packages';
          break;
        case 'cleanProject':
          commandToExecute = 'flutter clean';
          commandName = 'Clean Project';
          break;
        case 'runApp':
          commandToExecute = 'flutter run';
          commandName = 'Run Flutter App';
          break;
        case 'buildAPK':
          commandToExecute = 'flutter build apk';
          commandName = 'Build APK';
          break;
        case 'buildAAB':
          commandToExecute = 'flutter build appbundle';
          commandName = 'Build AAB';
          break;
        case 'installApk':
          await this.installApkToDevice();
          return;
        case 'sendText':
          await this.sendTextToDevice();
          return;
        default:
          console.log(`❌ FlutterPanelController: Unknown command ID: ${commandId}`)
          this.showErrorMessage(`Unknown command: ${commandId}`);
          return;
      }

      console.log(`🚀 FlutterPanelController: Executing command: ${commandName} (${commandToExecute})`)
      
      // First send a message to the webview that we're processing the command
      if (this.currentPanel) {
        console.log(`📤 FlutterPanelController: Sending processing message to webview`);
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `⏳ Processing command: ${commandName}`,
          type: 'info'
        });
      }
      
      // Run as a VS Code task so completion reflects the real process exit,
      // rather than merely confirming that text was sent to a terminal.
      try {
        await runVisibleTask(commandName, commandToExecute, this.getInitialProjectPath() || undefined);
        console.log(`✅ FlutterPanelController: Command completed: ${commandToExecute}`);
        this.showSuccessMessage(`Completed: ${commandName}`);
        
        // Update webview with success message
        if (this.currentPanel) {
          console.log(`📤 FlutterPanelController: Sending success message to webview`);
          this.currentPanel.webview.postMessage({
            command: 'addStatusMessage',
            message: `✅ Successfully completed: ${commandName}`,
            type: 'success'
          });
        }
      } catch (terminalError) {
        console.error(`❌ FlutterPanelController: Terminal error:`, terminalError);
        const errorMessage = terminalError instanceof Error ? terminalError.message : String(terminalError)
        throw new Error(`Failed to create terminal: ${errorMessage}`);
      }
    } catch (error) {
      console.error(`❌ FlutterPanelController: Failed to execute command ${commandId}:`, error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.showErrorMessage(`Failed to execute command: ${errorMessage}`);
      
      // Update webview with error message
      if (this.currentPanel) {
        console.log(`📤 FlutterPanelController: Sending error message to webview`);
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `❌ Failed to execute: ${errorMessage}`,
          type: 'error'
        });
      }
    }
  }

  private shouldTrackOperation(command: unknown): command is string {
    return typeof command === 'string' && ![
      'panelReady',
      'loadDeepLinkStudio',
      'getWorkflowInitialPath'
    ].includes(command);
  }

  private postOperationLoading(
    operationId: string,
    message: Record<string, unknown>,
    loading: boolean
  ): void {
    this.currentPanel?.webview.postMessage({
      command: 'operationLoading',
      operationId,
      operation: message.command,
      target: message.commandId,
      loading
    });
  }

  // Method removed - using direct terminal execution in handleFlutterCommand

  private async handleDisconnectDevice(deviceId: string) {
    console.log(`❌ FlutterPanelController: handleDisconnectDevice called for device: ${deviceId}`)
    
    try {
      await this.localhostBridge.cleanupDevice(deviceId);
      await this.deviceManager.disconnectDevice(deviceId);
      
      // Remove the device from our list
      this.connectedDevices = this.connectedDevices.filter(d => d.id !== deviceId);
      
      // Update the UI
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          command: 'updateDevices',
          devices: this.connectedDevices
        });
        
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `✅ Disconnected device: ${deviceId}`,
          type: 'success'
        });
      }

      console.log(`✅ FlutterPanelController: Successfully disconnected device: ${deviceId}`)
      this.showSuccessMessage(`Disconnected device: ${deviceId}`);
      
      // Refresh device list to show actual connected devices
      await this.refreshConnectedDevices();
    } catch (error) {
      console.error(`❌ FlutterPanelController: Failed to disconnect device:`, error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.showErrorMessage(`Failed to disconnect device: ${errorMessage}`);
      
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `❌ Failed to disconnect device: ${errorMessage}`,
          type: 'error'
        });
      }
    }
  }

  private async refreshConnectedDevices() {
    console.log('🔄 FlutterPanelController: refreshConnectedDevices called')

    try {
      const deviceList = await this.deviceManager.listDevices();
      const discoveredDevices = await this.getDiscoverableNetworkDevices();
      this.usbDevices = deviceList
        .filter(device => device.transport === 'usb')
        .map(device => this.toPanelDevice(device));
      this.connectedDevices = deviceList
        .filter(device => device.transport !== 'usb')
        .map(device => this.toPanelDevice(device));
      const connectedHosts = new Set(
        this.connectedDevices.map(device => device.id.split(':')[0])
      );
      this.networkDevices = discoveredDevices.filter(
        device => !connectedHosts.has(device.endpoint.split(':')[0])
      );

      console.log(
        `📱 FlutterPanelController: Found ${this.usbDevices.length} USB and ${this.connectedDevices.length} connected devices`
      );

      // Update the webview with current device list
      if (this.currentPanel) {
        console.log('📝 FlutterPanelController: Updating webview with device list...');
        this.currentPanel.webview.postMessage({
          command: 'updateDevices',
          devices: this.connectedDevices
        });
        this.currentPanel.webview.postMessage({
          command: 'updateUsbDevices',
          devices: this.usbDevices
        });
        this.currentPanel.webview.postMessage({
          command: 'updateNetworkDevices',
          devices: this.networkDevices
        });
      }

      const onlineDeviceIds = deviceList
        .filter(device => device.state === 'device')
        .map(device => device.id);
      await this.localhostBridge.refresh(onlineDeviceIds);
      this.pushLocalhostBridgeState();
      
      console.log('✅ FlutterPanelController: Device list refreshed successfully');
    } catch (error) {
      console.error('❌ FlutterPanelController: Failed to refresh devices:', error);
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.showErrorMessage(`Failed to refresh devices: ${errorMessage}`);
      
      // Fallback to empty device list
      this.connectedDevices = [];
      this.usbDevices = [];
      this.networkDevices = [];
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          command: 'updateDevices',
          devices: this.connectedDevices
        });
        this.currentPanel.webview.postMessage({
          command: 'updateUsbDevices',
          devices: this.usbDevices
        });
        this.currentPanel.webview.postMessage({
          command: 'updateNetworkDevices',
          devices: this.networkDevices
        });
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `⚠️ ${errorMessage}`,
          type: 'warning'
        });
      }
    }
  }

  private async getDiscoverableNetworkDevices(): Promise<NetworkDevice[]> {
    try {
      return await this.deviceManager.discoverNetworkDevices();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.postStatus(`⚠️ Network discovery unavailable: ${errorMessage}`, 'warning');
      return [];
    }
  }

  private async handleConnectUSBDevice(deviceId: string) {
    this.postStatus(`🔄 Enabling wireless ADB for ${deviceId}...`, 'info');

    try {
      const result = await this.deviceManager.connectUSBDevice(deviceId);
      await this.context.globalState.update(appStateKeys.lastUsedIP(), result.ipAddress);
      await this.context.globalState.update(appStateKeys.lastUsedPort(), result.port);
      this.postStatus(`✅ ${result.message}. You can unplug the USB cable.`, 'success');
      vscode.window.showInformationMessage(
        `${result.message}. You can unplug the USB cable now.`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.postStatus(`❌ Wireless connection failed: ${errorMessage}`, 'error');
      this.showErrorMessage(`Wireless connection failed: ${errorMessage}`);
    } finally {
      await this.refreshConnectedDevices();
    }
  }

  private async handleConnectNetworkDevice(endpoint: string) {
    this.postStatus(`🔄 Connecting to discovered device ${endpoint}...`, 'info');
    try {
      await this.deviceManager.connectNetworkDevice(endpoint);
      const [ipAddress, port] = endpoint.split(':');
      await this.context.globalState.update(appStateKeys.lastUsedIP(), ipAddress);
      await this.context.globalState.update(appStateKeys.lastUsedPort(), port);
      this.postStatus(`✅ Connected wirelessly to ${endpoint}.`, 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.postStatus(`❌ Network connection failed: ${errorMessage}`, 'error');
      this.showErrorMessage(`Network connection failed: ${errorMessage}`);
    } finally {
      await this.refreshConnectedDevices();
    }
  }

  private async handleMirrorDevice(
    deviceId: string,
    options: MirrorOptions = {}
  ) {
    const device = this.connectedDevices.find(item => item.id === deviceId);
    if (!device) {
      this.showErrorMessage('Refresh the device list and select an online device.');
      return;
    }
    if (device.status !== 'online') {
      this.showErrorMessage(`${device.name} is ${device.status}.`);
      return;
    }

    try {
      const adbPath = await this.deviceManager.getADBExecutable();
      if (options.wirelessDisplay) {
        await this.screenMirrorManager.startWirelessDisplay(device.id, device.name, adbPath, options);
        this.postStatus(
          `✅ Mirroring ${device.name} into a virtual display. The phone panel stays off.`,
          'success'
        );
      } else {
        // Pass the whole options object: audioRoute and performanceProfile are
        // part of the launch contract — dropping them silences the session.
        await this.screenMirrorManager.start(device.id, device.name, adbPath, options);

        if (options.hardwareKeyboard) {
          this.postStatus(
            `✅ Mirroring ${device.name} with keyboard & screen off. Switch languages with Alt+Shift. 💡 Press Alt+Shift+O in mirror window or click Stop Mirroring to turn screen on.`,
            'success'
          );
          const choice = await vscode.window.showInformationMessage(
            'The phone now sees a physical keyboard. If Arabic types the wrong letters, set the keyboard layout on the phone once.',
            'Open keyboard layout'
          );
          if (choice === 'Open keyboard layout') {
            await this.screenMirrorManager.configureHardwareKeyboardLayout(adbPath, device.id);
          }
        } else {
          this.postStatus(
            options.displayOff
              ? `✅ Mirroring ${device.name} with the phone screen off. 💡 Press Alt+Shift+O in mirror window or click Stop Mirroring to wake screen.`
              : `✅ Low-latency screen mirroring started for ${device.name}.`,
            'success'
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.postStatus(`❌ Screen mirroring failed: ${errorMessage}`, 'error');
      const selection = await vscode.window.showErrorMessage(
        `Screen mirroring failed: ${errorMessage}`,
        'Select scrcpy'
      );
      if (selection === 'Select scrcpy') {
        await this.setScrcpyPath();
      }
    }
  }

  private async selectDeviceToMirror(options: MirrorOptions = {}) {
    await this.refreshConnectedDevices();
    const onlineDevices = this.connectedDevices.filter(device => device.status === 'online');
    if (onlineDevices.length === 0) {
      vscode.window.showWarningMessage('No online wireless or emulator device was found.');
      return;
    }

    const selection = await vscode.window.showQuickPick(
      onlineDevices.map(device => ({
        label: `$(device-mobile) ${device.name}`,
        description: device.transport,
        detail: device.id,
        deviceId: device.id
      })),
      { placeHolder: 'Select a device to mirror', ignoreFocusOut: true }
    );

    if (selection) {
      await this.handleMirrorDevice(selection.deviceId, options);
    }
  }

  private async setScrcpyPath() {
    try {
      const selectedPath = await this.screenMirrorManager.selectScrcpyExecutable();
      if (selectedPath) {
        this.postStatus(`✅ scrcpy configured: ${selectedPath}`, 'success');
        vscode.window.showInformationMessage(`scrcpy configured: ${selectedPath}`);
      }
    } catch (error) {
      this.showErrorMessage(
        `Invalid scrcpy executable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private notifyMirroringState(state: MirroringState) {
    this.currentPanel?.webview.postMessage({
      command: 'mirroringState',
      ...state
    });
  }

  private publishMirroringState(serial?: string): void {
    const activeSerial = serial && this.screenMirrorManager.isMirroring(serial)
      ? serial
      : this.screenMirrorManager.getActiveDeviceSerial();
    const state: MirroringState = {
      isMirroring: this.screenMirrorManager.isMirroring(),
      displayOff: activeSerial
        ? this.screenMirrorManager.wasPhysicalDisplayTurnedOff(activeSerial)
        : false,
      serial: activeSerial
    };
    this.notifyMirroringState(state);
    this._onMirroringStateChanged.fire(state);
  }

  private async stopMirroring() {
    try {
      const mirroredSerial = this.screenMirrorManager.getActiveDeviceSerial();
      const stopped = await this.screenMirrorManager.stop();
      // Wake up phone screen if it was turned off during mirror
      const serial = mirroredSerial || this.getActiveDeviceSerial();
      if (serial) {
        try {
          const adbPath = await this.deviceManager.getADBExecutable();
          execFile(adbPath, ['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], { windowsHide: true }, () => {});
        } catch {
          // ignore
        }
      }

      this.publishMirroringState(mirroredSerial);
      if (stopped) {
        this.postStatus('⏹️ Screen mirroring stopped. Phone screen restored.', 'info');
        vscode.window.showInformationMessage('Screen mirroring stopped. Phone screen restored.');
      } else {
        this.postStatus('⏹️ Screen mirroring stopped.', 'info');
      }
    } catch (error) {
      this.showErrorMessage(error instanceof Error ? error.message : String(error));
      this.publishMirroringState();
    }
  }

  private async wakeDeviceScreen(deviceId?: string): Promise<string> {
    const targetSerial = deviceId || this.screenMirrorManager.getActiveDeviceSerial() || this.getActiveDeviceSerial();
    if (!targetSerial) {
      throw new Error('No online phone or active mirror session was found.');
    }
    if (!/^[A-Za-z0-9._:-]+$/.test(targetSerial)) {
      throw new Error('Invalid Android device serial.');
    }

    const adbPath = await this.deviceManager.getADBExecutable();
    const preferredScrcpyRestore = this.screenMirrorManager.wasPhysicalDisplayTurnedOff(targetSerial);
    if (preferredScrcpyRestore) {
      this.postStatus(`🔄 Waking ${targetSerial}…`, 'info');
    }
    const finalState = await this.screenPower.wakeDisplay(adbPath, targetSerial, {
      preferScrcpyRestore: preferredScrcpyRestore
    });

    if (finalState === 'on' || (finalState === 'unknown' && preferredScrcpyRestore)) {
      this.screenMirrorManager.markPhysicalDisplayOn(targetSerial);
      this.publishMirroringState(targetSerial);
      this.postStatus(
        finalState === 'on' ? `✅ Screen woken for ${targetSerial}` : `✅ Wake keys sent to ${targetSerial}`,
        'success'
      );
      return targetSerial;
    }

    this.publishMirroringState(targetSerial);
    throw new Error(
      finalState === 'off'
        ? `The display of ${targetSerial} is still off after the wake attempts. Stop mirroring once and start it again if it stays dark.`
        : `Could not read the display state of ${targetSerial}; check the phone.`
    );
  }

  private async toggleMirroredDisplay(requestedSerial?: string): Promise<MirroringState> {
    const serial = this.screenMirrorManager.getActiveDeviceSerial();
    if (!serial || !this.screenMirrorManager.isMirroring(serial)) {
      const awakenedSerial = await this.wakeDeviceScreen();
      return { isMirroring: false, displayOff: false, serial: awakenedSerial };
    }
    if (requestedSerial && requestedSerial !== serial) {
      throw new Error('The selected device is not the active mirroring session.');
    }

    const adbPath = await this.deviceManager.getADBExecutable();
    const actualState = await this.screenPower.getDisplayPowerState(adbPath, serial)
      .catch(() => 'unknown' as const);

    // Decide by the real device state; the remembered flag is only a fallback
    // for builds whose dumpsys cannot be parsed.
    let displayOff: boolean;
    if (actualState === 'off' || (actualState === 'unknown' && this.screenMirrorManager.wasPhysicalDisplayTurnedOff(serial))) {
      await this.wakeDeviceScreen(serial);
      displayOff = false;
    } else {
      displayOff = await this.turnDisplayOffForSession(adbPath, serial);
    }

    this.publishMirroringState(serial);
    this.postStatus(
      displayOff ? `✅ Physical display turned off for ${serial}` : `✅ Screen woken for ${serial}`,
      'success'
    );
    return { isMirroring: true, displayOff, serial };
  }

  /** Turns the panel off, verifying and falling back to scrcpy blanking. */
  private async turnDisplayOffForSession(adbPath: string, serial: string): Promise<boolean> {
    try {
      const state = await this.screenPower.turnPhysicalDisplayOffVerified(adbPath, serial);
      if (state === 'off') {
        this.screenMirrorManager.markPhysicalDisplayOff(serial);
        return true;
      }
      if (state === 'on') {
        // The display service ignored the request; let scrcpy blank the panel.
        await this.screenMirrorManager.restartWithPhysicalDisplayOff(serial);
        this.screenMirrorManager.markPhysicalDisplayOff(serial);
        return true;
      }
      // Unreadable state: trust the successful power-off exit code.
      this.screenMirrorManager.markPhysicalDisplayOff(serial);
      return true;
    } catch {
      // `cmd display` is missing or failed on this build.
      await this.screenMirrorManager.restartWithPhysicalDisplayOff(serial);
      this.screenMirrorManager.markPhysicalDisplayOff(serial);
      return true;
    }
  }

  private async installApkToDevice(deviceId?: string) {
    const targetSerial = deviceId || (this.connectedDevices.find(d => d.status === 'online')?.id);
    if (!targetSerial) {
      this.showErrorMessage('No online device connected.');
      return;
    }

    const files = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: 'Install APK to device',
      filters: { 'Android Package': ['apk'] }
    });

    if (!files || !files[0]) {
      return;
    }

    const apkPath = files[0].fsPath;
    const apkName = path.basename(apkPath);
    this.postStatus(`📦 Installing ${apkName} to device…`, 'info');

    try {
      const adbPath = await this.deviceManager.getADBExecutable();
      await new Promise<void>((resolve, reject) => {
        execFile(
          adbPath,
          ['-s', targetSerial, 'install', '-r', '-d', apkPath],
          { windowsHide: true, timeout: 180000 },
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(stderr || stdout || error.message));
            } else {
              resolve();
            }
          }
        );
      });
      this.postStatus(`✅ ${apkName} installed successfully!`, 'success');
      vscode.window.showInformationMessage(`✅ ${apkName} installed successfully!`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.postStatus(`❌ APK install failed: ${msg}`, 'error');
      vscode.window.showErrorMessage(`APK install failed: ${msg}`);
    }
  }

  private async sendTextToDevice(deviceId?: string) {
    const targetSerial = deviceId || (this.connectedDevices.find(d => d.status === 'online')?.id);
    if (!targetSerial) {
      this.showErrorMessage('No online device connected.');
      return;
    }

    const clipboardText = await vscode.env.clipboard.readText();
    const input = await vscode.window.showInputBox({
      prompt: 'Enter text to send to active field on phone (or press Enter to send clipboard)',
      value: clipboardText || '',
      placeHolder: 'Text to send to phone'
    });

    if (input === undefined) {
      return;
    }

    const textToSend = input || clipboardText;
    if (!textToSend) {
      this.showErrorMessage('No text provided.');
      return;
    }

    this.postStatus(`⌨️ Sending text to device…`, 'info');
    try {
      const escaped = textToSend
        .replace(/\\/g, '\\\\')
        .replace(/ /g, '%s')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/([&<>;|()$`*?~!=])/g, '\\$1');

      const adbPath = await this.deviceManager.getADBExecutable();
      await new Promise<void>((resolve, reject) => {
        execFile(
          adbPath,
          ['-s', targetSerial, 'shell', 'input', 'text', escaped],
          { windowsHide: true, timeout: 15000 },
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(stderr || stdout || error.message));
            } else {
              resolve();
            }
          }
        );
      });
      this.postStatus(`✅ Text sent to phone input!`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.postStatus(`❌ Failed to send text: ${msg}`, 'error');
      vscode.window.showErrorMessage(`Failed to send text: ${msg}`);
    }
  }

  private getInitialProjectPath(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      for (const folder of workspaceFolders) {
        if (fs.existsSync(path.join(folder.uri.fsPath, 'pubspec.yaml'))) {
          return folder.uri.fsPath;
        }
      }
      for (const folder of workspaceFolders) {
        const nested = this.findNestedFlutterProject(folder.uri.fsPath, 3);
        if (nested) {
          return nested;
        }
      }
      return workspaceFolders[0].uri.fsPath;
    }
    return '';
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

  // --- Workflow Handler Delegations ---
  private async openWorkflowModal() {
    return this.workflowHandler.openWorkflowModal();
  }

  private async selectWorkflowProject() {
    return this.workflowHandler.selectWorkflowProject();
  }

  private async handleGenerateWorkflow(options: WorkflowOptions) {
    return this.workflowHandler.handleGenerateWorkflow(options);
  }

  // --- Signing Key Handler Delegations ---
  private async openSigningKeyModal() {
    return this.signingKeyHandler.openSigningKeyModal();
  }

  private async selectSigningKeyProject() {
    return this.signingKeyHandler.selectSigningKeyProject();
  }

  private async createSigningKey(options: SigningKeyOptions) {
    return this.signingKeyHandler.createSigningKey(options);
  }

  // --- Agent Scaffold Handler Delegations ---
  private async openAgentScaffoldModal(targetPath?: string) {
    return this.agentHandler.openAgentScaffoldModal(targetPath);
  }

  private async selectAgentScaffoldProject() {
    return this.agentHandler.selectAgentScaffoldProject();
  }

  private async handleGenerateAgentScaffold(options: AgentScaffoldOptions) {
    return this.agentHandler.handleGenerateAgentScaffold(options);
  }

  // --- New Flutter Tools Delegations ---
  public async openStorageInspectorModal(packageId?: string) {
    return this.storageInspectorHandler.openModal(packageId);
  }

  public async openDebugOverlaysModal() {
    return this.debugOverlaysHandler.openModal();
  }

  public async openMockGpsModal() {
    return this.mockGpsHandler.openModal();
  }

  public async openApkSizeModal() {
    return this.apkSizeHandler.openModal();
  }

  public async openPubHealthModal() {
    return this.pubHealthHandler.openModal();
  }

  private async openMcpHubModal(workspaceRoot?: string) {
    return this.mcpHandler.openMcpHubModal(workspaceRoot || this.getInitialProjectPath());
  }

  // --- Compat Doctor Handler Delegations ---
  private async openCompatDoctorModal(targetPath?: string) {
    return this.compatHandler.openCompatDoctorModal(targetPath);
  }

  private async selectCompatProject() {
    return this.compatHandler.selectCompatProject();
  }

  private async handleRunCompatDoctorScan(projectPath?: string) {
    return this.compatHandler.handleRunCompatDoctorScan(projectPath);
  }

  private async handleApplyCompatUpgrades(projectPath?: string) {
    return this.compatHandler.handleApplyCompatUpgrades(projectPath);
  }

  private async handleApplyCustomStack(projectPath?: string, diffs?: StackDiffItem[]) {
    return this.compatHandler.handleApplyCustomStack(projectPath, diffs);
  }

  // --- Flavors Handler Delegations ---
  private async openFlavorsModal(projectPath?: string) {
    return this.flavorHandler.openFlavorsModal(projectPath);
  }

  private async selectFlavorsProject() {
    return this.flavorHandler.selectFlavorsProject();
  }

  private async handleDetectFlavors(projectPath?: string) {
    return this.flavorHandler.handleDetectFlavors(projectPath);
  }

  private async handleSetupFlavors(projectPath?: string, flavors?: string[]) {
    return this.flavorHandler.handleSetupFlavors(projectPath, flavors);
  }

  private async handleRunFlavor(projectPath?: string, flavor?: string, target?: string) {
    return this.flavorHandler.handleRunFlavor(projectPath, flavor, target);
  }

  private async handleBuildFlavorApk(projectPath?: string, flavor?: string, target?: string) {
    return this.flavorHandler.handleBuildFlavorApk(projectPath, flavor, target);
  }

  private async handleBuildAllFlavors(projectPath?: string, flavors?: string[]) {
    return this.flavorHandler.handleBuildAllFlavors(projectPath, flavors);
  }

  // --- Network / Proxy Handler Delegations ---
  private async openProxyModal() {
    return this.networkHandler.openProxyModal();
  }

  private async handleGetNetworkState() {
    return this.networkHandler.handleGetNetworkState();
  }

  private async handleSetProxy(host?: string, port?: string) {
    return this.networkHandler.handleSetProxy(host, port);
  }

  private async handleClearProxy() {
    return this.networkHandler.handleClearProxy();
  }

  private async handleSetPrivateDns(host?: string) {
    return this.networkHandler.handleSetPrivateDns(host);
  }

  private async handleClearPrivateDns() {
    return this.networkHandler.handleClearPrivateDns();
  }

  // --- App State Wiper Handler Delegations ---
  private async handleWipe(
    operation: WipeOperation,
    deviceId?: string,
    packageId?: string
  ) {
    return this.appStateHandler.handleWipeRequest(operation, deviceId, packageId);
  }

  private async openAppStateQuickPick(deviceId?: string) {
    await this.openFlutterPanel();
    return this.appStateHandler.openWipeQuickPick(deviceId);
  }

  private async pickAppPackage(deviceId?: string) {
    const serial = deviceId || this.getActiveDeviceSerial();
    if (!serial) {
      this.showErrorMessage('No online device connected.');
      return;
    }
    const packageId = await this.appStateHandler.pickPackageId(serial);
    if (packageId) {
      this.currentPanel?.webview.postMessage({
        command: 'appStatePackageSelected',
        deviceId: serial,
        packageId
      });
    } else {
      this.currentPanel?.webview.postMessage({
        command: 'appStateCancelled'
      });
    }
  }

  private getActiveDeviceSerial(): string | undefined {
    return this.connectedDevices.find(d => d.status === 'online')?.id ||
      this.usbDevices.find(d => d.status === 'online')?.id;
  }

  private getBridgeDevices(): Device[] {
    return [...this.connectedDevices, ...this.usbDevices].filter(device => device.status === 'online');
  }

  private pushLocalhostBridgeState(): void {
    this.currentPanel?.webview.postMessage({
      command: 'localhostBridgeState',
      devices: this.getBridgeDevices(),
      rules: this.localhostBridge.getRules()
    });
  }

  private async refreshLocalhostBridge(): Promise<void> {
    try {
      const deviceIds = this.getBridgeDevices().map(device => device.id);
      if (deviceIds.length > 0) {
        await this.localhostBridge.refresh(deviceIds);
      }
      this.pushLocalhostBridgeState();
    } catch (error) {
      this.reportLocalhostBridgeError('Could not inspect reverse ports', error);
    }
  }

  private async applyLocalhostBridge(deviceId: string, port: number): Promise<void> {
    try {
      this.requireBridgeDevice(deviceId);
      await this.localhostBridge.apply(deviceId, port);
      const message = `Localhost tcp:${port} is linked to ${deviceId}.`;
      this.postStatus(`✅ ${message}`, 'success');
      this.currentPanel?.webview.postMessage({ command: 'showToast', message, type: 'success' });
    } catch (error) {
      this.reportLocalhostBridgeError(`Could not link tcp:${port}`, error);
    }
  }

  private async removeLocalhostBridge(deviceId: string, port: number): Promise<void> {
    try {
      this.requireBridgeDevice(deviceId);
      await this.localhostBridge.remove(deviceId, port);
      const message = `Unlinked tcp:${port} from ${deviceId}.`;
      this.postStatus(`✅ ${message}`, 'success');
      this.currentPanel?.webview.postMessage({ command: 'showToast', message, type: 'success' });
    } catch (error) {
      this.reportLocalhostBridgeError(`Could not unlink tcp:${port}`, error);
    }
  }

  private async removeAllLocalhostBridges(deviceId: string): Promise<void> {
    try {
      this.requireBridgeDevice(deviceId);
      await this.localhostBridge.removeAll(deviceId);
      const message = `Removed all reverse ports from ${deviceId}.`;
      this.postStatus(`✅ ${message}`, 'success');
      this.currentPanel?.webview.postMessage({ command: 'showToast', message, type: 'success' });
    } catch (error) {
      this.reportLocalhostBridgeError('Could not remove reverse ports', error);
    }
  }

  private requireBridgeDevice(deviceId: string): void {
    if (!deviceId || !this.getBridgeDevices().some(device => device.id === deviceId)) {
      throw new Error('Select an online Android device and try again.');
    }
  }

  private reportLocalhostBridgeError(prefix: string, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `${prefix}: ${detail}`;
    this.postStatus(`❌ ${message}`, 'error');
    this.currentPanel?.webview.postMessage({ command: 'showToast', message, type: 'error' });
    vscode.window.showErrorMessage(message);
  }

  private notifyRecordingState(isRecording: boolean, duration: number) {
    this.currentPanel?.webview.postMessage({
      command: 'recordingState',
      isRecording,
      duration
    });
    this._onRecordingStateChanged.fire({ isRecording, duration });
  }

  private async toggleScreenRecording() {
    const adbPath = await this.deviceManager.getADBExecutable();

    if (this.screenRecorder.isRecording()) {
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = undefined;
      }
      this.postStatus('⏹️ Stopping screen recording & finalizing MP4...', 'info');

      try {
        const rootPath = this.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const outputDir = rootPath ? path.join(rootPath, 'screenshots') : path.join(process.cwd(), 'screenshots');

        const videoPath = await this.screenRecorder.stopRecording(adbPath, outputDir);

        this.notifyRecordingState(false, 0);

        this.postStatus(`🎬 Video saved: ${path.basename(videoPath)}`, 'success');
        const choice = await vscode.window.showInformationMessage(
          `🎬 Screen recording saved: ${path.basename(videoPath)}`,
          'Open Video'
        );
        if (choice === 'Open Video') {
          vscode.env.openExternal(vscode.Uri.file(videoPath));
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.showErrorMessage(`Failed to stop recording: ${msg}`);
        this.postStatus(`❌ Screen recording error: ${msg}`, 'error');
        this.notifyRecordingState(false, 0);
      }
    } else {
      let serial = this.getActiveDeviceSerial();
      if (!serial) {
        await this.refreshConnectedDevices();
        serial = this.getActiveDeviceSerial();
      }
      if (!serial) {
        this.showErrorMessage('No online device connected to record screen.');
        return;
      }

      try {
        await this.screenRecorder.startRecording(adbPath, serial);
        this.postStatus('🔴 Screen recording started...', 'info');

        this.notifyRecordingState(true, 0);

        if (this.recordingTimer) {
          clearInterval(this.recordingTimer);
        }
        this.recordingTimer = setInterval(() => {
          if (!this.screenRecorder.isRecording()) {
            if (this.recordingTimer) {
              clearInterval(this.recordingTimer);
              this.recordingTimer = undefined;
            }
            this.notifyRecordingState(false, 0);
            return;
          }
          const duration = this.screenRecorder.getDurationSeconds();
          this.notifyRecordingState(true, duration);
        }, 1000);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.showErrorMessage(`Failed to start recording: ${msg}`);
        this.postStatus(`❌ Screen recording error: ${msg}`, 'error');
      }
    }
  }

  private toPanelDevice(device: AndroidDevice): Device {
    return {
      id: device.id,
      name: device.name,
      status: device.state === 'device' ? 'online' : device.state,
      type: device.transport === 'emulator' ? 'emulator' : 'device',
      transport: device.transport
    };
  }

  private postStatus(message: string, type: 'info' | 'success' | 'warning' | 'error') {
    this.currentPanel?.webview.postMessage({
      command: 'addStatusMessage',
      message,
      type
    });
  }

  private async connectWirelessDevice() {
    console.log('📱 FlutterPanelController: connectWirelessDevice called')

    try {
      const devices = (await this.deviceManager.listDevices()).filter(
        device => device.transport === 'usb'
      );
      if (devices.length === 0) {
        vscode.window.showWarningMessage(
          'No USB phones found. Connect a phone, enable USB debugging, and authorize this computer.'
        );
        return;
      }

      const selectedDevice = await vscode.window.showQuickPick(
        devices.map(device => ({
          label: `$(device-mobile) ${device.name}`,
          description: device.state,
          detail: device.id,
          deviceId: device.id
        })),
        {
          ignoreFocusOut: true,
          placeHolder: 'Select the USB phone to connect wirelessly'
        }
      );

      if (selectedDevice) {
        await this.handleConnectUSBDevice(selectedDevice.deviceId);
      }
    } catch (error) {
      this.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  private async showConnectedDevices() {
    console.log('🔍 FlutterPanelController: showConnectedDevices called')
    await this.refreshConnectedDevices();
    vscode.window.showInformationMessage(`Found ${this.connectedDevices.length} connected devices`);
  }

  private async runFlutterApp() {
    console.log('🚀 FlutterPanelController: runFlutterApp called')
    await this.handleFlutterCommand('runApp');
  }
  
  private async runFlutterAppDirect() {
    console.log('🚀 FlutterPanelController: runFlutterAppDirect called')
    const terminal = vscode.window.createTerminal('Flutter Run');
    terminal.show();
    terminal.sendText('flutter run');
  }

  // Removed unused methods: buildFlutterApp, hotReload, hotRestart, stopApp

  private async cleanProject() {
    console.log('🧹 FlutterPanelController: cleanProject called')
    await this.handleFlutterCommand('cleanProject');
  }
  
  private async cleanProjectDirect() {
    console.log('🧹 FlutterPanelController: cleanProjectDirect called')
    const terminal = vscode.window.createTerminal('Flutter Clean');
    terminal.show();
    terminal.sendText('flutter clean');
  }

  private async flutterDoctor() {
    console.log('👨‍⚕️ FlutterPanelController: flutterDoctor called')
    await this.handleFlutterCommand('runFlutterDoctor');
  }
  
  private async flutterDoctorDirect() {
    console.log('👨‍⚕️ FlutterPanelController: flutterDoctorDirect called')
    const terminal = vscode.window.createTerminal('Flutter Doctor');
    terminal.show();
    terminal.sendText('flutter doctor');
  }

  private async getPackages() {
    console.log('📦 FlutterPanelController: getPackages called')
    await this.handleFlutterCommand('getPackages');
  }
  
  private async getPackagesDirect() {
    console.log('📦 FlutterPanelController: getPackagesDirect called')
    const terminal = vscode.window.createTerminal('Flutter Packages');
    terminal.show();
    terminal.sendText('flutter pub get');
  }

  private async upgradePackages() {
    console.log('⬆️ FlutterPanelController: upgradePackages called')
    await this.handleFlutterCommand('upgradePackages');
  }
  
  private async upgradePackagesDirect() {
    console.log('⬆️ FlutterPanelController: upgradePackagesDirect called')
    const terminal = vscode.window.createTerminal('Flutter Upgrade Packages');
    terminal.show();
    terminal.sendText('flutter pub upgrade');
  }

  private async buildAPK() {
    console.log('📱 FlutterPanelController: buildAPK called')
    await this.handleFlutterCommand('buildAPK');
  }
  
  private async buildAPKDirect() {
    console.log('📱 FlutterPanelController: buildAPKDirect called')
    const terminal = vscode.window.createTerminal('Flutter Build APK');
    terminal.show();
    terminal.sendText('flutter build apk');
  }

  private async buildAAB() {
    console.log('📦 FlutterPanelController: buildAAB called')
    await this.handleFlutterCommand('buildAppBundle');
  }
  
  private async buildAABDirect() {
    console.log('📦 FlutterPanelController: buildAABDirect called')
    const terminal = vscode.window.createTerminal('Flutter Build AAB');
    terminal.show();
    terminal.sendText('flutter build appbundle');
  }

  // Removed unused methods: analyzeProject, formatCode, injectResources, buildIOS, buildWeb, upgradeFlutterSDK

  private showSuccessMessage(message: string) {
    console.log(`✅ FlutterPanelController: Success message: ${message}`)
    vscode.window.showInformationMessage(message);
  }

  private showErrorMessage(message: string) {
    console.error(`❌ FlutterPanelController: Error message: ${message}`)
    vscode.window.showErrorMessage(message);
  }

  private async showTroubleshootingGuide() {
    console.log('🔧 FlutterPanelController: Showing troubleshooting guide');
    
    const troubleshootingPanel = vscode.window.createWebviewPanel(
      'airFlutterTroubleshooting',
      '🔧 Air Flutter - Device Setup Guide',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'screenshots'),
          vscode.Uri.joinPath(this.context.extensionUri, 'media')
        ]
      }
    );

    troubleshootingPanel.webview.html = this.getTroubleshootingContent(troubleshootingPanel);

    troubleshootingPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'backToPanel':
            troubleshootingPanel.dispose();
            if (this.currentPanel) {
              this.currentPanel.reveal();
            } else {
              this.openFlutterPanel();
            }
            break;
          case 'testConnection':
            troubleshootingPanel.dispose();
            await this.connectWirelessDevice();
            break;
        }
      }
    );
  }

  private getTroubleshootingContent(panel: vscode.WebviewPanel): string {
    return getTroubleshootingContent(this.context, panel);
  }

  private isFlutterProject(workspacePath: string): boolean {
    try {
      const pubspecPath = path.join(workspacePath, 'pubspec.yaml');
      return fs.existsSync(pubspecPath);
    } catch (error) {
      console.error('❌ FlutterPanelController: Error checking Flutter project:', error);
      return false;
    }
  }
}
