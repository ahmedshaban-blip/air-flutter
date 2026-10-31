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
            this.initWorkflowModal();
            this.initFlavorsModal();
            this.initProxyModal();
            this.initRecording();
            this.initAgentScaffoldModal();
            this.initCompatDoctorModal();

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
                    <button class="mirror-btn" data-device-action="mirror" data-device-id="${this.escapeHtml(device.id)}" title="Standard mirroring: Display on PC & phone" ${offline}>
                        <span class="mirror-btn-title">Mirror</span>
                        <span class="mirror-btn-desc">Display on PC & phone</span>
                    </button>
                    <button class="mirror-btn" data-device-action="mirror-keys" data-device-id="${this.escapeHtml(device.id)}" title="Eco mode: Phone dark, keyboard active" ${offline}>
                        <span class="mirror-btn-title">Screen Off + Keys</span>
                        <span class="mirror-btn-desc">Phone dark, keyboard active</span>
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
                case 'openWorkflowModal':
                    this.openWorkflowModal(message.projectPath);
                    break;
                case 'workflowProjectPath':
                    const pathInput = document.getElementById('workflowProjectPathInput');
                    if (pathInput) pathInput.value = message.path || '';
                    break;
                case 'workflowGenerated':
                    const modalToClose = document.getElementById('workflowModal');
                    if (modalToClose) modalToClose.hidden = true;
                    this.showToast(message.message || 'Workflow generated successfully!', 'success');
                    const genSubmitBtn = document.getElementById('generateWorkflowSubmitBtn');
                    if (genSubmitBtn) {
                        genSubmitBtn.disabled = false;
                        genSubmitBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Workflow';
                    }
                    break;
                case 'openFlavorsModal':
                    this.openFlavorsModal(message.projectPath);
                    break;
                case 'flavorsDetected':
                    this.renderFlavors(message.data);
                    break;
                case 'openProxyModal':
                    this.openProxyModal();
                    break;
                case 'networkState':
                    this.renderNetworkState(message.data);
                    break;
                case 'recordingState':
                    this.updateRecordingState(message.isRecording, message.duration);
                    break;
                case 'openAgentScaffoldModal':
                    this.openAgentScaffoldModal(message.projectPath);
                    break;
                case 'agentScaffoldProjectPath':
                    const scaffoldPathInput = document.getElementById('scaffoldExternalPathInput');
                    if (scaffoldPathInput) scaffoldPathInput.value = message.path || '';
                    break;
                case 'agentScaffoldGenerated':
                    const scaffoldModal = document.getElementById('agentScaffoldModal');
                    if (scaffoldModal) scaffoldModal.hidden = true;
                    this.showToast(message.message || 'Agents generated successfully!', 'success');
                    const genAgentBtn = document.getElementById('scaffoldSubmitBtn');
                    if (genAgentBtn) {
                        genAgentBtn.disabled = false;
                        genAgentBtn.innerHTML = '<i class="fas fa-robot"></i> Generate Agent(s)';
                    }
                    break;
                case 'openCompatDoctorModal':
                    this.openCompatDoctorModal(message.projectPath);
                    break;
                case 'compatProjectSelected':
                    const compatPathInput = document.getElementById('compatProjectPathInput');
                    if (compatPathInput) compatPathInput.value = message.path || '';
                    break;
                case 'compatDoctorLoading':
                    this.setCompatDoctorLoading(message.loading);
                    break;
                case 'compatDoctorReport':
                    this.renderCompatReport(message.report, message.availableVersions, message.rules, message.error);
                    break;
                default:
                    console.warn('⚠️ Unknown message command:', message.command);
                    break;
            }
        } catch (error) {
            console.error('❌ Error handling message from extension:', error);
        }
    }

    initWorkflowModal() {
        const modal = document.getElementById('workflowModal');
        if (!modal) return;

        const closeBtn = document.getElementById('closeWorkflowModalBtn');
        const cancelBtn = document.getElementById('cancelWorkflowModalBtn');
        const browseBtn = document.getElementById('browseWorkflowProjectBtn');
        const signingToggle = document.getElementById('workflowEnableSigning');
        const secretsBox = document.getElementById('workflowSecretsBox');
        const submitBtn = document.getElementById('generateWorkflowSubmitBtn');

        const closeModal = () => {
            modal.hidden = true;
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.sendMessage('selectWorkflowProject', {});
            });
        }

        if (signingToggle && secretsBox) {
            signingToggle.addEventListener('change', () => {
                secretsBox.hidden = !signingToggle.checked;
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('workflowProjectPathInput')?.value?.trim();
                const branch = document.getElementById('workflowBranchInput')?.value?.trim() || 'main';
                const triggerOnPush = document.getElementById('workflowTriggerPush')?.checked ?? true;
                const triggerOnPr = document.getElementById('workflowTriggerPr')?.checked ?? false;
                const triggerManual = document.getElementById('workflowTriggerManual')?.checked ?? true;

                const targetRadio = document.querySelector('input[name="workflowBuildTarget"]:checked');
                const buildTarget = targetRadio ? targetRadio.value : 'universal_apk';

                const modeRadio = document.querySelector('input[name="workflowBuildMode"]:checked');
                const buildMode = modeRadio ? modeRadio.value : 'release';

                const enableSigning = document.getElementById('workflowEnableSigning')?.checked ?? false;
                const enableCache = document.getElementById('workflowEnableCache')?.checked ?? true;

                if (!projectPath) {
                    this.showToast('Please select a valid project path', 'error');
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Generating…';

                this.sendMessage('generateWorkflow', {
                    projectPath,
                    branch,
                    triggerOnPush,
                    triggerOnPr,
                    triggerManual,
                    buildTarget,
                    buildMode,
                    enableSigning,
                    enableCache
                });
            });
        }
    }

    openWorkflowModal(defaultPath) {
        const modal = document.getElementById('workflowModal');
        if (modal) {
            modal.hidden = false;
            const input = document.getElementById('workflowProjectPathInput');
            if (input && defaultPath) {
                input.value = defaultPath;
            } else if (!input?.value) {
                this.sendMessage('getWorkflowInitialPath', {});
            }
            const submitBtn = document.getElementById('generateWorkflowSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Workflow';
            }
        }
    }

    // --- Flavors Modal -----------------------------------------------------

    initFlavorsModal() {
        const modal = document.getElementById('flavorsModal');
        if (!modal) return;

        const closeBtn = document.getElementById('closeFlavorsModalBtn');
        const cancelBtn = document.getElementById('cancelFlavorsModalBtn');
        const browseBtn = document.getElementById('browseFlavorsProjectBtn');
        const setupBtn = document.getElementById('setupFlavorsBtn');
        const runBtn = document.getElementById('runFlavorBtn');
        const buildApkBtn = document.getElementById('buildFlavorApkBtn');
        const buildAllBtn = document.getElementById('buildAllFlavorsBtn');

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.sendMessage('selectFlavorsProject', {});
            });
        }

        if (setupBtn) {
            setupBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('flavorsProjectPathInput')?.value?.trim();
                setupBtn.disabled = true;
                setupBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Setting up…';
                this.sendMessage('setupFlavors', { projectPath, flavors: ['dev', 'staging', 'prod'] });
            });
        }

        if (runBtn) {
            runBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('flavorsProjectPathInput')?.value?.trim();
                const selectedFlavor = this.getSelectedFlavor();
                if (!selectedFlavor) {
                    this.showToast('Select a flavor first', 'error');
                    return;
                }
                this.sendMessage('runFlavor', { projectPath, flavor: selectedFlavor.name, target: selectedFlavor.entrypoint });
                closeModal();
            });
        }

        if (buildApkBtn) {
            buildApkBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('flavorsProjectPathInput')?.value?.trim();
                const selectedFlavor = this.getSelectedFlavor();
                if (!selectedFlavor) {
                    this.showToast('Select a flavor first', 'error');
                    return;
                }
                buildApkBtn.disabled = true;
                buildApkBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Building…';
                this.sendMessage('buildFlavorApk', { projectPath, flavor: selectedFlavor.name, target: selectedFlavor.entrypoint });
            });
        }

        if (buildAllBtn) {
            buildAllBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('flavorsProjectPathInput')?.value?.trim();
                const flavors = this.detectedFlavorsList || [];
                if (flavors.length === 0) {
                    this.showToast('No flavors detected to build', 'error');
                    return;
                }
                buildAllBtn.disabled = true;
                buildAllBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Building All…';
                this.sendMessage('buildAllFlavors', { projectPath, flavors: flavors.map(f => f.name) });
            });
        }
    }

    openFlavorsModal(defaultPath) {
        const modal = document.getElementById('flavorsModal');
        if (modal) {
            modal.hidden = false;
            const input = document.getElementById('flavorsProjectPathInput');
            if (input && defaultPath) {
                input.value = defaultPath;
            }
            const currentPath = input?.value?.trim() || defaultPath;
            this.sendMessage('detectFlavors', { projectPath: currentPath });
        }
    }

    renderFlavors(data) {
        this.detectedFlavorsList = data?.flavors || [];
        const container = document.getElementById('flavorsListContainer');
        const emptyState = document.getElementById('flavorsEmptyState');
        const actionsRow = document.getElementById('flavorsActionsRow');

        if (!container || !emptyState || !actionsRow) return;

        if (!data || !data.hasFlavors || data.flavors.length === 0) {
            container.innerHTML = '';
            emptyState.hidden = false;
            actionsRow.hidden = true;
            const setupBtn = document.getElementById('setupFlavorsBtn');
            if (setupBtn) {
                setupBtn.disabled = false;
                setupBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Setup Flavors (dev, staging, prod)';
            }
        } else {
            emptyState.hidden = true;
            actionsRow.hidden = false;

            container.innerHTML = data.flavors.map((flavor, index) => `
                <label class="flavor-item-card ${index === 0 ? 'is-selected' : ''}">
                    <div>
                        <input type="radio" name="selectedFlavorRadio" value="${this.escapeHtml(flavor.name)}" data-entrypoint="${this.escapeHtml(flavor.entrypoint || '')}" ${index === 0 ? 'checked' : ''} />
                        <span class="flavor-item-name">${this.escapeHtml(flavor.name)}</span>
                    </div>
                    <span class="flavor-item-entry">${this.escapeHtml(flavor.entrypoint || 'lib/main.dart')}</span>
                </label>
            `).join('');

            container.querySelectorAll('.flavor-item-card').forEach(card => {
                card.addEventListener('click', () => {
                    container.querySelectorAll('.flavor-item-card').forEach(c => c.classList.remove('is-selected'));
                    card.classList.add('is-selected');
                });
            });

            const buildApkBtn = document.getElementById('buildFlavorApkBtn');
            if (buildApkBtn) {
                buildApkBtn.disabled = false;
                buildApkBtn.innerHTML = '<i class="fas fa-box"></i> Build APK';
            }
            const buildAllBtn = document.getElementById('buildAllFlavorsBtn');
            if (buildAllBtn) {
                buildAllBtn.disabled = false;
                buildAllBtn.innerHTML = '<i class="fas fa-boxes-stacked"></i> Build All Flavors';
            }
        }
    }

    getSelectedFlavor() {
        const radio = document.querySelector('input[name="selectedFlavorRadio"]:checked');
        if (!radio) return null;
        return {
            name: radio.value,
            entrypoint: radio.dataset.entrypoint
        };
    }

    // --- Proxy & DNS Modal -------------------------------------------------

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

    initRecording() {
        const recordBtn = document.getElementById('screenRecordBtn');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => {
                this.sendMessage('toggleScreenRecording', {});
            });
        }
    }

    updateRecordingState(isRecording, duration) {
        const recordBtn = document.getElementById('screenRecordBtn');
        if (!recordBtn) return;

        if (isRecording) {
            recordBtn.classList.add('btn-recording');
            const mm = String(Math.floor(duration / 60)).padStart(2, '0');
            const ss = String(duration % 60).padStart(2, '0');
            recordBtn.innerHTML = `<i class="fas fa-stop"></i> Stop Rec (${mm}:${ss})`;
        } else {
            recordBtn.classList.remove('btn-recording');
            recordBtn.innerHTML = '<i class="fas fa-video"></i> Record Screen';
        }
    }

    // --- AI Agent Scaffolding Stepper Wizard -------------------------------

    initAgentScaffoldModal() {
        const modal = document.getElementById('agentScaffoldModal');
        if (!modal) return;

        const closeBtn = document.getElementById('closeAgentScaffoldModalBtn');
        const cancelBtn = document.getElementById('cancelAgentScaffoldModalBtn');
        const browseBtn = document.getElementById('browseScaffoldProjectBtn');
        const submitBtn = document.getElementById('scaffoldSubmitBtn');

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.sendMessage('selectAgentScaffoldProject', {});
            });
        }

        // Stepper Navigation
        this.scaffoldCurrentStep = 1;
        const setStep = (step) => {
            this.scaffoldCurrentStep = Math.max(1, Math.min(5, step));
            modal.querySelectorAll('.stepper-step').forEach(s => {
                const stepNum = parseInt(s.dataset.step, 10);
                s.classList.toggle('is-active', stepNum === this.scaffoldCurrentStep);
                s.classList.toggle('is-completed', stepNum < this.scaffoldCurrentStep);
            });
            modal.querySelectorAll('.stepper-pane').forEach(p => {
                const stepNum = parseInt(p.dataset.step, 10);
                p.classList.toggle('is-active', stepNum === this.scaffoldCurrentStep);
            });
        };

        modal.querySelectorAll('[data-stepper-next]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.scaffoldCurrentStep === 2) {
                    const modeRadio = document.querySelector('input[name="scaffoldGenMode"]:checked');
                    if (modeRadio && modeRadio.value === 'team') {
                        const checkedRoles = Array.from(modal.querySelectorAll('input[name="scaffoldTeamRoles"]:checked'));
                        if (checkedRoles.length < 2) {
                            this.showToast('Please select at least 2 roles to build a workflow team', 'error');
                            return;
                        }
                    }
                }
                setStep(this.scaffoldCurrentStep + 1);
            });
        });

        modal.querySelectorAll('[data-stepper-back]').forEach(btn => {
            btn.addEventListener('click', () => setStep(this.scaffoldCurrentStep - 1));
        });

        // Location type change
        modal.querySelectorAll('input[name="scaffoldLocation"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const pathRow = document.getElementById('scaffoldExternalPathRow');
                if (pathRow) {
                    pathRow.hidden = !(radio.value === 'external' || radio.value === 'custom');
                }
            });
        });

        // Mode change (single vs team)
        modal.querySelectorAll('input[name="scaffoldGenMode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const singlePicker = document.getElementById('singleRolePickerContainer');
                const teamPicker = document.getElementById('teamRolePickerContainer');
                if (singlePicker && teamPicker) {
                    const isTeam = radio.value === 'team';
                    singlePicker.hidden = isTeam;
                    teamPicker.hidden = !isTeam;
                }
            });
        });

        // Role change (show custom role if custom)
        modal.querySelectorAll('input[name="scaffoldRole"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const customRoleRow = document.getElementById('customRoleRow');
                if (customRoleRow) {
                    customRoleRow.hidden = radio.value !== 'custom';
                }
            });
        });

        // Team custom checkbox change
        const teamCustomCheckbox = document.getElementById('scaffoldTeamCustomCheckbox');
        if (teamCustomCheckbox) {
            teamCustomCheckbox.addEventListener('change', () => {
                const customTeamRoleRow = document.getElementById('customTeamRoleRow');
                if (customTeamRoleRow) {
                    customTeamRoleRow.hidden = !teamCustomCheckbox.checked;
                }
            });
        }

        // Tool level change (show custom tools if custom)
        modal.querySelectorAll('input[name="scaffoldToolLevel"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const customToolsRow = document.getElementById('customToolsRow');
                if (customToolsRow) {
                    customToolsRow.hidden = radio.value !== 'custom';
                }
            });
        });

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const locationRadio = document.querySelector('input[name="scaffoldLocation"]:checked');
                const targetLocationType = locationRadio ? locationRadio.value : 'workspace';
                const targetPath = document.getElementById('scaffoldExternalPathInput')?.value?.trim();

                const modeRadio = document.querySelector('input[name="scaffoldGenMode"]:checked');
                const generationMode = modeRadio ? modeRadio.value : 'single';

                let role = 'planner';
                let teamRoles = [];
                let customRoleName = '';
                let customRoleDescription = '';

                if (generationMode === 'team') {
                    teamRoles = Array.from(modal.querySelectorAll('input[name="scaffoldTeamRoles"]:checked')).map(cb => cb.value);
                    if (teamRoles.length < 2) {
                        this.showToast('Please select at least 2 roles for a workflow team', 'error');
                        return;
                    }
                    customRoleName = document.getElementById('customTeamRoleNameInput')?.value?.trim();
                    customRoleDescription = document.getElementById('customTeamRoleDescInput')?.value?.trim();
                } else {
                    const roleRadio = document.querySelector('input[name="scaffoldRole"]:checked');
                    role = roleRadio ? roleRadio.value : 'planner';
                    customRoleName = document.getElementById('customRoleNameInput')?.value?.trim();
                    customRoleDescription = document.getElementById('customRoleDescInput')?.value?.trim();
                }

                const frameworkRadio = document.querySelector('input[name="scaffoldFramework"]:checked');
                const framework = frameworkRadio ? frameworkRadio.value : 'antigravity';

                const toolRadio = document.querySelector('input[name="scaffoldToolLevel"]:checked');
                const toolLevel = toolRadio ? toolRadio.value : 'standard';
                const customTools = document.getElementById('customToolsInput')?.value?.trim();

                const contentRadio = document.querySelector('input[name="scaffoldContentMode"]:checked');
                const contentMode = contentRadio ? contentRadio.value : 'fully_populated';

                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Scaffolding…';

                this.sendMessage('generateAgentScaffold', {
                    targetLocationType,
                    targetPath,
                    generationMode,
                    role,
                    teamRoles,
                    customRoleName,
                    customRoleDescription,
                    framework,
                    toolLevel,
                    customTools,
                    contentMode
                });
            });
        }
    }

    // --- Compatibility Doctor & Auto-Fixer Modal ----------------------------
    initCompatDoctorModal() {
        const modal = document.getElementById('compatDoctorModal');
        if (!modal) return;

        const closeBtn = document.getElementById('closeCompatDoctorModalBtn');
        const cancelBtn = document.getElementById('cancelCompatDoctorBtn');
        const cancelConfigBtn = document.getElementById('cancelCompatConfigBtn');
        const browseBtn = document.getElementById('browseCompatProjectBtn');
        const reScanBtn = document.getElementById('reScanCompatDoctorBtn');
        const outputBtn = document.getElementById('openCompatOutputBtn');
        const autoUpgradeBtn = document.getElementById('autoUpgradeStackBtn');
        const pathInput = document.getElementById('compatProjectPathInput');

        // Tabs navigation
        const tabAudit = document.getElementById('tabBtnCompatAudit');
        const tabConfig = document.getElementById('tabBtnCompatConfig');
        const contentAudit = document.getElementById('tabContentCompatAudit');
        const contentConfig = document.getElementById('tabContentCompatConfig');

        if (tabAudit && tabConfig) {
            tabAudit.addEventListener('click', () => {
                tabAudit.classList.add('is-active');
                tabConfig.classList.remove('is-active');
                if (contentAudit) contentAudit.style.display = 'block';
                if (contentConfig) contentConfig.style.display = 'none';
            });

            tabConfig.addEventListener('click', () => {
                tabConfig.classList.add('is-active');
                tabAudit.classList.remove('is-active');
                if (contentAudit) contentAudit.style.display = 'none';
                if (contentConfig) contentConfig.style.display = 'block';
            });
        }

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (cancelConfigBtn) cancelConfigBtn.addEventListener('click', closeModal);

        // Diff Preview Modal
        const diffModal = document.getElementById('compatDiffModal');
        const closeDiffBtn = document.getElementById('closeCompatDiffModalBtn');
        const cancelDiffBtn = document.getElementById('cancelCompatDiffModalBtn');
        const confirmDiffBtn = document.getElementById('confirmApplyDiffBtn');

        const closeDiffModal = () => { if (diffModal) diffModal.hidden = true; };
        if (closeDiffBtn) closeDiffBtn.addEventListener('click', closeDiffModal);
        if (cancelDiffBtn) cancelDiffBtn.addEventListener('click', closeDiffModal);

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.sendMessage('selectCompatProject', {});
            });
        }

        if (reScanBtn) {
            reScanBtn.addEventListener('click', () => {
                const p = pathInput ? pathInput.value : '';
                this.setCompatDoctorLoading(true);
                this.sendMessage('runCompatDoctorScan', { projectPath: p });
            });
        }

        if (outputBtn) {
            outputBtn.addEventListener('click', () => {
                this.sendMessage('runFlutterCommand', { commandId: 'airFlutter.runCompatDoctor' });
            });
        }

        if (autoUpgradeBtn) {
            autoUpgradeBtn.addEventListener('click', () => {
                const p = pathInput ? pathInput.value : '';
                this.setCompatDoctorLoading(true);
                this.sendMessage('applyCompatUpgrades', { projectPath: p });
            });
        }

        // Configurator change listeners
        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');

        if (agpSelect) {
            agpSelect.addEventListener('change', () => {
                this.onConfigAgpChanged();
            });
        }
        if (gradleSelect) {
            gradleSelect.addEventListener('change', () => {
                this.updateConfigStatusBanner();
            });
        }

        // Preview & Apply Custom Stack Button
        const previewBtn = document.getElementById('previewCustomStackBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.prepareCustomStackDiffs();
            });
        }

        // Confirm Apply Diff Button
        if (confirmDiffBtn) {
            confirmDiffBtn.addEventListener('click', () => {
                const checkedBoxes = Array.from(document.querySelectorAll('#compatDiffList input[type="checkbox"]:checked'));
                if (checkedBoxes.length === 0) {
                    this.showToast('No modifications selected to apply.', 'warning');
                    return;
                }
                const selectedIds = checkedBoxes.map(cb => cb.dataset.diffId);
                const diffsToApply = (this.pendingDiffs || []).filter(d => selectedIds.includes(d.id));

                if (diffModal) diffModal.hidden = true;
                this.setCompatDoctorLoading(true);
                const p = pathInput ? pathInput.value : '';
                this.sendMessage('applyCustomStack', { projectPath: p, diffs: diffsToApply });
            });
        }
    }

    setCompatDoctorLoading(loading) {
        const loadingEl = document.getElementById('compatDoctorLoading');
        const contentAudit = document.getElementById('tabContentCompatAudit');
        const contentConfig = document.getElementById('tabContentCompatConfig');
        if (loadingEl) loadingEl.style.display = loading ? 'block' : 'none';
        if (loading) {
            if (contentAudit) contentAudit.style.display = 'none';
            if (contentConfig) contentConfig.style.display = 'none';
        } else {
            const isConfigActive = document.getElementById('tabBtnCompatConfig')?.classList.contains('is-active');
            if (contentAudit) contentAudit.style.display = isConfigActive ? 'none' : 'block';
            if (contentConfig) contentConfig.style.display = isConfigActive ? 'block' : 'none';
        }
    }

    openCompatDoctorModal(defaultPath) {
        const modal = document.getElementById('compatDoctorModal');
        if (modal) {
            modal.hidden = false;

            // Reset tabs to Audit tab by default
            const tabAudit = document.getElementById('tabBtnCompatAudit');
            const tabConfig = document.getElementById('tabBtnCompatConfig');
            const contentAudit = document.getElementById('tabContentCompatAudit');
            const contentConfig = document.getElementById('tabContentCompatConfig');
            if (tabAudit && tabConfig && contentAudit && contentConfig) {
                tabAudit.classList.add('is-active');
                tabConfig.classList.remove('is-active');
                contentAudit.style.display = 'block';
                contentConfig.style.display = 'none';
            }

            const pathInput = document.getElementById('compatProjectPathInput');
            if (pathInput && defaultPath) {
                pathInput.value = defaultPath;
            }
            this.setCompatDoctorLoading(true);

            // Trigger immediate scan
            const targetPath = (pathInput && pathInput.value) ? pathInput.value : (defaultPath || '');
            this.sendMessage('runCompatDoctorScan', { projectPath: targetPath });
        }
    }

    renderCompatReport(report, availableVersions, rules, error) {
        this.setCompatDoctorLoading(false);
        const issuesContainer = document.getElementById('compatIssuesContainer');
        const autoUpgradeBtn = document.getElementById('autoUpgradeStackBtn');

        if (error || !report) {
            if (issuesContainer) {
                issuesContainer.innerHTML = `<div class="compat-issue-item is-error">
                    <div class="compat-issue-header">
                        <span class="compat-issue-badge is-error">Error</span>
                    </div>
                    <div class="compat-issue-msg">${error || 'Failed to analyze project build stack.'}</div>
                </div>`;
            }
            if (autoUpgradeBtn) autoUpgradeBtn.disabled = true;
            return;
        }

        this.currentCompatReport = report;
        this.compatAvailableVersions = availableVersions;
        this.compatRules = rules;

        // Auto-fill project path input
        if (report.projectPath) {
            const pathInput = document.getElementById('compatProjectPathInput');
            if (pathInput) {
                pathInput.value = report.projectPath;
            }
        }

        // Update cards
        const updateCard = (cardId, valId, subId, val, sub, state) => {
            const card = document.getElementById(cardId);
            const valEl = document.getElementById(valId);
            const subEl = document.getElementById(subId);
            if (card) {
                card.classList.remove('is-success', 'is-warning', 'is-error');
                if (state) card.classList.add(state);
            }
            if (valEl) valEl.textContent = val || '-';
            if (subEl) subEl.textContent = sub || '';
        };

        const gradleVer = report.gradle ? report.gradle.gradleVersion : null;
        const agpVer = report.gradle ? report.gradle.agpVersion : null;
        const javaVer = report.environment ? report.environment.javaVersion : null;
        const iosVer = report.podfile ? report.podfile.deploymentTarget : null;

        const hasAgpMismatch = report.issues && report.issues.some(i => i.code === 'AGP_GRADLE_MISMATCH');
        const hasJavaMismatch = report.issues && report.issues.some(i => i.code === 'JAVA_AGP_MISMATCH');
        const hasOutdatedStack = report.issues && report.issues.some(i => i.code === 'OUTDATED_STACK');
        const hasIosIssue = report.issues && report.issues.some(i => i.code === 'OUTDATED_IOS_TARGET' || i.code === 'DEPRECATED_IOS_TARGET');

        updateCard(
            'compatCardGradle',
            'compatValGradle',
            'compatSubGradle',
            gradleVer ? `Gradle ${gradleVer}` : 'Not Detected',
            report.gradle && report.gradle.wrapperPath ? 'wrapper.properties' : 'wrapper missing',
            hasAgpMismatch ? 'is-error' : (gradleVer ? 'is-success' : 'is-warning')
        );

        updateCard(
            'compatCardAgp',
            'compatValAgp',
            'compatSubAgp',
            agpVer ? `AGP ${agpVer}` : 'Not Detected',
            report.gradle && report.gradle.isKotlinDsl ? 'Kotlin DSL (.kts)' : 'Groovy DSL (.gradle)',
            hasAgpMismatch ? 'is-error' : (hasOutdatedStack ? 'is-warning' : (agpVer ? 'is-success' : 'is-warning'))
        );

        updateCard(
            'compatCardJava',
            'compatValJava',
            'compatSubJava',
            javaVer ? `JDK ${javaVer}` : 'Not Found',
            javaVer ? 'Runtime active' : 'Check JAVA_HOME / PATH',
            hasJavaMismatch ? 'is-error' : (javaVer ? 'is-success' : 'is-warning')
        );

        updateCard(
            'compatCardIos',
            'compatValIos',
            'compatSubIos',
            iosVer ? `iOS ${iosVer}` : (report.podfile && report.podfile.exists ? 'Not set' : 'No Podfile'),
            report.environment && report.environment.isWindows ? 'Skipped CocoaPods (Windows)' : (report.podfile && report.podfile.exists ? 'Podfile target' : 'iOS not configured'),
            hasIosIssue ? 'is-warning' : (iosVer ? 'is-success' : '')
        );

        // Render issues list
        if (issuesContainer) {
            issuesContainer.innerHTML = '';
            if (!report.issues || report.issues.length === 0) {
                issuesContainer.innerHTML = `
                    <div style="padding: 16px; text-align: center; background: rgba(46, 125, 50, 0.08); border: 1px solid rgba(46, 125, 50, 0.3); border-radius: 6px; color: var(--ink);">
                        <i class="fas fa-check-circle" style="color: #4caf50; font-size: 20px; margin-bottom: 6px; display: block;"></i>
                        <strong>All Configurations Healthy &amp; Up to Date!</strong>
                        <p style="margin: 4px 0 0; font-size: 11px; color: var(--muted);">AGP, Gradle wrapper, Java runtime, and iOS deployment target are fully compatible.</p>
                    </div>`;
            } else {
                report.issues.forEach(issue => {
                    const item = document.createElement('div');
                    item.className = `compat-issue-item is-${issue.type}`;
                    const badgeClass = issue.type === 'error' ? 'is-error' : 'is-warning';
                    const iconClass = issue.type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';

                    let fixHtml = '';
                    if (issue.suggestedFix) {
                        fixHtml = `
                            <div class="compat-issue-fix">
                                <i class="fas fa-magic"></i>
                                <span>Suggested Auto-Fix: <strong>${issue.suggestedFix.description}</strong> (&rarr; "${issue.suggestedFix.newText}")</span>
                            </div>`;
                    }

                    let guideHtml = '';
                    if (issue.migrationUrl) {
                        guideHtml = `<a href="${issue.migrationUrl}" target="_blank" style="font-size: 11px; color: var(--primary); text-decoration: underline; margin-top: 2px; display: inline-block;"><i class="fas fa-external-link-alt"></i> Migration Guide</a>`;
                    }

                    item.innerHTML = `
                        <div class="compat-issue-header">
                            <span class="compat-issue-badge ${badgeClass}"><i class="fas ${iconClass}"></i> ${issue.code}</span>
                            ${issue.filePath ? `<span style="font-size: 10px; color: var(--muted); font-family: monospace;">${issue.filePath.split(/[\\\\/]/).slice(-2).join('/')}</span>` : ''}
                        </div>
                        <div class="compat-issue-msg">${issue.message}</div>
                        ${fixHtml}
                        ${guideHtml}
                    `;
                    issuesContainer.appendChild(item);
                });
            }
        }

        // Enable or disable Auto-Upgrade button
        if (autoUpgradeBtn) {
            autoUpgradeBtn.disabled = !report.canAutoUpgrade;
        }

        // Populate and configure Smart Version Configurator
        this.populateVersionConfigurator(report, availableVersions, rules);
    }

    populateVersionConfigurator(report, availableVersions, rules) {
        const versions = availableVersions || {
            agp: ["8.5.2", "8.4.2", "8.3.2", "8.2.2", "8.1.4", "8.0.2", "7.4.2"],
            gradle: ["8.7", "8.6", "8.5", "8.4", "8.2.1", "8.0.2", "7.6.4", "7.5"],
            kotlin: ["1.9.24", "1.9.10", "1.8.22", "1.7.20"],
            java: [17, 11],
            ios: ["13.0", "14.0", "15.0", "16.0", "17.0", "18.0", "12.0", "11.0"]
        };

        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');
        const kotlinSelect = document.getElementById('configKotlinSelect');
        const javaSelect = document.getElementById('configJavaSelect');
        const iosSelect = document.getElementById('configIosSelect');

        if (!agpSelect) return;

        // Fill AGP
        agpSelect.innerHTML = versions.agp.map(v => `<option value="${v}">${v}${v === '8.5.2' ? ' (Latest Verified)' : ''}</option>`).join('');
        const curAgp = report.gradle ? report.gradle.agpVersion : null;
        if (curAgp && versions.agp.includes(curAgp)) {
            agpSelect.value = curAgp;
        } else {
            agpSelect.value = '8.5.2';
        }

        // Fill Kotlin
        if (kotlinSelect) {
            kotlinSelect.innerHTML = versions.kotlin.map(v => `<option value="${v}">${v}</option>`).join('');
            const curKotlin = report.gradle ? report.gradle.kotlinVersion : null;
            if (curKotlin && versions.kotlin.includes(curKotlin)) {
                kotlinSelect.value = curKotlin;
            } else {
                kotlinSelect.value = '1.9.24';
            }
        }

        // Fill Java
        if (javaSelect) {
            javaSelect.innerHTML = versions.java.map(v => `<option value="${v}">JDK ${v} (source/target ${v})</option>`).join('');
            javaSelect.value = '17';
        }

        // Fill iOS
        if (iosSelect) {
            iosSelect.innerHTML = versions.ios.map(v => {
                const isDep = ['11.0', '12.0'].includes(v);
                return `<option value="${v}">iOS ${v}${isDep ? ' (Deprecated)' : (v === '13.0' ? ' (Recommended Min)' : '')}</option>`;
            }).join('');
            const curIos = report.podfile ? report.podfile.deploymentTarget : null;
            if (curIos && versions.ios.includes(curIos)) {
                iosSelect.value = curIos;
            } else {
                iosSelect.value = '13.0';
            }
        }

        // Trigger cascading logic
        this.onConfigAgpChanged();
    }

    onConfigAgpChanged() {
        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');
        const javaSelect = document.getElementById('configJavaSelect');
        const kotlinSelect = document.getElementById('configKotlinSelect');
        if (!agpSelect || !gradleSelect) return;

        const selectedAgp = agpSelect.value;
        const versions = this.compatAvailableVersions || {
            gradle: ["8.7", "8.6", "8.5", "8.4", "8.2.1", "8.0.2", "7.6.4", "7.5"]
        };

        // Find rule
        const rule = (this.compatRules || []).find(r => {
            const range = r.agpRange;
            if (selectedAgp.startsWith('8.5') && range.includes('8.5')) return true;
            if ((selectedAgp.startsWith('8.2') || selectedAgp.startsWith('8.3') || selectedAgp.startsWith('8.4')) && range.includes('8.2')) return true;
            if ((selectedAgp.startsWith('8.0') || selectedAgp.startsWith('8.1')) && range.includes('8.0')) return true;
            if (selectedAgp.startsWith('7.4') && range.includes('7.4')) return true;
            if (selectedAgp.startsWith('7.') && range.includes('7.0')) return true;
            return false;
        });

        // Smart Filter Gradle
        const isGradleCompatible = (gVer) => {
            if (!rule) return true;
            const expr = rule.compatibleGradle;
            if (expr.startsWith('>=8.7')) return parseFloat(gVer) >= 8.7;
            if (expr.includes('8.2') && expr.includes('8.7')) return parseFloat(gVer) >= 8.2 && parseFloat(gVer) <= 8.7;
            if (expr.includes('8.0') && expr.includes('8.4')) return parseFloat(gVer) >= 8.0 && parseFloat(gVer) <= 8.4;
            if (expr.includes('7.5') && expr.includes('7.6')) return parseFloat(gVer) >= 7.5 && parseFloat(gVer) <= 7.6;
            if (expr.includes('7.0') && expr.includes('7.4')) return parseFloat(gVer) >= 7.0 && parseFloat(gVer) <= 7.4;
            return true;
        };

        const currentGradle = gradleSelect.value;
        gradleSelect.innerHTML = versions.gradle.map(g => {
            const compat = isGradleCompatible(g);
            const isRec = rule && rule.recommendedGradle === g;
            return `<option value="${g}" ${compat ? '' : 'disabled'}>Gradle ${g}${isRec ? ' (Recommended for AGP ' + selectedAgp + ')' : (compat ? '' : ' (Incompatible)')}</option>`;
        }).join('');

        if (rule && rule.recommendedGradle) {
            if (!isGradleCompatible(currentGradle)) {
                gradleSelect.value = rule.recommendedGradle;
            } else {
                gradleSelect.value = currentGradle;
            }
        }

        // Auto-sync Java JDK baseline
        if (javaSelect && rule) {
            javaSelect.value = String(rule.minJava || 17);
        }

        // Auto-sync Kotlin if applicable
        if (kotlinSelect && rule && rule.recommendedKotlin) {
            kotlinSelect.value = rule.recommendedKotlin;
        }

        this.updateConfigStatusBanner();
    }

    updateConfigStatusBanner() {
        const banner = document.getElementById('configStatusBanner');
        const textEl = document.getElementById('configStatusText');
        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');
        const javaSelect = document.getElementById('configJavaSelect');
        const kotlinSelect = document.getElementById('configKotlinSelect');

        if (!banner || !textEl || !agpSelect || !gradleSelect) return;

        const agp = agpSelect.value;
        const gradle = gradleSelect.value;
        const java = javaSelect ? javaSelect.value : '17';
        const kotlin = kotlinSelect ? kotlinSelect.value : '1.9.24';

        banner.className = 'compat-status-card is-success';
        banner.style.padding = '10px 14px';
        banner.style.marginTop = '10px';
        textEl.innerHTML = `<strong>Verified Compatible Stack:</strong> AGP ${agp} &harr; Gradle ${gradle} &harr; JDK ${java} &harr; Kotlin ${kotlin}`;
    }

    prepareCustomStackDiffs() {
        const report = this.currentCompatReport;
        if (!report) {
            this.showToast('Please wait for scan results before customizing.', 'warning');
            return;
        }

        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');
        const kotlinSelect = document.getElementById('configKotlinSelect');
        const javaSelect = document.getElementById('configJavaSelect');
        const iosSelect = document.getElementById('configIosSelect');

        const targetAgp = agpSelect ? agpSelect.value : '';
        const targetGradle = gradleSelect ? gradleSelect.value : '';
        const targetKotlin = kotlinSelect ? kotlinSelect.value : '';
        const targetJava = javaSelect ? parseInt(javaSelect.value, 10) : 17;
        const targetIos = iosSelect ? iosSelect.value : '13.0';

        const diffs = [];

        // 1. Gradle Wrapper
        if (report.gradle && report.gradle.wrapperPath && report.gradle.gradleRange) {
            if (report.gradle.gradleVersion !== targetGradle) {
                diffs.push({
                    id: 'gradle',
                    title: 'Gradle Wrapper (gradle-wrapper.properties)',
                    filePath: report.gradle.wrapperPath,
                    current: report.gradle.gradleVersion || 'unknown',
                    target: targetGradle,
                    targetValue: targetGradle,
                    range: report.gradle.gradleRange
                });
            }
        }

        // 2. AGP
        if (report.gradle && report.gradle.buildGradlePath && report.gradle.agpRange) {
            if (report.gradle.agpVersion !== targetAgp) {
                diffs.push({
                    id: 'agp',
                    title: `AGP Version (${report.gradle.isKotlinDsl ? 'build.gradle.kts' : 'build.gradle'})`,
                    filePath: report.gradle.buildGradlePath,
                    current: report.gradle.agpVersion || 'unknown',
                    target: targetAgp,
                    targetValue: targetAgp,
                    range: report.gradle.agpRange
                });
            }
        }

        // 3. Kotlin
        if (report.gradle && report.gradle.buildGradlePath && report.gradle.kotlinRange && targetKotlin) {
            if (report.gradle.kotlinVersion !== targetKotlin) {
                diffs.push({
                    id: 'kotlin',
                    title: 'Kotlin Plugin Version',
                    filePath: report.gradle.buildGradlePath,
                    current: report.gradle.kotlinVersion || 'unknown',
                    target: targetKotlin,
                    targetValue: targetKotlin,
                    range: report.gradle.kotlinRange
                });
            }
        }

        // 4. Java / CompileOptions in app/build.gradle
        if (report.gradle && report.gradle.javaConfig && report.gradle.javaConfig.appBuildGradlePath) {
            const jc = report.gradle.javaConfig;
            const targetJavaVer = targetJava === 17 ? 'JavaVersion.VERSION_17' : 'JavaVersion.VERSION_11';
            const targetJvm = targetJava === 17 ? '17' : '11';

            if (jc.sourceCompatibilityRange && jc.sourceCompatibility && jc.sourceCompatibility !== targetJavaVer) {
                diffs.push({
                    id: 'javaSource',
                    title: 'sourceCompatibility (app/build.gradle)',
                    filePath: jc.appBuildGradlePath,
                    current: jc.sourceCompatibility,
                    target: targetJavaVer,
                    targetValue: targetJavaVer,
                    range: jc.sourceCompatibilityRange
                });
            }

            if (jc.targetCompatibilityRange && jc.targetCompatibility && jc.targetCompatibility !== targetJavaVer) {
                diffs.push({
                    id: 'javaTarget',
                    title: 'targetCompatibility (app/build.gradle)',
                    filePath: jc.appBuildGradlePath,
                    current: jc.targetCompatibility,
                    target: targetJavaVer,
                    targetValue: targetJavaVer,
                    range: jc.targetCompatibilityRange
                });
            }

            if (jc.jvmTargetRange && jc.jvmTarget && jc.jvmTarget !== targetJvm) {
                diffs.push({
                    id: 'jvmTarget',
                    title: 'kotlinOptions.jvmTarget (app/build.gradle)',
                    filePath: jc.appBuildGradlePath,
                    current: jc.jvmTarget,
                    target: targetJvm,
                    targetValue: targetJvm,
                    range: jc.jvmTargetRange
                });
            }
        }

        // 5. iOS Target
        if (report.podfile && report.podfile.exists && report.podfile.podfilePath && report.podfile.targetRange && targetIos) {
            if (report.podfile.deploymentTarget !== targetIos) {
                diffs.push({
                    id: 'ios',
                    title: 'iOS Deployment Target (ios/Podfile)',
                    filePath: report.podfile.podfilePath,
                    current: report.podfile.deploymentTarget || 'unknown',
                    target: targetIos,
                    targetValue: targetIos,
                    range: report.podfile.targetRange
                });
            }
        }

        if (diffs.length === 0) {
            this.showToast('Project is already configured with this exact build stack!', 'info');
            return;
        }

        this.pendingDiffs = diffs;

        // Render diffs
        const diffListEl = document.getElementById('compatDiffList');
        if (diffListEl) {
            diffListEl.innerHTML = diffs.map(diff => `
                <div class="compat-diff-card">
                    <input type="checkbox" id="diff_${diff.id}" checked data-diff-id="${diff.id}" style="margin-top: 3px;" />
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 12px; margin-bottom: 2px;">${diff.title}</div>
                        <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px; font-family: monospace;">${diff.filePath.split(/[\\\\/]/).slice(-2).join('/')}</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="compat-diff-badge-old">${diff.current}</span>
                            <i class="fas fa-arrow-right" style="font-size: 10px; color: var(--muted);"></i>
                            <span class="compat-diff-badge-new">${diff.target}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        const diffModal = document.getElementById('compatDiffModal');
        if (diffModal) {
            diffModal.hidden = false;
        }
    }

    openAgentScaffoldModal(defaultPath) {
        const modal = document.getElementById('agentScaffoldModal');
        if (modal) {
            modal.hidden = false;
            this.scaffoldCurrentStep = 1;
            modal.querySelectorAll('.stepper-step').forEach(s => {
                const stepNum = parseInt(s.dataset.step, 10);
                s.classList.toggle('is-active', stepNum === 1);
                s.classList.toggle('is-completed', false);
            });
            modal.querySelectorAll('.stepper-pane').forEach(p => {
                const stepNum = parseInt(p.dataset.step, 10);
                p.classList.toggle('is-active', stepNum === 1);
            });

            const pathInput = document.getElementById('scaffoldExternalPathInput');
            if (pathInput && defaultPath) {
                pathInput.value = defaultPath;
            }
            const submitBtn = document.getElementById('scaffoldSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-robot"></i> Generate Agent(s)';
            }
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
