(function () {
    class AssetAssistantModule {
        initAssetAssistant() {
            document.querySelectorAll('[data-panel-tab]').forEach(button => {
                button.addEventListener('click', () => this.selectPanelTab(button.dataset.panelTab));
            });

            const scanButton = document.getElementById('scanSyncAssetsBtn');
            if (scanButton) scanButton.addEventListener('click', () => this.scanAndSyncAssets());

            const generateButton = document.getElementById('generateAssetConstantsBtn');
            if (generateButton) generateButton.addEventListener('click', () => {
                this.setAssetAssistantLoading(true);
                this.sendMessage('generateAssetConstants', {});
            });
            const assetTree = document.getElementById('assetFileTree');
            if (assetTree) {
                assetTree.addEventListener('click', event => {
                    const button = event.target.closest('button[data-delete-asset]');
                    if (button) this.sendMessage('deleteUnusedAsset', { file: button.dataset.deleteAsset });
                });
            }
        }

        selectPanelTab(tabName) {
            document.querySelectorAll('[data-panel-tab]').forEach(button => {
                const selected = button.dataset.panelTab === tabName;
                button.classList.toggle('is-active', selected);
                button.setAttribute('aria-selected', String(selected));
            });
            document.querySelectorAll('[data-panel-view]').forEach(view => {
                view.hidden = view.dataset.panelView !== tabName;
            });
            if (tabName === 'assets' && !this.assetAssistantScanned) this.scanAssets();
            if (tabName === 'permissions') this.loadPermissionCatalog();
        }

        scanAssets() {
            this.setAssetAssistantLoading(true);
            this.sendMessage('scanAssets', {});
        }

        scanAndSyncAssets() {
            this.setAssetAssistantLoading(true);
            this.sendMessage('scanAndSyncAssets', {});
        }

        setAssetAssistantLoading(loading) {
            ['scanSyncAssetsBtn', 'generateAssetConstantsBtn'].forEach(id => {
                const button = document.getElementById(id);
                if (button) button.disabled = Boolean(loading);
            });
            const status = document.getElementById('assetAssistantStatus');
            if (status && loading) status.textContent = 'Scanning project assets…';
        }

        renderAssetAssistantReport(report) {
            this.assetAssistantScanned = true;
            this.setAssetAssistantLoading(false);
            const status = document.getElementById('assetAssistantStatus');
            const tree = document.getElementById('assetFileTree');
            const summary = document.getElementById('assetAssistantSummary');
            if (!status || !tree || !summary) return;

            const files = report.files || [];
            const warningCount = files.reduce((sum, file) => sum + (file.warnings || []).length, 0);
            const missingCount = report.pubspecUpdated ? 0 : (report.missingFromPubspec || []).length;
            summary.innerHTML = `
                <span><strong>${files.length}</strong> files</span>
                <span><strong>${this.formatAssetSize(report.totalBytes || 0)}</strong> total</span>
                <span class="${warningCount ? 'asset-summary-warning' : ''}"><strong>${warningCount}</strong> warnings</span>
                <span class="${missingCount ? 'asset-summary-warning' : ''}"><strong>${missingCount}</strong> undeclared</span>
            `;
            status.textContent = report.pubspecUpdated
                ? `pubspec.yaml updated with ${report.missingFromPubspec.length} asset(s).`
                : (files.length ? 'Asset audit complete.' : 'No files found under assets/.');

            if (!files.length) {
                tree.innerHTML = '<p class="empty"><i class="fas fa-folder-open"></i><span>No assets found</span></p>';
                return;
            }

            tree.innerHTML = files.map(file => {
                const warnings = (file.warnings || []).map(code => {
                    const labels = { heavy: 'Over 1 MB', spaces: 'Spaces in name', 'non-standard-format': 'Non-standard format' };
                    return `<span class="asset-warning">${this.escapeHtml(labels[code] || code)}</span>`;
                }).join('');
                const declaration = file.declared ? '' : '<span class="asset-warning">Missing from pubspec</span>';
                const icon = file.kind === 'font' ? 'fa-font' : (file.kind === 'svg' ? 'fa-bezier-curve' : 'fa-image');
                return `
                    <div class="asset-file-row">
                        <i class="fas ${icon}" aria-hidden="true"></i>
                        <div class="asset-file-info">
                            <span class="asset-file-path">${this.escapeHtml(file.path)}</span>
                            <span class="asset-file-warnings">${declaration}${warnings}</span>
                        </div>
                        <div class="asset-file-actions">
                            <span class="asset-file-size">${this.formatAssetSize(file.size)}</span>
                            <span class="${file.used ? 'asset-used' : 'asset-unused'}">${file.used ? `Used · ${file.usageCount}` : 'Unused'}</span>
                            ${file.safeToDelete ? `<button class="btn btn-danger asset-delete-btn" data-delete-asset="${this.escapeHtml(file.path)}">Delete</button>` : ''}
                        </div>
                    </div>`;
            }).join('');
        }

        formatAssetSize(bytes) {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }
    }

    window.AirFlutterAssetAssistantModule = AssetAssistantModule;
})();
