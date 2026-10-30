/**
 * Command Registry for Air Flutter Extension
 * This file makes it easy to add, edit, and delete commands
 */

export interface AirFlutterCommand {
  id: string;
  title: string;
  category: string;
  description?: string;
}

export const FLUTTER_FLY_COMMANDS: AirFlutterCommand[] = [
  // Panel Commands
  {
    id: 'airFlutter.openFlutterPanel',
    title: '🚀 Open Air Flutter Panel',
    category: 'Air Flutter',
    description: 'Open the main Air Flutter panel interface'
  },
  {
    id: 'airFlutter.connectWirelessDevice',
    title: '📱 Connect Wireless Device',
    category: 'Air Flutter',
    description: 'Connect to a wireless Android device'
  },
  {
    id: 'airFlutter.showConnectedDevices',
    title: '🔍 Show Connected Devices',
    category: 'Air Flutter',
    description: 'Display list of connected devices'
  },

  // Flutter Development Commands
  {
    id: 'airFlutter.runFlutterDoctor',
    title: '⚡ Flutter Doctor',
    category: 'Air Flutter',
    description: 'Run Flutter doctor to check installation'
  },
  {
    id: 'airFlutter.getPackages',
    title: '📦 Get Packages',
    category: 'Air Flutter',
    description: 'Get Flutter packages and dependencies'
  },
  {
    id: 'airFlutter.upgradePackages',
    title: '⬆️ Upgrade Packages',
    category: 'Air Flutter',
    description: 'Upgrade Flutter packages to latest versions'
  },
  {
    id: 'airFlutter.cleanProject',
    title: '🧹 Clean Project',
    category: 'Air Flutter',
    description: 'Clean Flutter project build files'
  },
  {
    id: 'airFlutter.analyzeProject',
    title: '🔍 Analyze Project',
    category: 'Air Flutter',
    description: 'Analyze Flutter project for issues'
  },
  {
    id: 'airFlutter.formatCode',
    title: '✨ Format Code',
    category: 'Air Flutter',
    description: 'Format Flutter/Dart code'
  },

  // Building Commands
  {
    id: 'airFlutter.buildAPK',
    title: '🏗️ Build APK',
    category: 'Air Flutter',
    description: 'Build Android APK file'
  },
  {
    id: 'airFlutter.buildAppBundle',
    title: '📱 Build App Bundle (AAB)',
    category: 'Air Flutter',
    description: 'Build Android App Bundle'
  },
  {
    id: 'airFlutter.buildIOS',
    title: '🍎 Build iOS',
    category: 'Air Flutter',
    description: 'Build iOS app'
  },
  {
    id: 'airFlutter.buildWeb',
    title: '🌐 Build Web',
    category: 'Air Flutter',
    description: 'Build web app'
  },

  // Running Commands
  {
    id: 'airFlutter.runFlutterApp',
    title: '🚀 Run Flutter App',
    category: 'Air Flutter',
    description: 'Run Flutter app on connected device'
  },
  {
    id: 'airFlutter.buildFlutterApp',
    title: '🏗️ Build Flutter App',
    category: 'Air Flutter',
    description: 'Build Flutter app with options'
  },
  {
    id: 'airFlutter.hotReload',
    title: '🔄 Hot Reload',
    category: 'Air Flutter',
    description: 'Hot reload the running app'
  },
  {
    id: 'airFlutter.hotRestart',
    title: '🔄 Hot Restart',
    category: 'Air Flutter',
    description: 'Hot restart the running app'
  },
  {
    id: 'airFlutter.stopApp',
    title: '⏹️ Stop App',
    category: 'Air Flutter',
    description: 'Stop the running Flutter app'
  },

  // Advanced Commands
  {
    id: 'airFlutter.injectResources',
    title: '💉 Inject Resources',
    category: 'Air Flutter',
    description: 'Run build_runner for code generation'
  },
  {
    id: 'airFlutter.upgradeFlutterSDK',
    title: '⬆️ Upgrade Flutter SDK',
    category: 'Air Flutter',
    description: 'Upgrade Flutter SDK to latest version'
  },

  // ADB Commands
  {
    id: 'airFlutter.killserver',
    title: '⚠️ Kill ADB Server',
    category: 'Air Flutter',
    description: 'Kill ADB server'
  },

  // Firebase Commands
  {
    id: 'airFlutter.enableFirebaseDebug',
    title: '🔥 Enable Firebase Debug',
    category: 'Air Flutter',
    description: 'Enable Firebase events debug mode'
  },
  {
    id: 'airFlutter.disableFirebaseDebug',
    title: '🔥 Disable Firebase Debug',
    category: 'Air Flutter',
    description: 'Disable Firebase events debug mode'
  }
];

/**
 * Helper function to get commands by category
 */
export function getCommandsByCategory(category: string): AirFlutterCommand[] {
  return FLUTTER_FLY_COMMANDS.filter(cmd => cmd.category === category);
}

/**
 * Helper function to get all command IDs
 */
export function getAllCommandIds(): string[] {
  return FLUTTER_FLY_COMMANDS.map(cmd => cmd.id);
}

/**
 * Helper function to find a command by ID
 */
export function findCommandById(id: string): AirFlutterCommand | undefined {
  return FLUTTER_FLY_COMMANDS.find(cmd => cmd.id === id);
}
