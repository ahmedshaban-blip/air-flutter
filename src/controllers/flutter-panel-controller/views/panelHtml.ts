import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkflowModalHtml } from './modals/workflowModalHtml';
import { getFlavorsModalHtml } from './modals/flavorsModalHtml';
import { getProxyModalHtml } from './modals/proxyModalHtml';
import { getMirrorSetupModalHtml } from './modals/mirrorSetupModalHtml';
import { getAgentScaffoldModalHtml } from './modals/agentScaffoldModalHtml';
import { getCompatDoctorModalHtml } from './modals/compatDoctorModalHtml';
import { getMcpHubModalHtml } from './modals/mcpHubModalHtml';
import { getSigningKeyModalHtml } from './modals/signingKeyModalHtml';
import { LOCALHOST_BRIDGE_PRESETS } from '../../../domain/localhost-bridge';

/**
 * Generates the full HTML markup for the main Air Flutter panel webview.
 */
export function getPanelWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  extensionVersion: string
): string {
  const mediaPath = path.join(context.extensionPath, 'media');
  const themeUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'theme.css')));
  const componentsUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'components.css')));
  const modalsUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'modals.css')));
  const stepperUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'stepper.css')));
  const compatUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'compat.css')));
  const signingKeyCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'signing-key.css')));
  const assetAssistantCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'asset-assistant.css')));
  const codeCleanupCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'code-cleanup.css')));
  const permissionManagerCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'permission-manager.css')));
  const appStateCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'app-state.css')));
  const deepLinkCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'deep-link-studio.css')));
  const localhostBridgeCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'localhost-bridge.css')));
  const mcpHubCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'mcp-hub.css')));
  const workflowModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'workflowModule.js')));
  const flavorsModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'flavorsModule.js')));
  const proxyModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'proxyModule.js')));
  const recorderModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'recorderModule.js')));
  const agentScaffoldModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'agentScaffoldModule.js')));
  const compatAuditUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'compat', 'compatAuditView.js')));
  const compatConfigUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'compat', 'compatConfigView.js')));
  const compatDoctorModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'compatDoctorModule.js')));
  const signingKeyModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'signingKeyModule.js')));
  const assetAssistantModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'assetAssistantModule.js')));
  const codeCleanupModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'codeCleanupModule.js')));
  const permissionManagerModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'permissionManagerModule.js')));
  const appStateModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'appStateModule.js')));
  const deepLinkModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'deepLinkStudioModule.js')));
  const localhostBridgeModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'localhostBridgeModule.js')));
  const mirrorSetupModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'mirrorSetupModule.js')));
  const mcpHubModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'mcpHubModule.js')));
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'air-flutter.js')));
  const localhostPresetButtons = LOCALHOST_BRIDGE_PRESETS
    .map(port => `<button type="button" data-localhost-port="${port}">${port}</button>`)
    .join('');

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
        <link href="${themeUri}" rel="stylesheet">
        <link href="${componentsUri}" rel="stylesheet">
        <link href="${modalsUri}" rel="stylesheet">
        <link href="${stepperUri}" rel="stylesheet">
        <link href="${compatUri}" rel="stylesheet">
        <link href="${signingKeyCssUri}" rel="stylesheet">
        <link href="${assetAssistantCssUri}" rel="stylesheet">
        <link href="${codeCleanupCssUri}" rel="stylesheet">
        <link href="${permissionManagerCssUri}" rel="stylesheet">
        <link href="${appStateCssUri}" rel="stylesheet">
        <link href="${deepLinkCssUri}" rel="stylesheet">
        <link href="${localhostBridgeCssUri}" rel="stylesheet">
        <link href="${mcpHubCssUri}" rel="stylesheet">
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
                    <span class="ff-version" title="Running extension version">v${extensionVersion}</span>
                    <button class="btn btn-quiet" id="darkModeToggle" type="button" title="Toggle theme">
                        <i class="fas fa-moon"></i> Dark
                    </button>
                </div>
            </header>

            <nav class="ff-tabs" role="tablist" aria-label="Air Flutter tools">
                <button class="ff-tab is-active" type="button" role="tab" aria-selected="true" data-panel-tab="workspace">Workspace</button>
                <button class="ff-tab" type="button" role="tab" aria-selected="false" data-panel-tab="assets">Assets &amp; Media</button>
                <button class="ff-tab" type="button" role="tab" aria-selected="false" data-panel-tab="cleanup">Code Cleanup</button>
                <button class="ff-tab" type="button" role="tab" aria-selected="false" data-panel-tab="permissions">Android Permissions</button>
                <button class="ff-tab" type="button" role="tab" aria-selected="false" data-panel-tab="deep-links">Deep Links</button>
            </nav>

            <div data-panel-view="workspace">
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
                            <button class="btn btn-quiet btn-block" id="stopMirrorBtn" type="button" disabled title="No active screen mirroring session">
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

                    <div class="ff-section localhost-bridge" aria-label="Localhost Bridge">
                        <div class="ff-section-head">
                            <h2>Localhost Bridge</h2>
                            <button class="link-btn" id="refreshLocalhostBridgeBtn" type="button">Refresh</button>
                        </div>
                        <p class="localhost-bridge-help">Expose a computer localhost port to a selected Android device via <span class="mono">adb reverse</span>.</p>
                        <label class="localhost-bridge-field" for="localhostBridgeDevice">
                            <span>Target device</span>
                            <select id="localhostBridgeDevice"><option value="">No online device</option></select>
                        </label>
                        <div class="localhost-presets" aria-label="Quick port presets">
                            ${localhostPresetButtons}
                        </div>
                        <form id="localhostBridgeForm" class="localhost-custom-row">
                            <input id="localhostBridgePort" type="number" min="1" max="65535" step="1" inputmode="numeric" placeholder="Custom port" aria-label="Custom localhost port">
                            <button class="btn btn-primary" type="submit">Link</button>
                        </form>
                        <div class="localhost-active-head">
                            <span>Active forwards</span>
                            <button class="link-btn link-danger" id="removeAllLocalhostBridgesBtn" type="button">Remove all</button>
                        </div>
                        <div id="localhostBridgeRules" class="localhost-rules" aria-live="polite"><p class="empty">No active forwards</p></div>
                    </div>

                    <div class="ff-section" aria-label="Reset app state">
                        <div class="ff-section-head">
                            <h2>Reset app state</h2>
                            <button class="link-btn" id="pickAppPackageBtn" type="button">Package</button>
                        </div>
                        <p class="app-state-pkg" id="appStatePackage" data-state="empty">detecting package…</p>
                        <div class="app-state-actions">
                            <button class="btn btn-quiet btn-block" id="clearAppCacheBtn" type="button">
                                <i class="fas fa-broom"></i> Clear cache
                            </button>
                            <button class="btn btn-quiet btn-block" id="resetAppDatabasesBtn" type="button">
                                <i class="fas fa-database"></i> Reset database
                            </button>
                            <button class="btn btn-danger btn-block" id="factoryResetAppBtn" type="button">
                                <i class="fas fa-triangle-exclamation"></i> Factory reset (pm clear)
                            </button>
                        </div>
                        <p class="app-state-help">Wipes cache, databases or the whole sandbox over ADB — no reinstall needed. A confirmation is required before anything is erased.</p>
                        <p class="app-state-status" id="appStateStatus" role="status" hidden></p>
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
                            <button class="cmd" type="button" data-command="signingKey" onclick="airFlutter.openSigningKeyModal()">
                                <i class="cmd-icon fas fa-key"></i>
                                <span><span class="cmd-label">Signing Key Studio</span><span class="cmd-run">create Android upload key</span></span>
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
                            <button class="cmd" type="button" data-command="mcpHubModal" onclick="window.airFlutter.openMcpHubModal()">
                                <i class="cmd-icon fas fa-plug"></i>
                                <span><span class="cmd-label">MCP Hub</span><span class="cmd-run">AI agent MCP servers</span></span>
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
                            <button class="rail-item" type="button" onclick="airFlutter.openSigningKeyModal()">
                                <i class="fas fa-key"></i> Android Signing Key
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
            </div>

            <section data-panel-view="deep-links" hidden aria-label="Deep Link and Intent Studio">
                <div class="deep-link-layout">
                    <div class="ff-section deep-link-console">
                        <div class="ff-section-head">
                            <div>
                                <h2>Deep Link &amp; Intent Studio</h2>
                                <p class="deep-link-kicker">android.intent.action.VIEW</p>
                            </div>
                            <span class="ff-section-note">ADB · am start -W</span>
                        </div>

                        <form id="deepLinkForm" class="deep-link-form">
                            <label class="deep-link-field deep-link-field-wide" for="deepLinkUriInput">
                                <span>URL / URI</span>
                                <input id="deepLinkUriInput" class="deep-link-input mono" type="text" spellcheck="false" autocomplete="off" placeholder="myapp://products/42" required>
                            </label>

                            <label class="deep-link-field" for="deepLinkSuggestionSelect">
                                <span>Detected in AndroidManifest.xml</span>
                                <select id="deepLinkSuggestionSelect" class="deep-link-input">
                                    <option value="">No detected links yet</option>
                                </select>
                            </label>

                            <label class="deep-link-field" for="deepLinkDeviceSelect">
                                <span>Target device</span>
                                <select id="deepLinkDeviceSelect" class="deep-link-input">
                                    <option value="">Use active device</option>
                                </select>
                            </label>

                            <label class="deep-link-field deep-link-field-wide" for="deepLinkPackageInput">
                                <span>Package <em>optional · limits resolution</em></span>
                                <input id="deepLinkPackageInput" class="deep-link-input mono" type="text" spellcheck="false" autocomplete="off" placeholder="com.example.app">
                            </label>

                            <button class="btn btn-primary deep-link-dispatch" id="deepLinkDispatchBtn" type="submit">
                                <i class="fas fa-paper-plane"></i> Dispatch to Phone
                            </button>
                        </form>

                        <div id="deepLinkResult" class="deep-link-result" role="status" aria-live="polite" data-state="idle">
                            <span class="deep-link-result-mark">READY</span>
                            <span>Enter a URI, then dispatch it to a connected Android device.</span>
                        </div>
                    </div>

                    <aside class="deep-link-library">
                        <div class="ff-section">
                            <div class="ff-section-head"><h2>Recent</h2><span class="ff-section-note">workspace · 10 max</span></div>
                            <div id="deepLinkRecentList" class="deep-link-list"><p class="empty">No links dispatched yet</p></div>
                        </div>
                        <div class="ff-section">
                            <div class="ff-section-head"><h2>Named presets</h2><span class="ff-section-note">global</span></div>
                            <div class="deep-link-save-row">
                                <input id="deepLinkPresetName" class="deep-link-input" type="text" maxlength="80" placeholder="Product Details">
                                <button id="deepLinkSavePresetBtn" class="btn btn-quiet" type="button">Save current</button>
                            </div>
                            <div id="deepLinkPresetList" class="deep-link-list"><p class="empty">No saved presets</p></div>
                        </div>
                    </aside>
                </div>
            </section>

            <section data-panel-view="assets" hidden aria-label="Assets and media">
                <div class="asset-assistant-layout">
                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Assets &amp; Media</h2>
                            <span class="ff-section-note">assets/</span>
                        </div>
                        <div class="asset-actions">
                            <button class="btn btn-primary btn-block" id="scanSyncAssetsBtn" type="button">
                                <i class="fas fa-arrows-rotate"></i> Scan &amp; Sync Pubspec
                            </button>
                            <button class="btn btn-quiet btn-block" id="generateAssetConstantsBtn" type="button">
                                <i class="fas fa-code"></i> Generate Asset Constants
                            </button>
                        </div>

                        <div id="assetDropZone" class="asset-dropzone">
                            <i class="fas fa-cloud-arrow-up asset-dropzone-icon"></i>
                            <div class="asset-dropzone-text">
                                <span>Drop assets here or</span>
                                <label class="btn btn-quiet btn-xs asset-browse-btn">
                                    <input type="file" id="assetFileInput" multiple accept="image/*,.svg,.ttf,.otf,.woff,.woff2" hidden>
                                    <span>Browse</span>
                                </label>
                            </div>
                        </div>

                        <p class="asset-help">Smart Flutter asset manager with 2x/3x resolution awareness, instant WebP optimization, 1-click widget snippet copy, and bulk unused cleanup.</p>
                        <p class="asset-status" id="assetAssistantStatus" role="status">Open this tab to scan the current Flutter project.</p>
                    </div>

                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Asset file tree</h2>
                            <span class="ff-section-note">size audit</span>
                        </div>
                        <div class="asset-summary" id="assetAssistantSummary">
                            <span><strong>0</strong> files</span>
                        </div>

                        <div class="asset-toolbar">
                            <div class="asset-search-row">
                                <div class="asset-search-wrapper">
                                    <i class="fas fa-magnifying-glass"></i>
                                    <input type="text" id="assetSearchInput" class="asset-search-input" placeholder="Search by name or path...">
                                    <button type="button" id="assetSearchClearBtn" class="asset-search-clear" hidden>&times;</button>
                                </div>
                                <div class="asset-sort-wrapper">
                                    <select id="assetSortSelect" class="asset-sort-select" title="Sort assets">
                                        <option value="name-asc">Name (A-Z)</option>
                                        <option value="name-desc">Name (Z-A)</option>
                                        <option value="size-desc">Size (Largest first)</option>
                                        <option value="size-asc">Size (Smallest first)</option>
                                        <option value="usage-desc">Usage (Most used)</option>
                                        <option value="usage-asc">Usage (Least used)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="asset-filter-pills">
                                <button type="button" class="asset-filter-pill is-active" data-asset-filter="all">All</button>
                                <button type="button" class="asset-filter-pill" data-asset-filter="unused">Unused</button>
                                <button type="button" class="asset-filter-pill" data-asset-filter="warnings">Warnings</button>
                                <button type="button" class="asset-filter-pill" data-asset-filter="undeclared">Undeclared</button>
                                <button type="button" class="asset-filter-pill" data-asset-filter="image">Images</button>
                                <button type="button" class="asset-filter-pill" data-asset-filter="svg">SVGs</button>
                                <button type="button" class="asset-filter-pill" data-asset-filter="font">Fonts</button>
                            </div>
                        </div>

                        <div id="assetBulkBar" class="asset-bulk-bar" hidden>
                            <div class="asset-bulk-info">
                                <label class="asset-select-all-label">
                                    <input type="checkbox" id="assetSelectAllCheckbox">
                                    <span id="assetSelectedCount">0 selected</span>
                                </label>
                                <span id="assetSelectedSize" class="asset-selected-size"></span>
                            </div>
                            <div class="asset-bulk-actions">
                                <button type="button" id="bulkDeleteBtn" class="btn btn-danger btn-xs" disabled>
                                    <i class="fas fa-trash"></i> Delete Selected
                                </button>
                                <button type="button" id="bulkCompressBtn" class="btn btn-quiet btn-xs" disabled>
                                    <i class="fas fa-compress"></i> Convert to WebP
                                </button>
                            </div>
                        </div>

                        <div class="asset-tree" id="assetFileTree">
                            <p class="empty"><i class="fas fa-folder-tree"></i><span>Waiting for asset scan</span></p>
                        </div>
                    </div>
                </div>

                <div id="assetHoverPopover" class="asset-hover-popover" hidden></div>

                <div id="assetImportModal" class="asset-modal-overlay" hidden>
                    <div class="asset-modal-content">
                        <div class="asset-modal-head">
                            <h3><i class="fas fa-file-import"></i> Import Assets</h3>
                            <button type="button" class="asset-modal-close" id="assetImportCloseBtn">&times;</button>
                        </div>
                        <div class="asset-modal-body">
                            <label class="asset-modal-label">
                                <span>Target Folder:</span>
                                <select id="assetImportFolderSelect" class="deep-link-input">
                                    <option value="assets/images">assets/images</option>
                                    <option value="assets/icons">assets/icons</option>
                                    <option value="assets/fonts">assets/fonts</option>
                                    <option value="assets">assets/</option>
                                </select>
                            </label>
                            <div id="assetImportFileList" class="asset-import-file-list"></div>
                        </div>
                        <div class="asset-modal-foot">
                            <button type="button" class="btn btn-quiet" id="assetImportCancelBtn">Cancel</button>
                            <button type="button" class="btn btn-primary" id="assetImportConfirmBtn">Import &amp; Sync</button>
                        </div>
                    </div>
                </div>
            </section>

            <section data-panel-view="cleanup" hidden aria-label="Code cleanup">
                <div class="cleanup-toolbar">
                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Code Cleanup</h2>
                            <span class="ff-section-note">static analysis</span>
                        </div>
                        <button class="btn btn-primary btn-block" id="runCodeCleanupBtn" type="button">
                            <i class="fas fa-magnifying-glass-chart"></i> Scan Code &amp; Packages
                        </button>
                        <p class="asset-help">Uses Dart Analyzer plus project import-graph checks. Package findings are suggestions because some plugins are used from native configuration.</p>
                        <p class="asset-status" id="codeCleanupStatus" role="status">Run a scan to find cleanup candidates.</p>
                    </div>
                    <div class="ff-section cleanup-summary" id="codeCleanupSummary">
                        <span><strong>0</strong> findings</span>
                    </div>
                </div>
                <div class="ff-section cleanup-results" id="codeCleanupResults">
                    <p class="empty"><i class="fas fa-code"></i><span>Waiting for code cleanup scan</span></p>
                </div>
            </section>

            <section data-panel-view="permissions" hidden aria-label="Android permissions">
                <div class="permission-manager-layout">
                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Android Permissions</h2>
                            <span class="ff-section-note">AndroidManifest.xml</span>
                        </div>
                        <button class="btn btn-primary btn-block" id="addPermissionsBtn" type="button" disabled>
                            <i class="fas fa-plus"></i> Add to Manifest
                        </button>
                        <p class="permission-help">Select one or more permissions. Permissions already declared in the main Android manifest cannot be selected again.</p>
                        <p class="permission-status" id="permissionStatus" role="status">Open this tab to inspect AndroidManifest.xml.</p>
                    </div>

                    <div class="ff-section">
                        <div class="ff-section-head">
                            <h2>Permission catalog</h2>
                            <span class="ff-section-note">multi-select</span>
                        </div>
                        <div class="permission-catalog" id="permissionCatalog">
                            <p class="empty"><i class="fas fa-shield-halved"></i><span>Waiting for manifest pre-check</span></p>
                        </div>
                    </div>
                </div>
            </section>

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

        <div id="globalOperationIndicator" class="global-operation-indicator" role="status" aria-live="polite">
            <span class="global-operation-spinner" aria-hidden="true"></span>
            <span id="globalOperationLabel">Loading device state…</span>
        </div>

