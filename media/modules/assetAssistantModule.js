(function () {
    class AssetAssistantModule {
        initAssetAssistant() {
            this.currentReport = null;
            this.currentFilter = 'all';
            this.searchQuery = '';
            this.currentSort = 'name-asc';
            this.selectedAssetPaths = new Set();
            this.pendingImportFiles = [];

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

            this.initSearchAndFilters();
            this.initBulkActions();
            this.initDragAndDrop();
            this.initAssetTreeEvents();
            this.initImportModal();
        }

        initSearchAndFilters() {
            const searchInput = document.getElementById('assetSearchInput');
            const clearBtn = document.getElementById('assetSearchClearBtn');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    this.searchQuery = searchInput.value.trim().toLowerCase();
                    if (clearBtn) clearBtn.hidden = !this.searchQuery;
                    this.filterAndRenderTree();
                });
            }
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (searchInput) {
                        searchInput.value = '';
                        this.searchQuery = '';
                        clearBtn.hidden = true;
                        this.filterAndRenderTree();
                    }
                });
            }

            document.querySelectorAll('[data-asset-filter]').forEach(pill => {
                pill.addEventListener('click', () => {
                    document.querySelectorAll('[data-asset-filter]').forEach(p => p.classList.remove('is-active'));
                    pill.classList.add('is-active');
                    this.currentFilter = pill.dataset.assetFilter || 'all';
                    this.filterAndRenderTree();
                });
            });

            const sortSelect = document.getElementById('assetSortSelect');
            if (sortSelect) {
                sortSelect.addEventListener('change', () => {
                    this.currentSort = sortSelect.value;
                    this.filterAndRenderTree();
                });
            }
        }

        initBulkActions() {
            const selectAll = document.getElementById('assetSelectAllCheckbox');
            if (selectAll) {
                selectAll.addEventListener('change', () => {
                    const visibleRows = this.getVisibleFiles();
                    if (selectAll.checked) {
                        visibleRows.forEach(f => this.selectedAssetPaths.add(f.path));
                    } else {
                        visibleRows.forEach(f => this.selectedAssetPaths.delete(f.path));
                    }
                    this.updateBulkBar();
                    this.syncRowCheckboxes();
                });
            }

            const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
            if (bulkDeleteBtn) {
                bulkDeleteBtn.addEventListener('click', () => {
                    const paths = Array.from(this.selectedAssetPaths);
                    if (paths.length > 0) {
                        this.sendMessage('deleteAssetsBatch', { files: paths });
                        this.selectedAssetPaths.clear();
                        this.updateBulkBar();
                    }
                });
            }

            const bulkCompressBtn = document.getElementById('bulkCompressBtn');
            if (bulkCompressBtn) {
                bulkCompressBtn.addEventListener('click', () => this.compressSelectedAssets());
            }
        }

        initDragAndDrop() {
            const dropZone = document.getElementById('assetDropZone');
            const fileInput = document.getElementById('assetFileInput');

            if (dropZone) {
                ['dragenter', 'dragover'].forEach(name => {
                    dropZone.addEventListener(name, e => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropZone.classList.add('is-dragover');
                    });
                });

                ['dragleave', 'drop'].forEach(name => {
                    dropZone.addEventListener(name, e => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropZone.classList.remove('is-dragover');
                    });
                });

                dropZone.addEventListener('drop', e => {
                    const files = Array.from(e.dataTransfer.files || []);
                    if (files.length > 0) this.openImportModal(files);
                });
            }

            if (fileInput) {
                fileInput.addEventListener('change', () => {
                    const files = Array.from(fileInput.files || []);
                    if (files.length > 0) this.openImportModal(files);
                    fileInput.value = '';
                });
            }
        }

        initAssetTreeEvents() {
            const assetTree = document.getElementById('assetFileTree');
            const hoverPopover = document.getElementById('assetHoverPopover');

            if (assetTree) {
                assetTree.addEventListener('click', e => {
                    const deleteBtn = e.target.closest('button[data-delete-asset]');
                    if (deleteBtn) {
                        this.sendMessage('deleteUnusedAsset', { file: deleteBtn.dataset.deleteAsset });
                        return;
                    }

                    const compressBtn = e.target.closest('button[data-compress-asset]');
                    if (compressBtn) {
                        const path = compressBtn.dataset.compressAsset;
                        const file = (this.currentReport?.files || []).find(f => f.path === path);
                        if (file) this.compressSingleAsset(file);
                        return;
                    }

                    const copyBtn = e.target.closest('button[data-copy-snippet]');
                    if (copyBtn) {
                        const snippet = copyBtn.dataset.copySnippet;
                        this.copyToClipboard(snippet, copyBtn);
                        return;
                    }

                    const openTarget = e.target.closest('[data-open-asset]');
                    if (openTarget) {
                        this.sendMessage('openAssetInEditor', { file: openTarget.dataset.openAsset });
                        return;
                    }

                    const checkbox = e.target.closest('.asset-row-checkbox');
                    if (checkbox) {
                        const path = checkbox.dataset.assetPath;
                        if (checkbox.checked) {
                            this.selectedAssetPaths.add(path);
                        } else {
                            this.selectedAssetPaths.delete(path);
                        }
                        this.updateBulkBar();
                        return;
                    }
                });

                assetTree.addEventListener('mouseover', e => {
                    const thumb = e.target.closest('.asset-thumbnail-img');
                    if (thumb && hoverPopover) {
                        const src = thumb.dataset.previewSrc;
                        const path = thumb.dataset.previewPath || '';
                        const size = thumb.dataset.previewSize || '';
                        hoverPopover.innerHTML = `
                            <div class="asset-popover-card">
                                <img src="${src}" alt="" class="asset-popover-img" />
                                <div class="asset-popover-info">
                                    <span class="asset-popover-path">${this.escapeHtml(path)}</span>
                                    <span class="asset-popover-size">${this.escapeHtml(size)}</span>
                                </div>
                            </div>
                        `;
                        const rect = thumb.getBoundingClientRect();
                        hoverPopover.style.top = `${Math.max(10, rect.top - 80)}px`;
                        hoverPopover.style.left = `${rect.right + 12}px`;
                        hoverPopover.hidden = false;
                    }
                });

                assetTree.addEventListener('mouseout', e => {
                    const thumb = e.target.closest('.asset-thumbnail-img');
                    if (thumb && hoverPopover) {
                        hoverPopover.hidden = true;
                    }
                });
            }
        }

        initImportModal() {
            const closeBtn = document.getElementById('assetImportCloseBtn');
            const cancelBtn = document.getElementById('assetImportCancelBtn');
            const confirmBtn = document.getElementById('assetImportConfirmBtn');
            const modal = document.getElementById('assetImportModal');

            [closeBtn, cancelBtn].forEach(btn => {
                if (btn) btn.addEventListener('click', () => {
                    if (modal) modal.hidden = true;
                    this.pendingImportFiles = [];
                });
            });

            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    const folderSelect = document.getElementById('assetImportFolderSelect');
                    const targetDir = folderSelect ? folderSelect.value : 'assets/images';
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = 'Importing…';

                    try {
                        const payloadFiles = [];
                        const rows = document.querySelectorAll('.asset-import-row');
                        for (let i = 0; i < this.pendingImportFiles.length; i++) {
                            const originalFile = this.pendingImportFiles[i];
                            const row = rows[i];
                            const nameInput = row ? row.querySelector('.asset-import-name-input') : null;
                            const finalName = nameInput ? nameInput.value.trim() : originalFile.name;
                            const base64 = await this.readFileAsBase64(originalFile);
                            payloadFiles.push({
                                name: finalName,
                                targetDir,
                                base64
                            });
                        }

                        this.sendMessage('importAssets', { files: payloadFiles });
                        if (modal) modal.hidden = true;
                        this.pendingImportFiles = [];
                    } catch (err) {
                        console.error('Import failed', err);
                    } finally {
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'Import & Sync';
                    }
                });
            }
        }

        openImportModal(files) {
            this.pendingImportFiles = files;
            const modal = document.getElementById('assetImportModal');
            const list = document.getElementById('assetImportFileList');
            if (!modal || !list) return;

            list.innerHTML = files.map((file, index) => {
                const suggestedName = this.toSnakeCase(file.name);
                return `
                    <div class="asset-import-row">
                        <div class="asset-import-row-orig">
                            <i class="fas fa-file-image"></i>
                            <span title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</span>
                            <span class="asset-import-size">${this.formatAssetSize(file.size)}</span>
                        </div>
                        <i class="fas fa-arrow-right asset-import-arrow"></i>
                        <input type="text" class="deep-link-input mono asset-import-name-input" 
                               value="${this.escapeHtml(suggestedName)}" data-file-index="${index}" />
                    </div>
                `;
            }).join('');

            modal.hidden = false;
        }

        toSnakeCase(name) {
            const lastDot = name.lastIndexOf('.');
            const base = lastDot >= 0 ? name.slice(0, lastDot) : name;
            const ext = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : '';
            const clean = base
                .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
                .replace(/[^a-zA-Z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .toLowerCase();
            return `${clean || 'asset'}${ext}`;
        }

        readFileAsBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = String(reader.result || '');
                    const base64 = result.includes(',') ? result.split(',')[1] : result;
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        async compressSingleAsset(file) {
            if (!file.previewUri) return;
            const status = document.getElementById('assetAssistantStatus');
            if (status) status.textContent = `Compressing ${file.path} to WebP…`;

            try {
                const base64 = await this.convertImageToWebP(file.previewUri);
                const newPath = file.path.replace(/\.[^/.]+$/, '.webp');
                this.sendMessage('saveOptimizedAsset', {
                    originalPath: file.path,
                    newPath,
                    base64
                });
            } catch (err) {
                console.error('Optimization error', err);
                if (status) status.textContent = `Optimization failed: ${err.message || err}`;
            }
        }

        async compressSelectedAssets() {
            const paths = Array.from(this.selectedAssetPaths);
            const candidateFiles = (this.currentReport?.files || []).filter(
                f => paths.includes(f.path) && f.kind === 'image' && f.previewUri && !f.path.endsWith('.webp')
            );
            if (candidateFiles.length === 0) return;

            const bulkBtn = document.getElementById('bulkCompressBtn');
            if (bulkBtn) {
                bulkBtn.disabled = true;
                bulkBtn.textContent = 'Compressing…';
            }

            for (const file of candidateFiles) {
                await this.compressSingleAsset(file);
            }

            this.selectedAssetPaths.clear();
            this.updateBulkBar();
            if (bulkBtn) {
                bulkBtn.disabled = false;
                bulkBtn.innerHTML = '<i class="fas fa-compress"></i> Convert to WebP';
            }
        }

        convertImageToWebP(previewUri, quality = 0.85) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const dataUrl = canvas.toDataURL('image/webp', quality);
                        const base64 = dataUrl.replace(/^data:image\/webp;base64,/, '');
                        resolve(base64);
                    } catch (e) {
                        reject(e);
                    }
                };
                img.onerror = () => reject(new Error('Failed to load image for canvas compression'));
                img.src = previewUri;
            });
        }

        copyToClipboard(text, buttonElement) {
            if (!text) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    this.showCopiedFeedback(buttonElement);
                }).catch(() => {
                    this.fallbackCopyText(text, buttonElement);
                });
            } else {
                this.fallbackCopyText(text, buttonElement);
            }
        }

        fallbackCopyText(text, buttonElement) {
            const input = document.createElement('textarea');
            input.value = text;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            this.showCopiedFeedback(buttonElement);
        }

        showCopiedFeedback(button) {
            if (!button) return;
            const originalHtml = button.innerHTML;
            button.classList.add('is-copied');
            button.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                button.classList.remove('is-copied');
                button.innerHTML = originalHtml;
            }, 1200);
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
            this.currentReport = report;
            this.setAssetAssistantLoading(false);
            const status = document.getElementById('assetAssistantStatus');
            const summary = document.getElementById('assetAssistantSummary');
            if (!status || !summary) return;

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

            this.filterAndRenderTree();
        }

        getVisibleFiles() {
            if (!this.currentReport || !this.currentReport.files) return [];
            // Hide individual child variants from the root list; they are shown under parent
            let files = this.currentReport.files.filter(f => !f.isVariant);

            if (this.searchQuery) {
                files = files.filter(f => f.path.toLowerCase().includes(this.searchQuery));
            }

            if (this.currentFilter !== 'all') {
                if (this.currentFilter === 'unused') {
                    files = files.filter(f => !f.used);
                } else if (this.currentFilter === 'warnings') {
                    files = files.filter(f => (f.warnings || []).length > 0);
                } else if (this.currentFilter === 'undeclared') {
                    files = files.filter(f => !f.declared);
                } else if (['image', 'svg', 'font'].includes(this.currentFilter)) {
                    files = files.filter(f => f.kind === this.currentFilter);
                }
            }

            files.sort((a, b) => {
                switch (this.currentSort) {
                    case 'name-desc':
                        return b.path.localeCompare(a.path);
                    case 'size-desc':
                        return b.size - a.size;
                    case 'size-asc':
                        return a.size - b.size;
                    case 'usage-desc':
                        return (b.usageCount || 0) - (a.usageCount || 0);
                    case 'usage-asc':
                        return (a.usageCount || 0) - (b.usageCount || 0);
                    case 'name-asc':
                    default:
                        return a.path.localeCompare(b.path);
                }
            });

            return files;
        }

        filterAndRenderTree() {
            const tree = document.getElementById('assetFileTree');
            if (!tree) return;

            const visibleFiles = this.getVisibleFiles();

            if (!visibleFiles.length) {
                tree.innerHTML = '<p class="empty"><i class="fas fa-folder-open"></i><span>No matching assets found</span></p>';
                this.updateBulkBar();
                return;
            }

            tree.innerHTML = visibleFiles.map(file => {
                const warnings = (file.warnings || []).map(code => {
                    const labels = { heavy: 'Over 1 MB', spaces: 'Spaces in name', 'non-standard-format': 'Non-standard format' };
                    return `<span class="asset-warning">${this.escapeHtml(labels[code] || code)}</span>`;
                }).join('');
                const declaration = file.declared ? '' : '<span class="asset-warning">Missing from pubspec</span>';
                
                const variantsBadge = (file.variants && file.variants.length > 0)
                    ? `<span class="asset-badge-variants" title="Resolution variants: ${file.variants.map(v => v.ratio).join(', ')}"><i class="fas fa-layer-group"></i> ${file.variants.length + 1}x</span>`
                    : '';

                let thumbHtml = '';
                if (file.previewUri && (file.kind === 'image' || file.kind === 'svg')) {
                    thumbHtml = `
                        <div class="asset-thumb-wrapper">
                            <img src="${file.previewUri}" class="asset-thumbnail-img" alt="" 
                                 data-preview-src="${file.previewUri}" data-preview-path="${this.escapeHtml(file.path)}" 
                                 data-preview-size="${this.formatAssetSize(file.size)}" />
                        </div>
                    `;
                } else if (file.kind === 'font') {
                    thumbHtml = '<div class="asset-thumb-wrapper"><i class="fas fa-font asset-thumb-icon"></i></div>';
                } else {
                    thumbHtml = '<div class="asset-thumb-wrapper"><i class="fas fa-file asset-thumb-icon"></i></div>';
                }

                const constantName = this.toCamelCase(file.path.replace(/\.[^/.]+$/, '').split('/').pop() || 'asset');
                const widgetSnippet = file.kind === 'svg'
                    ? `SvgPicture.asset(AppAssets.${constantName})`
                    : `Image.asset(AppAssets.${constantName})`;

                const isChecked = this.selectedAssetPaths.has(file.path);

                return `
                    <div class="asset-file-row ${isChecked ? 'is-selected' : ''}">
                        <input type="checkbox" class="asset-row-checkbox" data-asset-path="${this.escapeHtml(file.path)}" ${isChecked ? 'checked' : ''} />
                        ${thumbHtml}
                        <div class="asset-file-info">
                            <span class="asset-file-path" role="button" title="Click to open in editor" data-open-asset="${this.escapeHtml(file.path)}">${this.escapeHtml(file.path)}</span>
                            <span class="asset-file-warnings">${declaration}${warnings}${variantsBadge}</span>
                        </div>
                        <div class="asset-file-actions">
                            <span class="asset-file-size">${this.formatAssetSize(file.size)}</span>
                            <span class="${file.used ? 'asset-used' : 'asset-unused'}">${file.used ? `Used · ${file.usageCount}` : 'Unused'}</span>
                            <button class="btn btn-quiet btn-icon asset-copy-btn" title="Copy Flutter widget (${this.escapeHtml(widgetSnippet)})" data-copy-snippet="${this.escapeHtml(widgetSnippet)}">
                                <i class="fas fa-copy"></i>
                            </button>
                            ${(file.kind === 'image' && (file.warnings || []).includes('heavy') && !file.path.endsWith('.webp'))
                                ? `<button class="btn btn-quiet btn-xs asset-compress-btn" data-compress-asset="${this.escapeHtml(file.path)}" title="Convert to WebP">
                                    <i class="fas fa-compress"></i> WebP
                                   </button>`
                                : ''}
                            ${file.safeToDelete
                                ? `<button class="btn btn-danger btn-xs asset-delete-btn" data-delete-asset="${this.escapeHtml(file.path)}" title="Delete unused asset">
                                    <i class="fas fa-trash"></i>
                                   </button>`
                                : ''}
                        </div>
                    </div>`;
            }).join('');

            this.updateBulkBar();
        }

        updateBulkBar() {
            const bulkBar = document.getElementById('assetBulkBar');
            const countLabel = document.getElementById('assetSelectedCount');
            const sizeLabel = document.getElementById('assetSelectedSize');
            const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
            const bulkCompressBtn = document.getElementById('bulkCompressBtn');
            const selectAll = document.getElementById('assetSelectAllCheckbox');

            if (!bulkBar) return;

            const count = this.selectedAssetPaths.size;
            if (count > 0) {
                bulkBar.hidden = false;
                if (countLabel) countLabel.textContent = `${count} selected`;

                let totalSelectedBytes = 0;
                let hasUnused = false;
                let hasCompressible = false;

                (this.currentReport?.files || []).forEach(f => {
                    if (this.selectedAssetPaths.has(f.path)) {
                        totalSelectedBytes += f.size;
                        if (f.safeToDelete) hasUnused = true;
                        if (f.kind === 'image' && !f.path.endsWith('.webp')) hasCompressible = true;
                    }
                });

                if (sizeLabel) sizeLabel.textContent = `(${this.formatAssetSize(totalSelectedBytes)})`;
                if (bulkDeleteBtn) bulkDeleteBtn.disabled = !hasUnused;
                if (bulkCompressBtn) bulkCompressBtn.disabled = !hasCompressible;
            } else {
                bulkBar.hidden = true;
                if (bulkDeleteBtn) bulkDeleteBtn.disabled = true;
                if (bulkCompressBtn) bulkCompressBtn.disabled = true;
            }

            const visible = this.getVisibleFiles();
            if (selectAll) {
                selectAll.checked = visible.length > 0 && visible.every(f => this.selectedAssetPaths.has(f.path));
            }
        }

        syncRowCheckboxes() {
            document.querySelectorAll('.asset-row-checkbox').forEach(cb => {
                const path = cb.dataset.assetPath;
                cb.checked = this.selectedAssetPaths.has(path);
                const row = cb.closest('.asset-file-row');
                if (row) row.classList.toggle('is-selected', cb.checked);
            });
        }

        toCamelCase(value) {
            const parts = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
            if (parts.length === 0) return '';
            return parts[0].toLowerCase() + parts.slice(1).map(part => part[0].toUpperCase() + part.slice(1).toLowerCase()).join('');
        }

        formatAssetSize(bytes) {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }
    }

    window.AirFlutterAssetAssistantModule = AssetAssistantModule;
})();
