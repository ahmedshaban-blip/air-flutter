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
        status.textContent = message;
        status.classList.toggle('is-error', kind === 'error');
        status.classList.toggle('is-busy', kind === 'busy');
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
