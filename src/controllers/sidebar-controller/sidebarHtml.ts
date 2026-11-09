import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { LOCALHOST_BRIDGE_PRESETS } from '../../domain/localhost-bridge';

export function getSidebarWebviewHtml(
  webview: vscode.Webview,
  styleUri: vscode.Uri,
  scriptUri: vscode.Uri,
  version: string
): string {
  const nonce = crypto.randomBytes(16).toString('base64');
  const localhostPresetButtons = LOCALHOST_BRIDGE_PRESETS
    .map(port => `<button type="button" data-bridge-port="${port}">${port}</button>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src ${webview.cspSource} https://fonts.gstatic.com; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Anti-FOUC critical styling: match editor theme before external stylesheets resolve */
        html {
            background: var(--vscode-sideBar-background, #0F110E);
            color: var(--vscode-sideBar-foreground, #E9E5D8);
        }
        body {
            background: var(--paper, var(--vscode-sideBar-background, #0F110E));
            color: var(--ink, var(--vscode-sideBar-foreground, #E9E5D8));
            font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
        }
    </style>
    <link href="${styleUri}" rel="stylesheet">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet"></noscript>
    <title>Air Flutter</title>
</head>
<body>
    <div id="sidebarOperationIndicator" class="sf-operation-indicator" role="status" aria-live="polite">
        <span class="sf-operation-spinner" aria-hidden="true"></span>
        <span id="sidebarOperationLabel">Loading device state…</span>
    </div>
    <header class="sf-masthead">
        <svg class="sf-mark" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="1" y="1" width="30" height="30" rx="7" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-width="1.25" stroke-opacity="0.25"></rect>
            <path d="M9.5 9.5 L16 16 L9.5 22.5" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M19 22.5 H23.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path>
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

    <!-- Localhost reverse port forwarding -->
    <section class="sf-card sf-bridge" aria-label="Localhost Bridge">
        <div class="sf-card-head">
            <h2 class="sf-label">Localhost Bridge</h2>
            <button class="sf-icon-btn" type="button" id="refreshBridgeBtn" title="Refresh reverse ports" aria-label="Refresh reverse ports">&#8635;</button>
        </div>
        <p class="sf-bridge-device" id="bridgeDevice">No online phone</p>
        <div class="sf-bridge-presets" aria-label="Quick port presets">
            ${localhostPresetButtons}
        </div>
        <form id="bridgeCustomForm" class="sf-bridge-custom">
            <input id="bridgeCustomPort" type="number" min="1" max="65535" step="1" inputmode="numeric" placeholder="Custom port" aria-label="Custom localhost port">
            <button class="sf-ghost" type="submit" data-bridge-action>Link</button>
        </form>
        <div class="sf-bridge-active-head"><span>Active</span><button id="removeAllBridgesBtn" type="button" data-bridge-action>Remove all</button></div>
        <div id="bridgeRules" class="sf-bridge-rules" aria-live="polite"><p class="sf-empty">No active forwards</p></div>
    </section>

    <!-- Developer tools -->
    <section class="sf-tools" aria-labelledby="toolsHeading">
        <div class="sf-tools-head">
            <h2 class="sf-label" id="toolsHeading">Tools</h2>
            <span class="sf-tools-hint">Select a category</span>
        </div>
        <div class="sf-tool-groups">
        <details class="sf-tool-group" data-tool-group="device" open>
            <summary>
                <span class="sf-tool-group-title">Device controls</span>
                <span class="sf-tool-group-meta"><span>5 tools</span><span class="sf-tool-chevron" aria-hidden="true"></span></span>
            </summary>
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
            <button class="sf-tool" type="button" id="toolSendText" data-tool="sendText" title="Send clipboard or text to phone's active input">
                <span class="sf-tool-name">Send text</span>
                <span class="sf-tool-note">paste to phone</span>
            </button>
            <button class="sf-tool" type="button" id="toolInstallApk" data-tool="installApk" title="Install an APK file to connected phone">
                <span class="sf-tool-name">Install APK</span>
                <span class="sf-tool-note">select &amp; install</span>
            </button>
            <button class="sf-tool" type="button" id="toolMockGps" data-tool="mockGps" title="Set and simulate mock GPS coordinates">
                <span class="sf-tool-name">Mock GPS</span>
                <span class="sf-tool-note">mock location</span>
            </button>
            </div>
        </details>

        <details class="sf-tool-group" data-tool-group="overlays">
            <summary>
                <span class="sf-tool-group-title">Flutter Overlays</span>
                <span class="sf-tool-group-meta"><span>5 tools</span><span class="sf-tool-chevron" aria-hidden="true"></span></span>
            </summary>
            <div class="sf-tool-grid">
            <button class="sf-tool" type="button" id="toolDebugPaint" data-tool="toggleDebugPaint" title="Toggle Flutter Debug Paint (borders &amp; bounds)">
                <span class="sf-tool-name">Debug Paint</span>
                <span class="sf-tool-note">layout bounds (p)</span>
            </button>
            <button class="sf-tool" type="button" id="toolPerfOverlay" data-tool="togglePerfOverlay" title="Toggle Performance Overlay (GPU/UI frames)">
                <span class="sf-tool-name">Perf Overlay</span>
                <span class="sf-tool-note">GPU &amp; UI graph (P)</span>
            </button>
            <button class="sf-tool" type="button" id="toolSlowMotion" data-tool="toggleSlowMotion" title="Toggle 5x Slow Motion animations">
                <span class="sf-tool-name">Slow Motion</span>
                <span class="sf-tool-note">5x animations (S)</span>
            </button>
            <button class="sf-tool" type="button" id="toolRepaintRainbow" data-tool="toggleRepaintRainbow" title="Toggle Repaint Rainbow (rotating repaint colors)">
                <span class="sf-tool-name">Repaint Rainbow</span>
                <span class="sf-tool-note">color repaints (t)</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolOverlaysModal" data-tool="debugOverlaysModal" title="Open All Flutter Overlays Studio">
                <span class="sf-tool-name">All Overlays Studio</span>
                <span class="sf-tool-note">interactive overlay manager</span>
            </button>
            </div>
        </details>

        <details class="sf-tool-group" data-tool-group="mirror">
            <summary>
                <span class="sf-tool-group-title">Mirror &amp; capture</span>
                <span class="sf-tool-group-meta"><span>4 tools</span><span class="sf-tool-chevron" aria-hidden="true"></span></span>
            </summary>
            <div class="sf-tool-grid">
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
            <button class="sf-tool" type="button" id="toolRecord" data-tool="record" title="Record device screen to MP4">
                <span class="sf-tool-name">Record Video</span>
                <span class="sf-tool-note">start MP4 recording</span>
            </button>
            </div>
            <form class="sf-mirror-setup" id="mirrorSetup" hidden>
                <div class="sf-mirror-setup-head">
                    <div>
                        <strong id="mirrorSetupTitle">Start mirroring</strong>
                        <span>Choose how this session should feel.</span>
                    </div>
                    <button type="button" id="mirrorSetupClose" aria-label="Close mirroring setup">Close</button>
                </div>

                <fieldset class="sf-mirror-choice">
                    <legend>Audio route</legend>
                    <label>
                        <input type="radio" name="mirrorAudio" value="computer" checked>
                        <span><strong>Computer only</strong><small>Mute phone · restore on stop</small></span>
                    </label>
                    <label>
                        <input type="radio" name="mirrorAudio" value="phone">
                        <span><strong>Phone only</strong><small>No audio forwarding</small></span>
                    </label>
                </fieldset>

                <fieldset class="sf-mirror-choice sf-mirror-profiles">
                    <legend>Performance</legend>
                    <label>
                        <input type="radio" name="mirrorProfile" value="speed">
                        <span><strong>Fast</strong><small>120 FPS · 1024 px cap</small></span>
                    </label>
                    <label>
                        <input type="radio" name="mirrorProfile" value="balanced" checked>
                        <span><strong>Balanced</strong><small>60 FPS · 1600 px cap</small></span>
                    </label>
                    <label>
                        <input type="radio" name="mirrorProfile" value="ultra">
                        <span><strong>Ultra</strong><small>Native size · 16 Mbps · up to 120 FPS*</small></span>
                    </label>
                </fieldset>
                <p class="sf-mirror-note">*Real FPS and quality depend on the device encoder, screen refresh rate and Wi&#8209;Fi. Audio forwarding needs Android 11+.</p>

                <button class="sf-mirror-launch" type="submit">Launch session <span aria-hidden="true">→</span></button>
            </form>
        </details>

        <details class="sf-tool-group" data-tool-group="build">
            <summary>
                <span class="sf-tool-group-title">Build &amp; release</span>
                <span class="sf-tool-group-meta"><span>4 tools</span><span class="sf-tool-chevron" aria-hidden="true"></span></span>
            </summary>
            <div class="sf-tool-grid">
            <button class="sf-tool" type="button" id="toolFlavors" data-tool="flavors" title="Manage, run, and build Flutter flavors">
                <span class="sf-tool-name">Flavors</span>
                <span class="sf-tool-note">manage &amp; build</span>
            </button>
            <button class="sf-tool" type="button" id="toolSigningKey" data-tool="signingKey" title="Create an Android upload signing key">
                <span class="sf-tool-name">Signing Key</span>
                <span class="sf-tool-note">Android upload key</span>
            </button>
            <button class="sf-tool" type="button" id="toolWorkflow" data-tool="workflow" title="Generate GitHub Actions CI/CD workflow for building APK">
                <span class="sf-tool-name">GitHub Workflow</span>
                <span class="sf-tool-note">CI/CD APK build</span>
            </button>
            <button class="sf-tool" type="button" id="toolCompatDoctor" data-tool="compatDoctor" title="Run Flutter Compatibility Doctor &amp; Auto-Fixer">
                <span class="sf-tool-name">Compat Doctor</span>
                <span class="sf-tool-note">Gradle, AGP, Java &amp; iOS</span>
            </button>
            <button class="sf-tool" type="button" id="toolApkSize" data-tool="apkSize" title="Analyze APK &amp; App Bundle binary sizes">
                <span class="sf-tool-name">Size Analyzer</span>
                <span class="sf-tool-note">APK/AAB weights</span>
            </button>
            <button class="sf-tool" type="button" id="toolPubHealth" data-tool="pubHealth" title="Check pubspec.yaml dependencies and outdated packages">
                <span class="sf-tool-name">Pub Health</span>
                <span class="sf-tool-note">dependencies check</span>
            </button>
            </div>
        </details>

        <details class="sf-tool-group" data-tool-group="advanced">
            <summary>
                <span class="sf-tool-group-title">Network &amp; automation</span>
                <span class="sf-tool-group-meta"><span>4 tools</span><span class="sf-tool-chevron" aria-hidden="true"></span></span>
            </summary>
            <div class="sf-tool-grid">
            <button class="sf-tool" type="button" id="toolProxy" data-tool="proxy" title="Configure HTTP Proxy and Private DNS for network traffic inspection">
                <span class="sf-tool-name">Proxy / DNS</span>
                <span class="sf-tool-note">network inspector</span>
            </button>
            <button class="sf-tool" type="button" id="toolPushTester" data-tool="pushTester" title="Test push notification payloads and FCM broadcasts">
                <span class="sf-tool-name">Push Tester</span>
                <span class="sf-tool-note">FCM payloads</span>
            </button>
            <button class="sf-tool" type="button" id="toolAgentEngine" data-tool="agentEngine" title="Scaffold AI Sub-Agents and Multi-Agent Workflows">
                <span class="sf-tool-name">AI Agent Engine</span>
                <span class="sf-tool-note">sub-agents &amp; teams</span>
            </button>
            <button class="sf-tool" type="button" id="toolMcpHub" data-tool="mcpHub" title="Configure MCP servers for your AI coding agent">
                <span class="sf-tool-name">MCP Hub</span>
                <span class="sf-tool-note">AI agent servers</span>
            </button>
            </div>
        </details>
        </div>
        <p class="sf-tool-msg" id="toolMessage" hidden></p>
    </section>

    <!-- Deep storage & cache wiper -->
    <section class="sf-card" id="wipeCard" aria-label="Reset app state">
        <div class="sf-card-head">
            <h2 class="sf-label">Reset app state</h2>
            <button class="sf-icon-btn" type="button" id="pickWipePackageBtn" title="Choose target package" aria-label="Choose target package">&#9776;</button>
        </div>
        <p class="sf-wipe-pkg" id="wipePackage" title="Detected applicationId">detecting package…</p>
        <div class="sf-tool-grid sf-wipe-grid">
            <button class="sf-tool sf-tool-wide" type="button" id="inspectStorageBtn" data-tool="inspectStorage" title="Inspect and edit SharedPreferences and SQLite without erasing">
                <span class="sf-tool-name">Explore &amp; Edit Storage</span>
                <span class="sf-tool-note">SharedPreferences &amp; SQLite</span>
            </button>
            <button class="sf-tool" type="button" id="wipeCache" data-wipe="cache" title="Clear cached files only; preferences are kept on debug builds">
                <span class="sf-tool-name">Clear cache</span>
                <span class="sf-tool-note">keep prefs &amp; db</span>
            </button>
            <button class="sf-tool" type="button" id="wipeDatabases" data-wipe="databases" title="Delete local databases only; preferences are kept">
                <span class="sf-tool-name">Reset database</span>
                <span class="sf-tool-note">keep prefs</span>
            </button>
            <button class="sf-tool sf-tool-wide sf-tool-danger" type="button" id="wipeFactory" data-wipe="factory" title="Erase everything via pm clear, like a fresh install">
                <span class="sf-tool-name">Factory reset app</span>
                <span class="sf-tool-note">pm clear &middot; erases all data</span>
            </button>
        </div>
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

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
