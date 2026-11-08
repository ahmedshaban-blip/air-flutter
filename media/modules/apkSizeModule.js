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
    }

    openApkSizeModal(data) {
        const modal = document.getElementById('apkSizeModal');
        if (!modal) return;
        modal.hidden = false;

        const select = document.getElementById('apkDetectedSelect');
        if (select && data?.defaultApks) {
            select.innerHTML = '<option value="">Choose a built package…</option>';
            data.defaultApks.forEach(apk => {
                const opt = document.createElement('option');
                opt.value = apk;
                opt.textContent = apk.split(/[/\\]/).pop();
                select.appendChild(opt);
            });
            if (data.defaultApks.length > 0) {
                select.value = data.defaultApks[0];
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
                <td><code>${f.path}</code></td>
                <td><span class="apk-cat-pill">${f.category}</span></td>
                <td>${(f.size / 1024).toFixed(1)} KB</td>
                <td>${(f.compressedSize / 1024).toFixed(1)} KB</td>
            `;
            tbody.appendChild(tr);
        });
    }
};

