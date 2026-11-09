window.AirFlutterStorageInspectorModule = class AirFlutterStorageInspectorModule {
    initStorageInspector() {
        const modal = document.getElementById('storageInspectorModal');
        if (!modal) return;

        const close = () => { modal.hidden = true; };
        document.getElementById('closeStorageModalBtn')?.addEventListener('click', close);

        // Mode toggling
        const modeRadios = modal.querySelectorAll('input[name="storageModuleMode"]');
        const presetsPanel = document.getElementById('storagePresetsPanel');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (presetsPanel) {
                    presetsPanel.hidden = radio.value !== 'presets';
                }
            });
        });

        // Inspect button
        document.getElementById('storageRefreshFilesBtn')?.addEventListener('click', () => {
            this.runStorageInspect();
        });

        // Edit Package ID button
        document.getElementById('storageEditPackageBtn')?.addEventListener('click', () => {
            const input = document.getElementById('storagePackageInput');
            const badge = document.getElementById('storagePkgBadge');
            if (input) {
                input.readOnly = false;
                input.focus();
                input.select();
            }
            if (badge) badge.hidden = true;
        });

        // Retry button
        document.getElementById('storageRetryBtn')?.addEventListener('click', () => {
            this.runStorageInspect();
        });

        // New key in SharedPreferences
        document.getElementById('storagePrefAddKeyBtn')?.addEventListener('click', () => {
            const key = prompt('Enter new Preference Key:');
            if (!key) return;
            const val = prompt('Enter Value:');
            if (val === null) return;
            const type = prompt('Enter Type (string, int, long, float, boolean):', 'string');
            if (!type) return;

            const pkg = document.getElementById('storagePackageInput')?.value?.trim();
            const fileName = this.activeStorageFile?.name;
            if (pkg && fileName) {
                this.sendMessage('storageInspectorSavePref', {
                    packageId: pkg,
                    fileName,
                    key,
                    value: val,
                    type
                });
            }
        });

        // Query run button for SQLite
        document.getElementById('storageQueryRunBtn')?.addEventListener('click', () => {
            const table = document.getElementById('storageTableSelect')?.value;
            const pkg = document.getElementById('storagePackageInput')?.value?.trim();
            const dbName = this.activeStorageFile?.name;
            if (pkg && dbName && table) {
                this.sendMessage('storageInspectorQueryTable', {
                    packageId: pkg,
                    dbName,
                    query: `SELECT * FROM ${table} LIMIT 50`
                });
            }
        });

        // Table change in SQLite
        document.getElementById('storageTableSelect')?.addEventListener('change', (e) => {
            const table = e.target.value;
            const pkg = document.getElementById('storagePackageInput')?.value?.trim();
            const dbName = this.activeStorageFile?.name;
            if (pkg && dbName && table) {
                this.sendMessage('storageInspectorQueryTable', {
                    packageId: pkg,
                    dbName,
                    query: `SELECT * FROM ${table} LIMIT 50`
                });
            }
        });

        // Search/filter in SharedPreferences
        document.getElementById('storagePrefFilter')?.addEventListener('input', (e) => {
            const filter = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#storagePrefsTableBody tr');
            rows.forEach(tr => {
                const key = tr.querySelector('.pref-key')?.textContent?.toLowerCase() || '';
                tr.hidden = filter && !key.includes(filter);
            });
        });
    }

    openStorageInspectorModal(dataOrPkg) {
        const modal = document.getElementById('storageInspectorModal');
        if (!modal) return;
        modal.hidden = false;

        let packageId = typeof dataOrPkg === 'object' ? dataOrPkg?.packageId : dataOrPkg;
        let isAuto = typeof dataOrPkg === 'object' ? Boolean(dataOrPkg?.isAutoDetected) : false;

        if (!packageId && this.appStatePackage) {
            packageId = this.appStatePackage;
            isAuto = true;
        }

        const pkgInput = document.getElementById('storagePackageInput');
        const badge = document.getElementById('storagePkgBadge');

        if (pkgInput && packageId) {
            pkgInput.value = packageId;
            if (isAuto) {
                pkgInput.readOnly = true;
                if (badge) badge.hidden = false;
            } else {
                pkgInput.readOnly = false;
                if (badge) badge.hidden = true;
            }
            this.runStorageInspect();
        } else if (pkgInput) {
            pkgInput.readOnly = false;
            if (badge) badge.hidden = true;
        }

        if (typeof dataOrPkg !== 'object' || !dataOrPkg?.packageId) {
            this.sendMessage('openStorageInspectorModal', { packageId: packageId || '' });
        }
    }

    runStorageInspect() {
        const pkgInput = document.getElementById('storagePackageInput');
        const pkg = pkgInput?.value?.trim();
        if (!pkg) {
            this.showToast('Please enter or select a package ID.', 'error');
            return;
        }

        const mode = document.querySelector('input[name="storageModuleMode"]:checked')?.value || 'auto';
        const selectedPresets = [];
        if (mode === 'presets') {
            document.querySelectorAll('#storagePresetsGrid input[type="checkbox"]:checked').forEach(cb => {
                selectedPresets.push(cb.value);
            });
        }

        this.setStorageUiState('loading', 'Scanning package storage container…');

        this.sendMessage('storageInspectorListFiles', {
            packageId: pkg,
            mode,
            selectedPresets
        });
    }

    setStorageUiState(state, message) {
        const initial = document.getElementById('storageInitialView');
        const loading = document.getElementById('storageLoadingView');
        const error = document.getElementById('storageErrorView');
        const content = document.getElementById('storageContentView');

        if (initial) initial.hidden = state !== 'initial';
        if (loading) loading.hidden = state !== 'loading';
        if (error) error.hidden = state !== 'error';
        if (content) content.hidden = state !== 'success';

        if (state === 'loading' && message) {
            const msgEl = document.getElementById('storageLoadingMessage');
            if (msgEl) msgEl.textContent = message;
        }
    }

    handleStorageInspectorState(data) {
        if (data.status === 'loading') {
            this.setStorageUiState('loading', data.message);
        } else if (data.status === 'error') {
            this.setStorageUiState('error');
            const errEl = document.getElementById('storageErrorMessage');
            if (errEl) errEl.textContent = data.error || 'Failed to inspect package';
        } else if (data.status === 'success') {
            this.setStorageUiState('success');
            this.renderStorageFiles(data.result?.files || []);
        }
    }

    renderStorageFiles(files) {
        const listEl = document.getElementById('storageFilesList');
        const countEl = document.getElementById('storageFileCount');
        if (!listEl) return;
        listEl.innerHTML = '';
        if (countEl) countEl.textContent = String(files.length);

        if (files.length === 0) {
            listEl.innerHTML = '<p class="storage-empty-list">No files found matching criteria.</p>';
            return;
        }

        files.forEach(file => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'storage-file-item';
            const icon = file.category === 'shared_prefs' ? 'fa-file-code'
                : file.category === 'sqlite' ? 'fa-database'
                : 'fa-file';

            btn.innerHTML = `
                <i class="fas ${icon}"></i>
                <div class="storage-file-info">
                    <strong>${file.name}</strong>
                    <small>${file.relativePath} (${(file.sizeBytes / 1024).toFixed(1)} KB)</small>
                </div>
            `;
            btn.addEventListener('click', () => {
                listEl.querySelectorAll('.storage-file-item').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                this.selectStorageFile(file);
            });
            listEl.appendChild(btn);
        });
    }

    selectStorageFile(file) {
        this.activeStorageFile = file;
        const titleEl = document.getElementById('storageSelectedFileTitle');
        const badgeEl = document.getElementById('storageFileTypeBadge');
        if (titleEl) titleEl.textContent = file.name;
        if (badgeEl) badgeEl.textContent = file.category;

        const emptyDetail = document.getElementById('storageEmptyDetail');
        const prefsEditor = document.getElementById('storagePrefsEditor');
        const sqliteEditor = document.getElementById('storageSqliteEditor');

        if (emptyDetail) emptyDetail.hidden = true;

        const pkg = document.getElementById('storagePackageInput')?.value?.trim();
        if (file.category === 'shared_prefs') {
            if (prefsEditor) prefsEditor.hidden = false;
            if (sqliteEditor) sqliteEditor.hidden = true;
            this.sendMessage('storageInspectorReadPrefs', {
                packageId: pkg,
                fileName: file.name
            });
        } else if (file.category === 'sqlite') {
            if (prefsEditor) prefsEditor.hidden = true;
            if (sqliteEditor) sqliteEditor.hidden = false;
            this.sendMessage('storageInspectorListTables', {
                packageId: pkg,
                dbName: file.name
            });
        } else {
            if (prefsEditor) prefsEditor.hidden = true;
            if (sqliteEditor) sqliteEditor.hidden = true;
            if (emptyDetail) {
                emptyDetail.hidden = false;
                emptyDetail.querySelector('p').textContent = 'Binary/Raw format file preview is not supported.';
            }
        }
    }

    handleStorageSharedPrefsLoaded(items) {
        const tbody = document.getElementById('storagePrefsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="storage-empty-table">No preferences recorded.</td></tr>';
            return;
        }

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="pref-key"><code>${item.key}</code></td>
                <td><span class="pref-type">${item.type}</span></td>
                <td class="pref-val"><code>${item.value}</code></td>
                <td class="pref-actions">
                    <button class="btn btn-quiet btn-xs pref-edit-btn" type="button"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-danger btn-xs pref-del-btn" type="button"><i class="fas fa-trash"></i></button>
                </td>
            `;

            tr.querySelector('.pref-edit-btn')?.addEventListener('click', () => {
                const newVal = prompt(`Edit value for "${item.key}":`, item.value);
                if (newVal !== null && newVal !== item.value) {
                    const pkg = document.getElementById('storagePackageInput')?.value?.trim();
                    this.sendMessage('storageInspectorSavePref', {
                        packageId: pkg,
                        fileName: this.activeStorageFile.name,
                        key: item.key,
                        value: newVal,
                        type: item.type
                    });
                }
            });

            tr.querySelector('.pref-del-btn')?.addEventListener('click', () => {
                if (confirm(`Delete key "${item.key}"?`)) {
                    const pkg = document.getElementById('storagePackageInput')?.value?.trim();
                    this.sendMessage('storageInspectorDeletePref', {
                        packageId: pkg,
                        fileName: this.activeStorageFile.name,
                        key: item.key
                    });
                }
            });

            tbody.appendChild(tr);
        });
    }

    handleStorageTablesLoaded(tables) {
        const select = document.getElementById('storageTableSelect');
        if (!select) return;
        select.innerHTML = '';

        tables.forEach(table => {
            const opt = document.createElement('option');
            opt.value = table;
            opt.textContent = table;
            select.appendChild(opt);
        });

        if (tables.length > 0) {
            const pkg = document.getElementById('storagePackageInput')?.value?.trim();
            this.sendMessage('storageInspectorQueryTable', {
                packageId: pkg,
                dbName: this.activeStorageFile.name,
                query: `SELECT * FROM ${tables[0]} LIMIT 50`
            });
        }
    }

    handleStorageQueryLoaded(queryResult) {
        const thead = document.getElementById('storageSqliteThead');
        const tbody = document.getElementById('storageSqliteTbody');
        if (!thead || !tbody) return;

        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!queryResult.columns || queryResult.columns.length === 0) {
            tbody.innerHTML = '<tr><td class="storage-empty-table">No rows returned.</td></tr>';
            return;
        }

        const trHead = document.createElement('tr');
        queryResult.columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);

        queryResult.rows.forEach(row => {
            const tr = document.createElement('tr');
            queryResult.columns.forEach(col => {
                const td = document.createElement('td');
                td.textContent = row[col] || '';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
};

