export function getProxyModalHtml(): string {
  return `
        <!-- Network Proxy & Private DNS Modal -->
        <div class="modal-backdrop" id="proxyModal" hidden>
            <div class="modal-card">
                <div class="modal-head">
                    <h2><i class="fas fa-network-wired"></i> Network Proxy &amp; Private DNS</h2>
                    <button class="modal-close" id="closeProxyModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="modal-field" style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px;">
                        <div><span style="font-size: 11px; color: var(--muted); display: block;">HTTP Proxy:</span> <span id="currentProxyBadge" class="status-badge is-disabled">Disabled</span></div>
                        <div><span style="font-size: 11px; color: var(--muted); display: block;">Private DNS:</span> <span id="currentDnsBadge" class="status-badge is-disabled">Default (Off)</span></div>
                        <button class="btn btn-quiet" id="refreshNetworkBtn" type="button" style="margin-left: auto;">
                            <i class="fas fa-rotate"></i> Refresh
                        </button>
                    </div>

                    <div class="modal-field">
                        <label><i class="fas fa-shield-halved"></i> HTTP Proxy Configuration</label>
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

                    <div class="modal-field" style="margin-top: 20px;">
                        <label><i class="fas fa-globe"></i> Android Private DNS (DNS-over-TLS)</label>
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

