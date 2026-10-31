import * as vscode from 'vscode';
import * as crypto from 'crypto';

export function getSidebarWebviewHtml(
  webview: vscode.Webview,
  styleUri: vscode.Uri,
  scriptUri: vscode.Uri,
  version: string
): string {
  const nonce = crypto.randomBytes(16).toString('base64');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src ${webview.cspSource} https://fonts.gstatic.com; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>Air Flutter</title>
</head>
<body>
    <header class="sf-masthead">
        <svg class="sf-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="0.75" y="0.75" width="30.5" height="30.5" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
            <path d="M9 9 L17 16 L9 23" fill="none" stroke="var(--accent)" stroke-width="2.6"></path>
            <path d="M20 21 H25" fill="none" stroke="currentColor" stroke-width="2"></path>
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

    <!-- Developer tools -->
    <section>
        <h2 class="sf-label">Tools</h2>
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
            <button class="sf-tool" type="button" id="toolSendText" data-tool="sendText" title="Send clipboard or text to phone's active input">
                <span class="sf-tool-name">Send text</span>
                <span class="sf-tool-note">paste to phone</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolInstallApk" data-tool="installApk" title="Install an APK file to connected phone">
                <span class="sf-tool-name">Install APK</span>
                <span class="sf-tool-note">select &amp; install to device</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolWorkflow" data-tool="workflow" title="Generate GitHub Actions CI/CD workflow for building APK">
                <span class="sf-tool-name">GitHub Workflow</span>
                <span class="sf-tool-note">CI/CD APK build action</span>
            </button>
            <button class="sf-tool" type="button" id="toolRecord" data-tool="record" title="Record device screen to MP4">
                <span class="sf-tool-name">Record Video</span>
                <span class="sf-tool-note">start MP4 recording</span>
            </button>
            <button class="sf-tool" type="button" id="toolFlavors" data-tool="flavors" title="Manage, run, and build Flutter flavors">
                <span class="sf-tool-name">Flavors</span>
                <span class="sf-tool-note">manage &amp; build</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolProxy" data-tool="proxy" title="Configure HTTP Proxy and Private DNS for network traffic inspection">
                <span class="sf-tool-name">Proxy / DNS</span>
                <span class="sf-tool-note">network inspector</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolAgentEngine" data-tool="agentEngine" title="Scaffold AI Sub-Agents and Multi-Agent Workflows">
                <span class="sf-tool-name">AI Agent Engine</span>
                <span class="sf-tool-note">scaffold sub-agents &amp; teams</span>
            </button>
            <button class="sf-tool sf-tool-wide" type="button" id="toolCompatDoctor" data-tool="compatDoctor" title="Run Flutter Compatibility Doctor &amp; Auto-Fixer">
                <span class="sf-tool-name">Compat Doctor</span>
                <span class="sf-tool-note">Gradle, AGP, Java &amp; iOS</span>
            </button>
        </div>
        <p class="sf-tool-msg" id="toolMessage" hidden></p>
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
