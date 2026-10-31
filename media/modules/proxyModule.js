// Proxy & DNS Module
window.AirFlutterProxyModule = class AirFlutterProxyModule {
    initProxyModal() {
        const modal = document.getElementById('proxyModal');
        if (!modal) return;

        const closeBtn = document.getElementById('closeProxyModalBtn');
        const cancelBtn = document.getElementById('cancelProxyModalBtn');
        const applyProxyBtn = document.getElementById('applyProxyBtn');
        const clearProxyBtn = document.getElementById('clearProxyBtn');
        const applyDnsBtn = document.getElementById('applyDnsBtn');
        const clearDnsBtn = document.getElementById('clearDnsBtn');
        const refreshBtn = document.getElementById('refreshNetworkBtn');

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Port Presets
        document.querySelectorAll('.port-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const portInput = document.getElementById('proxyPortInput');
                if (portInput) portInput.value = btn.dataset.port || '';
            });
        });

        // DNS Presets
        document.querySelectorAll('.dns-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dnsInput = document.getElementById('dnsHostInput');
                if (dnsInput) dnsInput.value = btn.dataset.dns || '';
            });
        });

        if (applyProxyBtn) {
            applyProxyBtn.addEventListener('click', () => {
                const host = document.getElementById('proxyHostInput')?.value?.trim();
                const port = document.getElementById('proxyPortInput')?.value?.trim();
                if (!host || !port) {
                    this.showToast('Please enter both Proxy IP and Port', 'error');
                    return;
                }
                this.sendMessage('setProxy', { host, port });
            });
        }

        if (clearProxyBtn) {
            clearProxyBtn.addEventListener('click', () => {
                this.sendMessage('clearProxy', {});
            });
        }

        if (applyDnsBtn) {
            applyDnsBtn.addEventListener('click', () => {
                const host = document.getElementById('dnsHostInput')?.value?.trim();
                if (!host) {
                    this.showToast('Please enter a DNS hostname', 'error');
                    return;
                }
                this.sendMessage('setPrivateDns', { host });
            });
        }

        if (clearDnsBtn) {
            clearDnsBtn.addEventListener('click', () => {
                this.sendMessage('clearPrivateDns', {});
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.sendMessage('getNetworkState', {});
            });
        }
    }

    openProxyModal() {
        const modal = document.getElementById('proxyModal');
        if (modal) {
            modal.hidden = false;
            this.sendMessage('getNetworkState', {});
        }
    }

    renderNetworkState(data) {
        if (!data) return;

        const hostInput = document.getElementById('proxyHostInput');
        if (hostInput && data.localIp && !hostInput.value) {
            hostInput.value = data.localIp;
        }

        const proxyBadge = document.getElementById('currentProxyBadge');
        if (proxyBadge) {
            if (data.proxy) {
                proxyBadge.textContent = `Active: ${data.proxy}`;
                proxyBadge.className = 'status-badge is-active';
            } else {
                proxyBadge.textContent = 'Disabled (Direct)';
                proxyBadge.className = 'status-badge is-disabled';
            }
        }

        const dnsBadge = document.getElementById('currentDnsBadge');
        if (dnsBadge) {
            if (data.dnsMode === 'hostname' && data.dnsSpecifier) {
                dnsBadge.textContent = `Active: ${data.dnsSpecifier}`;
                dnsBadge.className = 'status-badge is-active';
            } else {
                dnsBadge.textContent = data.dnsMode ? `Mode: ${data.dnsMode}` : 'Default (Off)';
                dnsBadge.className = 'status-badge is-disabled';
            }
        }
    }

    // --- Screen Recording --------------------------------------------------

};
