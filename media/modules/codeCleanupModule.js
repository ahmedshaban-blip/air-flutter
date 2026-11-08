(function () {
    class CodeCleanupModule {
        initCodeCleanup() {
            const scanButton = document.getElementById('runCodeCleanupBtn');
            if (scanButton) scanButton.addEventListener('click', () => this.runCodeCleanupScan());
            const results = document.getElementById('codeCleanupResults');
            if (results) {
                results.addEventListener('click', event => {
                    const button = event.target.closest('button[data-cleanup-action]');
                    if (!button) return;
                    const payload = {
                        file: button.dataset.file,
                        line: Number(button.dataset.line || 1),
                        column: Number(button.dataset.column || 1),
                        endLine: button.dataset.endLine ? Number(button.dataset.endLine) : undefined
                    };
                    const action = button.dataset.cleanupAction;
                    if (action === 'open') this.sendMessage('openCodeCleanupTarget', payload);
                    if (action === 'delete-file') this.sendMessage('deleteUnusedDartFile', payload);
                    if (action === 'remove-block') this.sendMessage('removeCommentedCodeBlock', payload);
                    if (action === 'uncomment-block') this.sendMessage('uncommentCodeBlock', payload);
                    if (action === 'remove-all-commented') this.sendMessage('removeAllCommentedCode', {});
                });
            }
        }

        runCodeCleanupScan() {
            this.setCodeCleanupLoading(true);
            this.sendMessage('runCodeCleanupScan', {});
        }

        setCodeCleanupLoading(loading) {
            const button = document.getElementById('runCodeCleanupBtn');
            if (button) {
                button.disabled = Boolean(loading);
                button.innerHTML = loading
                    ? '<i class="fas fa-rotate fa-spin"></i> Analyzing project…'
                    : '<i class="fas fa-magnifying-glass-chart"></i> Scan Code & Packages';
            }
            const status = document.getElementById('codeCleanupStatus');
            if (status && loading) status.textContent = 'Running Dart Analyzer and project graph checks…';
        }

        renderCodeCleanupReport(report) {
            this.setCodeCleanupLoading(false);
            const results = document.getElementById('codeCleanupResults');
            const summary = document.getElementById('codeCleanupSummary');
            const status = document.getElementById('codeCleanupStatus');
            if (!results || !summary || !status) return;

            const findings = report.findings || [];
            const unusedFiles = report.unusedFiles || [];
            const unusedPackages = report.unusedPackages || [];
            const commentedFindings = findings.filter(finding => finding.kind === 'commented-code');
            const commentedCount = commentedFindings.length;
            const commentedLineCount = commentedFindings.reduce((sum, f) => sum + (f.lineCount || 1), 0);
            const analyzerCount = findings.length - commentedCount;
            summary.innerHTML = `
                <span><strong>${unusedFiles.length}</strong> unused files</span>
                <span><strong>${analyzerCount}</strong> code findings</span>
                <span><strong>${commentedCount}</strong> commented blocks (${commentedLineCount} lines)</span>
                <span><strong>${unusedPackages.length}</strong> packages to review</span>`;
            status.textContent = report.analyzerError
                ? `Static checks completed, but Dart Analyzer reported: ${report.analyzerError}`
                : 'Code cleanup scan complete. Review findings before changing code.';

            const bulkCommentedAction = commentedCount > 0
                ? `<button class="btn btn-danger cleanup-bulk-btn" data-cleanup-action="remove-all-commented" type="button">Remove All (${commentedCount})</button>`
                : '';

            const packagesBanner = unusedPackages.length > 0
                ? `<div class="cleanup-advisory-callout">
                    <span class="cleanup-callout-icon">ℹ️</span>
                    <div class="cleanup-callout-text">
                        <strong>Review before removing:</strong> Packages listed here have no direct <code>import</code> in Dart files. Check if they are CLI tools, lints, or configured in <code>pubspec.yaml</code> before deleting them.
                    </div>
                </div>`
                : '';

            const groups = [
                this.cleanupGroup('Unused Dart files', unusedFiles.map(file => this.unusedFileRow(file))),
                this.cleanupGroup('Dead code & unused declarations', findings.filter(finding => finding.kind !== 'commented-code').map(finding => this.findingRow(finding))),
                this.cleanupGroup('Commented-out code', commentedFindings.map(finding => this.commentedCodeRow(finding)), bulkCommentedAction),
                this.cleanupGroup('Unused packages (review)', unusedPackages.map(pkg => this.packageRow(pkg)), '', packagesBanner)
            ];
            results.innerHTML = groups.join('');
        }

        cleanupGroup(title, rows, headerAction = '', bannerHtml = '') {
            return `
                <section class="cleanup-group">
                    <h3>
                        <span>${this.escapeHtml(title)} <em>${rows.length}</em></span>
                        ${headerAction}
                    </h3>
                    ${bannerHtml}
                    <div>${rows.length ? rows.join('') : '<p class="cleanup-empty">No findings</p>'}</div>
                </section>`;
        }

        unusedFileRow(file) {
            return this.cleanupRow(
                file.file,
                file.reason,
                `<button class="btn btn-quiet cleanup-open" data-cleanup-action="open" data-file="${this.escapeHtml(file.file)}">Open</button>
                 <button class="btn btn-danger cleanup-delete" data-cleanup-action="delete-file" data-file="${this.escapeHtml(file.file)}">Delete</button>`
            );
        }

        findingRow(finding) {
            return this.cleanupRow(
                `${finding.file}:${finding.line}`,
                finding.message,
                `<button class="btn btn-quiet cleanup-open" data-cleanup-action="open" data-file="${this.escapeHtml(finding.file)}" data-line="${finding.line}" data-column="${finding.column}">Open target</button>`
            );
        }

        commentedCodeRow(finding) {
            const endLine = finding.endLine || finding.line;
            const rangeLabel = endLine > finding.line
                ? `${finding.file}:${finding.line}-${endLine}`
                : `${finding.file}:${finding.line}`;
            const previewSnippet = finding.uncommentedText
                ? `<code class="cleanup-code-preview">${this.escapeHtml(finding.uncommentedText.slice(0, 140))}${finding.uncommentedText.length > 140 ? '…' : ''}</code>`
                : '';
            const actions = `
                <button class="btn btn-quiet cleanup-open" data-cleanup-action="open" data-file="${this.escapeHtml(finding.file)}" data-line="${finding.line}" data-column="${finding.column}" data-end-line="${endLine}">Preview</button>
                <button class="btn btn-quiet cleanup-uncomment" data-cleanup-action="uncomment-block" data-file="${this.escapeHtml(finding.file)}" data-line="${finding.line}" data-end-line="${endLine}">Uncomment</button>
                <button class="btn btn-danger cleanup-delete" data-cleanup-action="remove-block" data-file="${this.escapeHtml(finding.file)}" data-line="${finding.line}" data-end-line="${endLine}">Remove</button>`;
            return `
                <div class="cleanup-row">
                    <div class="cleanup-info">
                        <span class="cleanup-title">${this.escapeHtml(rangeLabel)}</span>
                        <span class="cleanup-description">${this.escapeHtml(finding.message)}</span>
                        ${previewSnippet}
                    </div>
                    <div class="cleanup-actions">${actions}</div>
                </div>`;
        }

        packageRow(pkg) {
            let badgeClass = 'cleanup-badge-warning';
            let badgeIcon = '⚠️';
            let badgeText = 'Verify Usage';
            let descHtml = 'No Dart import found. Verify if used by native code or assets before removing.';

            if (pkg.usageType === 'config') {
                badgeClass = 'cleanup-badge-config';
                badgeIcon = '⚙️';
                badgeText = `Config: ${pkg.usageDetail || 'pubspec.yaml'}`;
                descHtml = `No Dart import found, but configured in <strong>${this.escapeHtml(pkg.usageDetail || 'project config')}</strong>. Safe to keep.`;
            } else if (pkg.usageType === 'tool') {
                badgeClass = 'cleanup-badge-tool';
                badgeIcon = '🛠️';
                badgeText = 'CLI / Dev Tool';
                descHtml = `CLI / Code generation tool (${this.escapeHtml(pkg.usageDetail || 'tool')}) without direct Dart imports.`;
            }

            return `
                <div class="cleanup-row cleanup-pkg-row">
                    <div class="cleanup-info">
                        <div class="cleanup-pkg-header">
                            <span class="cleanup-title">${this.escapeHtml(pkg.name)}</span>
                            <span class="cleanup-badge cleanup-badge-section">${this.escapeHtml(pkg.section)}</span>
                            <span class="cleanup-badge ${badgeClass}">${badgeIcon} ${this.escapeHtml(badgeText)}</span>
                        </div>
                        <span class="cleanup-description">${descHtml}</span>
                    </div>
                    <div class="cleanup-actions">
                        <button class="btn btn-quiet cleanup-open" data-cleanup-action="open" data-file="pubspec.yaml" data-line="${pkg.line}">Open pubspec</button>
                    </div>
                </div>`;
        }

        cleanupRow(title, description, actions) {
            return `
                <div class="cleanup-row">
                    <div class="cleanup-info">
                        <span class="cleanup-title">${this.escapeHtml(title)}</span>
                        <span class="cleanup-description">${this.escapeHtml(description)}</span>
                    </div>
                    <div class="cleanup-actions">${actions}</div>
                </div>`;
        }
    }

    window.AirFlutterCodeCleanupModule = CodeCleanupModule;
})();
