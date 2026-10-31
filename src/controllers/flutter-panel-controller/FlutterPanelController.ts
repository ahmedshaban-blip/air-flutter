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
import { CompatibilityEngine } from '../../features/compatibility/services/compatibilityEngine';
import { StackDiffItem } from '../../features/compatibility/models/types';
import { getPanelWebviewContent } from './views/panelHtml';
import { getTroubleshootingContent } from './views/troubleshootingHtml';
import { PanelCompatHandler, PanelHandlerContext } from './handlers/panelCompatHandler';
import { PanelFlavorHandler } from './handlers/panelFlavorHandler';
import { PanelNetworkHandler, PanelDeviceContext } from './handlers/panelNetworkHandler';
import { PanelWorkflowHandler } from './handlers/panelWorkflowHandler';
import { PanelAgentHandler } from './handlers/panelAgentHandler';

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
  private readonly _onRecordingStateChanged = new vscode.EventEmitter<{ isRecording: boolean; duration: number }>();
  public readonly onRecordingStateChanged = this._onRecordingStateChanged.event;

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


  constructor(context: vscode.ExtensionContext) {
    super(context);
    
    // Initialize ADB connection
    const consoleInterface = new ConsoleInterface();
    const netHelper = new NetHelpers();
    this.adbConnection = new ADBConnection(consoleInterface, context.globalState, netHelper);
    this.deviceManager = new AndroidDeviceManager(context.globalState);
    this.screenMirrorManager = new ScreenMirrorManager(context);
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
            case 'applyCustomStack':
              await this.handleApplyCustomStack(message.projectPath, message.diffs);
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

  private getActiveDeviceSerial(): string | undefined {
    return this.connectedDevices.find(d => d.status === 'online')?.id ||
      this.usbDevices.find(d => d.status === 'online')?.id;
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
