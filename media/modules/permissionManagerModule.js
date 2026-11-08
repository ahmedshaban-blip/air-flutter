(function () {
    class PermissionManagerModule {
        initPermissionManager() {
            this.currentPlatform = 'android';
            this.selectedCategory = 'all';
            this.searchQuery = '';
            this.declaredPermissions = new Set();
            this.permissionCatalog = [];
            this.categories = [];
            this.iosDescriptions = {};

            const addButton = document.getElementById('addPermissionsBtn');
            if (addButton) addButton.addEventListener('click', () => this.addSelectedPermissions());

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
            if (catalog) catalog.innerHTML = `<p class="empty"><i class="fas fa-spinner fa-spin"></i><span>Reading ${fileLabel}…</span></p>`;
            this.setPermissionLoading(true);
            this.sendMessage('loadPermissions', { platform: this.currentPlatform });
        }

        renderPermissionCatalog(catalog, declaredPermissions, categories, platform) {
            if (platform) this.currentPlatform = platform;
            this.updatePlatformUiState();

            this.permissionCatalog = Array.isArray(catalog) ? catalog : [];
            this.declaredPermissions = new Set(declaredPermissions || []);
            this.categories = Array.isArray(categories) ? categories : [];

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
                        ${alreadyPresent ? '<span class="permission-badge">Already Present</span>' : ''}
                    </label>`;
            }).join('');

            this.updatePermissionActionState();
        }

        addSelectedPermissions() {
            const checkedInputs = Array.from(document.querySelectorAll('#permissionCatalog input[type="checkbox"]:checked:not(:disabled)'));
            const selectedPermissions = checkedInputs
                .map(input => input.value)
                .filter(permission => !this.declaredPermissions.has(permission));

            if (selectedPermissions.length === 0) return;

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
            this.filterAndRender();
            const target = this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml';
            this.showToast(message.message || `Permissions added to ${target}.`, 'success');
        }

        handlePermissionsUnchanged(message) {
            this.declaredPermissions = new Set(message.declaredPermissions || []);
            this.filterAndRender();
            this.showToast(message.message, 'success');
        }

        setPermissionLoading(loading) {
            const button = document.getElementById('addPermissionsBtn');
            if (button && loading) button.disabled = true;
            const status = document.getElementById('permissionStatus');
            const target = this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml';
            if (status && loading) status.textContent = `Checking ${target}…`;
            if (!loading) this.updatePermissionActionState();
        }

        updatePermissionActionState() {
            const selectedCount = document.querySelectorAll('#permissionCatalog input[type="checkbox"]:checked:not(:disabled)').length;
            const button = document.getElementById('addPermissionsBtn');
            if (button) button.disabled = selectedCount === 0;

            const target = this.currentPlatform === 'ios' ? 'Info.plist' : 'AndroidManifest.xml';
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
