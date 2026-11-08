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
                applyProxyBtn.disabled = true;
                applyProxyBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Applying…';
                this.sendMessage('setProxy', { host, port });
            });
        }

        if (clearProxyBtn) {
            clearProxyBtn.addEventListener('click', () => {
                clearProxyBtn.disabled = true;
                clearProxyBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Clearing…';
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
                applyDnsBtn.disabled = true;
                applyDnsBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Applying…';
                this.sendMessage('setPrivateDns', { host });
            });
        }

        if (clearDnsBtn) {
            clearDnsBtn.addEventListener('click', () => {
                clearDnsBtn.disabled = true;
                clearDnsBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Clearing…';
                this.sendMessage('clearPrivateDns', {});
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span>';
                this.sendMessage('getNetworkState', {});
            });
        }
    }

    openProxyModal() {
        const modal = document.getElementById('proxyModal');
        if (modal) {
            modal.hidden = false;
            const proxyBadge = document.getElementById('currentProxyBadge');
            const dnsBadge = document.getElementById('currentDnsBadge');
            if (proxyBadge) {
                proxyBadge.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Reading…';
                proxyBadge.className = 'status-badge';
            }
            if (dnsBadge) {
                dnsBadge.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Reading…';
                dnsBadge.className = 'status-badge';
            }
            this.sendMessage('getNetworkState', {});
        }
    }

    renderNetworkState(data) {
        const applyProxyBtn = document.getElementById('applyProxyBtn');
        const clearProxyBtn = document.getElementById('clearProxyBtn');
        const applyDnsBtn = document.getElementById('applyDnsBtn');
        const clearDnsBtn = document.getElementById('clearDnsBtn');
        const refreshBtn = document.getElementById('refreshNetworkBtn');

        if (applyProxyBtn) {
            applyProxyBtn.disabled = false;
            applyProxyBtn.innerHTML = '<i class="fas fa-check"></i> Apply Proxy';
        }
        if (clearProxyBtn) {
            clearProxyBtn.disabled = false;
            clearProxyBtn.innerHTML = '<i class="fas fa-ban"></i> Clear Proxy';
        }
        if (applyDnsBtn) {
            applyDnsBtn.disabled = false;
            applyDnsBtn.innerHTML = '<i class="fas fa-check"></i> Apply DNS';
        }
        if (clearDnsBtn) {
            clearDnsBtn.disabled = false;
            clearDnsBtn.innerHTML = '<i class="fas fa-ban"></i> Clear DNS';
        }
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-arrows-rotate"></i>';
        }

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
