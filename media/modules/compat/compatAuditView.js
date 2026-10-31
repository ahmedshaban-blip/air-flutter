// Compatibility Doctor - Audit View Module
window.AirFlutterCompatAuditModule = class AirFlutterCompatAuditModule {
    initCompatDoctorModal() {
        const modal = document.getElementById('compatDoctorModal');
        if (!modal) return;

        const closeBtn = document.getElementById('closeCompatDoctorModalBtn');
        const cancelBtn = document.getElementById('cancelCompatDoctorBtn');
        const cancelConfigBtn = document.getElementById('cancelCompatConfigBtn');
        const browseBtn = document.getElementById('browseCompatProjectBtn');
        const reScanBtn = document.getElementById('reScanCompatDoctorBtn');
        const outputBtn = document.getElementById('openCompatOutputBtn');
        const autoUpgradeBtn = document.getElementById('autoUpgradeStackBtn');
        const pathInput = document.getElementById('compatProjectPathInput');

        // Tabs navigation
        const tabAudit = document.getElementById('tabBtnCompatAudit');
        const tabConfig = document.getElementById('tabBtnCompatConfig');
        const contentAudit = document.getElementById('tabContentCompatAudit');
        const contentConfig = document.getElementById('tabContentCompatConfig');

        if (tabAudit && tabConfig) {
            tabAudit.addEventListener('click', () => {
                tabAudit.classList.add('is-active');
                tabConfig.classList.remove('is-active');
                if (contentAudit) contentAudit.style.display = 'block';
                if (contentConfig) contentConfig.style.display = 'none';
            });

            tabConfig.addEventListener('click', () => {
                tabConfig.classList.add('is-active');
                tabAudit.classList.remove('is-active');
                if (contentAudit) contentAudit.style.display = 'none';
                if (contentConfig) contentConfig.style.display = 'block';
            });
        }

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (cancelConfigBtn) cancelConfigBtn.addEventListener('click', closeModal);

        // Diff Preview Modal
        const diffModal = document.getElementById('compatDiffModal');
        const closeDiffBtn = document.getElementById('closeCompatDiffModalBtn');
        const cancelDiffBtn = document.getElementById('cancelCompatDiffModalBtn');
        const confirmDiffBtn = document.getElementById('confirmApplyDiffBtn');

        const closeDiffModal = () => { if (diffModal) diffModal.hidden = true; };
        if (closeDiffBtn) closeDiffBtn.addEventListener('click', closeDiffModal);
        if (cancelDiffBtn) cancelDiffBtn.addEventListener('click', closeDiffModal);

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.sendMessage('selectCompatProject', {});
            });
        }

        if (reScanBtn) {
            reScanBtn.addEventListener('click', () => {
                const p = pathInput ? pathInput.value : '';
                this.setCompatDoctorLoading(true);
                this.sendMessage('runCompatDoctorScan', { projectPath: p });
            });
        }

        if (outputBtn) {
            outputBtn.addEventListener('click', () => {
                this.sendMessage('runFlutterCommand', { commandId: 'airFlutter.runCompatDoctor' });
            });
        }

        if (autoUpgradeBtn) {
            autoUpgradeBtn.addEventListener('click', () => {
                const p = pathInput ? pathInput.value : '';
                this.setCompatDoctorLoading(true);
                this.sendMessage('applyCompatUpgrades', { projectPath: p });
            });
        }

        // Configurator change listeners
        const agpSelect = document.getElementById('configAgpSelect');
        const gradleSelect = document.getElementById('configGradleSelect');

        if (agpSelect) {
            agpSelect.addEventListener('change', () => {
                this.onConfigAgpChanged();
            });
        }
        if (gradleSelect) {
            gradleSelect.addEventListener('change', () => {
                this.updateConfigStatusBanner();
            });
        }

        // Preview & Apply Custom Stack Button
        const previewBtn = document.getElementById('previewCustomStackBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.prepareCustomStackDiffs();
            });
        }

        // Confirm Apply Diff Button
        if (confirmDiffBtn) {
            confirmDiffBtn.addEventListener('click', () => {
                const checkedBoxes = Array.from(document.querySelectorAll('#compatDiffList input[type="checkbox"]:checked'));
                if (checkedBoxes.length === 0) {
                    this.showToast('No modifications selected to apply.', 'warning');
                    return;
                }
                const selectedIds = checkedBoxes.map(cb => cb.dataset.diffId);
                const diffsToApply = (this.pendingDiffs || []).filter(d => selectedIds.includes(d.id));

                if (diffModal) diffModal.hidden = true;
                this.setCompatDoctorLoading(true);
                const p = pathInput ? pathInput.value : '';
                this.sendMessage('applyCustomStack', { projectPath: p, diffs: diffsToApply });
            });
        }
    }

    setCompatDoctorLoading(loading) {
        const loadingEl = document.getElementById('compatDoctorLoading');
        const contentAudit = document.getElementById('tabContentCompatAudit');
        const contentConfig = document.getElementById('tabContentCompatConfig');
        if (loadingEl) loadingEl.style.display = loading ? 'block' : 'none';
        if (loading) {
            if (contentAudit) contentAudit.style.display = 'none';
            if (contentConfig) contentConfig.style.display = 'none';
        } else {
            const isConfigActive = document.getElementById('tabBtnCompatConfig')?.classList.contains('is-active');
            if (contentAudit) contentAudit.style.display = isConfigActive ? 'none' : 'block';
            if (contentConfig) contentConfig.style.display = isConfigActive ? 'block' : 'none';
        }
    }

    openCompatDoctorModal(defaultPath) {
        const modal = document.getElementById('compatDoctorModal');
        if (modal) {
            modal.hidden = false;

            // Reset tabs to Audit tab by default
            const tabAudit = document.getElementById('tabBtnCompatAudit');
            const tabConfig = document.getElementById('tabBtnCompatConfig');
            const contentAudit = document.getElementById('tabContentCompatAudit');
            const contentConfig = document.getElementById('tabContentCompatConfig');
            if (tabAudit && tabConfig && contentAudit && contentConfig) {
                tabAudit.classList.add('is-active');
                tabConfig.classList.remove('is-active');
                contentAudit.style.display = 'block';
                contentConfig.style.display = 'none';
            }

            const pathInput = document.getElementById('compatProjectPathInput');
            if (pathInput && defaultPath) {
                pathInput.value = defaultPath;
            }
            this.setCompatDoctorLoading(true);

            // Trigger immediate scan
            const targetPath = (pathInput && pathInput.value) ? pathInput.value : (defaultPath || '');
            this.sendMessage('runCompatDoctorScan', { projectPath: targetPath });
        }
    }

    renderCompatReport(report, availableVersions, rules, error) {
        this.setCompatDoctorLoading(false);
        const issuesContainer = document.getElementById('compatIssuesContainer');
        const autoUpgradeBtn = document.getElementById('autoUpgradeStackBtn');

        if (error || !report) {
            if (issuesContainer) {
                issuesContainer.innerHTML = `<div class="compat-issue-item is-error">
                    <div class="compat-issue-header">
                        <span class="compat-issue-badge is-error">Error</span>
                    </div>
                    <div class="compat-issue-msg">${error || 'Failed to analyze project build stack.'}</div>
                </div>`;
            }
            if (autoUpgradeBtn) autoUpgradeBtn.disabled = true;
            return;
        }

        this.currentCompatReport = report;
        this.compatAvailableVersions = availableVersions;
        this.compatRules = rules;

        // Auto-fill project path input
        if (report.projectPath) {
            const pathInput = document.getElementById('compatProjectPathInput');
            if (pathInput) {
                pathInput.value = report.projectPath;
            }
        }

        // Update cards
        const updateCard = (cardId, valId, subId, val, sub, state) => {
            const card = document.getElementById(cardId);
            const valEl = document.getElementById(valId);
            const subEl = document.getElementById(subId);
            if (card) {
                card.classList.remove('is-success', 'is-warning', 'is-error');
                if (state) card.classList.add(state);
            }
            if (valEl) valEl.textContent = val || '-';
            if (subEl) subEl.textContent = sub || '';
        };

        const gradleVer = report.gradle ? report.gradle.gradleVersion : null;
        const agpVer = report.gradle ? report.gradle.agpVersion : null;
        const javaVer = report.environment ? report.environment.javaVersion : null;
        const iosVer = report.podfile ? report.podfile.deploymentTarget : null;

        const hasAgpMismatch = report.issues && report.issues.some(i => i.code === 'AGP_GRADLE_MISMATCH');
        const hasJavaMismatch = report.issues && report.issues.some(i => i.code === 'JAVA_AGP_MISMATCH');
        const hasOutdatedStack = report.issues && report.issues.some(i => i.code === 'OUTDATED_STACK');
        const hasIosIssue = report.issues && report.issues.some(i => i.code === 'OUTDATED_IOS_TARGET' || i.code === 'DEPRECATED_IOS_TARGET');

        updateCard(
            'compatCardGradle',
            'compatValGradle',
            'compatSubGradle',
            gradleVer ? `Gradle ${gradleVer}` : 'Not Detected',
            report.gradle && report.gradle.wrapperPath ? 'wrapper.properties' : 'wrapper missing',
            hasAgpMismatch ? 'is-error' : (gradleVer ? 'is-success' : 'is-warning')
        );

        updateCard(
            'compatCardAgp',
            'compatValAgp',
            'compatSubAgp',
            agpVer ? `AGP ${agpVer}` : 'Not Detected',
            report.gradle && report.gradle.isKotlinDsl ? 'Kotlin DSL (.kts)' : 'Groovy DSL (.gradle)',
            hasAgpMismatch ? 'is-error' : (hasOutdatedStack ? 'is-warning' : (agpVer ? 'is-success' : 'is-warning'))
        );

        updateCard(
            'compatCardJava',
            'compatValJava',
            'compatSubJava',
            javaVer ? `JDK ${javaVer}` : 'Not Found',
            javaVer ? 'Runtime active' : 'Check JAVA_HOME / PATH',
            hasJavaMismatch ? 'is-error' : (javaVer ? 'is-success' : 'is-warning')
        );

        updateCard(
            'compatCardIos',
            'compatValIos',
            'compatSubIos',
            iosVer ? `iOS ${iosVer}` : (report.podfile && report.podfile.exists ? 'Not set' : 'No Podfile'),
            report.environment && report.environment.isWindows ? 'Skipped CocoaPods (Windows)' : (report.podfile && report.podfile.exists ? 'Podfile target' : 'iOS not configured'),
            hasIosIssue ? 'is-warning' : (iosVer ? 'is-success' : '')
        );

        // Render issues list
        if (issuesContainer) {
            issuesContainer.innerHTML = '';
            if (!report.issues || report.issues.length === 0) {
                issuesContainer.innerHTML = `
                    <div style="padding: 16px; text-align: center; background: rgba(46, 125, 50, 0.08); border: 1px solid rgba(46, 125, 50, 0.3); border-radius: 6px; color: var(--ink);">
                        <i class="fas fa-check-circle" style="color: #4caf50; font-size: 20px; margin-bottom: 6px; display: block;"></i>
                        <strong>All Configurations Healthy &amp; Up to Date!</strong>
                        <p style="margin: 4px 0 0; font-size: 11px; color: var(--muted);">AGP, Gradle wrapper, Java runtime, and iOS deployment target are fully compatible.</p>
                    </div>`;
            } else {
                report.issues.forEach(issue => {
                    const item = document.createElement('div');
                    item.className = `compat-issue-item is-${issue.type}`;
                    const badgeClass = issue.type === 'error' ? 'is-error' : 'is-warning';
                    const iconClass = issue.type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';

                    let fixHtml = '';
                    if (issue.suggestedFix) {
                        fixHtml = `
                            <div class="compat-issue-fix">
                                <i class="fas fa-magic"></i>
                                <span>Suggested Auto-Fix: <strong>${issue.suggestedFix.description}</strong> (&rarr; "${issue.suggestedFix.newText}")</span>
                            </div>`;
                    }

                    let guideHtml = '';
                    if (issue.migrationUrl) {
                        guideHtml = `<a href="${issue.migrationUrl}" target="_blank" style="font-size: 11px; color: var(--primary); text-decoration: underline; margin-top: 2px; display: inline-block;"><i class="fas fa-external-link-alt"></i> Migration Guide</a>`;
                    }

                    item.innerHTML = `
                        <div class="compat-issue-header">
                            <span class="compat-issue-badge ${badgeClass}"><i class="fas ${iconClass}"></i> ${issue.code}</span>
                            ${issue.filePath ? `<span style="font-size: 10px; color: var(--muted); font-family: monospace;">${issue.filePath.split(/[\\\\/]/).slice(-2).join('/')}</span>` : ''}
                        </div>
                        <div class="compat-issue-msg">${issue.message}</div>
                        ${fixHtml}
                        ${guideHtml}
                    `;
                    issuesContainer.appendChild(item);
                });
            }
        }

        // Enable or disable Auto-Upgrade button
        if (autoUpgradeBtn) {
            autoUpgradeBtn.disabled = !report.canAutoUpgrade;
        }

        // Populate and configure Smart Version Configurator
        this.populateVersionConfigurator(report, availableVersions, rules);
    }
};
