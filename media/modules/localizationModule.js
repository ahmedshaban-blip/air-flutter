window.AirFlutterLocalizationModule = class AirFlutterLocalizationModule {
    initLocalization() {
        this.currentLocMatrix = null;

        const scanBtn = document.getElementById('locScanBtn');
        const addKeyModalBtn = document.getElementById('locAddKeyModalBtn');
        const copyAiPromptBtn = document.getElementById('locCopyAiPromptBtn');
        const runGenBtn = document.getElementById('locRunGenBtn');
        const initBtn = document.getElementById('locInitBtn');
        const searchInput = document.getElementById('locSearchInput');
        const missingCb = document.getElementById('locMissingOnlyCheckbox');

        if (!scanBtn) return;

        scanBtn.addEventListener('click', () => {
            this.sendMessage('loadLocalizationMatrix', {});
        });

        runGenBtn?.addEventListener('click', () => {
            this.sendMessage('runGenL10n', {});
        });

        initBtn?.addEventListener('click', () => {
            this.sendMessage('initLocalizationWorkspace', {});
        });

        searchInput?.addEventListener('input', () => this.renderLocalizationTable());
        missingCb?.addEventListener('change', () => this.renderLocalizationTable());

        // Add Key Modal
        const addModal = document.getElementById('locAddKeyModal');
        const addCloseBtn = document.getElementById('locAddKeyCloseBtn');
        const addCancelBtn = document.getElementById('locAddKeyCancelBtn');
        const addSaveBtn = document.getElementById('locAddKeySaveBtn');

        addKeyModalBtn?.addEventListener('click', () => {
            if (!this.currentLocMatrix || !this.currentLocMatrix.locales.length) {
                this.showToast('Please scan or initialize ARB files first.', 'warning');
                return;
            }
            const container = document.getElementById('locNewKeyInputsContainer');
            if (container) {
                container.innerHTML = this.currentLocMatrix.locales.map(loc => `
                    <label class="loc-field-label">
                        <span>Translation (${loc}):</span>
                        <input type="text" class="loc-new-val-input" data-locale="${loc}" placeholder="Value for ${loc}">
                    </label>
                `).join('');
            }
            if (addModal) addModal.hidden = false;
        });

        const closeAddModal = () => { if (addModal) addModal.hidden = true; };
        addCloseBtn?.addEventListener('click', closeAddModal);
        addCancelBtn?.addEventListener('click', closeAddModal);

        addSaveBtn?.addEventListener('click', () => {
            const key = document.getElementById('locNewKeyInput')?.value?.trim();
            const desc = document.getElementById('locNewKeyDescInput')?.value?.trim();
            if (!key) {
                this.showToast('Please enter a key identifier.', 'error');
                return;
            }

            const translations = {};
            document.querySelectorAll('.loc-new-val-input').forEach(input => {
                const loc = input.getAttribute('data-locale');
                translations[loc] = input.value;
            });

            this.sendMessage('saveLocalizationEntry', {
                key,
                translations,
                metadataDescription: desc
            });
            closeAddModal();
        });

        // AI Prompt Modal
        const aiModal = document.getElementById('locAiPromptModal');
        const aiCloseBtn = document.getElementById('locAiPromptCloseBtn');
        const aiDismissBtn = document.getElementById('locAiPromptDismissBtn');
        const aiCopyBtn = document.getElementById('locAiPromptCopyBtn');

        copyAiPromptBtn?.addEventListener('click', () => {
            if (!this.currentLocMatrix || !this.currentLocMatrix.locales.length) {
                this.showToast('Please scan ARB files first.', 'warning');
                return;
            }
            const targetLocale = this.currentLocMatrix.locales.find(l => l !== this.currentLocMatrix.templateLocale) || 'ar';
            this.sendMessage('generateAiTranslatePrompt', { targetLocale });
        });

        const closeAiModal = () => { if (aiModal) aiModal.hidden = true; };
        aiCloseBtn?.addEventListener('click', closeAiModal);
        aiDismissBtn?.addEventListener('click', closeAiModal);

        aiCopyBtn?.addEventListener('click', () => {
            const textarea = document.getElementById('locAiPromptTextarea');
            if (textarea) {
                navigator.clipboard.writeText(textarea.value);
                this.showToast('Copied AI prompt to clipboard!', 'success');
            }
        });
    }

    handleLocalizationMatrix(data, error) {
        if (error) {
            const container = document.getElementById('locTableContainer');
            if (container) container.innerHTML = `<p class="empty"><i class="fas fa-triangle-exclamation"></i><span>${error}</span></p>`;
            return;
        }
        this.currentLocMatrix = data;
        const summary = document.getElementById('locStatsSummary');
        if (summary) {
            summary.innerHTML = `<span><strong>${data.totalKeys}</strong> keys &middot; <strong>${data.totalMissing}</strong> missing</span>`;
        }
        this.renderLocalizationTable();
    }

    renderLocalizationTable() {
        const container = document.getElementById('locTableContainer');
        if (!container || !this.currentLocMatrix) return;

        const filter = document.getElementById('locSearchInput')?.value?.toLowerCase() || '';
        const missingOnly = document.getElementById('locMissingOnlyCheckbox')?.checked || false;

        let filtered = this.currentLocMatrix.entries.filter(entry => {
            if (missingOnly && entry.missingInLocales.length === 0) return false;
            if (!filter) return true;
            if (entry.key.toLowerCase().includes(filter)) return true;
            return Object.values(entry.translations).some(v => v.toLowerCase().includes(filter));
        });

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty"><i class="fas fa-check"></i><span>No keys match the current filter.</span></p>';
            return;
        }

        const locales = this.currentLocMatrix.locales;

        let html = '<table class="loc-table"><thead><tr>';
        html += '<th>Key</th>';
        locales.forEach(loc => { html += `<th>${loc.toUpperCase()}</th>`; });
        html += '<th style="text-align: right;">Action</th></tr></thead><tbody>';

        filtered.forEach(entry => {
            html += `<tr data-key="${entry.key}">`;
            html += `<td class="loc-key-cell">${entry.key}</td>`;

            locales.forEach(loc => {
                const val = entry.translations[loc] || '';
                const isMissing = entry.missingInLocales.includes(loc);
                html += `<td>
                    <input type="text" class="loc-input ${isMissing ? 'is-missing' : ''}" 
                           data-key="${entry.key}" data-locale="${loc}" value="${val.replace(/"/g, '&quot;')}" 
                           placeholder="${isMissing ? 'Missing translation' : ''}">
                </td>`;
            });

            html += `<td style="text-align: right;">
                <button class="btn btn-quiet btn-xs loc-save-row-btn" data-key="${entry.key}" type="button">
                    <i class="fas fa-save"></i> Save
                </button>
            </td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // Wire save row buttons
        container.querySelectorAll('.loc-save-row-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-key');
                const row = container.querySelector(`tr[data-key="${key}"]`);
                if (!row) return;

                const translations = {};
                row.querySelectorAll('.loc-input').forEach(input => {
                    const loc = input.getAttribute('data-locale');
                    translations[loc] = input.value;
                });

                this.sendMessage('saveLocalizationEntry', { key, translations });
            });
        });
    }

    handleLocalizationAiPrompt(prompt, targetLocale) {
        const modal = document.getElementById('locAiPromptModal');
        const textarea = document.getElementById('locAiPromptTextarea');
        if (textarea) textarea.value = prompt;
        if (modal) modal.hidden = false;
    }
};

