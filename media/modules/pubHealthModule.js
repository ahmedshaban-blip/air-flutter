window.AirFlutterPubHealthModule = class AirFlutterPubHealthModule {
    initPubHealth() {
        const modal = document.getElementById('pubHealthModal');
        if (!modal) return;

        const close = () => { modal.hidden = true; };
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

        if (initial) initial.hidden = data.status !== 'initial';
        if (loading) loading.hidden = data.status !== 'loading';
        if (error) error.hidden = data.status !== 'error';
        if (report) report.hidden = data.status !== 'success';

        if (data.status === 'error') {
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
            this.renderPubSummary(data.summary);
        }
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

        const tbody = document.getElementById('pubPackagesTbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        sum.packages.forEach(pkg => {
            const tr = document.createElement('tr');
            const statusClass = pkg.status === 'up_to_date' ? 'is-ok'
                : pkg.status === 'upgradable' ? 'is-warn'
                : 'is-danger';
            const statusLabel = pkg.status === 'up_to_date' ? 'Up to date'
                : pkg.status === 'upgradable' ? 'Upgradable'
                : 'Major Available';

            tr.innerHTML = `
                <td><strong>${pkg.name}</strong></td>
                <td><small>${pkg.kind}</small></td>
                <td><code>${pkg.currentVersion}</code></td>
                <td><code>${pkg.upgradableVersion}</code></td>
                <td><code>${pkg.latestVersion}</code></td>
                <td><span class="pub-status-pill ${statusClass}">${statusLabel}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
};

