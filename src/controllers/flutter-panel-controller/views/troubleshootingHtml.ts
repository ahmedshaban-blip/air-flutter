import * as vscode from 'vscode';
import * as path from 'path';

/**
 * HTML Template for Device Setup & Troubleshooting Guide
 */
export function getTroubleshootingContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): string {
  const mediaPath = path.join(context.extensionPath, 'media');
  const themeUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'theme.css')));
  const componentsUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'css', 'components.css')));

  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Air Flutter - Device Setup Guide</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <link href="${themeUri}" rel="stylesheet">
        <link href="${componentsUri}" rel="stylesheet">
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
