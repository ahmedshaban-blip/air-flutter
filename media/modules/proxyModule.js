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
        const toggleDnsOfflineBtn = document.getElementById('toggleDnsOfflineBtn');
        const toggleHwOfflineBtn = document.getElementById('toggleHardwareOfflineBtn');
        const restoreOnlineBtn = document.getElementById('restoreOnlineBtn');
        const resetSimBtn = document.getElementById('resetNetworkSimulationBtn');
        const genOverridesBtn = document.getElementById('generateFlutterOverridesBtn');
        const copySnippetBtn = document.getElementById('copyFlutterOverridesSnippetBtn');

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Screen State Testing: DNS Drop Offline (Wireless-Safe)
        if (toggleDnsOfflineBtn) {
            toggleDnsOfflineBtn.addEventListener('click', () => {
                toggleDnsOfflineBtn.disabled = true;
                toggleDnsOfflineBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Applying…';
                this.sendMessage('toggleOfflineMode', { modePreference: 'dns_drop' });
            });
        }

        // Screen State Testing: Full Hardware Radio Cut
        if (toggleHwOfflineBtn) {
            toggleHwOfflineBtn.addEventListener('click', () => {
                toggleHwOfflineBtn.disabled = true;
                toggleHwOfflineBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Cutting…';
                this.sendMessage('toggleOfflineMode', { modePreference: 'hardware' });
            });
        }

        // Screen State Testing: Restore Online
        if (restoreOnlineBtn) {
            restoreOnlineBtn.addEventListener('click', () => {
                restoreOnlineBtn.disabled = true;
                restoreOnlineBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Restoring…';
                this.sendMessage('toggleOfflineMode', { modePreference: 'auto' });
            });
        }

        // Generate Flutter Overrides in lib/dev_http_overrides.dart
        if (genOverridesBtn) {
            genOverridesBtn.addEventListener('click', () => {
                this.sendMessage('generateFlutterOverrides', {});
            });
        }

        // Copy main() snippet
        if (copySnippetBtn) {
            copySnippetBtn.addEventListener('click', () => {
                const snippet = `// In your lib/main.dart:
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'dev_http_overrides.dart';

void main() {
  if (kDebugMode) {
    HttpOverrides.global = DevHttpOverrides();
  }
  runApp(const MyApp());
}`;
                navigator.clipboard.writeText(snippet).then(() => {
                  this.showToast('Copied main() hook snippet to clipboard!', 'success');
                }).catch(() => {
                  this.showToast('Copied hook snippet!', 'info');
                });
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
        const toggleDnsOfflineBtn = document.getElementById('toggleDnsOfflineBtn');
        const toggleHwOfflineBtn = document.getElementById('toggleHardwareOfflineBtn');
        const restoreOnlineBtn = document.getElementById('restoreOnlineBtn');
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

        if (toggleDnsOfflineBtn) {
            toggleDnsOfflineBtn.disabled = false;
            toggleDnsOfflineBtn.innerHTML = '<i class="fas fa-bolt"></i> Instant DNS Drop (Wireless Safe)';
        }
        if (toggleHwOfflineBtn) {
            toggleHwOfflineBtn.disabled = false;
            toggleHwOfflineBtn.innerHTML = '<i class="fas fa-wifi"></i> Full Hardware Radio Cut';
        }
        if (restoreOnlineBtn) {
            restoreOnlineBtn.disabled = false;
            restoreOnlineBtn.innerHTML = '<i class="fas fa-globe"></i> Restore Online';
        }

        if (!data) return;

        // 1. Offline Mode State
        const offlineBadge = document.getElementById('stateLabOfflineBadge');
        if (offlineBadge) {
            if (data.isOffline) {
                const label = data.offlineMode === 'dns_drop' ? 'Offline (DNS Drop)' : (data.offlineMode === 'hardware' ? 'Offline (Hardware Radio)' : 'Offline (Isolated)');
                offlineBadge.textContent = label;
                offlineBadge.className = 'status-badge is-warning';
            } else {
                offlineBadge.textContent = 'Online';
                offlineBadge.className = 'status-badge is-enabled';
            }
        }

        if (restoreOnlineBtn) {
            restoreOnlineBtn.style.display = data.isOffline ? 'inline-flex' : 'none';
        }

        if (offlineStateHint) {
            if (data.isOffline) {
                offlineStateHint.innerHTML = `<span style="color: var(--err, #ef4444); font-weight: 600;">⚠️ Device is OFFLINE</span> (${data.offlineMode === 'dns_drop' ? 'Host lookups blocked immediately; Wireless ADB safe' : 'Hardware radios turned off'}).`;
            } else {
                offlineStateHint.textContent = 'Currently: Online (Connected)';
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
