import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
      .registerCommand('airFlutter.setScrcpyPath', () => this.setScrcpyPath())
    
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
            case 'setScrcpyPath':
              await this.setScrcpyPath();
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
            `✅ Mirroring ${device.name} with a hardware keyboard. Switch languages on the phone with the keyboard shortcut (Windows: Alt+Shift or Win+Space).`,
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
              ? `✅ Mirroring ${device.name} with the phone screen off.`
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
