window.AirFlutterApkSizeModule = class AirFlutterApkSizeModule {
    initApkSize() {
        const modal = document.getElementById('apkSizeModal');
        if (!modal) return;

        const close = () => { modal.hidden = true; };
        document.getElementById('closeApkSizeModalBtn')?.addEventListener('click', close);

        document.getElementById('apkRunAnalyzeBtn')?.addEventListener('click', () => {
            const select = document.getElementById('apkDetectedSelect');
            const path = select?.value;
            if (!path) {
                this.showToast('Please select or browse an APK file.', 'error');
                return;
            }
            this.sendMessage('analyzeApkSize', { apkPath: path });
        });

        document.getElementById('apkBrowseFileBtn')?.addEventListener('click', () => {
            this.sendMessage('pickAndAnalyzeApk', {});
        });

        document.getElementById('apkDetectedSelect')?.addEventListener('change', (e) => {
            const path = e.target.value;
            if (path) {
                this.sendMessage('analyzeApkSize', { apkPath: path });
            }
        });
    }

    openApkSizeModal(data) {
        const modal = document.getElementById('apkSizeModal');
        if (!modal) return;
        modal.hidden = false;

        const select = document.getElementById('apkDetectedSelect');

        // When opened directly without data (e.g. via UI bridge trigger), query the extension host
        if (!data || !Array.isArray(data.defaultApks)) {
            if (select) {
                select.innerHTML = '<option value="" disabled selected>Searching for built packages…</option>';
            }
            this.sendMessage('openApkSizeModal', {});
            return;
        }

        if (select) {
            select.innerHTML = '';
            const apks = data.defaultApks;
            if (apks.length === 0) {
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.disabled = true;
                emptyOpt.selected = true;
                emptyOpt.textContent = 'No built packages found in workspace';
                select.appendChild(emptyOpt);
            } else {
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Choose a built package…';
                select.appendChild(placeholder);

                apks.forEach(apk => {
                    const opt = document.createElement('option');
                    opt.value = apk;
                    const norm = apk.replace(/\\/g, '/');
                    const match = norm.match(/(?:flutter-apk|apk\/[^/]+|bundle\/[^/]+)\/[^/]+$/i);
                    opt.textContent = match ? match[0] : (norm.split('/').pop() || apk);
                    select.appendChild(opt);
                });
                select.value = apks[0];
            }
        }
    }

    handleApkSizeState(data) {
        const initial = document.getElementById('apkInitialView');
        const loading = document.getElementById('apkLoadingView');
        const error = document.getElementById('apkErrorView');
        const report = document.getElementById('apkReportView');

        if (initial) initial.hidden = data.status !== 'initial';
        if (loading) loading.hidden = data.status !== 'loading';
        if (error) error.hidden = data.status !== 'error';
        if (report) report.hidden = data.status !== 'success';

        if (data.status === 'error') {
            const msgEl = document.getElementById('apkErrorMessage');
            if (msgEl) msgEl.textContent = data.error || 'Failed to analyze APK';
        } else if (data.status === 'success' && data.report) {
            this.renderApkReport(data.report);
        }
    }

    renderApkReport(rep) {
        const fn = document.getElementById('apkReportFileName');
        const fs = document.getElementById('apkReportFileSize');
        const ufs = document.getElementById('apkReportUncompressedSize');

        if (fn) fn.textContent = rep.fileName;
        if (fs) fs.textContent = (rep.fileSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
        if (ufs) ufs.textContent = (rep.totalUncompressedBytes / (1024 * 1024)).toFixed(2) + ' MB';

        // Keep select dropdown synchronized with the analyzed file
        const select = document.getElementById('apkDetectedSelect');
        if (select && rep.filePath) {
            let optionExists = false;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === rep.filePath) {
                    optionExists = true;
                    break;
                }
            }
            if (!optionExists) {
                const opt = document.createElement('option');
                opt.value = rep.filePath;
                opt.textContent = rep.fileName || rep.filePath.split(/[/\\]/).pop();
                select.appendChild(opt);
            }
            select.value = rep.filePath;
        }

        // Render composite bar
        const bar = document.getElementById('apkCompositeBar');
        const legend = document.getElementById('apkLegendGrid');
        if (bar) bar.innerHTML = '';
        if (legend) legend.innerHTML = '';

        const colors = {
            native_lib: '#E2552B',
            assets: '#38A169',
            dex_code: '#3182CE',
            resources: '#D69E2E',
            other: '#718096'
        };

        rep.categories.forEach(cat => {
            if (cat.percentage <= 0) return;
            const seg = document.createElement('div');
            seg.className = 'apk-bar-segment';
            seg.style.width = cat.percentage + '%';
            seg.style.backgroundColor = colors[cat.category] || '#718096';
            seg.title = `${cat.label}: ${cat.percentage}% (${(cat.size / 1024 / 1024).toFixed(2)} MB)`;
            bar?.appendChild(seg);

            const legItem = document.createElement('div');
            legItem.className = 'apk-legend-item';
            legItem.innerHTML = `
                <span class="apk-legend-dot" style="background-color: ${colors[cat.category] || '#718096'}"></span>
                <span class="apk-legend-label">${cat.label}</span>
                <strong class="apk-legend-value">${cat.percentage}% (${(cat.size / 1024 / 1024).toFixed(2)} MB)</strong>
            `;
            legend?.appendChild(legItem);
        });

        // Render top files
        const tbody = document.getElementById('apkTopFilesTbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        rep.topFiles.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="apk-cell-path" title="${f.path}"><code>${f.path}</code></td>
                <td class="apk-cell-cat"><span class="apk-cat-pill">${f.category}</span></td>
                <td class="apk-cell-size">${(f.size / 1024).toFixed(1)} KB</td>
                <td class="apk-cell-compressed">${(f.compressedSize / 1024).toFixed(1)} KB</td>
            `;
            tbody.appendChild(tr);
        });
    }
};

