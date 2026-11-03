(function () {
    'use strict';

    class DeepLinkStudioModule {
        initDeepLinkStudio() {
            const form = document.getElementById('deepLinkForm');
            if (!form) return;

            form.addEventListener('submit', event => {
                event.preventDefault();
                this.dispatchDeepLink();
            });
            document.getElementById('deepLinkSuggestionSelect')?.addEventListener('change', event => {
                if (event.target.value) document.getElementById('deepLinkUriInput').value = event.target.value;
            });
            document.getElementById('deepLinkSavePresetBtn')?.addEventListener('click', () => this.saveDeepLinkPreset());
            document.getElementById('deepLinkRecentList')?.addEventListener('click', event => this.useDeepLinkListItem(event));
            document.getElementById('deepLinkPresetList')?.addEventListener('click', event => this.useDeepLinkListItem(event));
            this.sendMessage('loadDeepLinkStudio', {});
        }

        dispatchDeepLink() {
            const uri = document.getElementById('deepLinkUriInput')?.value.trim() || '';
            const deviceId = document.getElementById('deepLinkDeviceSelect')?.value || '';
            const packageName = document.getElementById('deepLinkPackageInput')?.value.trim() || '';
            const button = document.getElementById('deepLinkDispatchBtn');
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Dispatching…';
            }
            this.setDeepLinkResult('pending', 'WAIT', `Dispatching ${uri || 'URI'}…`);
            this.sendMessage('dispatchDeepLink', { uri, deviceId, packageName });
        }

        saveDeepLinkPreset() {
            this.sendMessage('saveDeepLinkPreset', {
                name: document.getElementById('deepLinkPresetName')?.value.trim() || '',
                uri: document.getElementById('deepLinkUriInput')?.value.trim() || '',
                packageName: document.getElementById('deepLinkPackageInput')?.value.trim() || ''
            });
        }

        renderDeepLinkStudio(state) {
            const suggestions = state.suggestions || [];
            const select = document.getElementById('deepLinkSuggestionSelect');
            if (select) {
                select.innerHTML = suggestions.length
                    ? '<option value="">Choose a detected scheme…</option>' + suggestions.map(item => `<option value="${this.escapeHtml(item.uri)}">${this.escapeHtml(item.label)} · ${this.escapeHtml(item.uri)}</option>`).join('')
                    : '<option value="">No links detected in manifest</option>';
            }
            this.renderDeepLinkRecent(state.recentUris || []);
            this.renderDeepLinkPresets(state.presets || []);
        }

        updateDeepLinkDevices(devices) {
            const select = document.getElementById('deepLinkDeviceSelect');
            if (!select) return;
            const selected = select.value;
            const online = (devices || []).filter(device => device.status === 'online');
            select.innerHTML = '<option value="">Use active device</option>' + online.map(device =>
                `<option value="${this.escapeHtml(device.id)}">${this.escapeHtml(device.name)} · ${this.escapeHtml(device.id)}</option>`
            ).join('');
            if (online.some(device => device.id === selected)) select.value = selected;
        }

        renderDeepLinkRecent(uris) {
            const list = document.getElementById('deepLinkRecentList');
            if (!list) return;
            list.innerHTML = uris.length
                ? uris.map(uri => `<button class="deep-link-item" type="button" data-link-uri="${this.escapeHtml(uri)}"><i class="fas fa-clock-rotate-left"></i><span>${this.escapeHtml(uri)}</span></button>`).join('')
                : '<p class="empty">No links dispatched yet</p>';
        }

        renderDeepLinkPresets(presets) {
            this.deepLinkPresets = presets;
            const list = document.getElementById('deepLinkPresetList');
            if (!list) return;
            list.innerHTML = presets.length ? presets.map(preset => `
                <div class="deep-link-preset">
                    <button class="deep-link-item" type="button" data-link-uri="${this.escapeHtml(preset.uri)}" data-link-package="${this.escapeHtml(preset.packageName || '')}">
                        <i class="fas fa-bookmark"></i><span><strong>${this.escapeHtml(preset.name)}</strong><small>${this.escapeHtml(preset.uri)}</small></span>
                    </button>
                    <button class="icon-btn icon-btn-danger" type="button" data-delete-preset="${this.escapeHtml(preset.name)}" title="Delete preset" aria-label="Delete ${this.escapeHtml(preset.name)}"><i class="fas fa-trash"></i></button>
                </div>`).join('') : '<p class="empty">No saved presets</p>';
        }

        useDeepLinkListItem(event) {
            const deleteButton = event.target.closest('[data-delete-preset]');
            if (deleteButton) {
                this.sendMessage('deleteDeepLinkPreset', { name: deleteButton.dataset.deletePreset });
                return;
            }
            const item = event.target.closest('[data-link-uri]');
            if (!item) return;
            document.getElementById('deepLinkUriInput').value = item.dataset.linkUri || '';
            if (item.dataset.linkPackage !== undefined) document.getElementById('deepLinkPackageInput').value = item.dataset.linkPackage;
            document.getElementById('deepLinkUriInput').focus();
        }

        handleDeepLinkDispatchResult(result, recentUris) {
            this.resetDeepLinkDispatchButton();
            this.renderDeepLinkRecent(recentUris || []);
            this.setDeepLinkResult(result.ok ? 'success' : 'error', result.ok ? 'OPEN' : 'MISS', result.summary);
        }

        handleDeepLinkDispatchError(message) {
            this.resetDeepLinkDispatchButton();
            this.setDeepLinkResult('error', 'ERR', message || 'Intent dispatch failed.');
        }

        resetDeepLinkDispatchButton() {
            const button = document.getElementById('deepLinkDispatchBtn');
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-paper-plane"></i> Dispatch to Phone';
            }
        }

        setDeepLinkResult(state, mark, message) {
            const result = document.getElementById('deepLinkResult');
            if (!result) return;
            result.dataset.state = state;
            result.innerHTML = `<span class="deep-link-result-mark">${this.escapeHtml(mark)}</span><span>${this.escapeHtml(message)}</span>`;
        }
    }

    window.AirFlutterDeepLinkStudioModule = DeepLinkStudioModule;
})();
