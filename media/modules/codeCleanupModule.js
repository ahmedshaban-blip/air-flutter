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
                        column: Number(button.dataset.column || 1)
                    };
                    if (button.dataset.cleanupAction === 'open') this.sendMessage('openCodeCleanupTarget', payload);
                    if (button.dataset.cleanupAction === 'delete-file') this.sendMessage('deleteUnusedDartFile', payload);
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
            const commentedCount = findings.filter(finding => finding.kind === 'commented-code').length;
            const analyzerCount = findings.length - commentedCount;
            summary.innerHTML = `
                <span><strong>${unusedFiles.length}</strong> unused files</span>
                <span><strong>${analyzerCount}</strong> code findings</span>
                <span><strong>${commentedCount}</strong> commented code</span>
                <span><strong>${unusedPackages.length}</strong> packages to review</span>`;
            status.textContent = report.analyzerError
                ? `Static checks completed, but Dart Analyzer reported: ${report.analyzerError}`
                : 'Code cleanup scan complete. Review findings before changing code.';

            const groups = [
                this.cleanupGroup('Unused Dart files', unusedFiles.map(file => this.unusedFileRow(file))),
                this.cleanupGroup('Dead code & unused declarations', findings.filter(finding => finding.kind !== 'commented-code').map(finding => this.findingRow(finding))),
                this.cleanupGroup('Commented-out code', findings.filter(finding => finding.kind === 'commented-code').map(finding => this.findingRow(finding))),
                this.cleanupGroup('Unused packages (review)', unusedPackages.map(pkg => this.packageRow(pkg)))
            ];
            results.innerHTML = groups.join('');
        }

        cleanupGroup(title, rows) {
            return `
                <section class="cleanup-group">
                    <h3>${this.escapeHtml(title)} <span>${rows.length}</span></h3>
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

        packageRow(pkg) {
            return this.cleanupRow(
                pkg.name,
                `${pkg.section} · No Dart import found; verify native/config-only usage.`,
                `<button class="btn btn-quiet cleanup-open" data-cleanup-action="open" data-file="pubspec.yaml" data-line="${pkg.line}">Open pubspec</button>`
            );
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
