// Deep Storage & Cache Wiper Module
window.AirFlutterAppStateModule = class AirFlutterAppStateModule {
    initAppStateWiper() {
        const cacheBtn = document.getElementById('clearAppCacheBtn');
        const dbBtn = document.getElementById('resetAppDatabasesBtn');
        const factoryBtn = document.getElementById('factoryResetAppBtn');
        const pickBtn = document.getElementById('pickAppPackageBtn');

        if (cacheBtn) {
            cacheBtn.addEventListener('click', () => this.requestWipe('cache'));
        }
        if (dbBtn) {
            dbBtn.addEventListener('click', () => this.requestWipe('databases'));
        }
        if (factoryBtn) {
            factoryBtn.addEventListener('click', () => this.requestWipe('factory'));
        }
        if (pickBtn) {
            pickBtn.addEventListener('click', () => {
                pickBtn.disabled = true;
                pickBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Package…';
                this.setAppStateStatus('Choose the package to target…', 'busy');
                this.sendMessage('pickAppPackage', {});
            });
        }
    }

    requestWipe(operation) {
        if (!this.appStatePackage) {
            this.setAppStateStatus('Pick a target package before resetting.', 'error');
            this.showToast('Pick a target package first.', 'error');
            this.sendMessage('pickAppPackage', {});
            return;
        }

        const btnMap = {
            cache: document.getElementById('clearAppCacheBtn'),
            databases: document.getElementById('resetAppDatabasesBtn'),
            factory: document.getElementById('factoryResetAppBtn')
        };
        const targetBtn = btnMap[operation];
        if (targetBtn) {
            targetBtn.disabled = true;
            targetBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Resetting…';
        }

        // The host shows a native modal confirmation. Here we only give instant
        // visual feedback so the click never feels ignored.
        this.setAppStateStatus(
            operation === 'factory'
                ? `Waiting for confirmation to factory reset ${this.appStatePackage}…`
                : `Waiting for confirmation to reset ${operation} of ${this.appStatePackage}…`,
            'busy'
        );
        this.sendMessage(operation === 'factory' ? 'factoryResetApp' : operation === 'cache' ? 'clearAppCache' : 'resetAppDatabases', {
            packageId: this.appStatePackage
        });
    }

    renderAppStatePackage(packageId) {
        this.resetWipeButtons();
        this.appStatePackage = packageId || '';
        const line = document.getElementById('appStatePackage');
        if (!line) {
            return;
        }
        if (this.appStatePackage) {
            line.textContent = this.appStatePackage;
            line.title = this.appStatePackage;
            line.setAttribute('data-state', 'ready');
        } else {
            line.textContent = 'no package detected — click Package';
            line.removeAttribute('title');
            line.setAttribute('data-state', 'empty');
        }
    }

    setAppStateStatus(message, kind) {
        const status = document.getElementById('appStateStatus');
        if (!status) {
            return;
        }
        if (!message) {
            status.hidden = true;
            status.textContent = '';
            status.classList.remove('is-error', 'is-busy');
            return;
        }
        status.hidden = false;
        if (kind === 'busy') {
            status.innerHTML = `<span class="af-spinner af-spinner-sm"></span> ${this.escapeHtml ? this.escapeHtml(message) : message}`;
        } else {
            status.textContent = message;
        }
        status.classList.toggle('is-error', kind === 'error');
        status.classList.toggle('is-busy', kind === 'busy');
    }

    resetWipeButtons() {
        const pickBtn = document.getElementById('pickAppPackageBtn');
        const cacheBtn = document.getElementById('clearAppCacheBtn');
        const dbBtn = document.getElementById('resetAppDatabasesBtn');
        const factoryBtn = document.getElementById('factoryResetAppBtn');
        if (pickBtn) {
            pickBtn.disabled = false;
            pickBtn.innerHTML = '<i class="fas fa-cube"></i> Package';
        }
        if (cacheBtn) {
            cacheBtn.disabled = false;
            cacheBtn.innerHTML = '<i class="fas fa-broom"></i> Clear Cache Only';
        }
        if (dbBtn) {
            dbBtn.disabled = false;
            dbBtn.innerHTML = '<i class="fas fa-database"></i> Reset Databases';
        }
        if (factoryBtn) {
            factoryBtn.disabled = false;
            factoryBtn.innerHTML = '<i class="fas fa-arrows-rotate"></i> Factory Reset (pm clear)';
        }
    }

    handleAppStateStatus(message) {
        if (message.busy) {
            const label = message.operation === 'factory'
                ? 'Factory resetting'
                : message.operation === 'cache'
                    ? 'Clearing cache for'
                    : message.operation === 'databases'
                        ? 'Resetting databases for'
                        : 'Working on';
            this.setAppStateStatus(
                `${label} ${message.packageId || this.appStatePackage || 'the app'}…`,
                'busy'
            );
            return;
        }

        this.resetWipeButtons();

        if (message.error) {
            this.setAppStateStatus(`Reset failed: ${message.error}`, 'error');
            return;
        }

        if (message.result) {
            const warn = message.result.warnings && message.result.warnings.length > 0;
            this.setAppStateStatus(message.result.message, warn ? 'error' : 'done');
            this.renderAppStatePackage(message.result.packageId || this.appStatePackage);
        } else {
            this.setAppStateStatus('');
        }
    }
};
