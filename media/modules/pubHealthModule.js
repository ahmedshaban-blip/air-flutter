window.AirFlutterPubHealthModule = class AirFlutterPubHealthModule {
    initPubHealth() {
        this._lastSummary = null;
        this._activeTab = 'all';
        this._selectedPackages = new Set();
        this._pendingAction = null;
        this._currentDiagnostics = null;

        const modal = document.getElementById('pubHealthModal');
        if (!modal) return;

        const close = () => {
            modal.hidden = true;
            this.hideConfirmModal();
        };
        document.getElementById('closePubHealthModalBtn')?.addEventListener('click', close);

        document.getElementById('pubHealthCheckBtn')?.addEventListener('click', () => {
            this.sendMessage('checkPubHealth', {});
        });

        document.getElementById('pubHealthUpgradeBtn')?.addEventListener('click', () => {
            this.sendMessage('runPubUpgrade', {});
        });

        document.getElementById('pubBrowseProjectBtn')?.addEventListener('click', () => {
            this.sendMessage('pubHealthSelectProject', {});
        });

        document.getElementById('pubOpenPubspecLineBtn')?.addEventListener('click', () => {
            if (this._currentDiagnostics) {
                this.sendMessage('openPubspecAtLine', {
                    filePath: this._currentDiagnostics.filePath,
                    line: this._currentDiagnostics.line || 1,
                    column: this._currentDiagnostics.column || 1
                });
            }
        });

        // Tab navigation
        document.querySelectorAll('#pubTabsBar .pub-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.getAttribute('data-tab');
                if (tab) this.switchTab(tab);
            });
        });

        // Select All Checkbox
        document.getElementById('pubSelectAllCheckbox')?.addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // Update Selected Button
        document.getElementById('pubUpdateSelectedBtn')?.addEventListener('click', () => {
            this.handleUpdateSelected();
        });

        // Confirmation Modal Buttons
        document.getElementById('pubConfirmCancelBtn')?.addEventListener('click', () => {
            this.hideConfirmModal();
        });

        document.getElementById('pubConfirmProceedBtn')?.addEventListener('click', () => {
            const action = this._pendingAction;
            this.hideConfirmModal();
            if (typeof action === 'function') {
                action();
            }
        });
    }

    openPubHealthModal(data) {
        const modal = document.getElementById('pubHealthModal');
        if (!modal) return;
        modal.hidden = false;
        if (data?.projectPath) {
            const pathDisplay = document.getElementById('pubProjectPathDisplay');
            if (pathDisplay) pathDisplay.textContent = data.projectPath.split(/[/\\]/).pop() || data.projectPath;
        }
        this.sendMessage('checkPubHealth', {});
    }

    handlePubHealthProjectPath(path) {
        const pathDisplay = document.getElementById('pubProjectPathDisplay');
        if (pathDisplay && path) {
            pathDisplay.textContent = path.split(/[/\\]/).pop() || path;
            pathDisplay.title = path;
        }
    }

    handlePubHealthState(data) {
        const initial = document.getElementById('pubHealthInitialView');
        const loading = document.getElementById('pubHealthLoadingView');
        const error = document.getElementById('pubHealthErrorView');
        const report = document.getElementById('pubHealthReportView');
        const tabsBar = document.getElementById('pubTabsBar');

        if (data.projectPath) {
            this.handlePubHealthProjectPath(data.projectPath);
        }

        if (initial) initial.hidden = data.status !== 'initial';
        if (loading) loading.hidden = data.status !== 'loading';
        if (error) error.hidden = data.status !== 'error';
        if (report) report.hidden = data.status !== 'success';
        if (tabsBar) tabsBar.hidden = data.status !== 'success';

        if (data.status === 'loading') {
            const loadingText = loading?.querySelector('p');
            if (loadingText && data.message) loadingText.textContent = data.message;
        } else if (data.status === 'error') {
            const errEl = document.getElementById('pubHealthErrorMessage');
            if (errEl) errEl.textContent = data.error || 'Pub check failed';

            const diagBox = document.getElementById('pubHealthDiagnosticBox');
            if (diagBox) {
                if (data.diagnostics && data.diagnostics.isPubspecError) {
                    this._currentDiagnostics = data.diagnostics;
                    diagBox.hidden = false;

                    const titleEl = document.getElementById('pubDiagnosticTitle');
                    if (titleEl) titleEl.textContent = data.diagnostics.title || 'pubspec.yaml issue detected';

                    const detailEl = document.getElementById('pubDiagnosticDetail');
                    if (detailEl) detailEl.textContent = data.diagnostics.detail || '';

                    const sugEl = document.getElementById('pubDiagnosticSuggestion');
                    if (sugEl) sugEl.textContent = data.diagnostics.suggestion || '';

                    const btnText = document.getElementById('pubOpenBtnText');
                    if (btnText) {
                        btnText.textContent = data.diagnostics.line ? `Open Line ${data.diagnostics.line}` : 'Open pubspec.yaml';
                    }

                    const snippetContainer = document.getElementById('pubDiagnosticSnippetContainer');
                    const snippetCode = document.getElementById('pubDiagnosticSnippetCode');
                    if (snippetContainer && snippetCode) {
                        if (data.diagnostics.codeSnippet) {
                            snippetContainer.hidden = false;
                            snippetCode.textContent = data.diagnostics.codeSnippet;
                        } else {
                            snippetContainer.hidden = true;
                        }
                    }
                } else {
                    diagBox.hidden = true;
                    this._currentDiagnostics = null;
                }
            }
        } else if (data.status === 'success' && data.summary) {
            const diagBox = document.getElementById('pubHealthDiagnosticBox');
            if (diagBox) diagBox.hidden = true;
            this._lastSummary = data.summary;
            if (!this._selectedPackages) this._selectedPackages = new Set();
            this._selectedPackages.clear();
            this.renderPubSummary(data.summary);
        }
    }

    switchTab(tab) {
        this._activeTab = tab;
        document.querySelectorAll('#pubTabsBar .pub-tab').forEach(btn => {
            btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
        });

        const banner = document.getElementById('pubTransitiveBanner');
        if (banner) banner.hidden = tab !== 'transitive';

        this.renderFilteredPackages();
    }

    renderPubSummary(sum) {
        const total = document.getElementById('pubTotalCount');
        const ok = document.getElementById('pubUpToDateCount');
        const up = document.getElementById('pubUpgradableCount');
        const maj = document.getElementById('pubMajorCount');

        if (total) total.textContent = String(sum.total);
        if (ok) ok.textContent = String(sum.upToDateCount);
        if (up) up.textContent = String(sum.upgradableCount);
        if (maj) maj.textContent = String(sum.majorUpdateCount);

        // Update tab badges
        const directCount = sum.packages.filter(p => p.kind === 'direct').length;
        const devCount = sum.packages.filter(p => p.kind === 'dev').length;
        const transitiveCount = sum.packages.filter(p => p.kind === 'transitive').length;

        const allBadge = document.getElementById('pubTabAllCount');
        const directBadge = document.getElementById('pubTabDirectCount');
        const devBadge = document.getElementById('pubTabDevCount');
        const transBadge = document.getElementById('pubTabTransitiveCount');

        if (allBadge) allBadge.textContent = String(sum.total);
        if (directBadge) directBadge.textContent = String(directCount);
        if (devBadge) devBadge.textContent = String(devCount);
        if (transBadge) transBadge.textContent = String(transitiveCount);

        this.renderFilteredPackages();
    }

    getFilteredPackages() {
        if (!this._lastSummary || !Array.isArray(this._lastSummary.packages)) return [];
        const tab = this._activeTab || 'all';
        if (tab === 'all') return this._lastSummary.packages;
        return this._lastSummary.packages.filter(p => p.kind === tab);
    }

    renderFilteredPackages() {
        const tbody = document.getElementById('pubPackagesTbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const pkgs = this.getFilteredPackages();
        const selectAllCb = document.getElementById('pubSelectAllCheckbox');

        let visibleSelectableCount = 0;
        let visibleSelectedCount = 0;

        pkgs.forEach(pkg => {
            const tr = document.createElement('tr');
            const statusClass = pkg.status === 'up_to_date' ? 'is-ok'
                : pkg.status === 'upgradable' ? 'is-warn'
                : 'is-danger';
            const statusLabel = pkg.status === 'up_to_date' ? 'Up to date'
                : pkg.status === 'upgradable' ? 'Upgradable'
                : 'Major Available';

            const isSelectable = pkg.kind !== 'transitive' && (pkg.status === 'upgradable' || pkg.status === 'major_update');
            if (isSelectable) {
                visibleSelectableCount++;
                if (this._selectedPackages.has(pkg.name)) {
                    visibleSelectedCount++;
                }
            }

            const isChecked = this._selectedPackages.has(pkg.name);

            // Transitive parent tags markup
            let parentHtml = '';
            if (pkg.kind === 'transitive' && Array.isArray(pkg.parentPackages) && pkg.parentPackages.length > 0) {
                const tags = pkg.parentPackages.slice(0, 3).map(p => `<span class="pub-parent-tag">${p}</span>`).join(' ');
                const extra = pkg.parentPackages.length > 3 ? `<span class="pub-parent-tag-more">+${pkg.parentPackages.length - 3}</span>` : '';
                parentHtml = `<div class="pub-parent-tags"><span class="pub-parent-label">via</span> ${tags} ${extra}</div>`;
            }

            // Actions buttons
            let actionHtml = '';
            if (pkg.kind === 'transitive') {
                if (pkg.status !== 'up_to_date') {
                    actionHtml = `<button class="btn btn-sm btn-quiet pub-btn-action-transitive" data-pkg="${pkg.name}" type="button" title="Upgrade via flutter pub upgrade ${pkg.name}"><i class="fas fa-terminal"></i> Upgrade CLI</button>`;
                } else {
                    actionHtml = `<span class="pub-no-action"><i class="fas fa-check"></i> Latest</span>`;
                }
            } else if (pkg.status === 'upgradable') {
                if (pkg.latestVersion !== pkg.upgradableVersion) {
                    actionHtml = `
                        <div class="pub-action-btns">
                            <button class="btn btn-sm btn-primary pub-btn-action-update" data-pkg="${pkg.name}" data-ver="${pkg.upgradableVersion}" data-dev="${pkg.kind === 'dev'}" type="button" title="Safe upgrade to ^${pkg.upgradableVersion}">Update</button>
                            <button class="btn btn-sm btn-danger pub-btn-action-latest" data-pkg="${pkg.name}" data-ver="${pkg.latestVersion}" data-dev="${pkg.kind === 'dev'}" type="button" title="Update to Latest (^${pkg.latestVersion}) - Breaking Changes"><i class="fas fa-bolt"></i> Latest</button>
                        </div>
                    `;
                } else {
                    actionHtml = `<button class="btn btn-sm btn-primary pub-btn-action-update" data-pkg="${pkg.name}" data-ver="${pkg.upgradableVersion}" data-dev="${pkg.kind === 'dev'}" type="button" title="Update to ^${pkg.upgradableVersion}">Update</button>`;
                }
            } else if (pkg.status === 'major_update') {
                actionHtml = `<button class="btn btn-sm btn-danger pub-btn-action-latest" data-pkg="${pkg.name}" data-ver="${pkg.latestVersion}" data-dev="${pkg.kind === 'dev'}" type="button" title="Update to Latest (^${pkg.latestVersion}) - Breaking Changes"><i class="fas fa-bolt"></i> Update</button>`;
            } else {
                actionHtml = `<span class="pub-no-action"><i class="fas fa-check"></i> Latest</span>`;
            }

            const checkColHtml = isSelectable
                ? `<input type="checkbox" class="pub-pkg-checkbox" data-pkg="${pkg.name}" ${isChecked ? 'checked' : ''}>`
                : `<span class="pub-check-disabled"></span>`;

            tr.innerHTML = `
                <td class="pub-td-check">${checkColHtml}</td>
                <td>
                    <strong class="pub-pkg-name">${pkg.name}</strong>
                    ${parentHtml}
                </td>
                <td><span class="pub-kind-badge is-${pkg.kind}">${pkg.kind}</span></td>
                <td><code>${pkg.currentVersion}</code></td>
                <td><code>${pkg.upgradableVersion}</code></td>
                <td><code>${pkg.latestVersion}</code></td>
                <td><span class="pub-status-pill ${statusClass}">${statusLabel}</span></td>
                <td class="pub-td-action">${actionHtml}</td>
            `;

            // Attach checkbox handler
            const cb = tr.querySelector('.pub-pkg-checkbox');
            cb?.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this._selectedPackages.add(pkg.name);
                } else {
                    this._selectedPackages.delete(pkg.name);
                }
                this.updateSelectionToolbar();
            });

            // Attach safe update handler
            const updateBtn = tr.querySelector('.pub-btn-action-update');
            updateBtn?.addEventListener('click', () => {
                this.sendMessage('updatePubPackages', {
                    packages: [{ name: pkg.name, version: pkg.upgradableVersion, isDev: pkg.kind === 'dev' }]
                });
            });

            // Attach latest (major) update handler
            const latestBtn = tr.querySelector('.pub-btn-action-latest');
            latestBtn?.addEventListener('click', () => {
                this.showConfirmModal(
                    'Breaking Change Warning (Major Update)',
                    `Upgrading "${pkg.name}" from ${pkg.currentVersion} to latest major version ^${pkg.latestVersion} may introduce breaking API changes that require code adjustments.`,
                    [{ name: pkg.name, current: pkg.currentVersion, target: pkg.latestVersion, isMajor: true }],
                    () => {
                        this.sendMessage('updatePubPackages', {
                            packages: [{ name: pkg.name, version: pkg.latestVersion, isDev: pkg.kind === 'dev' }]
                        });
                    }
                );
            });

            // Attach transitive CLI upgrade handler
            const transBtn = tr.querySelector('.pub-btn-action-transitive');
            transBtn?.addEventListener('click', () => {
                const parents = pkg.parentPackages?.length ? pkg.parentPackages.join(', ') : 'parent dependencies';
                this.showConfirmModal(
                    'Transitive Package Upgrade Warning',
                    `"${pkg.name}" is a transitive dependency used by: ${parents}. Upgrading it directly via "flutter pub upgrade" might create version incompatibilities with its parent packages.`,
                    [{ name: pkg.name, current: pkg.currentVersion, target: pkg.upgradableVersion || pkg.latestVersion, isTransitive: true }],
                    () => {
                        this.sendMessage('upgradeTransitivePubPackage', { packageName: pkg.name });
                    }
                );
            });

            tbody.appendChild(tr);
        });

        if (selectAllCb) {
            selectAllCb.checked = visibleSelectableCount > 0 && visibleSelectedCount === visibleSelectableCount;
            selectAllCb.disabled = visibleSelectableCount === 0;
        }

        this.updateSelectionToolbar();
    }

    toggleSelectAll(checked) {
        const pkgs = this.getFilteredPackages();
        pkgs.forEach(pkg => {
            const isSelectable = pkg.kind !== 'transitive' && (pkg.status === 'upgradable' || pkg.status === 'major_update');
            if (isSelectable) {
                if (checked) {
                    this._selectedPackages.add(pkg.name);
                } else {
                    this._selectedPackages.delete(pkg.name);
                }
            }
        });
        this.renderFilteredPackages();
    }

    updateSelectionToolbar() {
        const count = this._selectedPackages.size;
        const btn = document.getElementById('pubUpdateSelectedBtn');
        const countEl = document.getElementById('pubSelectedCount');

        if (countEl) countEl.textContent = String(count);
        if (btn) btn.disabled = count === 0;
    }

    handleUpdateSelected() {
        if (!this._lastSummary || this._selectedPackages.size === 0) return;

        const selectedList = this._lastSummary.packages.filter(p => this._selectedPackages.has(p.name));
        const majorItems = selectedList.filter(p => p.status === 'major_update');

        const targets = selectedList.map(p => ({
            name: p.name,
            version: p.status === 'major_update' ? p.latestVersion : p.upgradableVersion,
            isDev: p.kind === 'dev',
            current: p.currentVersion,
            status: p.status
        }));

        if (majorItems.length > 0) {
            this.showConfirmModal(
                `Confirm Batch Update (${targets.length} Packages)`,
                `Your selection includes ${majorItems.length} package(s) with Major breaking changes. Upgrading these will modify pubspec.yaml and could break existing code until updated:`,
                majorItems.map(m => ({
                    name: m.name,
                    current: m.currentVersion,
                    target: m.latestVersion,
                    isMajor: true
                })),
                () => {
                    this.sendMessage('updatePubPackages', { packages: targets });
                }
            );
        } else {
            // Safe batch update without major breaking changes
            this.sendMessage('updatePubPackages', { packages: targets });
        }
    }

    showConfirmModal(title, message, items, onConfirm) {
        const modal = document.getElementById('pubConfirmModal');
        const titleEl = document.getElementById('pubConfirmTitle');
        const msgEl = document.getElementById('pubConfirmMessage');
        const listEl = document.getElementById('pubConfirmList');

        if (!modal) return;

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;

        if (listEl) {
            listEl.innerHTML = '';
            (items || []).forEach(it => {
                const li = document.createElement('li');
                const badge = it.isMajor ? '<span class="pub-confirm-badge is-danger">Major</span>' : '';
                li.innerHTML = `<strong>${it.name}</strong>: <code>${it.current}</code> &rarr; <code>^${it.target}</code> ${badge}`;
                listEl.appendChild(li);
            });
        }

        this._pendingAction = onConfirm;
        modal.hidden = false;
    }

    hideConfirmModal() {
        const modal = document.getElementById('pubConfirmModal');
        if (modal) modal.hidden = true;
        this._pendingAction = null;
    }
};
