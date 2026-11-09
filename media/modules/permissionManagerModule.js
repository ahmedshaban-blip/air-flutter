(function () {
    class PermissionManagerModule {
        initPermissionManager() {
            this.currentMode = 'manifest'; // 'manifest' | 'runtime'
            this.currentPlatform = 'android';
            this.selectedCategory = 'all';
            this.searchQuery = '';
            this.declaredPermissions = new Set();
            this.permissionCatalog = [];
            this.categories = [];
            this.iosDescriptions = {};

            // Runtime Permissions State
            this.runtimePermissions = [];
            this.runtimeSearchQuery = '';
            this.runtimePackageId = '';

            const addButton = document.getElementById('addPermissionsBtn');
            if (addButton) addButton.addEventListener('click', () => this.addSelectedPermissions());

            // Mode Tabs (Manifest vs Runtime)
            const modeManifestTab = document.getElementById('permModeManifestTab');
            const modeRuntimeTab = document.getElementById('permModeRuntimeTab');
            if (modeManifestTab) {
                modeManifestTab.addEventListener('click', () => this.switchPermissionMode('manifest'));
            }
            if (modeRuntimeTab) {
                modeRuntimeTab.addEventListener('click', () => this.switchPermissionMode('runtime'));
            }

            // Runtime controls
            const refreshRuntimeBtn = document.getElementById('refreshRuntimePermsBtn');
            if (refreshRuntimeBtn) {
                refreshRuntimeBtn.addEventListener('click', () => {
                    const pkg = document.getElementById('runtimePackageIdInput')?.value?.trim();
                    this.loadRuntimePermissions(pkg);
                });
            }

            const grantAllBtn = document.getElementById('grantAllRuntimePermsBtn');
            if (grantAllBtn) {
                grantAllBtn.addEventListener('click', () => this.grantAllRuntimePermissions());
            }

            const revokeAllBtn = document.getElementById('revokeAllRuntimePermsBtn');
            if (revokeAllBtn) {
                revokeAllBtn.addEventListener('click', () => this.revokeAllRuntimePermissions());
            }

            const runtimeSearch = document.getElementById('runtimePermSearchInput');
            if (runtimeSearch) {
                runtimeSearch.addEventListener('input', (e) => {
                    this.runtimeSearchQuery = (e.target.value || '').toLowerCase().trim();
                    this.filterAndRenderRuntimePermissions();
                });
            }

            const catalog = document.getElementById('permissionCatalog');
            if (catalog) {
                catalog.addEventListener('change', (e) => {
                    if (e.target && e.target.type === 'checkbox') {
                        this.updatePermissionActionState();
                    }
                });
                catalog.addEventListener('input', (e) => {
                    if (e.target && e.target.classList.contains('permission-ios-input')) {
                        const name = e.target.dataset.permissionName;
                        if (name) this.iosDescriptions[name] = e.target.value;
                    }
                });
                catalog.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('.permission-remove-btn');
                    if (removeBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        const permName = removeBtn.dataset.permission;
                        if (permName) {
                            this.removePermission(permName, removeBtn);
                        }
                    }
                });
            }

            const androidPlatformBtn = document.getElementById('permPlatformAndroidBtn');
            const iosPlatformBtn = document.getElementById('permPlatformIosBtn');
            if (androidPlatformBtn) {
                androidPlatformBtn.addEventListener('click', () => this.switchPlatform('android'));
            }
            if (iosPlatformBtn) {
                iosPlatformBtn.addEventListener('click', () => this.switchPlatform('ios'));
            }

            const searchInput = document.getElementById('permissionSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchQuery = (e.target.value || '').toLowerCase().trim();
                    this.filterAndRender();
                });
            }

            const chipsContainer = document.getElementById('permissionCategoryChips');
            if (chipsContainer) {
                chipsContainer.addEventListener('click', (e) => {
                    const chip = e.target.closest('.permission-chip');
                    if (!chip) return;
                    const cat = chip.dataset.category;
                    if (cat) {
                        this.selectedCategory = cat;
                        chipsContainer.querySelectorAll('.permission-chip').forEach(c => {
                            c.classList.toggle('is-active', c.dataset.category === cat);
                        });
                        this.filterAndRender();
                    }
                });
            }
        }

        switchPermissionMode(mode) {
            this.currentMode = mode;
            const isManifest = mode === 'manifest';

            const manifestTab = document.getElementById('permModeManifestTab');
            const runtimeTab = document.getElementById('permModeRuntimeTab');
            const manifestView = document.getElementById('permissionManifestView');
            const runtimeView = document.getElementById('permissionRuntimeView');

            if (manifestTab) {
                manifestTab.classList.toggle('is-active', isManifest);
                manifestTab.setAttribute('aria-selected', String(isManifest));
            }
            if (runtimeTab) {
                runtimeTab.classList.toggle('is-active', !isManifest);
                runtimeTab.setAttribute('aria-selected', String(!isManifest));
            }

            if (manifestView) manifestView.hidden = !isManifest;
            if (runtimeView) runtimeView.hidden = isManifest;

            if (!isManifest && (!this.runtimePermissions || this.runtimePermissions.length === 0)) {
                const pkg = document.getElementById('runtimePackageIdInput')?.value?.trim();
                this.loadRuntimePermissions(pkg);
            }
        }

        loadRuntimePermissions(packageId) {
            const list = document.getElementById('runtimePermissionsList');
            const statusText = document.getElementById('runtimePermissionsStatusText');
            const refreshBtn = document.getElementById('refreshRuntimePermsBtn');

            if (list) {
                list.innerHTML = '<div class="af-loading-container" style="padding: 20px;"><span class="af-spinner af-spinner-lg"></span><span>Querying app runtime permissions…</span></div>';
            }
            if (statusText) statusText.textContent = 'Querying runtime permissions via ADB…';
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<span class="af-spinner af-spinner-sm"></span>';
            }

            this.sendMessage('loadRuntimePermissions', { packageId: packageId || '' });
        }

        renderRuntimePermissionsState(message) {
            const refreshBtn = document.getElementById('refreshRuntimePermsBtn');
            const grantAllBtn = document.getElementById('grantAllRuntimePermsBtn');
            const revokeAllBtn = document.getElementById('revokeAllRuntimePermsBtn');
            const statusText = document.getElementById('runtimePermissionsStatusText');
            const pkgInput = document.getElementById('runtimePackageIdInput');
            const deviceBadge = document.getElementById('runtimeDeviceBadge');
            const countBadge = document.getElementById('runtimePermCountBadge');
            const list = document.getElementById('runtimePermissionsList');

            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fas fa-rotate"></i> Query';
            }

            if (message.packageId && pkgInput && !pkgInput.value) {
                pkgInput.value = message.packageId;
            }
            if (message.packageId) {
                this.runtimePackageId = message.packageId;
            }
            if (message.serial && deviceBadge) {
                deviceBadge.textContent = message.serial;
            }

            if (message.status === 'error') {
                if (statusText) statusText.textContent = `❌ ${message.error || 'Failed to query permissions'}`;
                if (list) {
                    list.innerHTML = `<p class="empty"><i class="fas fa-triangle-exclamation"></i><span>${this.escapeHtml(message.error || 'Unable to inspect runtime permissions.')}</span></p>`;
                }
                if (grantAllBtn) grantAllBtn.disabled = true;
                if (revokeAllBtn) revokeAllBtn.disabled = true;
                if (countBadge) countBadge.textContent = '0 found';
                return;
            }

            if (message.status === 'success') {
                this.runtimePermissions = Array.isArray(message.permissions) ? message.permissions : [];
                if (statusText) {
                    statusText.textContent = `Found ${this.runtimePermissions.length} permissions for ${message.packageId}.`;
                }
                if (countBadge) {
                    countBadge.textContent = `${this.runtimePermissions.length} permissions`;
                }
                if (grantAllBtn) grantAllBtn.disabled = this.runtimePermissions.length === 0;
                if (revokeAllBtn) revokeAllBtn.disabled = this.runtimePermissions.length === 0;

                this.filterAndRenderRuntimePermissions();
            }
        }

        filterAndRenderRuntimePermissions() {
            const list = document.getElementById('runtimePermissionsList');
            if (!list) return;

            const query = this.runtimeSearchQuery;
            const filtered = this.runtimePermissions.filter(p => {
                if (!query) return true;
                return (p.name || '').toLowerCase().includes(query) || (p.label || '').toLowerCase().includes(query);
            });

            if (filtered.length === 0) {
                list.innerHTML = `<p class="empty"><i class="fas fa-shield-halved"></i><span>${this.runtimePermissions.length === 0 ? 'No runtime permissions declared or app not running.' : 'No matching permissions found.'}</span></p>`;
                return;
            }

            list.innerHTML = filtered.map(p => {
                const safeName = this.escapeHtml(p.name);
                const safeLabel = this.escapeHtml(p.label || p.name);
                const isGranted = Boolean(p.granted);

                return `
                    <div class="runtime-perm-card" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--card-bg, rgba(255,255,255,0.03)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); border-radius: 6px; margin-bottom: 6px;">
                        <div style="flex: 1; padding-right: 12px;">
                            <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                                <i class="fas ${isGranted ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${isGranted ? '#22c55e' : '#ef4444'}; font-size: 11px;"></i>
                                <span>${safeLabel}</span>
                            </div>
                            <div style="font-size: 11px; color: var(--muted); font-family: var(--font-mono, monospace); margin-top: 2px;">
                                ${safeName}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="status-badge ${isGranted ? 'is-enabled' : 'is-disabled'}" style="font-size: 10px;">
                                ${isGranted ? 'Granted' : 'Revoked'}
                            </span>
                            <button class="btn ${isGranted ? 'btn-danger' : 'btn-primary'} btn-sm runtime-toggle-btn" type="button" data-perm-name="${safeName}" data-granted="${isGranted}">
                                ${isGranted ? '<i class="fas fa-ban"></i> Revoke' : '<i class="fas fa-check"></i> Grant'}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Bind toggle buttons
            list.querySelectorAll('.runtime-toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const permName = btn.dataset.permName;
                    const currentlyGranted = btn.dataset.granted === 'true';
                    const pkg = document.getElementById('runtimePackageIdInput')?.value?.trim() || this.runtimePackageId;

                    btn.disabled = true;
                    btn.innerHTML = '<span class="af-spinner af-spinner-sm"></span>';

                    if (currentlyGranted) {
                        this.sendMessage('revokeRuntimePermission', { packageId: pkg, permission: permName });
                    } else {
                        this.sendMessage('grantRuntimePermission', { packageId: pkg, permission: permName });
                    }
                });
            });
        }

        grantAllRuntimePermissions() {
            const pkg = document.getElementById('runtimePackageIdInput')?.value?.trim() || this.runtimePackageId;
            if (!pkg || !this.runtimePermissions.length) return;

            const allNames = this.runtimePermissions.map(p => p.name);
            const btn = document.getElementById('grantAllRuntimePermsBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Granting…';
            }

            this.sendMessage('grantAllRuntimePermissions', { packageId: pkg, permissions: allNames });
        }

        revokeAllRuntimePermissions() {
            const pkg = document.getElementById('runtimePackageIdInput')?.value?.trim() || this.runtimePackageId;
            if (!pkg || !this.runtimePermissions.length) return;

            const allNames = this.runtimePermissions.map(p => p.name);
            const btn = document.getElementById('revokeAllRuntimePermsBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Revoking…';
            }

            this.sendMessage('revokeAllRuntimePermissions', { packageId: pkg, permissions: allNames });
        }

        switchPlatform(platform) {
            if (this.currentPlatform === platform) return;
            this.currentPlatform = platform;
            this.selectedCategory = 'all';
            this.searchQuery = '';
            const searchInput = document.getElementById('permissionSearchInput');
            if (searchInput) searchInput.value = '';

            this.updatePlatformUiState();
            this.loadPermissionCatalog();
        }

        updatePlatformUiState() {
            const isIos = this.currentPlatform === 'ios';
            const androidBtn = document.getElementById('permPlatformAndroidBtn');
            const iosBtn = document.getElementById('permPlatformIosBtn');
            if (androidBtn) {
                androidBtn.classList.toggle('is-active', !isIos);
                androidBtn.setAttribute('aria-selected', String(!isIos));
            }
            if (iosBtn) {
                iosBtn.classList.toggle('is-active', isIos);
                iosBtn.setAttribute('aria-selected', String(isIos));
            }

            const heading = document.getElementById('permissionHeading');
            if (heading) heading.textContent = isIos ? 'iOS Permissions' : 'Android Permissions';

            const badge = document.getElementById('permissionTargetBadge');
            if (badge) badge.textContent = isIos ? 'Info.plist' : 'AndroidManifest.xml';

            const btnText = document.getElementById('addPermissionsBtnText');
            if (btnText) btnText.textContent = isIos ? 'Add to Info.plist' : 'Add to Manifest';

            const help = document.getElementById('permissionHelpText');
            if (help) {
                help.textContent = isIos
                    ? 'Select iOS permissions to add to Info.plist. Each permission includes a customizable usage description string for App Store review.'
                    : 'Select one or more permissions. Permissions already declared in AndroidManifest.xml cannot be selected again.';
            }
        }

        loadPermissionCatalog() {
            const catalog = document.getElementById('permissionCatalog');
            const fileLabel = this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml';
            if (catalog) catalog.innerHTML = `<div class="af-loading-container"><span class="af-spinner af-spinner-lg"></span><span>Reading ${fileLabel}…</span></div>`;
            this.setPermissionLoading(true);
            this.sendMessage('loadPermissions', { platform: this.currentPlatform });
        }

        renderPermissionCatalog(catalog, declaredPermissions, categories, platform) {
            if (platform) this.currentPlatform = platform;
            this.updatePlatformUiState();

            this.permissionCatalog = Array.isArray(catalog) ? [...catalog] : [];
            this.declaredPermissions = new Set(declaredPermissions || []);
            this.categories = Array.isArray(categories) ? categories : [];

            // Ensure any declared permissions not present in catalog are visible and manageable
            const catalogNames = new Set(this.permissionCatalog.map(p => p.name));
            const undeclaredInCatalog = Array.from(this.declaredPermissions).filter(p => !catalogNames.has(p));
            if (undeclaredInCatalog.length > 0) {
                const syntheticItems = undeclaredInCatalog.map(name => ({
                    name,
                    label: name.split('.').pop() || name,
                    description: `Declared in ${this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml'}`,
                    category: 'all',
                    platform: this.currentPlatform
                }));
                this.permissionCatalog = [...syntheticItems, ...this.permissionCatalog];
            }

            this.renderCategoryChips();
            this.filterAndRender();
            this.setPermissionLoading(false);
        }

        renderCategoryChips() {
            const container = document.getElementById('permissionCategoryChips');
            if (!container) return;

            const total = this.permissionCatalog.length;
            const chipsHtml = [
                `<button class="permission-chip ${this.selectedCategory === 'all' ? 'is-active' : ''}" type="button" data-category="all">
                    <span>All</span><span class="permission-chip-count">${total}</span>
                </button>`
            ];

            const categoryCounts = {};
            this.permissionCatalog.forEach(p => {
                const cat = p.category || 'other';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });

            this.categories.forEach(cat => {
                const count = categoryCounts[cat.id] || 0;
                if (count === 0) return;
                const active = this.selectedCategory === cat.id ? 'is-active' : '';
                chipsHtml.push(
                    `<button class="permission-chip ${active}" type="button" data-category="${this.escapeHtml(cat.id)}" title="${this.escapeHtml(cat.description || '')}">
                        <span>${this.escapeHtml(cat.name)}</span><span class="permission-chip-count">${count}</span>
                    </button>`
                );
            });

            container.innerHTML = chipsHtml.join('');
        }

        filterAndRender() {
            const container = document.getElementById('permissionCatalog');
            if (!container) return;

            const filtered = this.permissionCatalog.filter(permission => {
                if (this.selectedCategory !== 'all' && permission.category !== this.selectedCategory) {
                    return false;
                }
                if (this.searchQuery) {
                    const q = this.searchQuery;
                    const matchesName = (permission.name || '').toLowerCase().includes(q);
                    const matchesLabel = (permission.label || '').toLowerCase().includes(q);
                    const matchesDesc = (permission.description || '').toLowerCase().includes(q);
                    const matchesDefault = (permission.defaultUsageDescription || '').toLowerCase().includes(q);
                    return matchesName || matchesLabel || matchesDesc || matchesDefault;
                }
                return true;
            });

            if (filtered.length === 0) {
                container.innerHTML = '<p class="empty"><i class="fas fa-search"></i><span>No matching permissions found</span></p>';
                this.updatePermissionActionState();
                return;
            }

            const isIos = this.currentPlatform === 'ios';
            container.innerHTML = filtered.map(permission => {
                const alreadyPresent = this.declaredPermissions.has(permission.name);
                const safeName = this.escapeHtml(permission.name);
                const safeLabel = this.escapeHtml(permission.label || permission.name);
                const safeDesc = this.escapeHtml(permission.description || '');

                let iosFieldsHtml = '';
                if (isIos) {
                    const defaultText = permission.defaultUsageDescription || permission.description || '';
                    const currentVal = this.iosDescriptions[permission.name] !== undefined
                        ? this.iosDescriptions[permission.name]
                        : defaultText;
                    iosFieldsHtml = `
                        <div class="permission-ios-input-wrapper">
                            <span class="permission-ios-input-label">Usage Description (Info.plist):</span>
                            <input type="text" class="permission-ios-input" data-permission-name="${safeName}" value="${this.escapeHtml(currentVal)}" ${alreadyPresent ? 'disabled' : ''} placeholder="Reason shown in prompt..." />
                        </div>
                    `;
                }

                let warningHtml = '';
                if (permission.storeReviewWarning) {
                    warningHtml = `<div class="permission-warning"><i class="fas fa-triangle-exclamation"></i> ${this.escapeHtml(permission.storeReviewWarning)}</div>`;
                }

                let packagesHtml = '';
                if (Array.isArray(permission.flutterPackageRecommendation) && permission.flutterPackageRecommendation.length > 0) {
                    packagesHtml = `<div class="permission-packages"><i class="fas fa-cube"></i> Packages: ${permission.flutterPackageRecommendation.map(p => this.escapeHtml(p)).join(', ')}</div>`;
                }

                return `
                    <label class="permission-row ${alreadyPresent ? 'is-present' : ''}">
                        <input type="checkbox" value="${safeName}" ${alreadyPresent ? 'disabled' : ''}>
                        <span class="permission-copy">
                            <span class="permission-title">${safeLabel}</span>
                            <span class="permission-name">${safeName}</span>
                            <span class="permission-description">${safeDesc}</span>
                            ${iosFieldsHtml}
                            ${warningHtml}
                            ${packagesHtml}
                        </span>
                        ${alreadyPresent ? `
                            <div class="permission-actions">
                                <span class="permission-badge">Already Present</span>
                                <button type="button" class="btn btn-sm btn-danger permission-remove-btn" data-permission="${safeName}" title="Remove permission from ${isIos ? 'Info.plist' : 'AndroidManifest.xml'}">
                                    <i class="fas fa-trash-alt"></i> Remove
                                </button>
                            </div>
                        ` : ''}
                    </label>`;
            }).join('');

            this.updatePermissionActionState();
        }

        removePermission(permissionName, buttonElement) {
            if (!permissionName) return;
            if (buttonElement) {
                buttonElement.disabled = true;
                buttonElement.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Removing…';
            }
            this.setPermissionLoading(true);
            this.sendMessage('removePermission', {
                permission: permissionName,
                platform: this.currentPlatform
            });
        }

        handlePermissionsRemoved(message) {
            this.declaredPermissions = new Set(message.declaredPermissions || []);
            if (message.declaredDescriptions) {
                this.iosDescriptions = message.declaredDescriptions;
            }
            const target = this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml';
            this.showToast(message.message || `Permission removed from ${target}.`, 'success');
            this.filterAndRender();
            this.setPermissionLoading(false);
        }

        addSelectedPermissions() {
            const checkedInputs = Array.from(document.querySelectorAll('#permissionCatalog input[type="checkbox"]:checked:not(:disabled)'));
            const selectedPermissions = checkedInputs
                .map(input => input.value)
                .filter(permission => !this.declaredPermissions.has(permission));

            if (selectedPermissions.length === 0) return;

            const button = document.getElementById('addPermissionsBtn');
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Updating…';
            }
            this.setPermissionLoading(true);
            if (this.currentPlatform === 'ios') {
                const permissionsMap = {};
                selectedPermissions.forEach(name => {
                    const input = document.querySelector(`.permission-ios-input[data-permission-name="${CSS.escape(name)}"]`);
                    permissionsMap[name] = input ? input.value : (this.iosDescriptions[name] || '');
                });
                this.sendMessage('addPermissions', {
                    platform: 'ios',
                    selectedPermissions,
                    permissionsMap
                });
            } else {
                this.sendMessage('addAndroidPermissions', { selectedPermissions });
            }
        }

        handlePermissionsAdded(message) {
            this.declaredPermissions = new Set(message.declaredPermissions || []);
            const target = this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml';
            this.showToast(message.message || `Permissions added to ${target}.`, 'success');
            this.filterAndRender();
            this.setPermissionLoading(false);
        }

        handlePermissionsUnchanged(message) {
            this.declaredPermissions = new Set(message.declaredPermissions || []);
            this.showToast(message.message || 'No new permissions were added.', 'info');
            this.filterAndRender();
            this.setPermissionLoading(false);
        }

        setPermissionLoading(loading) {
            const button = document.getElementById('addPermissionsBtn');
            const status = document.getElementById('permissionStatus');
            const target = this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml';

            if (button && loading) button.disabled = true;
            if (status && loading) status.innerHTML = `<span class="af-spinner af-spinner-sm"></span> Checking ${target}…`;
            if (!loading) this.updatePermissionActionState();
        }

        updatePermissionActionState() {
            const selectedCount = document.querySelectorAll('#permissionCatalog input[type="checkbox"]:checked:not(:disabled)').length;
            const button = document.getElementById('addPermissionsBtn');
            const target = this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml';
            const btnLabel = this.currentPlatform === 'ios' ? 'Add to Info.plist' : 'Add to Manifest';
            if (button) {
                button.disabled = selectedCount === 0;
                button.innerHTML = `<i class="fas fa-plus"></i> <span id="addPermissionsBtnText">${btnLabel}</span>`;
            }

            const status = document.getElementById('permissionStatus');
            if (status) {
                status.textContent = selectedCount
                    ? `${selectedCount} permission(s) selected.`
                    : `${this.declaredPermissions.size} permission(s) already declared in ${target}.`;
            }

            const badge = document.getElementById('permissionSelectedBadge');
            if (badge) {
                badge.textContent = selectedCount ? `${selectedCount} selected` : 'multi-select';
            }
        }
    }

    window.AirFlutterPermissionManagerModule = PermissionManagerModule;
})();
