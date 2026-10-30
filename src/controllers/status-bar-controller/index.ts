import * as vscode from 'vscode'
import { ADBBaseController } from '../adb-controller/ADBBaseController'
import { AndroidDeviceManager } from '../../domain/android-device-manager'

export class StatusBarController extends ADBBaseController {
  private statusBarItem: vscode.StatusBarItem
  private deviceManager: AndroidDeviceManager
  private refreshInterval: NodeJS.Timeout | undefined

  constructor(context: vscode.ExtensionContext) {
    super(context)
    
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    )
    this.statusBarItem.command = 'airFlutter.showConnectedDevices'
    this.statusBarItem.tooltip = 'Click to view connected devices'
    this.statusBarItem.show()
    context.subscriptions.push(this.statusBarItem)
    
    this.deviceManager = new AndroidDeviceManager(context.globalState)
  }

  async onInit() {
    // Register command for quick connect from status bar
    this.registerCommand('airFlutter.quickConnect', () => this.quickConnect())
    
    // Initial device check
    await this.updateDeviceStatus()
    
    // Start periodic refresh (every 30 seconds)
    this.startPeriodicRefresh()
  }

  async updateDeviceStatus() {
    try {
      const devices = (await this.deviceManager.listDevices()).filter(
        device => device.state === 'device'
      )
      
      if (devices && devices.length > 0) {
        // Extract device info from the first device
        const firstDevice = devices[0]
        const deviceInfo = firstDevice.name
        
        this.statusBarItem.text = `$(device-mobile) ${deviceInfo}`
        this.statusBarItem.backgroundColor = undefined
        this.statusBarItem.tooltip = `Connected to ${deviceInfo}\nClick to view all devices or quick connect`
      } else {
        this.statusBarItem.text = '$(device-mobile) No Device'
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
        this.statusBarItem.tooltip = 'No devices connected\nClick to connect a device'
      }
    } catch (error) {
      // ADB not found or error - show offline status
      this.statusBarItem.text = '$(device-mobile) Offline'
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
      this.statusBarItem.tooltip = 'ADB not available\nClick to configure ADB path'
    }
  }

  async quickConnect() {
    // Show quick pick menu with options
    const selected = await vscode.window.showQuickPick([
      {
        label: '$(device-mobile) Connect Wireless Device',
        description: 'Select a USB phone and connect automatically',
        action: 'connect'
      },
      {
        label: '$(list-unordered) View Connected Devices',
        description: 'Show all connected devices',
        action: 'view'
      },
      {
        label: '$(tools) Open Setup Guide',
        description: 'Device configuration help',
        action: 'setup'
      }
    ])

    if (!selected) return

    switch (selected.action) {
      case 'connect':
        await vscode.commands.executeCommand('airFlutter.connectWirelessDevice')
        break
      case 'view':
        await vscode.commands.executeCommand('airFlutter.showConnectedDevices')
        break
      case 'setup':
        await vscode.commands.executeCommand('airFlutter.showTroubleshootingGuide')
        break
    }

    // Refresh status after action
    setTimeout(() => this.updateDeviceStatus(), 2000)
  }

  private startPeriodicRefresh() {
    // Clear any existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }

    // Refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.updateDeviceStatus()
    }, 30000)
  }

  async dispose() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }
    this.statusBarItem.dispose()
  }
}
