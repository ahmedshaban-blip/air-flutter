export function getSslDoctorViewHtml(): string {
  return `
    <section data-panel-view="ssl-proxy" hidden aria-label="SSL and Proxy Doctor">
        <div class="ssl-layout">
            <div class="ff-section ssl-head-bar">
                <div class="ff-section-head">
                    <div>
                        <h2>SSL &amp; Proxy Doctor</h2>
                        <p class="ssl-kicker">Android Network Security Config &middot; Dart HttpOverrides &middot; Charles &amp; Proxyman Bridge</p>
                    </div>
                    <button class="btn btn-quiet" id="sslRefreshBtn" type="button">
                        <i class="fas fa-rotate"></i> Refresh Status
                    </button>
                </div>
            </div>

            <div class="ssl-grid">
                <!-- Android Network Security Card -->
                <div class="ff-section ssl-card">
                    <div class="ff-section-head">
                        <h3><i class="fas fa-shield-halved"></i> 1. Android Network Security Config</h3>
                        <span id="sslXmlBadge" class="status-badge is-disabled">Unconfigured</span>
                    </div>
                    <p class="ssl-desc">
                        Android 7.0+ ignores user-installed CA certificates by default, blocking Charles and Proxyman inspection.
                        This generates <span class="mono">res/xml/network_security_config.xml</span> with <span class="mono">&lt;certificates src="user" /&gt;</span> and links it in <span class="mono">AndroidManifest.xml</span>.
                    </p>
                    <div class="ssl-checklist">
                        <div class="ssl-check-item">
                            <i id="sslXmlCheckIcon" class="fas fa-circle-xmark status-icon-no"></i>
                            <span>XML Config: <code id="sslXmlPathText">android/app/src/main/res/xml/network_security_config.xml</code></span>
                        </div>
                        <div class="ssl-check-item">
                            <i id="sslManifestCheckIcon" class="fas fa-circle-xmark status-icon-no"></i>
                            <span>AndroidManifest.xml: <code id="sslManifestTagText">android:networkSecurityConfig</code> linked</span>
                        </div>
                    </div>
                    <button class="btn btn-primary" id="sslApplyConfigBtn" type="button" style="margin-top: 12px;">
                        <i class="fas fa-wand-magic-sparkles"></i> Generate &amp; Link Network Security Config
                    </button>
                </div>

                <!-- Dart HttpOverrides Card -->
                <div class="ff-section ssl-card">
                    <div class="ff-section-head">
                        <h3><i class="fas fa-code"></i> 2. Dart HttpOverrides (Proxy Route)</h3>
                        <span id="sslOverridesBadge" class="status-badge is-disabled">Missing</span>
                    </div>
                    <p class="ssl-desc">
                        Flutter's Dart <span class="mono">HttpClient</span> bypasses system proxy settings. You must attach an <span class="mono">HttpOverrides</span> instance in your main entrypoint.
                    </p>
                    <button class="btn btn-quiet" id="sslGenerateOverridesBtn" type="button" style="margin-bottom: 10px;">
                        <i class="fas fa-file-plus"></i> Create lib/dev_http_overrides.dart
                    </button>
                    <div class="ssl-code-preview">
                        <pre class="mono" id="sslSnippetPre">// In lib/main.dart:
void main() {
  if (kDebugMode) {
    HttpOverrides.global = DevHttpOverrides(
      proxyHost: '192.168.1.XX', // Your desktop IP
      proxyPort: 8888,
    );
  }
  runApp(const MyApp());
}</pre>
                        <button class="btn btn-quiet btn-xs ssl-copy-btn" id="sslCopySnippetBtn" type="button">
                            <i class="fas fa-copy"></i> Copy Snippet
                        </button>
                    </div>
                </div>

                <!-- HTTP Proxy Quick Controls -->
                <div class="ff-section ssl-card ssl-card-wide">
                    <div class="ff-section-head">
                        <h3><i class="fas fa-network-wired"></i> 3. Connected Device Proxy &amp; Private DNS</h3>
                        <div style="display:flex; gap:8px;">
                            <span id="sslProxyLiveBadge" class="status-badge is-disabled">Proxy: Off</span>
                            <span id="sslDnsLiveBadge" class="status-badge is-disabled">DNS: Off</span>
                        </div>
                    </div>
                    <div class="ssl-proxy-controls">
                        <div class="ssl-proxy-col">
                            <label class="ssl-label">Device HTTP Proxy:</label>
                            <div class="path-picker-row">
                                <input type="text" id="sslProxyHostInput" placeholder="Proxy IP (e.g. 192.168.1.15)" style="flex: 2;">
                                <input type="text" id="sslProxyPortInput" placeholder="Port" value="8888" style="flex: 1;">
                            </div>
                            <div class="preset-pill-group" style="margin-top: 6px;">
                                <span style="font-size: 11px; color: var(--muted); margin-right: 4px;">Presets:</span>
                                <button class="preset-pill ssl-port-preset" type="button" data-port="8888">Charles (8888)</button>
                                <button class="preset-pill ssl-port-preset" type="button" data-port="9090">Proxyman (9090)</button>
                                <button class="preset-pill ssl-port-preset" type="button" data-port="8866">Fiddler (8866)</button>
                            </div>
                            <div style="display: flex; gap: 8px; margin-top: 10px;">
                                <button class="btn btn-primary" id="sslApplyProxyBtn" type="button"><i class="fas fa-check"></i> Set Proxy</button>
                                <button class="btn btn-quiet" id="sslClearProxyBtn" type="button"><i class="fas fa-times"></i> Clear Proxy</button>
                            </div>
                        </div>

                        <div class="ssl-proxy-col">
                            <label class="ssl-label">Android Private DNS (DoT):</label>
                            <div class="path-picker-row">
                                <input type="text" id="sslDnsHostInput" placeholder="DNS Hostname (e.g. dns.google)">
                            </div>
                            <div class="preset-pill-group" style="margin-top: 6px;">
                                <span style="font-size: 11px; color: var(--muted); margin-right: 4px;">Presets:</span>
                                <button class="preset-pill ssl-dns-preset" type="button" data-dns="dns.google">Google</button>
                                <button class="preset-pill ssl-dns-preset" type="button" data-dns="1dot1dot1dot1.cloudflare-dns.com">Cloudflare</button>
                                <button class="preset-pill ssl-dns-preset" type="button" data-dns="dns.adguard-dns.com">AdGuard</button>
                            </div>
                            <div style="display: flex; gap: 8px; margin-top: 10px;">
                                <button class="btn btn-primary" id="sslApplyDnsBtn" type="button"><i class="fas fa-check"></i> Set DNS</button>
                                <button class="btn btn-quiet" id="sslClearDnsBtn" type="button"><i class="fas fa-times"></i> Turn Off DNS</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ssl-status-bar" id="sslDoctorStatusBar" role="status">Ready.</div>
        </div>
    </section>
  `;
}

