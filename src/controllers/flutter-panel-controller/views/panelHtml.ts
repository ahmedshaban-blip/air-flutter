import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkflowModalHtml } from './modals/workflowModalHtml';
import { getFlavorsModalHtml } from './modals/flavorsModalHtml';
import { getProxyModalHtml } from './modals/proxyModalHtml';
import { getAgentScaffoldModalHtml } from './modals/agentScaffoldModalHtml';
import { getCompatDoctorModalHtml } from './modals/compatDoctorModalHtml';

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
  const workflowModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'workflowModule.js')));
  const flavorsModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'flavorsModule.js')));
  const proxyModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'proxyModule.js')));
  const recorderModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'recorderModule.js')));
  const agentScaffoldModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'agentScaffoldModule.js')));
  const compatAuditUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'compat', 'compatAuditView.js')));
  const compatConfigUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'compat', 'compatConfigView.js')));
  const compatDoctorModuleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'modules', 'compatDoctorModule.js')));
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'air-flutter.js')));

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

${getWorkflowModalHtml()}
${getFlavorsModalHtml()}
${getProxyModalHtml()}
${getAgentScaffoldModalHtml()}
${getCompatDoctorModalHtml()}

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

        <script src="${workflowModuleUri}"></script>
        <script src="${flavorsModuleUri}"></script>
        <script src="${proxyModuleUri}"></script>
        <script src="${recorderModuleUri}"></script>
        <script src="${agentScaffoldModuleUri}"></script>
        <script src="${compatAuditUri}"></script>
        <script src="${compatConfigUri}"></script>
        <script src="${compatDoctorModuleUri}"></script>
        <script src="${scriptUri}" onerror="document.body.classList.add('script-error')"></script>
    </body>
    </html>`;
}