${getWorkflowModalHtml()}
${getFlavorsModalHtml()}
${getProxyModalHtml()}
${getAgentScaffoldModalHtml()}
${getCompatDoctorModalHtml()}
${getMcpHubModalHtml()}
${getSigningKeyModalHtml()}
${getMirrorSetupModalHtml()}

        <script>
            // Define the bridge IMMEDIATELY, not inside DOMContentLoaded.
            // The inline onclick attributes (e.g. airFlutter.openMcpHubModal())
            // resolve against window.airFlutter, and a deferred definition is
            // not guaranteed to have run before the user can click. Keeping it
            // synchronous removes that race entirely.
            window.airFlutter = {
                // The real webview instance is exposed as window.airFlutterApp
                // by air-flutter.js. Bridge methods delegate to it so the
                // mixed-in module implementations are actually invoked
                // instead of the bridge calling itself.
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
                    this.delegate('openWorkflowModal', 'openWorkflowModal');
                },
                openSigningKeyModal: function () {
                    this.delegate('openSigningKeyModal', 'openSigningKeyModal');
                },
                openFlavorsModal: function () {
                    this.delegate('openFlavorsModal', 'openFlavorsModal');
                },
                openProxyModal: function () {
                    this.delegate('openProxyModal', 'openProxyModal');
                },
                toggleRecording: function () {
                    if (window.vscode) {
                        window.vscode.postMessage({ command: 'toggleScreenRecording' });
                    }
                },
                openAgentScaffoldModal: function () {
                    this.delegate('openAgentScaffoldModal', 'openAgentScaffoldModal');
                },
                openCompatDoctorModal: function () {
                    this.delegate('openCompatDoctorModal', 'openCompatDoctorModal');
                },
                openMcpHubModal: function () {
                    this.delegate('openMcpHub', 'openMcpHubModal');
                },

                /**
                 * Call a method on the real webview instance when it exists,
                 * otherwise fall back to asking the extension host to open the
                 * corresponding panel.
                 *
                 * @param method  method name on window.airFlutterApp
                 * @param command fallback host message command
                 */
                delegate: function (method, command) {
                    const app = window.airFlutterApp;
                    if (app && typeof app[method] === 'function') {
                        app[method]();
                        return;
                    }
                    if (window.vscode) {
                        window.vscode.postMessage({ command: command });
                    }
                }
            };

            window.showTroubleshootingGuide = function () {
                if (window.vscode) {
                    window.vscode.postMessage({ command: 'showTroubleshootingGuide' });
                }
            };

            window.addEventListener('DOMContentLoaded', () => {
                document.body.classList.add('js-loaded');

                if (typeof acquireVsCodeApi !== 'undefined') {
                    window.vscode = acquireVsCodeApi();
                } else {
                    document.body.classList.add('no-vscode-api');
                }

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

        <script src="${workflowModuleUri}"></script>
        <script src="${flavorsModuleUri}"></script>
        <script src="${proxyModuleUri}"></script>
        <script src="${recorderModuleUri}"></script>
        <script src="${agentScaffoldModuleUri}"></script>
        <script src="${compatAuditUri}"></script>
        <script src="${compatConfigUri}"></script>
        <script src="${compatDoctorModuleUri}"></script>
        <script src="${signingKeyModuleUri}"></script>
        <script src="${assetAssistantModuleUri}"></script>
        <script src="${codeCleanupModuleUri}"></script>
        <script src="${permissionManagerModuleUri}"></script>
        <script src="${appStateModuleUri}"></script>
        <script src="${deepLinkModuleUri}"></script>
        <script src="${localhostBridgeModuleUri}"></script>
        <script src="${mcpHubModuleUri}"></script>
        <script src="${mirrorSetupModuleUri}"></script>
        <script src="${scriptUri}" onerror="document.body.classList.add('script-error')"></script>
    </body>
    </html>`;
}
