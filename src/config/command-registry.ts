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
  {
    id: 'airFlutter.stopScreenMirroring',
    title: '⏹️ Stop Screen Mirroring',
    category: 'Air Flutter',
    description: 'Stop active screen mirroring session'
  },
  {
    id: 'airFlutter.wakeScreen',
    title: '☀️ Wake Device Screen',
    category: 'Air Flutter',
    description: 'Wake the active mirrored device or a connected phone display'
  },
  {
    id: 'airFlutter.toggleScreenPower',
    title: '◐ Toggle Mirrored Device Display',
    category: 'Air Flutter',
    description: 'Wake or blank the physical display while mirroring continues'
  },
  {
    id: 'airFlutter.installApk',
    title: '📦 Install APK to Device',
    category: 'Air Flutter',
    description: 'Install selected APK file to connected device'
  },
  {
    id: 'airFlutter.sendTextToDevice',
    title: '⌨️ Send Text / Clipboard to Device',
    category: 'Air Flutter',
    description: 'Send text or clipboard to active input field on phone'
  },
  {
    id: 'airFlutter.generateWorkflow',
    title: '🚀 Generate GitHub Actions CI/CD Workflow',
    category: 'Air Flutter',
    description: 'Build Android APK / AAB with GitHub Actions workflow'
  },
  {
    id: 'airFlutter.openSigningKeyModal',
    title: '🔐 Create Android Signing Key',
    category: 'Air Flutter',
    description: 'Create and configure a secure Android upload keystore for a Flutter project'
  },
  {
    id: 'airFlutter.openFlavorsModal',
    title: '🍧 Manage & Build Flutter Flavors',
    category: 'Air Flutter',
    description: 'Detect, configure, run, and build Flutter project flavors'
  },
  {
    id: 'airFlutter.openProxyModal',
    title: '🌐 Network & Screen State Lab',
    category: 'Air Flutter',
    description: 'Configure HTTP Proxy, Private DNS, Offline mode, Network Throttling, and Error states'
  },
  {
    id: 'airFlutter.toggleOfflineMode',
    title: '📶 Toggle Device Offline Mode (Isolated & Safe)',
    category: 'Air Flutter',
    description: 'Toggle smart offline state without severing wireless ADB debugging connection'
  },
  {
    id: 'airFlutter.toggleSlowNetwork',
    title: '⏳ Toggle Slow Network (3s Latency)',
    category: 'Air Flutter',
    description: 'Inject artificial latency to test shimmer loading states'
  },
  {
    id: 'airFlutter.toggleScreenRecording',
    title: '🎬 Record Screen (MP4) to Workspace',
    category: 'Air Flutter',
    description: 'Start or stop high quality screen recording of connected device'
  },
  {
    id: 'airFlutter.openAgentScaffoldingModal',
    title: '🤖 AI Agent Architect & Scaffolding Engine',
    category: 'Air Flutter',
    description: 'Interactively configure, scaffold, and generate AI sub-agents and multi-agent workflows'
  },
  {
    id: 'airFlutter.runCompatDoctor',
    title: '🩺 Flutter Compatibility Doctor',
    category: 'Air Flutter',
    description: 'Inspect Java, Gradle Wrapper, AGP, Kotlin, and Podfile compatibility with upgrade recommendations'
  },
  {
    id: 'airFlutter.upgradeBuildStack',
    title: '⚡ Upgrade Flutter Build Stack (Auto-Fixer)',
    category: 'Air Flutter',
    description: 'Interactively apply verified stable upgrades to Gradle, AGP, and iOS deployment target'
  },
  {
    id: 'airFlutter.resetAppState',
    title: '🧽 Reset App State (Cache, Database, Factory)',
    category: 'Air Flutter',
    description: 'Wipe app cache, databases, or all data without reinstalling the Flutter app'
  },
  {
    id: 'airFlutter.clearAppCache',
    title: '🗑️ Clear App Cache Only',
    category: 'Air Flutter',
    description: 'Remove cached files for the app while keeping preferences and databases'
  },
  {
    id: 'airFlutter.resetAppDatabases',
    title: '🗄️ Reset App Databases Only',
    category: 'Air Flutter',
    description: 'Delete local databases for the app while keeping preferences intact'
  },
  {
    id: 'airFlutter.factoryResetApp',
    title: '💣 Factory Reset App (pm clear)',
    category: 'Air Flutter',
    description: 'Erase all app data via adb shell pm clear, like a fresh install'
  },
  {
    id: 'airFlutter.packageBugReport',
    title: '🐞 Package Bug Report',
    category: 'Air Flutter',
    description: 'Capture a screenshot, filtered Logcat, and device diagnostics for a GitHub report'
  },
  {
    id: 'airFlutter.cleanCommentedCode',
    title: '🧹 Clean Commented-Out Dart Code',
    category: 'Air Flutter',
    description: 'Detect, preview, uncomment, or remove commented-out Dart/Flutter code blocks'
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
