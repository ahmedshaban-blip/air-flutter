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
import { ScreenMirrorManager } from '../../domain/screen-mirror';
import { WorkflowGenerator, WorkflowOptions } from '../../domain/workflow-generator';
import { FlavorManager } from '../../domain/flavor-manager';
import { ScreenRecorder } from '../../domain/screen-recorder';
import { NetworkManager } from '../../domain/network-manager';
import { AgentScaffolder, AgentScaffoldOptions } from '../../domain/agent-scaffolder';
import { CompatibilityModule } from '../../features/compatibility';

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
  private screenMirrorManager: ScreenMirrorManager;
  private screenRecorder = new ScreenRecorder();
  private recordingTimer?: NodeJS.Timeout;
  private readonly extensionVersion: string;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    
    // Initialize ADB connection
    const consoleInterface = new ConsoleInterface();
    const netHelper = new NetHelpers();
    this.adbConnection = new ADBConnection(consoleInterface, context.globalState, netHelper);
    this.deviceManager = new AndroidDeviceManager(context.globalState);
    this.screenMirrorManager = new ScreenMirrorManager(context);
    this.extensionVersion = (context.extension.packageJSON.version as string) || 'unknown';
  }

  async onInit() {
    console.log('🚀 FlutterPanelController: Initializing commands...')
    
    // Only register essential commands - remove all others
    this.registerCommand('airFlutter.openFlutterPanel', () => this.openFlutterPanel())
      .registerCommand('airFlutter.connectWirelessDevice', () => this.connectWirelessDevice())
      .registerCommand('airFlutter.showConnectedDevices', () => this.showConnectedDevices())
      .registerCommand('airFlutter.showTroubleshootingGuide', () => this.showTroubleshootingGuide())
      .registerCommand('airFlutter.runFlutterDoctor', () => this.flutterDoctor())
      .registerCommand('airFlutter.getPackages', () => this.getPackages())
      .registerCommand('airFlutter.upgradePackages', () => this.upgradePackages())
      .registerCommand('airFlutter.cleanProject', () => this.cleanProject())
      .registerCommand('airFlutter.runFlutterApp', () => this.runFlutterApp())
      .registerCommand('airFlutter.buildAPK', () => this.buildAPK())
      .registerCommand('airFlutter.buildAppBundle', () => this.buildAAB())
      .registerCommand('airFlutter.startScreenMirroring', () => this.selectDeviceToMirror())
      .registerCommand('airFlutter.mirrorWithScreenOff', () => this.selectDeviceToMirror({ displayOff: true }))
      .registerCommand('airFlutter.mirrorWithKeyboard', () => this.selectDeviceToMirror({ displayOff: true, hardwareKeyboard: true }))
      .registerCommand('airFlutter.mirrorWirelessDisplay', () => this.selectDeviceToMirror({ wirelessDisplay: true }))
      .registerCommand('airFlutter.stopScreenMirroring', () => this.stopMirroring())
      .registerCommand('airFlutter.installApk', () => this.installApkToDevice())
      .registerCommand('airFlutter.sendTextToDevice', () => this.sendTextToDevice())
      .registerCommand('airFlutter.setScrcpyPath', () => this.setScrcpyPath())
      .registerCommand('airFlutter.generateWorkflow', () => this.openWorkflowModal())
      .registerCommand('airFlutter.openFlavorsModal', () => this.openFlavorsModal())
      .registerCommand('airFlutter.openProxyModal', () => this.openProxyModal())
      .registerCommand('airFlutter.toggleScreenRecording', () => this.toggleScreenRecording())
      .registerCommand('airFlutter.openAgentScaffoldingModal', () => this.openAgentScaffoldModal())
      .registerCommand('airFlutter.openCompatDoctorModal', () => this.openCompatDoctorModal())
    
    console.log('✅ FlutterPanelController: Essential commands registered successfully')
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
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
          vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview'),
          vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
        ],
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
        console.log('📨 FlutterPanelController: Received message:', message)
        
        try {
          switch (message.command) {
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
                wirelessDisplay: message.mode === 'virtual-display'
              });
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
            case 'disconnectDevice':
              console.log('❌ FlutterPanelController: Disconnecting device...')
              await this.handleDisconnectDevice(message.deviceId);
              break;
            case 'showTroubleshootingGuide':
              console.log('🔧 FlutterPanelController: Showing troubleshooting guide...')
              await this.showTroubleshootingGuide();
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
        }
      }
    );

    this.currentPanel.onDidDispose(() => {
      console.log('🗑️ FlutterPanelController: Panel disposed')
      this.currentPanel = undefined;
    });

    // Initial device refresh
    console.log('🔄 FlutterPanelController: Performing initial device refresh...')
    await this.refreshConnectedDevices();
    
    console.log('✅ FlutterPanelController: Panel opened successfully')
  }

  private getWebviewContent(panel: vscode.WebviewPanel): string {
    // Get the absolute path to the media directory
    const mediaPath = path.join(this.context.extensionPath, 'media');
    console.log(`📂 Media directory path: ${mediaPath}`);
    
    // Create URIs for the CSS and JS files
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'air-flutter.css')));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'air-flutter.js')));
    
    console.log(`🔗 Style URI: ${styleUri}`);
    console.log(`🔗 Script URI: ${scriptUri}`);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Air Flutter - Wireless Debug &amp; Run</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <link href="${styleUri}" rel="stylesheet">
    </head>
    <body>
        <div class="ff-shell">
            <header class="ff-masthead">
                <div class="ff-brand">
                    <svg class="ff-mark" viewBox="0 0 32 32" aria-hidden="true">
                        <rect x="0.75" y="0.75" width="30.5" height="30.5" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
                        <path d="M9 8.5 L17 16 L9 23.5" fill="none" stroke="var(--accent)" stroke-width="2.5"></path>
                        <path d="M17 8.5 L23 13 L17 17.5" fill="none" stroke="currentColor" stroke-width="1.5"></path>
                    </svg>
                    <div>
                        <div class="ff-wordmark">Air Flutter</div>
                        <div class="ff-tagline">Wireless debug &amp; run</div>
                    </div>
                </div>
                <div class="ff-masthead-actions">
                    <span class="ff-version" title="Running extension version">v${this.extensionVersion}</span>
                    <button class="btn btn-quiet" id="darkModeToggle" type="button" title="Toggle theme">
                        <i class="fas fa-moon"></i> Dark
                    </button>
                </div>
            </header>

            <div class="ff-grid">
                <!-- Devices -->
                <section class="ff-col" aria-label="Devices">
                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Devices</h2>
                            <button class="link-btn" id="refreshDevicesBtn" type="button">Refresh</button>
                        </div>

                        <div class="ff-group">
                            <div class="ff-subhead">
                                <h3>Over USB</h3>
                                <button class="icon-btn" id="refreshUsbDevicesBtn" type="button" title="Rescan USB" aria-label="Rescan USB">
                                    <i class="fas fa-rotate"></i>
                                </button>
                            </div>
                            <div class="devices-list" id="usbDevicesList">
                                <p class="empty"><i class="fas fa-usb"></i><span>No USB device attached</span></p>
                            </div>
                        </div>

                        <div class="ff-group">
                            <div class="ff-subhead">
                                <h3>On this network</h3>
                            </div>
                            <div class="devices-list" id="networkDevicesList">
                                <p class="empty"><i class="fas fa-wifi"></i><span>No device answered on port 5555</span></p>
                            </div>
                        </div>

                        <div class="ff-group">
                            <div class="ff-subhead">
                                <h3>Connected</h3>
                            </div>
                            <div class="devices-list" id="devicesList">
                                <p class="empty"><i class="fas fa-mobile-screen"></i><span>No device connected</span></p>
                            </div>
                        </div>

                        <div class="ff-group">
                            <div class="ff-subhead">
                                <h3>Mirroring</h3>
                            </div>
                            <button class="btn btn-quiet btn-block btn-danger-hover" id="stopMirrorBtn" type="button" onclick="airFlutter.stopMirroring()" title="Stop active screen mirroring session">
                                <i class="fas fa-stop"></i> Stop mirroring
                            </button>
                            <button class="btn btn-quiet btn-block" id="setScrcpyPathBtn" type="button">
                                <i class="fas fa-desktop"></i> Locate scrcpy
                            </button>
                            <button class="btn btn-quiet btn-block" type="button" onclick="showTroubleshootingGuide()">
                                <i class="fas fa-tools"></i> Device setup guide
                            </button>
                        </div>
                    </div>
                </section>

                <!-- Commands and activity -->
                <section class="ff-col" aria-label="Flutter commands">
                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Flutter commands</h2>
                            <span class="ff-section-note">workspace</span>
                        </div>
                        <div class="cmd-list" id="flutterCommandsGrid">
                            <button class="cmd" type="button" data-command="runApp" onclick="airFlutter.executeFlutterCommand('runApp')">
                                <i class="cmd-icon fas fa-play"></i>
                                <span><span class="cmd-label">Run app</span><span class="cmd-run">flutter run</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="runFlutterDoctor" onclick="airFlutter.executeFlutterCommand('runFlutterDoctor')">
                                <i class="cmd-icon fas fa-stethoscope"></i>
                                <span><span class="cmd-label">Flutter doctor</span><span class="cmd-run">flutter doctor</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="getPackages" onclick="airFlutter.executeFlutterCommand('getPackages')">
                                <i class="cmd-icon fas fa-download"></i>
                                <span><span class="cmd-label">Get packages</span><span class="cmd-run">flutter pub get</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="upgradePackages" onclick="airFlutter.executeFlutterCommand('upgradePackages')">
                                <i class="cmd-icon fas fa-arrow-up"></i>
                                <span><span class="cmd-label">Upgrade packages</span><span class="cmd-run">flutter pub upgrade</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="buildAPK" onclick="airFlutter.executeFlutterCommand('buildAPK')">
                                <i class="cmd-icon fas fa-box"></i>
                                <span><span class="cmd-label">Build APK</span><span class="cmd-run">flutter build apk</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="buildAAB" onclick="airFlutter.executeFlutterCommand('buildAAB')">
                                <i class="cmd-icon fas fa-cubes"></i>
                                <span><span class="cmd-label">Build app bundle</span><span class="cmd-run">flutter build appbundle</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="cleanProject" onclick="airFlutter.executeFlutterCommand('cleanProject')">
                                <i class="cmd-icon fas fa-broom"></i>
                                <span><span class="cmd-label">Clean project</span><span class="cmd-run">flutter clean</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="installApk" onclick="airFlutter.executeFlutterCommand('installApk')">
                                <i class="cmd-icon fas fa-file-arrow-up"></i>
                                <span><span class="cmd-label">Install APK</span><span class="cmd-run">adb install -r</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="sendText" onclick="airFlutter.executeFlutterCommand('sendText')">
                                <i class="cmd-icon fas fa-keyboard"></i>
                                <span><span class="cmd-label">Send text</span><span class="cmd-run">paste to phone</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="generateWorkflow" onclick="airFlutter.openWorkflowModal()">
                                <i class="cmd-icon fab fa-github"></i>
                                <span><span class="cmd-label">GitHub Workflow</span><span class="cmd-run">CI/CD APK Builder</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" id="screenRecordBtn" type="button" data-command="toggleRecording" onclick="airFlutter.toggleRecording()">
                                <i class="cmd-icon fas fa-video"></i>
                                <span><span class="cmd-label">Record Screen</span><span class="cmd-run">record phone MP4</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="flavorsModal" onclick="airFlutter.openFlavorsModal()">
                                <i class="cmd-icon fas fa-layer-group"></i>
                                <span><span class="cmd-label">Flutter Flavors</span><span class="cmd-run">manage, run &amp; build</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="proxyModal" onclick="airFlutter.openProxyModal()">
                                <i class="cmd-icon fas fa-network-wired"></i>
                                <span><span class="cmd-label">Proxy &amp; DNS</span><span class="cmd-run">network inspector</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="agentScaffoldModal" onclick="airFlutter.openAgentScaffoldModal()">
                                <i class="cmd-icon fas fa-robot"></i>
                                <span><span class="cmd-label">Agent Engine</span><span class="cmd-run">AI sub-agents &amp; teams</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                            <button class="cmd" type="button" data-command="compatDoctorModal" onclick="airFlutter.openCompatDoctorModal()">
                                <i class="cmd-icon fas fa-stethoscope"></i>
                                <span><span class="cmd-label">Compat Doctor</span><span class="cmd-run">Gradle, AGP, Java &amp; iOS</span></span>
                                <i class="cmd-go fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>

                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Activity</h2>
                            <button class="link-btn" id="clearStatusBtn" type="button">Clear log</button>
                        </div>
                        <div class="log" id="statusMessages" role="log" aria-live="polite">
                            <p class="log-empty">Waiting for the extension host…</p>
                        </div>
                    </div>
                </section>

                <!-- Quick actions -->
                <aside class="ff-col" aria-label="Quick actions">
                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Shortcuts</h2>
                        </div>
                        <div class="rail-list">
                            <button class="rail-item" type="button" onclick="airFlutter.executeFlutterCommand('runFlutterDoctor')">
                                <i class="fas fa-stethoscope"></i> Flutter doctor
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.executeFlutterCommand('getPackages')">
                                <i class="fas fa-download"></i> Get packages
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.executeFlutterCommand('upgradePackages')">
                                <i class="fas fa-arrow-up"></i> Upgrade packages
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.executeFlutterCommand('cleanProject')">
                                <i class="fas fa-broom"></i> Clean project
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.executeFlutterCommand('installApk')">
                                <i class="fas fa-file-arrow-up"></i> Install APK
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.executeFlutterCommand('sendText')">
                                <i class="fas fa-keyboard"></i> Send text to phone
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.openWorkflowModal()">
                                <i class="fab fa-github"></i> GitHub CI/CD Workflow
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.toggleRecording()">
                                <i class="fas fa-video"></i> Record Screen (MP4)
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.openFlavorsModal()">
                                <i class="fas fa-layer-group"></i> Manage Flavors
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.openProxyModal()">
                                <i class="fas fa-network-wired"></i> Network Proxy &amp; DNS
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.openAgentScaffoldModal()">
                                <i class="fas fa-robot"></i> AI Agent Architect
                            </button>
                            <button class="rail-item" type="button" onclick="airFlutter.openCompatDoctorModal()">
                                <i class="fas fa-stethoscope"></i> Compat Doctor
                            </button>
                        </div>
                    </div>

                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Keys</h2>
                        </div>
                        <div class="shortcut-row">
                            <span>Refresh devices</span>
                            <span><kbd>Ctrl</kbd> <kbd>R</kbd></span>
                        </div>
                    </div>

                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Mirroring</h2>
                        </div>
                        <p class="rail-note">
                            scrcpy ships with the extension. Streams start at H.264, 60 fps,
                            1600 px, 6 Mbps, audio off — all configurable from Air Flutter settings.
                        </p>
                    </div>
                </aside>
            </div>

            <footer class="ff-footer">
                <span>Built by <a href="https://www.linkedin.com/in/ahmed-shaban-front-cross" target="_blank" rel="noreferrer">Ahmed Shaban</a></span>
                <div class="ff-footer-links">
                    <a href="https://www.linkedin.com/in/ahmed-shaban-front-cross" target="_blank" rel="noreferrer"><i class="fab fa-linkedin"></i> LinkedIn</a>
                    <a href="https://ahmed-shaban-dev.vercel.app" target="_blank" rel="noreferrer"><i class="fas fa-globe"></i> Portfolio</a>
                </div>
            </footer>
        </div>

        <div class="toast-stack">
            <div id="successToast" class="toast is-success" role="status">
                <div class="toast-head">
                    <span>Success</span>
                    <button class="toast-close" type="button" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>
                </div>
                <div class="toast-body" id="successToastBody"></div>
            </div>
            <div id="errorToast" class="toast is-error" role="alert">
                <div class="toast-head">
                    <span>Error</span>
                    <button class="toast-close" type="button" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>
                </div>
                <div class="toast-body" id="errorToastBody"></div>
            </div>
        </div>

        <!-- GitHub Workflow Generator Modal -->
        <div class="modal-backdrop" id="workflowModal" hidden>
            <div class="modal-card">
                <div class="modal-head">
                    <h2><i class="fab fa-github"></i> GitHub Actions Workflow Builder</h2>
                    <button class="modal-close" id="closeWorkflowModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Project Path -->
                    <div class="modal-field">
                        <label>Target Flutter Project</label>
                        <div class="path-picker-row">
                            <input type="text" id="workflowProjectPathInput" placeholder="Select Flutter project folder..." />
                            <button class="btn btn-quiet" id="browseWorkflowProjectBtn" type="button">
                                <i class="fas fa-folder-open"></i> Browse
                            </button>
                        </div>
                        <span class="field-desc">Must contain a pubspec.yaml file</span>
                    </div>

                    <!-- Target Branch & Triggers -->
                    <div class="modal-field">
                        <label>Target Branch</label>
                        <input type="text" id="workflowBranchInput" value="main" placeholder="e.g. main, master, release/*" />
                    </div>

                    <div class="modal-field">
                        <label>Triggers</label>
                        <div class="modal-options-grid">
                            <label class="modal-option-card">
                                <input type="checkbox" id="workflowTriggerPush" checked />
                                <span>Push to branch</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="checkbox" id="workflowTriggerPr" />
                                <span>Pull Request</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="checkbox" id="workflowTriggerManual" checked />
                                <span>Manual Run (dispatch)</span>
                            </label>
                        </div>
                    </div>

                    <!-- Build Target -->
                    <div class="modal-field">
                        <label>Build Target</label>
                        <div class="modal-options-grid">
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildTarget" value="universal_apk" checked />
                                <span>Universal APK</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildTarget" value="split_apk" />
                                <span>Split-per-ABI APKs</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildTarget" value="appbundle" />
                                <span>App Bundle (AAB)</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildTarget" value="both" />
                                <span>Both (APK + AAB)</span>
                            </label>
                        </div>
                    </div>

                    <!-- Build Mode -->
                    <div class="modal-field">
                        <label>Build Mode</label>
                        <div class="modal-options-grid">
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildMode" value="release" checked />
                                <span>Release (Production)</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildMode" value="debug" />
                                <span>Debug (Testing)</span>
                            </label>
                        </div>
                    </div>

                    <!-- App Signing (Keystore) -->
                    <div class="modal-field">
                        <label class="modal-option-card" style="margin-top: 4px;">
                            <input type="checkbox" id="workflowEnableSigning" checked />
                            <strong>Configure App Signing (using GitHub Secrets)</strong>
                        </label>
                    </div>

                    <!-- Secrets Instructions Notice Box (shown when signing is enabled) -->
                    <div class="secrets-notice-box" id="workflowSecretsBox">
                        <h4><i class="fas fa-key"></i> Required GitHub Secrets for Signing:</h4>
                        <p style="margin: 0;">Add these 4 secrets in your GitHub Repo: <strong>Settings &gt; Secrets and variables &gt; Actions</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li><code>KEYSTORE_BASE64</code>: Base64 string of your <code>.jks</code> keystore.</li>
                            <li><code>KEYSTORE_PASSWORD</code>: Master keystore password.</li>
                            <li><code>KEY_ALIAS</code>: Key alias name (e.g. <code>upload</code>).</li>
                            <li><code>KEY_PASSWORD</code>: Private key password.</li>
                        </ul>
                        <div style="font-weight: 600; margin-top: 4px;">Convert Keystore to Base64 (Windows PowerShell):</div>
                        <div class="secrets-code-snippet">[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\\to\\your-key.jks")) | Set-Clipboard</div>
                        <span style="font-size: 11px; color: var(--muted);">A complete guide (<code>SECRETS_SETUP.md</code>) will be generated inside your <code>.github</code> folder automatically.</span>
                    </div>

                    <!-- Performance / Cache -->
                    <div class="modal-field">
                        <label class="modal-option-card">
                            <input type="checkbox" id="workflowEnableCache" checked />
                            <span>Enable Dependency Caching (Gradle &amp; Flutter Pub)</span>
                        </label>
                    </div>
                </div>
                <div class="modal-foot">
                    <button class="btn btn-quiet" id="cancelWorkflowModalBtn" type="button">Cancel</button>
                    <button class="btn btn-primary" id="generateWorkflowSubmitBtn" type="button">
                        <i class="fas fa-magic"></i> Generate Workflow
                    </button>
                </div>
            </div>
        </div>

        <!-- Flutter Flavors Modal -->
        <div class="modal-backdrop" id="flavorsModal" hidden>
            <div class="modal-card">
                <div class="modal-head">
                    <h2><i class="fas fa-layer-group"></i> Flutter Flavors Manager</h2>
                    <button class="modal-close" id="closeFlavorsModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="modal-field">
                        <label>Target Flutter Project</label>
                        <div class="path-picker-row">
                            <input type="text" id="flavorsProjectPathInput" placeholder="Select Flutter project folder..." />
                            <button class="btn btn-quiet" id="browseFlavorsProjectBtn" type="button">
                                <i class="fas fa-folder-open"></i> Browse
                            </button>
                        </div>
                        <span class="field-desc">Choose current or external Flutter project with pubspec.yaml</span>
                    </div>

                    <div class="modal-field">
                        <label>Flavors</label>
                        <div id="flavorsListContainer" style="display: flex; flex-direction: column; gap: 8px;"></div>
                    </div>

                    <div id="flavorsEmptyState" class="secrets-notice-box" hidden>
                        <h4><i class="fas fa-info-circle"></i> No Flavors Configured</h4>
                        <p style="margin: 0 0 10px 0;">This project does not have productFlavors defined in android/app/build.gradle.</p>
                        <button class="btn btn-primary" id="setupFlavorsBtn" type="button">
                            <i class="fas fa-wand-magic-sparkles"></i> Setup Flavors (dev, staging, prod)
                        </button>
                    </div>
                </div>
                <div class="modal-foot">
                    <button class="btn btn-quiet" id="cancelFlavorsModalBtn" type="button">Cancel</button>
                    <div id="flavorsActionsRow" style="display: flex; gap: 8px;">
                        <button class="btn btn-quiet" id="runFlavorBtn" type="button">
                            <i class="fas fa-play"></i> Run
                        </button>
                        <button class="btn btn-primary" id="buildFlavorApkBtn" type="button">
                            <i class="fas fa-box"></i> Build APK
                        </button>
                        <button class="btn btn-primary" id="buildAllFlavorsBtn" type="button">
                            <i class="fas fa-boxes-stacked"></i> Build All Flavors
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Network Proxy & Private DNS Modal -->
        <div class="modal-backdrop" id="proxyModal" hidden>
            <div class="modal-card">
                <div class="modal-head">
                    <h2><i class="fas fa-network-wired"></i> Network Proxy &amp; Private DNS</h2>
                    <button class="modal-close" id="closeProxyModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="modal-field" style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px;">
                        <div><span style="font-size: 11px; color: var(--muted); display: block;">HTTP Proxy:</span> <span id="currentProxyBadge" class="status-badge is-disabled">Disabled</span></div>
                        <div><span style="font-size: 11px; color: var(--muted); display: block;">Private DNS:</span> <span id="currentDnsBadge" class="status-badge is-disabled">Default (Off)</span></div>
                        <button class="btn btn-quiet" id="refreshNetworkBtn" type="button" style="margin-left: auto;">
                            <i class="fas fa-rotate"></i> Refresh
                        </button>
                    </div>

                    <div class="modal-field">
                        <label><i class="fas fa-shield-halved"></i> HTTP Proxy Configuration</label>
                        <div class="path-picker-row">
                            <input type="text" id="proxyHostInput" placeholder="Proxy IP (e.g. 192.168.1.15)" style="flex: 2;" />
                            <input type="text" id="proxyPortInput" placeholder="Port" value="8888" style="flex: 1;" />
                        </div>
                        <div class="preset-pill-group" style="margin-top: 6px;">
                            <span style="font-size: 11px; color: var(--muted); margin-right: 4px;">Presets:</span>
                            <button class="preset-pill port-preset-btn" type="button" data-port="8888">Charles (8888)</button>
                            <button class="preset-pill port-preset-btn" type="button" data-port="9090">Proxyman (9090)</button>
                            <button class="preset-pill port-preset-btn" type="button" data-port="8866">Fiddler (8866)</button>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button class="btn btn-primary" id="applyProxyBtn" type="button"><i class="fas fa-check"></i> Set Proxy</button>
                            <button class="btn btn-quiet" id="clearProxyBtn" type="button"><i class="fas fa-times"></i> Clear Proxy</button>
                        </div>
                    </div>

                    <div class="modal-field" style="margin-top: 20px;">
                        <label><i class="fas fa-globe"></i> Android Private DNS (DNS-over-TLS)</label>
                        <div class="path-picker-row">
                            <input type="text" id="dnsHostInput" placeholder="DNS Hostname (e.g. dns.google)" />
                        </div>
                        <div class="preset-pill-group" style="margin-top: 6px;">
                            <span style="font-size: 11px; color: var(--muted); margin-right: 4px;">Presets:</span>
                            <button class="preset-pill dns-preset-btn" type="button" data-dns="dns.google">Google</button>
                            <button class="preset-pill dns-preset-btn" type="button" data-dns="1dot1dot1dot1.cloudflare-dns.com">Cloudflare</button>
                            <button class="preset-pill dns-preset-btn" type="button" data-dns="dns.adguard-dns.com">AdGuard</button>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button class="btn btn-primary" id="applyDnsBtn" type="button"><i class="fas fa-check"></i> Set Private DNS</button>
                            <button class="btn btn-quiet" id="clearDnsBtn" type="button"><i class="fas fa-times"></i> Turn Off DNS</button>
                        </div>
                    </div>
                </div>
                <div class="modal-foot">
                    <button class="btn btn-quiet" id="cancelProxyModalBtn" type="button">Close</button>
                </div>
            </div>
        </div>

        <!-- AI Agent Architect & Scaffolding Stepper Modal -->
        <div class="modal-backdrop" id="agentScaffoldModal" hidden>
            <div class="modal-card" style="max-width: 680px;">
                <div class="modal-head">
                    <h2><i class="fas fa-robot"></i> AI Agent Architect &amp; Scaffolding Engine</h2>
                    <button class="modal-close" id="closeAgentScaffoldModalBtn" type="button" aria-label="Close">&times;</button>
                </div>

                <!-- Stepper Progress Bar -->
                <div class="stepper-header">
                    <div class="stepper-step is-active" data-step="1">
                        <span class="stepper-number">1</span>
                        <span class="stepper-title">Scope</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="2">
                        <span class="stepper-number">2</span>
                        <span class="stepper-title">Role</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="3">
                        <span class="stepper-number">3</span>
                        <span class="stepper-title">Framework</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="4">
                        <span class="stepper-number">4</span>
                        <span class="stepper-title">Tools</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="5">
                        <span class="stepper-number">5</span>
                        <span class="stepper-title">Mode</span>
                    </div>
                </div>

                <div class="modal-body" style="padding-top: 4px;">
                    <!-- STEP 1: Target Location & Scope -->
                    <div class="stepper-pane is-active" data-step="1">
                        <div class="modal-field">
                            <label>Target Location &amp; Scope</label>
                            <span class="field-desc">Where should the agent specifications be scaffolded?</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldLocation" value="workspace" checked />
                                    <span><strong>Current Project Workspace</strong> (Scaffold into <code>./.agents/agents/</code> in the active project)</span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldLocation" value="external" />
                                    <span><strong>External Project Directory</strong> (Specify an absolute path to another project on your machine)</span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldLocation" value="global" />
                                    <span><strong>Global Machine Scope</strong> (Scaffold into <code>~/.gemini/config/agents/</code> for system-wide Antigravity discovery)</span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldLocation" value="custom" />
                                    <span><strong>Custom Target Directory Path</strong></span>
                                </label>
                            </div>
                        </div>

                        <div class="modal-field" id="scaffoldExternalPathRow" hidden>
                            <label>Directory Path</label>
                            <div class="path-picker-row">
                                <input type="text" id="scaffoldExternalPathInput" placeholder="e.g. C:\Projects\MyProject or D:\Workspace" />
                                <button class="btn btn-quiet" id="browseScaffoldProjectBtn" type="button">
                                    <i class="fas fa-folder-open"></i> Browse
                                </button>
                            </div>
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" id="cancelAgentScaffoldModalBtn" type="button">Cancel</button>
                            <button class="btn btn-primary" type="button" data-stepper-next>
                                Next: Role Archetype <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>

                    <!-- STEP 2: Generation Mode & Role Archetype -->
                    <div class="stepper-pane" data-step="2">
                        <div class="modal-field">
                            <label>Generation Mode</label>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldGenMode" value="single" checked />
                                    <span><strong>Single Sub-Agent</strong><br/><span style="font-size: 11px; color: var(--muted);">Scaffold a single specialized agent file</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldGenMode" value="team" />
                                    <span><strong>Multi-Agent Team Workflow</strong><br/><span style="font-size: 11px; color: var(--muted);">Scaffold full SDLC team + Orchestrator</span></span>
                                </label>
                            </div>
                        </div>

                        <!-- Single Role Picker -->
                        <div id="singleRolePickerContainer" class="modal-field">
                            <label>Agent Role &amp; Archetype</label>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="planner" checked />
                                    <span><strong>Planner / Business Analyst</strong><br/><span style="font-size: 11px; color: var(--muted);">PRDs, scopes, task breakdown</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="architect" />
                                    <span><strong>Architect / System Designer</strong><br/><span style="font-size: 11px; color: var(--muted);">DB schemas, API contracts, seams</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="developer" />
                                    <span><strong>Developer / Implementer</strong><br/><span style="font-size: 11px; color: var(--muted);">Fullstack &amp; core coding</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="qa" />
                                    <span><strong>QA / Tester &amp; Reviewer</strong><br/><span style="font-size: 11px; color: var(--muted);">Tests, diff audits, edge cases</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="flutter_ui" />
                                    <span><strong>Flutter UI / Widget Specialist</strong><br/><span style="font-size: 11px; color: var(--muted);">Responsive widgets &amp; RTL</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="flutter_state" />
                                    <span><strong>Flutter Architecture &amp; Bloc</strong><br/><span style="font-size: 11px; color: var(--muted);">Clean Arch, Cubit &amp; state flow</span></span>
                                </label>
                                <label class="modal-option-card" style="grid-column: 1 / -1;">
                                    <input type="radio" name="scaffoldRole" value="custom" />
                                    <span><strong>Custom Role</strong><br/><span style="font-size: 11px; color: var(--muted);">Define custom job title and responsibilities</span></span>
                                </label>
                            </div>

                            <div id="customRoleRow" class="modal-field" style="margin-top: 10px;" hidden>
                                <input type="text" id="customRoleNameInput" placeholder="Agent Job Title (e.g. Security Auditor Agent)" style="margin-bottom: 6px;" />
                                <input type="text" id="customRoleDescInput" placeholder="Short description of core duties..." />
                            </div>
                        </div>

                        <!-- Team Mode Multi-Role Checklist -->
                        <div id="teamRolePickerContainer" class="modal-field" hidden>
                            <label><i class="fas fa-users-gear"></i> Select Team Roles (Choose 2 or more to build your workflow chain)</label>
                            <span class="field-desc">The orchestrator will automatically chain the selected agents in sequence:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px;">
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="planner" checked />
                                    <span><strong>Planner / Business Analyst</strong><br/><span style="font-size: 11px; color: var(--muted);">PRDs &amp; task breakdown</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="architect" checked />
                                    <span><strong>Architect / System Designer</strong><br/><span style="font-size: 11px; color: var(--muted);">Schemas &amp; contracts</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="developer" checked />
                                    <span><strong>Developer / Implementer</strong><br/><span style="font-size: 11px; color: var(--muted);">Source implementation</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="qa" checked />
                                    <span><strong>QA / Tester &amp; Reviewer</strong><br/><span style="font-size: 11px; color: var(--muted);">Tests &amp; diff audit</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="flutter_ui" />
                                    <span><strong>Flutter UI Specialist</strong><br/><span style="font-size: 11px; color: var(--muted);">Widgets, layouts &amp; RTL</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="flutter_state" />
                                    <span><strong>Flutter Architecture &amp; Bloc</strong><br/><span style="font-size: 11px; color: var(--muted);">Clean Arch &amp; Cubit flow</span></span>
                                </label>
                                <label class="modal-option-card" style="grid-column: 1 / -1;">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="custom" id="scaffoldTeamCustomCheckbox" />
                                    <span><strong>Custom Role Member</strong><br/><span style="font-size: 11px; color: var(--muted);">Include a custom-defined role in the workflow</span></span>
                                </label>
                            </div>

                            <div id="customTeamRoleRow" class="modal-field" style="margin-top: 10px;" hidden>
                                <input type="text" id="customTeamRoleNameInput" placeholder="Custom Agent Job Title (e.g. Security Auditor)" style="margin-bottom: 6px;" />
                                <input type="text" id="customTeamRoleDescInput" placeholder="Core duties of this custom agent..." />
                            </div>
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" type="button" data-stepper-back><i class="fas fa-arrow-left"></i> Back</button>
                            <button class="btn btn-primary" type="button" data-stepper-next>Next: Framework <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 3: Target Framework -->
                    <div class="stepper-pane" data-step="3">
                        <div class="modal-field">
                            <label>Target Agent Framework</label>
                            <span class="field-desc">Select orchestrator format compatibility:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldFramework" value="antigravity" checked />
                                    <span><strong>Antigravity Markdown (.agent.md)</strong> [Default]<br/><span style="font-size: 11px; color: var(--muted);">Directly compatible with Antigravity CLI, IDE Subagents, and AI coding assistants</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldFramework" value="herdr" />
                                    <span><strong>Herdr Framework (YAML &amp; Sequential Pipeline)</strong><br/><span style="font-size: 11px; color: var(--muted);">Includes <code>herdr.yaml</code> orchestration file with handoff stages</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldFramework" value="crewai" />
                                    <span><strong>CrewAI (Python Agents &amp; Sequential Process)</strong><br/><span style="font-size: 11px; color: var(--muted);">Generates runnable <code>crew.py</code> with Agent, Task, and Process definitions</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldFramework" value="generic" />
                                    <span><strong>Generic Custom Agent Loop</strong><br/><span style="font-size: 11px; color: var(--muted);">Standardized markdown specifications for custom autonomous agent loops</span></span>
                                </label>
                            </div>
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" type="button" data-stepper-back><i class="fas fa-arrow-left"></i> Back</button>
                            <button class="btn btn-primary" type="button" data-stepper-next>Next: Tool Permissions <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 4: Toolset & Access Permissions -->
                    <div class="stepper-pane" data-step="4">
                        <div class="modal-field">
                            <label>Toolset &amp; Access Permissions</label>
                            <span class="field-desc">Define what tools the generated agent is permitted to execute:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldToolLevel" value="read_only" />
                                    <span><strong>Read-Only / Analysis</strong><br/><span style="font-size: 11px; color: var(--muted);"><code>read_file</code>, <code>list_dir</code>, <code>web_search</code> (Zero file write permissions)</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldToolLevel" value="standard" checked />
                                    <span><strong>Standard Engineering</strong><br/><span style="font-size: 11px; color: var(--muted);"><code>read_file</code>, <code>write_file</code>, <code>replace_file_content</code>, <code>run_tests</code></span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldToolLevel" value="full" />
                                    <span><strong>Full Orchestration &amp; Terminal</strong><br/><span style="font-size: 11px; color: var(--muted);">Full file I/O + Shell command execution (<code>execute_command</code>, <code>git_operations</code>)</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldToolLevel" value="custom" />
                                    <span><strong>Custom Tool Definition</strong><br/><span style="font-size: 11px; color: var(--muted);">Specify exact comma-separated list of tool names</span></span>
                                </label>
                            </div>
                        </div>

                        <div id="customToolsRow" class="modal-field" style="margin-top: 8px;" hidden>
                            <label>Comma-separated Tool Names</label>
                            <input type="text" id="customToolsInput" placeholder="e.g. read_file, write_file, flutter_analyze, adb_run" />
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" type="button" data-stepper-back><i class="fas fa-arrow-left"></i> Back</button>
                            <button class="btn btn-primary" type="button" data-stepper-next>Next: Content Mode <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 5: Content Scaffolding Mode -->
                    <div class="stepper-pane" data-step="5">
                        <div class="modal-field">
                            <label>Content Scaffolding Mode</label>
                            <span class="field-desc">Choose how the files should be populated:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldContentMode" value="fully_populated" checked />
                                    <span><strong>Fully Populated</strong><br/><span style="font-size: 11px; color: var(--muted);">Generate complete, production-ready markdown specs with full system prompts, operational loop, handoff phases, and quality gates.</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldContentMode" value="blank_template" />
                                    <span><strong>Blank Template with Fill Prompts</strong><br/><span style="font-size: 11px; color: var(--muted);">Generate skeletal markdown structures with an embedded, ready-to-execute prompt for an LLM to populate based on project PRD.</span></span>
                                </label>
                            </div>
                        </div>

                        <div class="secrets-notice-box" style="margin-top: 14px;">
                            <h4><i class="fas fa-shield-halved"></i> Non-Destructive Scaffolding</h4>
                            <p style="margin: 0;">Existing files in the destination directory will be safely preserved and merged.</p>
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" type="button" data-stepper-back><i class="fas fa-arrow-left"></i> Back</button>
                            <button class="btn btn-primary" id="scaffoldSubmitBtn" type="button">
                                <i class="fas fa-robot"></i> Generate Agent(s)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Flutter Compatibility Doctor & Auto-Fixer Modal -->
        <div class="modal-backdrop" id="compatDoctorModal" hidden>
            <div class="modal-card" style="max-width: 720px;">
                <div class="modal-head">
                    <h2><i class="fas fa-stethoscope"></i> Flutter Compatibility Doctor &amp; Auto-Fixer</h2>
                    <button class="modal-close" id="closeCompatDoctorModalBtn" type="button" aria-label="Close">&times;</button>
                </div>

                <div class="modal-body" style="padding-top: 8px;">
                    <!-- Project Selector Header -->
                    <div class="modal-field" style="margin-bottom: 12px;">
                        <label>Active Project Path</label>
                        <div class="custom-path-row" style="display: flex; gap: 8px; margin-top: 4px;">
                            <input type="text" id="compatProjectPathInput" class="modal-input" placeholder="Select a Flutter project..." readonly style="flex: 1;" />
                            <button class="btn btn-secondary" id="browseCompatProjectBtn" type="button">
                                <i class="fas fa-folder-open"></i> Browse
                            </button>
                            <button class="btn btn-primary" id="reScanCompatDoctorBtn" type="button">
                                <i class="fas fa-sync-alt"></i> Re-scan
                            </button>
                        </div>
                    </div>

                    <!-- Loading / Spinner State -->
                    <div id="compatDoctorLoading" style="display: none; text-align: center; padding: 32px 0;">
                        <i class="fas fa-circle-notch fa-spin fa-2x" style="color: var(--primary);"></i>
                        <p style="margin-top: 12px; font-weight: 500;">Inspecting Gradle, AGP, Java runtime &amp; iOS deployment target...</p>
                    </div>

                    <!-- Content State -->
                    <div id="compatDoctorContent">
                        <!-- Overview Cards Grid -->
                        <div class="compat-cards-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;">
                            <div class="compat-status-card" id="compatCardGradle">
                                <div class="compat-card-title"><i class="fas fa-cubes"></i> Gradle Wrapper</div>
                                <div class="compat-card-value" id="compatValGradle">-</div>
                                <div class="compat-card-sub" id="compatSubGradle">Checking...</div>
                            </div>
                            <div class="compat-status-card" id="compatCardAgp">
                                <div class="compat-card-title"><i class="fab fa-android"></i> Android Gradle Plugin</div>
                                <div class="compat-card-value" id="compatValAgp">-</div>
                                <div class="compat-card-sub" id="compatSubAgp">Checking...</div>
                            </div>
                            <div class="compat-status-card" id="compatCardJava">
                                <div class="compat-card-title"><i class="fab fa-java"></i> Java Runtime (JDK)</div>
                                <div class="compat-card-value" id="compatValJava">-</div>
                                <div class="compat-card-sub" id="compatSubJava">Checking...</div>
                            </div>
                            <div class="compat-status-card" id="compatCardIos">
                                <div class="compat-card-title"><i class="fab fa-apple"></i> iOS Target (Podfile)</div>
                                <div class="compat-card-value" id="compatValIos">-</div>
                                <div class="compat-card-sub" id="compatSubIos">Checking...</div>
                            </div>
                        </div>

                        <!-- Issues & Recommendations List -->
                        <div class="modal-field">
                            <label><i class="fas fa-clipboard-check"></i> Diagnostic Findings &amp; Upgrades</label>
                            <div id="compatIssuesContainer" style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto;">
                                <!-- Dynamic issue items injected here -->
                            </div>
                        </div>

                        <!-- Recommended Stack Banner -->
                        <div class="secrets-notice-box" id="compatTargetNotice" style="margin-top: 14px;">
                            <h4><i class="fas fa-shield-alt"></i> Verified Stable Baseline</h4>
                            <p id="compatTargetText" style="margin: 0;">AGP 8.5.2 | Gradle 8.7 | JDK 17 | iOS 13.0+</p>
                        </div>
                    </div>

                    <div class="modal-foot" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;">
                        <button class="btn btn-quiet" id="cancelCompatDoctorBtn" type="button">Close</button>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary" id="openCompatOutputBtn" type="button">
                                <i class="fas fa-terminal"></i> View Detailed Log
                            </button>
                            <button class="btn btn-primary" id="autoUpgradeStackBtn" type="button" disabled>
                                <i class="fas fa-wrench"></i> Upgrade Stack (Auto-Fix)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            window.addEventListener('DOMContentLoaded', () => {
                document.body.classList.add('js-loaded');

                if (typeof acquireVsCodeApi !== 'undefined') {
                    window.vscode = acquireVsCodeApi();
                } else {
                    document.body.classList.add('no-vscode-api');
                }

                window.airFlutter = {
                    executeFlutterCommand: function (commandId) {
                        if (window.vscode) {
                            window.vscode.postMessage({
                                command: 'runFlutterCommand',
                                commandId: commandId
                            });
                        }
                    },
                    stopMirroring: function () {
                        if (window.vscode) {
                            window.vscode.postMessage({ command: 'stopMirroring' });
                        }
                    },
                    openWorkflowModal: function () {
                        if (typeof airFlutter !== 'undefined' && airFlutter.openWorkflowModal) {
                            airFlutter.openWorkflowModal();
                        } else if (window.vscode) {
                            window.vscode.postMessage({ command: 'openWorkflowModal' });
                        }
                    },
                    openFlavorsModal: function () {
                        if (typeof airFlutter !== 'undefined' && airFlutter.openFlavorsModal) {
                            airFlutter.openFlavorsModal();
                        } else if (window.vscode) {
                            window.vscode.postMessage({ command: 'openFlavorsModal' });
                        }
                    },
                    openProxyModal: function () {
                        if (typeof airFlutter !== 'undefined' && airFlutter.openProxyModal) {
                            airFlutter.openProxyModal();
                        } else if (window.vscode) {
                            window.vscode.postMessage({ command: 'openProxyModal' });
                        }
                    },
                    toggleRecording: function () {
                        if (window.vscode) {
                            window.vscode.postMessage({ command: 'toggleScreenRecording' });
                        }
                    },
                    openAgentScaffoldModal: function () {
                        if (typeof airFlutter !== 'undefined' && airFlutter.openAgentScaffoldModal) {
                            airFlutter.openAgentScaffoldModal();
                        } else if (window.vscode) {
                            window.vscode.postMessage({ command: 'openAgentScaffoldModal' });
                        }
                    },
                    openCompatDoctorModal: function () {
                        if (typeof airFlutter !== 'undefined' && airFlutter.openCompatDoctorModal) {
                            airFlutter.openCompatDoctorModal();
                        } else if (window.vscode) {
                            window.vscode.postMessage({ command: 'openCompatDoctorModal' });
                        }
                    }
                };

                window.showTroubleshootingGuide = function () {
                    if (window.vscode) {
                        window.vscode.postMessage({ command: 'showTroubleshootingGuide' });
                    }
                };

                const darkModeToggle = document.getElementById('darkModeToggle');
                if (darkModeToggle) {
                    const isDarkMode = localStorage.getItem('airFlutterDarkMode') === 'true';
                    if (isDarkMode) {
                        document.body.classList.add('dark-mode');
                        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i> Light';
                    }

                    darkModeToggle.addEventListener('click', function () {
                        document.body.classList.toggle('dark-mode');
                        const isDark = document.body.classList.contains('dark-mode');
                        localStorage.setItem('airFlutterDarkMode', isDark);
                        this.innerHTML = isDark
                            ? '<i class="fas fa-sun"></i> Light'
                            : '<i class="fas fa-moon"></i> Dark';
                    });
                }
            });
        </script>

        <script src="${scriptUri}" onerror="document.body.classList.add('script-error')"></script>
    </body>
    </html>`;
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
      
      // Create a new terminal and execute the command directly
      try {
        const terminal = vscode.window.createTerminal(`Air Flutter - ${commandName}`);
        terminal.show();
        
        // Execute the command with a small delay to ensure the terminal is ready
        setTimeout(() => {
          terminal.sendText(commandToExecute);
          console.log(`✅ FlutterPanelController: Command sent to terminal: ${commandToExecute}`);
        }, 500);
        
        console.log(`✅ FlutterPanelController: Terminal created for command: ${commandName}`);
        this.showSuccessMessage(`Executed: ${commandName}`);
        
        // Update webview with success message
        if (this.currentPanel) {
          console.log(`📤 FlutterPanelController: Sending success message to webview`);
          this.currentPanel.webview.postMessage({
            command: 'addStatusMessage',
            message: `✅ Successfully executed: ${commandName}`,
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
  
  // Method removed - using direct terminal execution in handleFlutterCommand

  private async handleDisconnectDevice(deviceId: string) {
    console.log(`❌ FlutterPanelController: handleDisconnectDevice called for device: ${deviceId}`)
    
    try {
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
    options: { displayOff?: boolean; wirelessDisplay?: boolean; hardwareKeyboard?: boolean } = {}
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
        await this.screenMirrorManager.startWirelessDisplay(device.id, device.name, adbPath);
        this.postStatus(
          `✅ Mirroring ${device.name} into a virtual display. The phone panel stays off.`,
          'success'
        );
      } else {
        await this.screenMirrorManager.start(device.id, device.name, adbPath, {
          displayOff: options.displayOff,
          hardwareKeyboard: options.hardwareKeyboard
        });

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

  private async selectDeviceToMirror(options: { displayOff?: boolean; wirelessDisplay?: boolean; hardwareKeyboard?: boolean } = {}) {
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

  private async stopMirroring() {
    try {
      const stopped = await this.screenMirrorManager.stop();
      if (stopped) {
        this.postStatus('⏹️ Screen mirroring stopped. Phone screen restored.', 'info');
        vscode.window.showInformationMessage('Screen mirroring stopped. Phone screen restored.');
      } else {
        this.postStatus('No active screen mirroring session found.', 'info');
      }
    } catch (error) {
      this.showErrorMessage(error instanceof Error ? error.message : String(error));
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
      return workspaceFolders[0].uri.fsPath;
    }
    return '';
  }

  private async openWorkflowModal() {
    await this.openFlutterPanel();
    const initialPath = this.getInitialProjectPath();
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({
        command: 'openWorkflowModal',
        projectPath: initialPath
      });
    }
  }

  private async selectWorkflowProject() {
    const folders = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Flutter Project Folder'
    });

    if (folders && folders[0]) {
      const selectedPath = folders[0].fsPath;
      const validation = WorkflowGenerator.validateProject(selectedPath);
      if (!validation.valid) {
        this.showErrorMessage(validation.error || 'Invalid Flutter project folder.');
        return;
      }
      this.currentPanel?.webview.postMessage({
        command: 'workflowProjectPath',
        path: selectedPath
      });
    }
  }

  private async handleGenerateWorkflow(options: WorkflowOptions) {
    try {
      this.postStatus('⚙️ Generating GitHub Actions workflow…', 'info');
      const result = await WorkflowGenerator.writeWorkflowFiles(options);
      
      this.currentPanel?.webview.postMessage({
        command: 'workflowGenerated',
        message: 'GitHub Workflow generated at .github/workflows/build_apk.yml'
      });
      this.postStatus('✅ GitHub Actions workflow generated successfully!', 'success');

      // Open the generated workflow file in editor
      const document = await vscode.workspace.openTextDocument(result.workflowPath);
      await vscode.window.showTextDocument(document, { preview: false });

      if (result.secretsGuidePath) {
        const choice = await vscode.window.showInformationMessage(
          '✅ GitHub Workflow and Secrets Setup Guide generated!',
          'View Secrets Guide'
        );
        if (choice === 'View Secrets Guide') {
          const guideDoc = await vscode.workspace.openTextDocument(result.secretsGuidePath);
          await vscode.window.showTextDocument(guideDoc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
        }
      } else {
        vscode.window.showInformationMessage('✅ GitHub Actions workflow generated successfully!');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.showErrorMessage(`Workflow generation failed: ${msg}`);
      this.postStatus(`❌ Workflow generation failed: ${msg}`, 'error');
    }
  }

  private async openAgentScaffoldModal(targetPath?: string) {
    await this.openFlutterPanel();
    const initialPath = targetPath || this.getInitialProjectPath();
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({
        command: 'openAgentScaffoldModal',
        projectPath: initialPath
      });
    }
  }

  private async selectAgentScaffoldProject() {
    const folders = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Project Directory for Agents'
    });

    if (folders && folders[0]) {
      const selectedPath = folders[0].fsPath;
      this.currentPanel?.webview.postMessage({
        command: 'agentScaffoldProjectPath',
        path: selectedPath
      });
    }
  }

  private async handleGenerateAgentScaffold(options: AgentScaffoldOptions) {
    try {
      this.postStatus('🤖 Scaffolding AI Agent specifications…', 'info');
      const workspaceRoot = this.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const result = await AgentScaffolder.scaffold(options, workspaceRoot);

      this.currentPanel?.webview.postMessage({
        command: 'agentScaffoldGenerated',
        message: `Successfully scaffolded ${result.createdFiles.length} file(s) into: ${path.basename(result.targetDir)}`
      });

      this.postStatus(`✅ ${result.summary}`, 'success');
      vscode.window.showInformationMessage(`✅ ${result.summary}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.showErrorMessage(`Agent scaffolding failed: ${msg}`);
      this.postStatus(`❌ Agent scaffolding failed: ${msg}`, 'error');
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          command: 'addStatusMessage',
          message: `❌ Agent scaffolding failed: ${msg}`,
          type: 'error'
        });
      }
    }
  }

  private async openCompatDoctorModal(targetPath?: string) {
    await this.openFlutterPanel();
    const initialPath = targetPath || this.getInitialProjectPath();
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({
        command: 'openCompatDoctorModal',
        projectPath: initialPath
      });
      await this.handleRunCompatDoctorScan(initialPath);
    }
  }

  private async selectCompatProject() {
    const folders = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Flutter Project for Compatibility Scan'
    });

    if (folders && folders[0]) {
      const selectedPath = folders[0].fsPath;
      this.currentPanel?.webview.postMessage({
        command: 'compatProjectSelected',
        path: selectedPath
      });
      await this.handleRunCompatDoctorScan(selectedPath);
    }
  }

  private async handleRunCompatDoctorScan(projectPath?: string) {
    try {
      this.currentPanel?.webview.postMessage({ command: 'compatDoctorLoading', loading: true });
      const report = await CompatibilityModule.runScan(projectPath);
      this.currentPanel?.webview.postMessage({
        command: 'compatDoctorReport',
        report
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showErrorMessage(`Compatibility scan failed: ${msg}`);
      this.currentPanel?.webview.postMessage({
        command: 'compatDoctorReport',
        report: null,
        error: msg
      });
    }
  }

  private async handleApplyCompatUpgrades(projectPath?: string) {
    try {
      const success = await CompatibilityModule.upgradeBuildStackCommand(projectPath);
      if (success) {
        await this.handleRunCompatDoctorScan(projectPath);
      } else {
        this.currentPanel?.webview.postMessage({ command: 'compatDoctorLoading', loading: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showErrorMessage(`Upgrade failed: ${msg}`);
      this.currentPanel?.webview.postMessage({ command: 'compatDoctorLoading', loading: false });
    }
  }

  private async openFlavorsModal(projectPath?: string) {
    await this.openFlutterPanel();
    const initialPath = projectPath || this.getInitialProjectPath();
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({
        command: 'openFlavorsModal',
        projectPath: initialPath
      });
    }
    if (initialPath) {
      await this.handleDetectFlavors(initialPath);
    }
  }

  private async selectFlavorsProject() {
    const folders = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Flutter Project Folder'
    });

    if (folders && folders[0]) {
      const selectedPath = folders[0].fsPath;
      const validation = WorkflowGenerator.validateProject(selectedPath);
      if (!validation.valid) {
        this.showErrorMessage(validation.error || 'Invalid Flutter project folder.');
        return;
      }
      this.currentPanel?.webview.postMessage({
        command: 'openFlavorsModal',
        projectPath: selectedPath
      });
      await this.handleDetectFlavors(selectedPath);
    }
  }

  private async handleDetectFlavors(projectPath?: string) {
    const targetPath = projectPath || this.getInitialProjectPath();
    try {
      const result = await FlavorManager.detectFlavors(targetPath);
      this.currentPanel?.webview.postMessage({
        command: 'flavorsDetected',
        data: result
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.postStatus(`⚠️ Flavors detection warning: ${msg}`, 'warning');
      this.currentPanel?.webview.postMessage({
        command: 'flavorsDetected',
        data: { hasFlavors: false, flavors: [], error: msg }
      });
    }
  }

  private async handleSetupFlavors(projectPath?: string, flavors?: string[]) {
    const targetPath = projectPath || this.getInitialProjectPath();
    try {
      this.postStatus('🪄 Setting up Flutter flavors...', 'info');
      const result = await FlavorManager.setupFlavors(targetPath, flavors || ['dev', 'staging', 'prod']);
      this.postStatus(`✅ Flavors configured! Created ${result.createdFiles.length} entrypoints.`, 'success');
      vscode.window.showInformationMessage(`✅ Flavors configured successfully! (${result.createdFiles.join(', ')})`);
      await this.handleDetectFlavors(targetPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.showErrorMessage(`Flavors setup failed: ${msg}`);
      this.postStatus(`❌ Flavors setup failed: ${msg}`, 'error');
    }
  }

  private async handleRunFlavor(projectPath?: string, flavor?: string, target?: string) {
    if (!flavor) {
      this.showErrorMessage('No flavor selected to run.');
      return;
    }
    const targetPath = projectPath || this.getInitialProjectPath();
    const terminal = vscode.window.createTerminal(`Flutter Run - ${flavor}`);
    terminal.show();
    if (targetPath) {
      terminal.sendText(`cd "${targetPath}"`);
    }
    const targetArg = target ? ` -t ${target}` : '';
    terminal.sendText(`flutter run --flavor ${flavor}${targetArg}`);
    this.postStatus(`▶️ Running flavor "${flavor}" in terminal...`, 'info');
  }

  private async handleBuildFlavorApk(projectPath?: string, flavor?: string, target?: string) {
    if (!flavor) {
      this.showErrorMessage('No flavor selected to build.');
      return;
    }
    const targetPath = projectPath || this.getInitialProjectPath();
    const terminal = vscode.window.createTerminal(`Flutter Build APK - ${flavor}`);
    terminal.show();
    if (targetPath) {
      terminal.sendText(`cd "${targetPath}"`);
    }
    const targetArg = target ? ` -t ${target}` : '';
    terminal.sendText(`flutter build apk --flavor ${flavor}${targetArg}`);
    this.postStatus(`🚀 Building APK for flavor "${flavor}" in terminal...`, 'info');
    await this.handleDetectFlavors(targetPath);
  }

  private async handleBuildAllFlavors(projectPath?: string, flavors?: string[]) {
    if (!flavors || flavors.length === 0) {
      this.showErrorMessage('No flavors available to build.');
      return;
    }
    const targetPath = projectPath || this.getInitialProjectPath();
    const terminal = vscode.window.createTerminal(`Flutter Build All Flavors`);
    terminal.show();
    if (targetPath) {
      terminal.sendText(`cd "${targetPath}"`);
    }
    for (const flavor of flavors) {
      terminal.sendText(`flutter build apk --flavor ${flavor}`);
    }
    this.postStatus(`🚀 Batch building ${flavors.length} flavors in terminal...`, 'info');
    await this.handleDetectFlavors(targetPath);
  }

  private async openProxyModal() {
    await this.openFlutterPanel();
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({ command: 'openProxyModal' });
    }
    await this.handleGetNetworkState();
  }

  private getActiveDeviceSerial(): string | undefined {
    return this.connectedDevices.find(d => d.status === 'online')?.id ||
      this.usbDevices.find(d => d.status === 'online')?.id;
  }

  private async handleGetNetworkState() {
    const serial = this.getActiveDeviceSerial();
    const localIp = NetworkManager.getLocalIp();

    if (!serial) {
      this.currentPanel?.webview.postMessage({
        command: 'networkState',
        data: { proxy: null, dnsMode: null, dnsSpecifier: null, localIp }
      });
      return;
    }

    try {
      const adbPath = await this.deviceManager.getADBExecutable();
      const state = await NetworkManager.getNetworkState(adbPath, serial);
      this.currentPanel?.webview.postMessage({
        command: 'networkState',
        data: state
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.postStatus(`⚠️ Network state check failed: ${msg}`, 'warning');
      this.currentPanel?.webview.postMessage({
        command: 'networkState',
        data: { proxy: null, dnsMode: null, dnsSpecifier: null, localIp }
      });
    }
  }

  private async handleSetProxy(host?: string, port?: string) {
    const serial = this.getActiveDeviceSerial();
    if (!serial) {
      this.showErrorMessage('No online device connected.');
      return;
    }
    if (!host || !port) {
      this.showErrorMessage('Proxy Host and Port are required.');
      return;
    }

    try {
      const adbPath = await this.deviceManager.getADBExecutable();
      await NetworkManager.setHttpProxy(adbPath, serial, host, port);
      this.postStatus(`✅ HTTP Proxy set to ${host}:${port}`, 'success');
      vscode.window.showInformationMessage(`✅ HTTP Proxy set to ${host}:${port}`);
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.showErrorMessage(`Failed to set HTTP proxy: ${msg}`);
      this.postStatus(`❌ Proxy error: ${msg}`, 'error');
    }
  }

  private async handleClearProxy() {
    const serial = this.getActiveDeviceSerial();
    if (!serial) {
      this.showErrorMessage('No online device connected.');
      return;
    }

    try {
      const adbPath = await this.deviceManager.getADBExecutable();
      await NetworkManager.clearHttpProxy(adbPath, serial);
      this.postStatus('✅ HTTP Proxy cleared.', 'success');
      vscode.window.showInformationMessage('✅ HTTP Proxy cleared on device.');
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.showErrorMessage(`Failed to clear HTTP proxy: ${msg}`);
      this.postStatus(`❌ Proxy error: ${msg}`, 'error');
    }
  }

  private async handleSetPrivateDns(host?: string) {
    const serial = this.getActiveDeviceSerial();
    if (!serial) {
      this.showErrorMessage('No online device connected.');
      return;
    }
    if (!host) {
      this.showErrorMessage('Private DNS hostname is required.');
      return;
    }

    try {
      const adbPath = await this.deviceManager.getADBExecutable();
      await NetworkManager.setPrivateDns(adbPath, serial, host);
      this.postStatus(`✅ Private DNS set to ${host}`, 'success');
      vscode.window.showInformationMessage(`✅ Private DNS set to ${host}`);
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.showErrorMessage(`Failed to set Private DNS: ${msg}`);
      this.postStatus(`❌ DNS error: ${msg}`, 'error');
    }
  }

  private async handleClearPrivateDns() {
    const serial = this.getActiveDeviceSerial();
    if (!serial) {
      this.showErrorMessage('No online device connected.');
      return;
    }

    try {
      const adbPath = await this.deviceManager.getADBExecutable();
      await NetworkManager.clearPrivateDns(adbPath, serial);
      this.postStatus('✅ Private DNS turned off.', 'success');
      vscode.window.showInformationMessage('✅ Private DNS turned off on device.');
      await this.handleGetNetworkState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.showErrorMessage(`Failed to clear Private DNS: ${msg}`);
      this.postStatus(`❌ DNS error: ${msg}`, 'error');
    }
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

        this.currentPanel?.webview.postMessage({
          command: 'recordingState',
          isRecording: false,
          duration: 0
        });

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
        this.currentPanel?.webview.postMessage({
          command: 'recordingState',
          isRecording: false,
          duration: 0
        });
      }
    } else {
      const serial = this.getActiveDeviceSerial();
      if (!serial) {
        this.showErrorMessage('No online device connected to record screen.');
        return;
      }

      try {
        await this.screenRecorder.startRecording(adbPath, serial);
        this.postStatus('🔴 Screen recording started...', 'info');

        this.currentPanel?.webview.postMessage({
          command: 'recordingState',
          isRecording: true,
          duration: 0
        });

        if (this.recordingTimer) {
          clearInterval(this.recordingTimer);
        }
        this.recordingTimer = setInterval(() => {
          if (!this.screenRecorder.isRecording()) {
            if (this.recordingTimer) {
              clearInterval(this.recordingTimer);
              this.recordingTimer = undefined;
            }
            this.currentPanel?.webview.postMessage({
              command: 'recordingState',
              isRecording: false,
              duration: 0
            });
            return;
          }
          const duration = this.screenRecorder.getDurationSeconds();
          this.currentPanel?.webview.postMessage({
            command: 'recordingState',
            isRecording: true,
            duration
          });
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
    const mediaPath = path.join(this.context.extensionPath, 'media');
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'air-flutter.css')));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Air Flutter - Device Setup Guide</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <link href="${styleUri}" rel="stylesheet">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    </head>
    <body>
        <div class="ff-shell guide">
            <!-- Header -->
            <header class="guide-head">
                <div>
                    <h1>Device setup guide</h1>
                    <p>Enable wireless debugging on an Android phone, step by step.</p>
                </div>
                <button class="btn btn-quiet" id="darkModeToggleTrouble" type="button" title="Toggle theme">
                    <i class="fas fa-moon"></i> Dark
                </button>
            </header>

            <!-- Error Alert -->
            <div class="alert alert-custom">
                <h5><i class="fas fa-triangle-exclamation"></i> Connection issue detected</h5>
                <p class="mb-0">The error "ADB returned null value" usually means the device fingerprint is missing. Connect once with a USB cable, then enable wireless debugging with the steps below.</p>
            </div>

            <h2 class="guide-section-title">
                <i class="fas fa-mobile-screen"></i> Enable developer settings
            </h2>

                <!-- Section 1: Enable Developer Settings (Steps 1-6) -->
                <div class="row">
                    <!-- Step 1: Open Settings -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">1</div>
                                <div>Open Device Settings</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Open your device settings and look for the settings icon.</strong></p>
                            </div>
                        </div>
                    </div>

                    <!-- Step 2: About Phone -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">2</div>
                                <div>Navigate to About Phone/Device</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Find and tap on "About Phone" or "About Device" in settings.</strong></p>
                            </div>
                        </div>
                    </div>

                    <!-- Step 3: Software Information -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">3</div>
                                <div>Software Information</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Tap on "Software Information" or "Software Details".</strong></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <!-- Step 4: Enable Developer Options -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">4</div>
                                <div>Enable Developer Options</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Find "Build Number" and tap it 7 times rapidly to enable Developer Options.</strong></p>
                                <div class="alert alert-info mt-3">
                                    <i class="fas fa-info-circle"></i> <strong>Tip:</strong> You'll see a message saying "You are now X steps away from being a developer" as you tap.
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Step 5: Developer Options Available -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">5</div>
                                <div>Developer Options Available</div>
                            </div>
                            <div class="step-content">
                                <p><strong>After tapping 7 times, you'll see "Developer Options" is now available in settings.</strong></p>
                            </div>
                        </div>
                    </div>

                    <!-- Step 6: Open Developer Options -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">6</div>
                                <div>Open Developer Options</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Go to main settings and tap on "Developer Options".</strong></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <!-- Step 7: Enable Developer Settings -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">7</div>
                                <div>Enable Developer Settings</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Turn on the Developer Options toggle at the top.</strong></p>
                            </div>
                        </div>
                    </div>
                </div>

                <h2 class="guide-section-title">
                    <i class="fas fa-wifi"></i> Enable USB &amp; wireless options
                </h2>

                <div class="row">
                    <!-- Step 8: Open System Management -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">8</div>
                                <div>Open System Management</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Look for "System Management" or similar option in settings.</strong></p>
                            </div>
                        </div>
                    </div>

                    <!-- Step 9: Open Developer Options -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">9</div>
                                <div>Open Developer Options</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Navigate to "Developer Options" in the system settings.</strong></p>
                            </div>
                        </div>
                    </div>

                    <!-- Step 10: Enable USB Debugging -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">10</div>
                                <div>Enable USB Debugging</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Find and enable "USB Debugging" option.</strong></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <!-- Step 11: Enable Wireless Debugging -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">11</div>
                                <div>Enable Wireless Debugging</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Find and enable "Wireless Debugging" option.</strong></p>
                            </div>
                        </div>
                    </div>

                    <!-- Step 12: Connect with USB First -->
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="step-card">
                            <div class="step-header">
                                <div class="step-number">12</div>
                                <div>Connect with USB First</div>
                            </div>
                            <div class="step-content">
                                <p><strong>Connect your device with USB cable first, then run Flutter app to establish fingerprint.</strong></p>
                            </div>
                        </div>
                    </div>
                </div>

            <!-- Important Instructions -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="alert alert-success">
                        <h6><i class="fas fa-lightbulb"></i> Before you connect wirelessly</h6>
                        <ol class="mb-0">
                            <li>Connect the device with a USB cable</li>
                            <li>Run <code>flutter run</code> once</li>
                            <li>Accept any fingerprint prompts on the device</li>
                            <li>Press <strong>Connect wirelessly</strong> on the USB device in the panel</li>
                            <li>Unplug the cable — the phone now answers on port 5555</li>
                        </ol>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="testConnection()">
                    <i class="fas fa-wifi"></i> Test wireless connection
                </button>
                <button class="btn btn-quiet" onclick="backToPanel()">
                    <i class="fas fa-arrow-left"></i> Back to panel
                </button>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function testConnection() {
                vscode.postMessage({
                    command: 'testConnection'
                });
            }

            function backToPanel() {
                vscode.postMessage({
                    command: 'backToPanel'
                });
            }
            
            function showTroubleshootingGuide() {
                if (window.vscode) {
                    window.vscode.postMessage({
                        command: 'showTroubleshootingGuide'
                    });
                } else {
                    console.error('VSCode API not available');
                }
            }
            
            // Load dark mode preference and setup toggle
            window.addEventListener('DOMContentLoaded', () => {
                const isDarkMode = localStorage.getItem('airFlutterDarkMode') === 'true';
                if (isDarkMode) {
                    document.body.classList.add('dark-mode');
                }
                
                // Setup dark mode toggle
                const darkModeToggle = document.getElementById('darkModeToggleTrouble');
                if (darkModeToggle) {
                    if (isDarkMode) {
                        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i> Light';
                    }
                    
                    darkModeToggle.addEventListener('click', function() {
                        document.body.classList.toggle('dark-mode');
                        const isDark = document.body.classList.contains('dark-mode');
                        localStorage.setItem('airFlutterDarkMode', isDark);
                        this.innerHTML = isDark ? '<i class="fas fa-sun"></i> Light' : '<i class="fas fa-moon"></i> Dark';
                    });
                }
            });
        </script>
    </body>
    </html>`;
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
