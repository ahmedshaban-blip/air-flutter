// Network & Screen State Lab Module
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
        const toggleOfflineBtn = document.getElementById('toggleOfflineBtn');
        const resetSimBtn = document.getElementById('resetNetworkSimulationBtn');

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Screen State Testing: Offline Toggle
        if (toggleOfflineBtn) {
            toggleOfflineBtn.addEventListener('click', () => {
                toggleOfflineBtn.disabled = true;
                toggleOfflineBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Updating…';
                this.sendMessage('toggleOfflineMode', {});
            });
        }

        // Screen State Testing: Reset Simulation
        if (resetSimBtn) {
            resetSimBtn.addEventListener('click', () => {
                resetSimBtn.disabled = true;
                resetSimBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Resetting…';
                this.sendMessage('resetNetworkSimulation', {});
            });
        }

        // Screen State Testing: Throttle Presets
        document.querySelectorAll('.throttle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                document.querySelectorAll('.throttle-btn').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                this.sendMessage('setNetworkThrottle', { preset });
            });
        });

        // Screen State Testing: Error Simulation Presets
        document.querySelectorAll('.error-sim-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const error = btn.dataset.error;
                document.querySelectorAll('.error-sim-btn').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                this.sendMessage('simulateNetworkError', { errorType: error });
            });
        });

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
        const resetSimBtn = document.getElementById('resetNetworkSimulationBtn');
        const toggleOfflineBtn = document.getElementById('toggleOfflineBtn');
        const toggleOfflineBtnText = document.getElementById('toggleOfflineBtnText');
        const offlineStateHint = document.getElementById('offlineStateHint');

        if (applyProxyBtn) {
            applyProxyBtn.disabled = false;
            applyProxyBtn.innerHTML = '<i class="fas fa-check"></i> Set Proxy';
        }
        if (clearProxyBtn) {
            clearProxyBtn.disabled = false;
            clearProxyBtn.innerHTML = '<i class="fas fa-times"></i> Clear Proxy';
        }
        if (applyDnsBtn) {
            applyDnsBtn.disabled = false;
            applyDnsBtn.innerHTML = '<i class="fas fa-check"></i> Set Private DNS';
        }
        if (clearDnsBtn) {
            clearDnsBtn.disabled = false;
            clearDnsBtn.innerHTML = '<i class="fas fa-times"></i> Turn Off DNS';
        }
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-rotate"></i> Refresh';
        }
        if (resetSimBtn) {
            resetSimBtn.disabled = false;
            resetSimBtn.innerHTML = '<i class="fas fa-arrow-rotate-left"></i> Reset to Normal';
        }

        if (!data) return;

        // 1. Offline Mode State
        const offlineBadge = document.getElementById('stateLabOfflineBadge');
        if (offlineBadge) {
            if (data.isOffline) {
                offlineBadge.textContent = data.offlineMode === 'isolated' ? 'Offline (Isolated)' : 'Offline (Airplane)';
                offlineBadge.className = 'status-badge is-warning';
            } else {
                offlineBadge.textContent = 'Online';
                offlineBadge.className = 'status-badge is-enabled';
            }
        }

        if (toggleOfflineBtn) {
            toggleOfflineBtn.disabled = false;
            if (data.isOffline) {
                toggleOfflineBtn.className = 'btn btn-primary';
                if (toggleOfflineBtnText) toggleOfflineBtnText.textContent = 'Restore Online';
                toggleOfflineBtn.innerHTML = '<i class="fas fa-wifi"></i> <span id="toggleOfflineBtnText">Restore Online</span>';
                if (offlineStateHint) offlineStateHint.textContent = `Active: ${data.offlineMode === 'isolated' ? 'Smart Isolated (Wireless Safe)' : 'Airplane Mode'}`;
            } else {
                toggleOfflineBtn.className = 'btn btn-danger';
                if (toggleOfflineBtnText) toggleOfflineBtnText.textContent = 'Go Offline (Isolated)';
                toggleOfflineBtn.innerHTML = '<i class="fas fa-plug-circle-xmark"></i> <span id="toggleOfflineBtnText">Go Offline (Isolated)</span>';
                if (offlineStateHint) offlineStateHint.textContent = 'Currently: Online';
            }
        }

        // 2. Link Badge
        const linkBadge = document.getElementById('stateLabLinkBadge');
        if (linkBadge) {
            if (data.isWireless) {
                linkBadge.textContent = 'Wireless (Wi-Fi)';
                linkBadge.className = 'status-badge is-active';
            } else if (data.isEmulator) {
                linkBadge.textContent = 'Emulator';
                linkBadge.className = 'status-badge is-active';
            } else {
                linkBadge.textContent = 'USB / Direct';
                linkBadge.className = 'status-badge is-active';
            }
        }

        // 3. Throttle Badge & Pills
        const throttleBadge = document.getElementById('stateLabThrottleBadge');
        if (throttleBadge) {
            if (data.activeThrottle) {
                throttleBadge.textContent = data.activeThrottle;
                throttleBadge.className = 'status-badge is-warning';
            } else {
                throttleBadge.textContent = 'Normal';
                throttleBadge.className = 'status-badge is-disabled';
            }
        }

        document.querySelectorAll('.throttle-btn').forEach(btn => {
            const p = btn.dataset.preset;
            if (!data.activeThrottle && p === 'normal') {
                btn.classList.add('is-active');
            } else if (data.activeThrottle && p && data.activeThrottle.toLowerCase().includes(p)) {
                btn.classList.add('is-active');
            } else if (!data.activeThrottle && p !== 'normal') {
                btn.classList.remove('is-active');
            }
        });

        // 4. Error Simulation Badge & Pills
        const errorBadge = document.getElementById('stateLabErrorBadge');
        if (errorBadge) {
            if (data.activeErrorSimulation) {
                errorBadge.textContent = data.activeErrorSimulation;
                errorBadge.className = 'status-badge is-danger';
            } else {
                errorBadge.textContent = 'None';
                errorBadge.className = 'status-badge is-disabled';
            }
        }

        document.querySelectorAll('.error-sim-btn').forEach(btn => {
            const err = btn.dataset.error;
            if (data.activeErrorSimulation && err && data.activeErrorSimulation.toLowerCase().includes(err.replace('http_', ''))) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });

        // 5. Proxy inputs and badge
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

        // 6. DNS badge
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

        // 7. Update quick sidebar offline button state if present
        const sidebarOfflineBtn = document.getElementById('sidebarToggleOfflineBtn');
        if (sidebarOfflineBtn) {
            if (data.isOffline) {
                sidebarOfflineBtn.classList.add('is-offline-active');
                sidebarOfflineBtn.title = 'Offline mode active (Click to restore online)';
            } else {
                sidebarOfflineBtn.classList.remove('is-offline-active');
                sidebarOfflineBtn.title = 'Toggle offline mode (Smart Isolated)';
            }
        }
    }
};
