// Air Flutter Webview JavaScript
console.log('🔄 Air Flutter JS loading...');

class AirFlutterWebview {
    constructor() {
        this.isExecuting = false; // Prevent duplicate execution
        this.initializeEventListeners();
        this.initializeToasts();
        console.log('✅ Air Flutter Webview initialized');
    }

    initializeEventListeners() {
        try {
            const refreshBtn = document.getElementById('refreshDevicesBtn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    if (!this.isExecuting) {
                        this.refreshDevices();
                    }
                });
            }

            const refreshUsbBtn = document.getElementById('refreshUsbDevicesBtn');
            if (refreshUsbBtn) {
                refreshUsbBtn.addEventListener('click', () => this.refreshDevices(refreshUsbBtn));
            }

            const setScrcpyPathBtn = document.getElementById('setScrcpyPathBtn');
            if (setScrcpyPathBtn) {
                setScrcpyPathBtn.addEventListener('click', () => {
                    this.sendMessage('setScrcpyPath', {});
                });
            }

            this.bindDeviceActions('usbDevicesList');
            this.bindDeviceActions('networkDevicesList');
            this.bindDeviceActions('devicesList');

            const setupGuideBtn = document.querySelector('button[onclick*="showTroubleshootingGuide"]');
            if (setupGuideBtn) {
                setupGuideBtn.removeAttribute('onclick');
                setupGuideBtn.addEventListener('click', () => this.showTroubleshootingGuide());
            }

            // Wire every command row to the extension host.
            const commandButtons = document.querySelectorAll('button[onclick*="airFlutter.executeFlutterCommand"]');
            commandButtons.forEach(button => {
                const onclickAttr = button.getAttribute('onclick');
                if (!onclickAttr) {
                    return;
                }
                const match = onclickAttr.match(/airFlutter\.executeFlutterCommand\('([^']+)'\)/);
                if (!match || !match[1]) {
                    return;
                }
                const commandId = match[1];
                button.removeAttribute('onclick');
                button.addEventListener('click', () => this.executeFlutterCommand(commandId));
            });

            const clearStatusBtn = document.getElementById('clearStatusBtn');
            if (clearStatusBtn) {
                clearStatusBtn.addEventListener('click', () => this.clearStatusMessages());
            }
        } catch (error) {
            console.error('❌ Error initializing event listeners:', error);
        }
    }

    refreshDevices(triggerButton) {
        const refreshBtn = triggerButton || document.getElementById('refreshDevicesBtn');
        if (!refreshBtn) {
            return;
        }
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i>';
        refreshBtn.disabled = true;

        this.sendMessage('refreshDevices', {});

        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 2400);
    }

    executeFlutterCommand(commandId) {
        if (this.isExecuting) {
            console.log('Command already executing, skipping:', commandId);
            return;
        }

        this.isExecuting = true;
        console.log('Executing Flutter command:', commandId);

        this.addStatusMessage(`Executing Flutter command: ${commandId}`, 'info');
        this.sendMessage('runFlutterCommand', { commandId });

        let buttons = Array.from(document.querySelectorAll(`[data-command="${commandId}"]`));
        if (buttons.length === 0) {
            buttons = Array.from(document.querySelectorAll('button')).filter(btn => {
                const onclick = btn.getAttribute('onclick');
                return onclick && onclick.includes(`executeFlutterCommand('${commandId}')`);
            });
        }

        buttons.forEach(button => {
            const originalHtml = button.innerHTML;
            button.classList.add('is-running');
            button.disabled = true;

            setTimeout(() => {
                button.innerHTML = originalHtml;
                button.classList.remove('is-running');
                button.disabled = false;
            }, 3000);
        });

        setTimeout(() => {
            this.isExecuting = false;
        }, 3000);
    }

    updateDevicesList(devices) {
        const devicesList = document.getElementById('devicesList');
        if (!devicesList) {
            return;
        }

        if (!devices || devices.length === 0) {
            devicesList.innerHTML = `
                <p class="empty"><i class="fas fa-mobile-screen"></i><span>No device connected</span></p>
            `;
            return;
        }

        devicesList.innerHTML = devices.map(device => {
            const offline = device.status !== 'online' ? 'disabled' : '';
            return `
            <div class="device">
                <div class="device-row">
                    <span class="dot ${device.status}" aria-hidden="true"></span>
                    <div class="device-id">
                        <h4>${this.escapeHtml(device.name)}</h4>
                        <span class="mono">${this.escapeHtml(device.id)} · ${this.escapeHtml(device.transport)}</span>
                        <span class="device-state ${device.status}">${device.status}</span>
                    </div>
                    <div class="device-actions">
                        <button class="icon-btn icon-btn-danger" data-device-action="disconnect" data-device-id="${this.escapeHtml(device.id)}" title="Disconnect" aria-label="Disconnect" ${device.transport !== 'wireless' ? 'disabled' : ''}>
                            <i class="fas fa-unlink"></i>
                        </button>
                    </div>
                </div>
                <div class="device-mirror">
                    <button class="mirror-btn" data-device-action="mirror" data-device-id="${this.escapeHtml(device.id)}" ${offline}>
                        Screen
                    </button>
                    <button class="mirror-btn" data-device-action="mirror-off" data-device-id="${this.escapeHtml(device.id)}" ${offline}>
                        Screen off
                    </button>
                    <button class="mirror-btn" data-device-action="mirror-keys" data-device-id="${this.escapeHtml(device.id)}" ${offline}>
                        + Keyboard
                    </button>
                    <button class="mirror-btn" data-device-action="mirror-virtual" data-device-id="${this.escapeHtml(device.id)}" ${offline}>
                        Phone off
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    updateUsbDevicesList(devices) {
        const devicesList = document.getElementById('usbDevicesList');
        if (!devicesList) {
            return;
        }

        if (!devices || devices.length === 0) {
            devicesList.innerHTML = `
                <p class="empty"><i class="fas fa-usb"></i><span>No USB device attached</span></p>
            `;
            return;
        }

        devicesList.innerHTML = devices.map(device => `
            <div class="device">
                <div class="device-id">
                    <h4>${this.escapeHtml(device.name)}</h4>
                    <span class="mono">${this.escapeHtml(device.id)}</span>
                </div>
                <button class="btn btn-primary btn-block" data-device-action="connect-usb" data-device-id="${this.escapeHtml(device.id)}" ${device.status !== 'online' ? 'disabled' : ''}>
                    <i class="fas fa-wifi"></i> ${device.status === 'unauthorized' ? 'Authorize on phone' : 'Connect wirelessly'}
                </button>
            </div>
        `).join('');
    }

    updateNetworkDevicesList(devices) {
        const devicesList = document.getElementById('networkDevicesList');
        if (!devicesList) {
            return;
        }

        if (!devices || devices.length === 0) {
            devicesList.innerHTML = `
                <p class="empty"><i class="fas fa-wifi"></i><span>No device answered on port 5555</span></p>
            `;
            return;
        }

        devicesList.innerHTML = devices.map(device => `
            <div class="device">
                <div class="device-id">
                    <h4>${this.escapeHtml(device.name)}</h4>
                    <span class="mono">${this.escapeHtml(device.endpoint)}</span>
                </div>
                <button class="btn btn-primary btn-block" data-device-action="connect-network" data-device-endpoint="${this.escapeHtml(device.endpoint)}">
                    <i class="fas fa-link"></i> Connect
                </button>
            </div>
        `).join('');
    }

    bindDeviceActions(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        container.addEventListener('click', event => {
            const button = event.target.closest('button[data-device-action]');
            if (!button || button.disabled) {
                return;
            }

            const deviceId = button.dataset.deviceId;
            const endpoint = button.dataset.deviceEndpoint;
            const action = button.dataset.deviceAction;

            if (action === 'connect-usb') {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Connecting…';
                this.sendMessage('connectUsbDevice', { deviceId });
            } else if (action === 'mirror') {
                this.sendMessage('mirrorDevice', { deviceId, mode: 'screen' });
            } else if (action === 'mirror-off') {
                this.sendMessage('mirrorDevice', { deviceId, mode: 'screen-off' });
            } else if (action === 'mirror-keys') {
                this.sendMessage('mirrorDevice', { deviceId, mode: 'keyboard' });
            } else if (action === 'mirror-virtual') {
                this.sendMessage('mirrorDevice', { deviceId, mode: 'virtual-display' });
            } else if (action === 'disconnect') {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-rotate fa-spin"></i>';
                this.sendMessage('disconnectDevice', { deviceId });
                this.addStatusMessage(`Disconnecting device: ${deviceId}`, 'info');
            } else if (action === 'connect-network') {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Connecting…';
                this.sendMessage('connectNetworkDevice', { endpoint });
            }
        });
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    showTroubleshootingGuide() {
        this.sendMessage('showTroubleshootingGuide', {});
        this.addStatusMessage('Opening device setup guide', 'info');
    }

    // Status log
    addStatusMessage(message, type = 'info') {
        const statusContainer = document.getElementById('statusMessages');
        if (!statusContainer) {
            return;
        }

        const levels = {
            info: { tag: 'INFO', className: 'log-info' },
            success: { tag: 'OK', className: 'log-success' },
            warning: { tag: 'WARN', className: 'log-warning' },
            error: { tag: 'ERR', className: 'log-error' }
        };
        const level = levels[type] || levels.info;
        const timestamp = new Date().toLocaleTimeString([], { hour12: false });
        const text = String(message ?? '').replace(/^[\p{Extended_Pictographic}\u200d\ufe0f]+\s*/u, '');

        const placeholder = statusContainer.querySelector('.log-empty');
        if (placeholder) {
            placeholder.remove();
        }

        const statusLine = document.createElement('div');
        statusLine.className = `log-line ${level.className}`;
        statusLine.innerHTML = `
            <span class="log-time">${this.escapeHtml(timestamp)}</span>
            <span class="log-tag">${level.tag}</span>
            <span class="log-text">${this.escapeHtml(text)}</span>
        `;

        statusContainer.appendChild(statusLine);
        statusContainer.scrollTop = statusContainer.scrollHeight;

        if (statusContainer.children.length > 60) {
            statusContainer.removeChild(statusContainer.firstChild);
        }
    }

    clearStatusMessages() {
        const statusContainer = document.getElementById('statusMessages');
        if (!statusContainer) {
            return;
        }
        statusContainer.innerHTML = '<p class="log-empty">Log cleared</p>';
    }

    sendMessage(command, data) {
        try {
            if (window.vscode) {
                window.vscode.postMessage({
                    command: command,
                    ...data
                });
            } else {
                console.log('VSCode message (FALLBACK):', { command, ...data });
                this.addStatusMessage('Running without the extension host', 'warning');
            }
        } catch (error) {
            console.error('❌ Error sending message to extension:', error);
            this.addStatusMessage(`Failed to send message: ${error.message}`, 'error');
        }
    }

    initializeToasts() {
        document.querySelectorAll('.toast').forEach(toast => {
            const closeButton = toast.querySelector('[data-toast-close], .toast-close');
            if (closeButton) {
                closeButton.addEventListener('click', () => toast.classList.remove('is-visible'));
            }
        });
    }

    showToast(message, type = 'success') {
        const isError = type === 'error';
        const toast = document.getElementById(isError ? 'errorToast' : 'successToast');
        const body = document.getElementById(isError ? 'errorToastBody' : 'successToastBody');
        if (!toast || !body) {
            return;
        }

        body.textContent = message;
        toast.classList.add('is-visible');

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4200);
    }

    handleMessage(message) {
        try {
            switch (message.command) {
                case 'updateDevices':
                    this.updateDevicesList(message.devices);
                    break;
                case 'updateUsbDevices':
                    this.updateUsbDevicesList(message.devices);
                    break;
                case 'updateNetworkDevices':
                    this.updateNetworkDevicesList(message.devices);
                    break;
                case 'addStatusMessage':
                    this.addStatusMessage(message.message, message.type);
                    break;
                case 'showToast':
                    this.showToast(message.message, message.type);
                    break;
                default:
                    console.warn('⚠️ Unknown message command:', message.command);
                    break;
            }
        } catch (error) {
            console.error('❌ Error handling message from extension:', error);
        }
    }
}

// Initialize the webview
const airFlutter = new AirFlutterWebview();

window.addEventListener('message', event => {
    airFlutter.handleMessage(event.data);
});

// Refresh when the panel regains focus.
window.addEventListener('focus', () => {
    setTimeout(() => {
        airFlutter.refreshDevices();
    }, 500);
});

// Ctrl/Cmd + R refreshes the device list.
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        airFlutter.refreshDevices();
    }
});
