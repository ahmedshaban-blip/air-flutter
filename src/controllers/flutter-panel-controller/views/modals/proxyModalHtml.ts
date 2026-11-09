export function getProxyModalHtml(): string {
  return `
        <!-- Network & Screen State Lab Modal -->
        <div class="modal-backdrop" id="proxyModal" hidden>
            <div class="modal-card modal-card-wide" style="max-width: 700px;">
                <div class="modal-head">
                    <h2><i class="fas fa-network-wired"></i> Network &amp; Screen State Lab</h2>
                    <button class="modal-close" id="closeProxyModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Live State Overview Header -->
                    <div class="modal-field state-lab-status-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; background: var(--card-bg, rgba(255,255,255,0.04)); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); margin-bottom: 14px;">
                        <div>
                            <span style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 2px;">Internet State:</span>
                            <span id="stateLabOfflineBadge" class="status-badge is-enabled">Online</span>
                        </div>
                        <div>
                            <span style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 2px;">Device Link:</span>
                            <span id="stateLabLinkBadge" class="status-badge">Auto</span>
                        </div>
                        <div>
                            <span style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 2px;">Network Throttle:</span>
                            <span id="stateLabThrottleBadge" class="status-badge is-disabled">Normal</span>
                        </div>
                        <div>
                            <span style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 2px;">Error Sim:</span>
                            <span id="stateLabErrorBadge" class="status-badge is-disabled">None</span>
                        </div>
                        <div style="display: flex; align-items: flex-end; justify-content: flex-end;">
                            <button class="btn btn-quiet" id="refreshNetworkBtn" type="button" title="Refresh network status">
                                <i class="fas fa-rotate"></i> Refresh
                            </button>
                        </div>
                    </div>

                    <!-- Flutter Dev Proxy Routing Notice -->
                    <div style="background: rgba(56, 189, 248, 0.08); border-left: 3px solid #38bdf8; padding: 10px 14px; border-radius: 4px; margin-bottom: 16px; font-size: 11.5px; line-height: 1.5;">
                        <div style="font-weight: 600; color: #38bdf8; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-circle-info"></i> How Flutter App Proxying Works (Important):
                        </div>
                        Flutter's Dart engine (<code>dart:io</code> / <code>Dio</code>) bypasses Android system proxies by default. For <strong>Loading/Latency Testing (3000ms delay)</strong> and <strong>Error Injection (HTTP 500/404)</strong> to intercept Flutter requests:
                        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-quiet btn-sm" id="generateFlutterOverridesBtn" type="button" style="border-color: #38bdf8; color: #38bdf8;">
                                <i class="fas fa-file-code"></i> Generate lib/dev_http_overrides.dart
                            </button>
                            <button class="btn btn-quiet btn-sm" id="copyFlutterOverridesSnippetBtn" type="button">
                                <i class="fas fa-copy"></i> Copy main() Hook Snippet
                            </button>
                        </div>
                    </div>

                    <!-- 1. Screen State Testing Section -->
                    <div class="state-lab-card" style="border: 1px solid var(--border-color, rgba(255,255,255,0.12)); border-radius: 8px; padding: 14px; margin-bottom: 18px; background: var(--bg-surface, rgba(0,0,0,0.15));">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h3 style="margin: 0; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-flask" style="color: var(--accent);"></i> Screen State Testing
                            </h3>
                            <button class="btn btn-quiet btn-sm" id="resetNetworkSimulationBtn" type="button" title="Restore network to normal">
                                <i class="fas fa-arrow-rotate-left"></i> Reset to Normal
                            </button>
                        </div>

                        <!-- A. Offline State Testing -->
                        <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed var(--border-color, rgba(255,255,255,0.08));">
                            <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">
                                <i class="fas fa-plane-slash"></i> Offline State Simulation
                            </label>
                            <p style="font-size: 11px; color: var(--muted); margin: 0 0 10px 0;">
                                Choose how to simulate offline mode. Instant DNS Drop fails lookups in 0.1s without hanging or disconnecting wireless ADB!
                            </p>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <button class="btn btn-danger" id="toggleDnsOfflineBtn" type="button" title="Drops host lookups immediately (0.1s). Safe for wireless ADB.">
                                    <i class="fas fa-bolt"></i> <span id="toggleDnsOfflineBtnText">Instant DNS Drop (Wireless Safe)</span>
                                </button>
                                <button class="btn btn-quiet" id="toggleHardwareOfflineBtn" type="button" title="Disables Wi-Fi & Cellular hardware. Real offline test for connectivity_plus.">
                                    <i class="fas fa-wifi"></i> <span id="toggleHardwareOfflineBtnText">Full Hardware Radio Cut</span>
                                </button>
                                <button class="btn btn-success" id="restoreOnlineBtn" type="button" style="display: none;">
                                    <i class="fas fa-globe"></i> Restore Online
                                </button>
                            </div>
                            <div id="offlineStateHint" style="font-size: 11px; color: var(--muted); margin-top: 6px;">Currently: Online</div>
                        </div>

                        <!-- B. Loading State / Network Throttling -->
                        <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed var(--border-color, rgba(255,255,255,0.08));">
                            <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">
                                <i class="fas fa-gauge-simple-high"></i> Loading &amp; Shimmer Testing (Throttling / Latency)
                            </label>
                            <p style="font-size: 11px; color: var(--muted); margin: 0 0 8px 0;">
                                Throttles connection or injects 3-second delay to test loading spinners, shimmers, and skeleton loaders.
                            </p>
                            <div class="preset-pill-group" style="display: flex; flex-wrap: wrap; gap: 6px;">
                                <button class="preset-pill throttle-btn is-active" type="button" data-preset="normal">⚡ Normal (Full Speed)</button>
                                <button class="preset-pill throttle-btn" type="button" data-preset="delay3s">⏳ 3000ms Delay (Shimmer Test)</button>
                                <button class="preset-pill throttle-btn" type="button" data-preset="2g">🐌 Slow 2G (GPRS)</button>
                                <button class="preset-pill throttle-btn" type="button" data-preset="3g">📶 Regular 3G</button>
                            </div>
                        </div>

                        <!-- C. Error State Simulation -->
                        <div>
                            <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">
                                <i class="fas fa-triangle-exclamation"></i> Error State Injection
                            </label>
                            <p style="font-size: 11px; color: var(--muted); margin: 0 0 8px 0;">
                                Force API calls to fail immediately with connection drops or simulated server responses.
                            </p>
                            <div class="preset-pill-group" style="display: flex; flex-wrap: wrap; gap: 6px;">
                                <button class="preset-pill error-sim-btn" type="button" data-error="connection_refused">💥 Connection Drop (Instant SocketException)</button>
                                <button class="preset-pill error-sim-btn" type="button" data-error="http_500">🚨 HTTP 500 (Internal Error)</button>
                                <button class="preset-pill error-sim-btn" type="button" data-error="http_404">🔍 HTTP 404 (Not Found)</button>
                                <button class="preset-pill error-sim-btn" type="button" data-error="http_401">🔒 HTTP 401 (Unauthorized)</button>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Developer HTTP Proxy Section -->
                    <div class="modal-field" style="margin-top: 14px;">
                        <label style="font-size: 13px; font-weight: 600;"><i class="fas fa-shield-halved"></i> HTTP Proxy (Charles / Proxyman / Fiddler)</label>
                        <div style="display: flex; gap: 12px; align-items: center; margin: 4px 0 8px 0;">
                            <span style="font-size: 11px; color: var(--muted);">Current Device Proxy:</span>
                            <span id="currentProxyBadge" class="status-badge is-disabled">Disabled</span>
                        </div>
                        <div class="path-picker-row">
                            <input type="text" id="proxyHostInput" placeholder="Proxy IP (e.g. 192.168.1.15)" style="flex: 2;" />
                            <input type="text" id="proxyPortInput" placeholder="Port" value="8888" style="flex: 1;" />
                        </div>
                        <div class="preset-pill-group" style="margin-top: 6px;">
                            <span style="font-size: 11px; color: var(--muted); margin-right: 4px;">Presets:</span>
                            <button class="preset-pill port-preset-btn" type="button" data-port="8888">Charles (8888)</button>
                            <button class="preset-pill port-preset-btn" type="button" data-port="9090">Proxyman (9090)</button>
                            <button class="preset-pill port-preset-btn" type="button" data-port="8866">Fiddler (8866)</button>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button class="btn btn-primary" id="applyProxyBtn" type="button"><i class="fas fa-check"></i> Set Proxy</button>
                            <button class="btn btn-quiet" id="clearProxyBtn" type="button"><i class="fas fa-times"></i> Clear Proxy</button>
                        </div>
                    </div>

                    <!-- 3. Private DNS Section -->
                    <div class="modal-field" style="margin-top: 18px;">
                        <label style="font-size: 13px; font-weight: 600;"><i class="fas fa-globe"></i> Android Private DNS (DNS-over-TLS)</label>
                        <div style="display: flex; gap: 12px; align-items: center; margin: 4px 0 8px 0;">
                            <span style="font-size: 11px; color: var(--muted);">Current Private DNS:</span>
                            <span id="currentDnsBadge" class="status-badge is-disabled">Default (Off)</span>
                        </div>
                        <div class="path-picker-row">
                            <input type="text" id="dnsHostInput" placeholder="DNS Hostname (e.g. dns.google)" />
                        </div>
                        <div class="preset-pill-group" style="margin-top: 6px;">
                            <span style="font-size: 11px; color: var(--muted); margin-right: 4px;">Presets:</span>
                            <button class="preset-pill dns-preset-btn" type="button" data-dns="dns.google">Google</button>
                            <button class="preset-pill dns-preset-btn" type="button" data-dns="1dot1dot1dot1.cloudflare-dns.com">Cloudflare</button>
                            <button class="preset-pill dns-preset-btn" type="button" data-dns="dns.adguard-dns.com">AdGuard</button>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button class="btn btn-primary" id="applyDnsBtn" type="button"><i class="fas fa-check"></i> Set Private DNS</button>
                            <button class="btn btn-quiet" id="clearDnsBtn" type="button"><i class="fas fa-times"></i> Turn Off DNS</button>
                        </div>
                    </div>
                </div>
                <div class="modal-foot">
                    <button class="btn btn-quiet" id="cancelProxyModalBtn" type="button">Close</button>
                </div>
            </div>
        </div>`;
}
