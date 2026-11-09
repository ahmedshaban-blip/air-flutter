window.AirFlutterSslDoctorModule = class AirFlutterSslDoctorModule {
    initSslDoctor() {
        const refreshBtn = document.getElementById('sslRefreshBtn');
        const applyConfigBtn = document.getElementById('sslApplyConfigBtn');
        const generateOverridesBtn = document.getElementById('sslGenerateOverridesBtn');
        const copySnippetBtn = document.getElementById('sslCopySnippetBtn');
        const applyProxyBtn = document.getElementById('sslApplyProxyBtn');
        const clearProxyBtn = document.getElementById('sslClearProxyBtn');
        const applyDnsBtn = document.getElementById('sslApplyDnsBtn');
        const clearDnsBtn = document.getElementById('sslClearDnsBtn');

        if (!refreshBtn) return;

        refreshBtn.addEventListener('click', () => {
            this.sendMessage('checkNetworkSecurityStatus', {});
            this.sendMessage('getNetworkState', {});
        });

        applyConfigBtn?.addEventListener('click', () => {
            this.sendMessage('applyNetworkSecurityConfig', {});
        });

        generateOverridesBtn?.addEventListener('click', () => {
            this.sendMessage('generateDevHttpOverridesFile', {});
        });

        copySnippetBtn?.addEventListener('click', () => {
            const pre = document.getElementById('sslSnippetPre');
            if (pre) {
                navigator.clipboard.writeText(pre.textContent || '');
                this.showToast('Copied HttpOverrides snippet to clipboard!', 'success');
            }
        });

        // Proxy presets
        document.querySelectorAll('.ssl-port-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const port = btn.getAttribute('data-port');
                const portInput = document.getElementById('sslProxyPortInput');
                if (portInput && port) portInput.value = port;
            });
        });

        applyProxyBtn?.addEventListener('click', () => {
            const host = document.getElementById('sslProxyHostInput')?.value?.trim();
            const port = parseInt(document.getElementById('sslProxyPortInput')?.value?.trim() || '8888', 10);
            if (!host) {
                this.showToast('Please enter a proxy IP address.', 'error');
                return;
            }
            this.sendMessage('setProxy', { host, port });
        });

        clearProxyBtn?.addEventListener('click', () => {
            this.sendMessage('clearProxy', {});
        });

        // DNS presets
        document.querySelectorAll('.ssl-dns-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const dns = btn.getAttribute('data-dns');
                const dnsInput = document.getElementById('sslDnsHostInput');
                if (dnsInput && dns) dnsInput.value = dns;
            });
        });

        applyDnsBtn?.addEventListener('click', () => {
            const host = document.getElementById('sslDnsHostInput')?.value?.trim();
            if (!host) {
                this.showToast('Please enter a DNS hostname.', 'error');
                return;
            }
            this.sendMessage('setDns', { host });
        });

        clearDnsBtn?.addEventListener('click', () => {
            this.sendMessage('clearDns', {});
        });
    }

    handleSslDoctorStatus(data, error) {
        const statusBar = document.getElementById('sslDoctorStatusBar');
        if (error) {
            if (statusBar) statusBar.textContent = `Error: ${error}`;
            return;
        }
        if (!data) return;

        const xmlBadge = document.getElementById('sslXmlBadge');
        const xmlCheck = document.getElementById('sslXmlCheckIcon');
        const manifestCheck = document.getElementById('sslManifestCheckIcon');
        const overridesBadge = document.getElementById('sslOverridesBadge');

        if (data.hasXmlConfig) {
            if (xmlBadge) {
                xmlBadge.className = 'status-badge is-enabled';
                xmlBadge.textContent = 'Configured';
            }
            if (xmlCheck) {
                xmlCheck.className = 'fas fa-circle-check status-icon-ok';
            }
        } else {
            if (xmlBadge) {
                xmlBadge.className = 'status-badge is-disabled';
                xmlBadge.textContent = 'Unconfigured';
            }
            if (xmlCheck) {
                xmlCheck.className = 'fas fa-circle-xmark status-icon-no';
            }
        }

        if (data.isManifestLinked) {
            if (manifestCheck) {
                manifestCheck.className = 'fas fa-circle-check status-icon-ok';
            }
        } else {
            if (manifestCheck) {
                manifestCheck.className = 'fas fa-circle-xmark status-icon-no';
            }
        }

        if (data.hasDevHttpOverrides) {
            if (overridesBadge) {
                overridesBadge.className = 'status-badge is-enabled';
                overridesBadge.textContent = 'Created (lib/dev_http_overrides.dart)';
            }
        } else {
            if (overridesBadge) {
                overridesBadge.className = 'status-badge is-disabled';
                overridesBadge.textContent = 'Missing';
            }
        }

        if (statusBar) statusBar.textContent = `Network status checked at ${new Date().toLocaleTimeString()}.`;
    }
};

