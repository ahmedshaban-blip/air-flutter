// Air Flutter Webview JavaScript
console.log('🔄 Air Flutter JS loading...');

class AirFlutterWebview {
    constructor() {
        this.isExecuting = false; // Prevent duplicate execution
        this.activeOperations = new Map();
        this.mirroringState = { isMirroring: false, displayOff: false, serial: null };
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

            const stopMirrorBtn = document.getElementById('stopMirrorBtn');
            if (stopMirrorBtn) {
                stopMirrorBtn.addEventListener('click', () => {
                    this.stopMirroring();
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
            this.initSigningKeyModal();
            this.initAssetAssistant();
            this.initCodeCleanup();
            this.initPermissionManager();
            this.initAppStateWiper();
            this.initDeepLinkStudio();
            this.initLocalhostBridge();
            this.initMirrorSetupModal();
            this.initMcpModal();
            this.initStorageInspector?.();
            this.initDebugOverlays?.();
            this.initMockGps?.();
            this.initApkSize?.();
            this.initPubHealth?.();

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
                button.dataset.command = commandId;
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
        if (!refreshBtn.dataset.idleHtml) refreshBtn.dataset.idleHtml = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span>';
        refreshBtn.disabled = true;

        this.sendMessage('refreshDevices', {});
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
            if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;
            button.classList.add('is-running');
            button.disabled = true;
        });
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
            if (this.updateDeepLinkDevices) this.updateDeepLinkDevices([]);
            return;
        }

        devicesList.innerHTML = devices.map(device => {
            const offline = device.status !== 'online' ? 'disabled' : '';
            const controlsActiveMirror = this.mirroringState.isMirroring && this.mirroringState.serial === device.id;
            const shouldTurnDisplayOff = controlsActiveMirror && !this.mirroringState.displayOff;
            const displayAction = controlsActiveMirror ? 'toggle-display' : 'wake';
            const displayTitle = shouldTurnDisplayOff ? 'Turn display off' : 'Wake screen';
            const displayDescription = shouldTurnDisplayOff ? 'Keep mirror running' : 'Turn this display on';
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
                    <button class="mirror-btn" data-device-action="mirror" data-device-id="${this.escapeHtml(device.id)}" data-device-name="${this.escapeHtml(device.name)}" title="Standard mirroring: Display on PC & phone" ${offline}>
                        <span class="mirror-btn-title">Mirror</span>
                        <span class="mirror-btn-desc">Display on PC & phone</span>
                    </button>
                    <button class="mirror-btn" data-device-action="mirror-keys" data-device-id="${this.escapeHtml(device.id)}" data-device-name="${this.escapeHtml(device.name)}" title="Eco mode: Phone dark, keyboard active" ${offline}>
                        <span class="mirror-btn-title">Screen Off + Keys</span>
                        <span class="mirror-btn-desc">Phone dark, keyboard active</span>
                    </button>
                    <button class="mirror-btn" data-display-power-control data-device-online="${device.status === 'online'}" data-device-action="${displayAction}" data-device-id="${this.escapeHtml(device.id)}" title="${displayTitle}" ${offline}>
                        <span class="mirror-btn-title">${displayTitle}</span>
                        <span class="mirror-btn-desc">${displayDescription}</span>
                    </button>
                </div>
            </div>
        `;
        }).join('');
        if (this.updateDeepLinkDevices) this.updateDeepLinkDevices(devices);
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
                button.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Connecting…';
                this.sendMessage('connectUsbDevice', { deviceId });
            } else if (action === 'mirror') {
                this.openMirrorSetup(deviceId, button.dataset.deviceName, 'screen');
            } else if (action === 'mirror-off') {
                this.openMirrorSetup(deviceId, button.dataset.deviceName, 'screen-off');
            } else if (action === 'mirror-keys') {
                this.openMirrorSetup(deviceId, button.dataset.deviceName, 'keyboard');
            } else if (action === 'wake') {
                button.disabled = true;
                button.innerHTML = '<span class="af-spinner af-spinner-sm"></span>';
                this.sendMessage('wakeDevice', { deviceId });
                this.addStatusMessage(`Waking screen: ${deviceId}`, 'info');
                setTimeout(() => { button.disabled = false; button.innerHTML = '<span class="mirror-btn-title">Wake screen</span>'; }, 1500);
            } else if (action === 'toggle-display') {
                button.disabled = true;
                button.innerHTML = '<span class="af-spinner af-spinner-sm"></span>';
                this.sendMessage('toggleMirrorDisplay', { deviceId });
                this.addStatusMessage(
                    this.mirroringState.displayOff ? `Waking screen: ${deviceId}` : `Turning display off: ${deviceId}`,
                    'info'
                );
            } else if (action === 'mirror-virtual') {
                this.sendMessage('mirrorDevice', { deviceId, mode: 'virtual-display' });
            } else if (action === 'disconnect') {
                button.disabled = true;
                button.innerHTML = '<span class="af-spinner af-spinner-sm"></span>';
                this.sendMessage('disconnectDevice', { deviceId });
                this.addStatusMessage(`Disconnecting device: ${deviceId}`, 'info');
            } else if (action === 'connect-network') {
                button.disabled = true;
                button.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Connecting…';
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

    stopMirroring() {
        const stopMirrorBtn = document.getElementById('stopMirrorBtn');
        if (stopMirrorBtn) {
            stopMirrorBtn.disabled = true;
            stopMirrorBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Stopping…';
        }
        this.sendMessage('stopMirroring', {});
        this.addStatusMessage('Stopping screen mirroring…', 'info');
    }

    updateMirroringState(state) {
        this.mirroringState = {
            isMirroring: Boolean(state && state.isMirroring),
            displayOff: Boolean(state && state.displayOff),
            serial: state && state.serial ? state.serial : null
        };
        this.isMirroring = this.mirroringState.isMirroring;
        const stopMirrorBtn = document.getElementById('stopMirrorBtn');
        if (stopMirrorBtn) {
            if (this.isMirroring) {
                stopMirrorBtn.classList.remove('btn-quiet');
                stopMirrorBtn.classList.add('btn-danger', 'is-active-mirror');
                stopMirrorBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Mirroring (Active)';
                stopMirrorBtn.disabled = false;
                stopMirrorBtn.title = 'Active screen mirroring session. Click to stop.';
            } else {
                stopMirrorBtn.classList.add('btn-quiet');
                stopMirrorBtn.classList.remove('btn-danger', 'is-active-mirror');
                stopMirrorBtn.innerHTML = '<i class="fas fa-stop"></i> Stop mirroring';
                stopMirrorBtn.disabled = true;
                stopMirrorBtn.title = 'No active screen mirroring session';
            }
        }

        document.querySelectorAll('#devicesList button[data-display-power-control]').forEach(button => {
            const title = button.querySelector('.mirror-btn-title');
            const description = button.querySelector('.mirror-btn-desc');
            if (!title || !description) {
                return;
            }
            const controlsActiveMirror = this.mirroringState.isMirroring &&
                button.dataset.deviceId === this.mirroringState.serial;
            const shouldTurnOff = controlsActiveMirror && !this.mirroringState.displayOff;
            button.dataset.deviceAction = controlsActiveMirror ? 'toggle-display' : 'wake';
            button.title = shouldTurnOff ? 'Turn display off' : 'Wake screen';
            title.textContent = shouldTurnOff ? 'Turn display off' : 'Wake screen';
            description.textContent = shouldTurnOff ? 'Keep mirror running' : 'Turn this display on';
            button.disabled = button.dataset.deviceOnline !== 'true';
        });
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
                case 'operationLoading':
                    this.setOperationLoading(message);
                    break;
                case 'openWorkflowModal':
                    this.openWorkflowModal(message.projectPath);
                    break;
                case 'workflowProjectPath':
                    const pathInput = document.getElementById('workflowProjectPathInput');
                    if (pathInput) {
                        pathInput.value = message.path || '';
                        pathInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
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
                case 'openSigningKeyModal':
                    this.openSigningKeyModal(message.projectPath);
                    break;
                case 'signingKeyProjectPath':
                    const signingProjectInput = document.getElementById('signingKeyProjectPath');
                    if (signingProjectInput) signingProjectInput.value = message.path || '';
                    break;
                case 'signingKeyCreated':
                    this.handleSigningKeyCreated(message.result);
                    break;
                case 'signingKeyFailed':
                    this.handleSigningKeyFailed(message.message);
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
                case 'mirroringState':
                    this.updateMirroringState(message);
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
                case 'openMcpHubModal':
                    this.openMcpHub(message.workspaceRoot);
                    break;
                case 'mcpHubData':
                    this.setData(message.agents, message.servers);
                    break;
                case 'mcpCompanionStatus':
                    this.onCompanionStatus(message);
                    break;
                case 'mcpCompanionDone':
                    this.onCompanionDone(message);
                    break;
                case 'mcpShowCompanionGuide':
                    this.openCompanionGuide(message.serverId);
                    break;
                case 'mcpPrereqResult':
                    this.showPrerequisiteResult(message);
                    break;
                case 'mcpWriteDone':
                    this.onWriteDone(message);
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
                case 'assetAssistantLoading':
                    this.setAssetAssistantLoading(message.loading);
                    break;
                case 'assetAssistantReport':
                    this.renderAssetAssistantReport(message.report);
                    break;
                case 'assetConstantsGenerated':
                    this.renderAssetAssistantReport(message.report);
                    this.showToast(`Generated ${message.generatedCount} constants in ${message.outputPath}`, 'success');
                    break;
                case 'assetAssistantError':
                    this.setAssetAssistantLoading(false);
                    this.showToast(message.message || 'Asset Assistant failed', 'error');
                    const assetStatus = document.getElementById('assetAssistantStatus');
                    if (assetStatus) assetStatus.textContent = message.message || 'Asset Assistant failed.';
                    break;
                case 'assetAssistantUnavailable':
                    this.setAssetAssistantLoading(false);
                    const unavailableAssetStatus = document.getElementById('assetAssistantStatus');
                    const unavailableAssetTree = document.getElementById('assetFileTree');
                    const unavailableAssetSummary = document.getElementById('assetAssistantSummary');
                    const generateAssetConstants = document.getElementById('generateAssetConstantsBtn');
                    if (unavailableAssetStatus) unavailableAssetStatus.textContent = message.message;
                    if (unavailableAssetTree) unavailableAssetTree.innerHTML = '<p class="empty"><i class="fas fa-folder-open"></i><span>No Flutter project open</span></p>';
                    if (unavailableAssetSummary) unavailableAssetSummary.innerHTML = '<span><strong>0</strong> files</span>';
                    if (generateAssetConstants) generateAssetConstants.disabled = true;
                    break;
                case 'codeCleanupLoading':
                    this.setCodeCleanupLoading(message.loading);
                    break;
                case 'codeCleanupReport':
                    this.renderCodeCleanupReport(message.report);
                    break;
                case 'codeCleanupError':
                    this.setCodeCleanupLoading(false);
                    this.showToast(message.message || 'Code cleanup scan failed', 'error');
                    const cleanupStatus = document.getElementById('codeCleanupStatus');
                    if (cleanupStatus) cleanupStatus.textContent = message.message || 'Code cleanup scan failed.';
                    break;
                case 'permissionCatalogLoaded':
                    this.renderPermissionCatalog(message.catalog, message.declaredPermissions, message.categories, message.platform);
                    break;
                case 'permissionsAdded':
                    this.handlePermissionsAdded(message);
                    break;
                case 'permissionsUnchanged':
                    this.handlePermissionsUnchanged(message);
                    break;
                case 'permissionCatalogError':
                    this.setPermissionLoading(false);
                    this.showToast(message.message || 'Unable to inspect AndroidManifest.xml.', 'error');
                    const permissionStatus = document.getElementById('permissionStatus');
                    if (permissionStatus) permissionStatus.textContent = message.message || 'Unable to inspect AndroidManifest.xml.';
                    break;
                case 'permissionCatalogUnavailable':
                    this.setPermissionLoading(false);
                    const unavailablePermissionStatus = document.getElementById('permissionStatus');
                    const unavailablePermissionCatalog = document.getElementById('permissionCatalog');
                    const addPermissions = document.getElementById('addPermissionsBtn');
                    if (unavailablePermissionStatus) unavailablePermissionStatus.textContent = message.message;
                    if (unavailablePermissionCatalog) unavailablePermissionCatalog.innerHTML = '<p class="empty"><i class="fas fa-shield-halved"></i><span>No Android Flutter project open</span></p>';
                    if (addPermissions) addPermissions.disabled = true;
                    break;
                case 'appStateStatus':
                    this.handleAppStateStatus(message);
                    break;
                case 'appStatePackageSelected':
                    this.renderAppStatePackage(message.packageId);
                    this.setAppStateStatus(`Target package set to ${message.packageId}.`, 'done');
                    break;
                case 'appStateCancelled':
                    this.setAppStateStatus('Reset cancelled — nothing was erased.');
                    break;
                case 'deepLinkStudioState':
                    this.renderDeepLinkStudio(message);
                    break;
                case 'deepLinkDispatchResult':
                    this.handleDeepLinkDispatchResult(message.result, message.recentUris);
                    break;
                case 'openStorageInspectorModal':
                    this.openStorageInspectorModal?.(message.data);
                    break;
                case 'storageInspectorState':
                    this.handleStorageInspectorState?.(message);
                    break;
                case 'storageInspectorSharedPrefsLoaded':
                    this.handleStorageSharedPrefsLoaded?.(message.items);
                    break;
                case 'storageInspectorTablesLoaded':
                    this.handleStorageTablesLoaded?.(message.tables);
                    break;
                case 'storageInspectorQueryLoaded':
                    this.handleStorageQueryLoaded?.(message.queryResult);
                    break;
                case 'openDebugOverlaysModal':
                    this.openDebugOverlaysModal?.();
                    break;
                case 'debugOverlaysState':
                    this.handleDebugOverlaysState?.(message.state);
                    break;
                case 'openMockGpsModal':
                    this.openMockGpsModal?.(message.data);
                    break;
                case 'mockGpsState':
                    this.handleMockGpsState?.(message);
                    break;
                case 'openApkSizeModal':
                    this.openApkSizeModal?.(message.data);
                    break;
                case 'apkSizeState':
                    this.handleApkSizeState?.(message);
                    break;
                case 'openPubHealthModal':
                    this.openPubHealthModal?.(message.data);
                    break;
                case 'pubHealthProjectPath':
                    this.handlePubHealthProjectPath?.(message.projectPath);
                    break;
                case 'pubHealthState':
                    this.handlePubHealthState?.(message);
                    break;
                case 'deepLinkDispatchError':
                    this.handleDeepLinkDispatchError(message.message);
                    break;
                case 'deepLinkPresetsUpdated':
                    this.renderDeepLinkPresets(message.presets);
                    break;
                case 'localhostBridgeState':
                    this.renderLocalhostBridgeState(message.devices || [], message.rules || []);
                    break;
                default:
                    console.warn('⚠️ Unknown message command:', message.command);
                    break;
            }
        } catch (error) {
            console.error('❌ Error handling message from extension:', error);
        }
    }

    setOperationLoading(message) {
        const id = String(message.operationId || message.operation || 'operation');
        if (message.loading) {
            this.activeOperations.set(id, {
                operation: message.operation,
                target: message.target
            });
        } else {
            this.activeOperations.delete(id);
            this.resetOperationControl(message.operation, message.target);
        }

        const indicator = document.getElementById('globalOperationIndicator');
        const label = document.getElementById('globalOperationLabel');
        if (!indicator || !label) return;
        const active = Array.from(this.activeOperations.values()).at(-1);
        indicator.hidden = !active;
        document.body.setAttribute('aria-busy', active ? 'true' : 'false');
        if (active) label.textContent = this.operationLabel(active.operation, active.target);
    }

    operationLabel(operation, target) {
        const labels = {
            openWorkflowModal: 'Opening workflow generator…',
            selectWorkflowProject: 'Selecting Flutter project…',
            openSigningKeyModal: 'Opening signing key tool…',
            selectSigningKeyProject: 'Selecting Flutter project…',
            openFlavorsModal: 'Detecting Flutter flavors…',
            selectFlavorsProject: 'Selecting Flutter project…',
            openProxyModal: 'Reading network settings…',
            openAgentScaffoldModal: 'Opening agent scaffolder…',
            selectAgentScaffoldProject: 'Selecting project directory…',
            openCompatDoctorModal: 'Scanning compatibility…',
            selectCompatProject: 'Selecting Flutter project…',
            connectDevice: 'Connecting to device…',
            refreshDevices: 'Refreshing devices…',
            connectUsbDevice: 'Enabling wireless ADB…',
            connectNetworkDevice: 'Connecting wirelessly…',
            disconnectDevice: 'Disconnecting device…',
            mirrorDevice: 'Starting screen mirroring…',
            wakeDevice: 'Updating phone display…',
            stopMirroring: 'Stopping screen mirroring…',
            installApk: 'Installing APK…',
            sendText: 'Sending text to phone…',
            setScrcpyPath: 'Checking scrcpy…',
            generateWorkflow: 'Generating workflow…',
            createSigningKey: 'Creating signing key…',
            detectFlavors: 'Detecting Flutter flavors…',
            setupFlavors: 'Setting up Flutter flavors…',
            runFlavor: 'Running Flutter flavor…',
            buildFlavorApk: 'Building flavor APK…',
            buildAllFlavors: 'Building all flavor APKs…',
            getNetworkState: 'Reading network settings…',
            setProxy: 'Applying HTTP proxy…',
            clearProxy: 'Clearing HTTP proxy…',
            setPrivateDns: 'Applying Private DNS…',
            clearPrivateDns: 'Clearing Private DNS…',
            toggleScreenRecording: 'Updating screen recording…',
            generateAgentScaffold: 'Scaffolding AI agents…',
            runCompatDoctorScan: 'Scanning compatibility…',
            applyCompatUpgrades: 'Applying compatibility upgrades…',
            applyCustomStack: 'Applying custom build stack…',
            scanAssets: 'Scanning assets…',
            scanAndSyncAssets: 'Scanning and syncing assets…',
            generateAssetConstants: 'Generating asset constants…',
            deleteUnusedAsset: 'Deleting asset and rescanning…',
            runCodeCleanupScan: 'Analyzing code and packages…',
            deleteUnusedDartFile: 'Deleting file and rescanning…',
            loadAndroidPermissions: 'Reading Android permissions…',
            addAndroidPermissions: 'Updating Android permissions…',
            loadPermissions: 'Reading permissions…',
            addPermissions: 'Updating permissions…',
            clearAppCache: 'Clearing app cache…',
            resetAppDatabases: 'Resetting app databases…',
            factoryResetApp: 'Resetting app data…',
            clearAllAppData: 'Clearing all app data…',
            pickAppPackage: 'Loading app packages…',
            dispatchDeepLink: 'Dispatching deep link…',
            applyLocalhostBridge: 'Linking localhost port…',
            refreshLocalhostBridge: 'Refreshing localhost ports…',
            removeLocalhostBridge: 'Removing localhost port…',
            removeAllLocalhostBridges: 'Removing localhost ports…'
        };
        if (operation === 'runFlutterCommand') {
            const commands = {
                runFlutterDoctor: 'Running Flutter Doctor…',
                getPackages: 'Getting Flutter packages…',
                upgradePackages: 'Upgrading Flutter packages…',
                cleanProject: 'Cleaning Flutter project…',
                runApp: 'Running Flutter app…',
                buildAPK: 'Building APK…',
                buildAAB: 'Building App Bundle…'
            };
            return commands[target] || 'Running Flutter command…';
        }
        return labels[operation] || 'Working…';
    }

    resetOperationControl(operation, target) {
        if (operation === 'refreshDevices') {
            ['refreshDevicesBtn', 'refreshUsbDevicesBtn'].forEach(id => {
                const button = document.getElementById(id);
                if (!button) return;
                if (button.dataset.idleHtml) button.innerHTML = button.dataset.idleHtml;
                button.disabled = false;
            });
        }
        if (operation === 'runFlutterCommand') {
            document.querySelectorAll(`[data-command="${target}"]`).forEach(button => {
                if (button.dataset.idleHtml) button.innerHTML = button.dataset.idleHtml;
                button.classList.remove('is-running');
                button.disabled = false;
            });
            this.isExecuting = false;
        }

        const controls = {
            generateWorkflow: ['generateWorkflowSubmitBtn', '<i class="fas fa-magic"></i> Generate Workflow'],
            generateAgentScaffold: ['scaffoldSubmitBtn', '<i class="fas fa-robot"></i> Generate Agent(s)'],
            setupFlavors: ['setupFlavorsBtn', '<i class="fas fa-wand-magic-sparkles"></i> Setup Flavors (dev, staging, prod)'],
            buildFlavorApk: ['buildFlavorApkBtn', '<i class="fas fa-box"></i> Build APK'],
            buildAllFlavors: ['buildAllFlavorsBtn', '<i class="fas fa-boxes-stacked"></i> Build All Flavors']
        };
        const control = controls[operation];
        if (control) {
            const button = document.getElementById(control[0]);
            if (button) {
                button.disabled = false;
                button.innerHTML = control[1];
            }
        }
    }

}

// Mix in submodule capabilities
function mixinModule(targetClass, moduleClass) {
    if (!moduleClass) return;
    const proto = moduleClass.prototype || moduleClass;
    for (const prop of Object.getOwnPropertyNames(proto)) {
        if (prop !== 'constructor') {
            targetClass.prototype[prop] = proto[prop];
        }
    }
}

mixinModule(AirFlutterWebview, window.AirFlutterWorkflowModule);
mixinModule(AirFlutterWebview, window.AirFlutterFlavorsModule);
mixinModule(AirFlutterWebview, window.AirFlutterProxyModule);
mixinModule(AirFlutterWebview, window.AirFlutterRecorderModule);
mixinModule(AirFlutterWebview, window.AirFlutterAgentScaffoldModule);
mixinModule(AirFlutterWebview, window.AirFlutterCompatDoctorModule);
mixinModule(AirFlutterWebview, window.AirFlutterSigningKeyModule);
mixinModule(AirFlutterWebview, window.AirFlutterAssetAssistantModule);
mixinModule(AirFlutterWebview, window.AirFlutterCodeCleanupModule);
mixinModule(AirFlutterWebview, window.AirFlutterPermissionManagerModule);
mixinModule(AirFlutterWebview, window.AirFlutterAppStateModule);
mixinModule(AirFlutterWebview, window.AirFlutterDeepLinkStudioModule);
mixinModule(AirFlutterWebview, window.AirFlutterLocalhostBridgeModule);
mixinModule(AirFlutterWebview, window.AirFlutterMirrorSetupModule);
mixinModule(AirFlutterWebview, window.AirFlutterMcpModule);
mixinModule(AirFlutterWebview, window.AirFlutterStorageInspectorModule);
mixinModule(AirFlutterWebview, window.AirFlutterDebugOverlaysModule);
mixinModule(AirFlutterWebview, window.AirFlutterMockGpsModule);
mixinModule(AirFlutterWebview, window.AirFlutterApkSizeModule);
mixinModule(AirFlutterWebview, window.AirFlutterPubHealthModule);

// Initialize the webview
const airFlutter = new AirFlutterWebview();

// The panel's inline script later replaces `window.airFlutter` with a small
// bridge object, which would hide every method mixed into this instance.
// Expose the real instance under a reserved name so the bridge (and any future
// inline code) can delegate to the actual implementation.
window.airFlutterApp = airFlutter;

window.addEventListener('message', event => {
    airFlutter.handleMessage(event.data);
});
airFlutter.sendMessage('panelReady', {});

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
