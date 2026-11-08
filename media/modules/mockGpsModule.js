window.AirFlutterMockGpsModule = class AirFlutterMockGpsModule {
    initMockGps() {
        const modal = document.getElementById('mockGpsModal');
        if (!modal) return;

        const close = () => { modal.hidden = true; };
        document.getElementById('closeMockGpsModalBtn')?.addEventListener('click', close);

        // City preset buttons
        modal.querySelectorAll('.gps-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lat = btn.getAttribute('data-lat');
                const lon = btn.getAttribute('data-lon');
                const latInput = document.getElementById('gpsLatInput');
                const lonInput = document.getElementById('gpsLonInput');
                if (latInput) latInput.value = lat;
                if (lonInput) lonInput.value = lon;
            });
        });

        // Set location button
        document.getElementById('gpsSetLocationBtn')?.addEventListener('click', () => {
            const lat = parseFloat(document.getElementById('gpsLatInput')?.value || '');
            const lon = parseFloat(document.getElementById('gpsLonInput')?.value || '');
            const alt = parseFloat(document.getElementById('gpsAltInput')?.value || '0');

            if (isNaN(lat) || isNaN(lon)) {
                this.showToast('Please enter valid numeric latitude and longitude.', 'error');
                return;
            }

            this.lastAppliedGps = { lat, lon, alt };
            this.sendMessage('setMockGpsLocation', {
                lat,
                lon,
                altitude: alt
            });
        });

        // Reset button
        document.getElementById('gpsResetBtn')?.addEventListener('click', () => {
            const latInput = document.getElementById('gpsLatInput');
            const lonInput = document.getElementById('gpsLonInput');
            const altInput = document.getElementById('gpsAltInput');
            if (latInput) latInput.value = '';
            if (lonInput) lonInput.value = '';
            if (altInput) altInput.value = '0';

            const prompt = document.getElementById('gpsSaveLocationPrompt');
            if (prompt) prompt.hidden = true;

            const card = document.getElementById('gpsStatusCard');
            if (card) card.hidden = true;

            this.sendMessage('resetMockGps', {});
            this.showToast('Mock GPS reset to default.', 'info');
        });

        // Confirm Save Preset button
        document.getElementById('gpsConfirmSaveBtn')?.addEventListener('click', () => {
            if (!this.lastAppliedGps) return;
            const nameInput = document.getElementById('gpsCustomLocationName');
            const rawName = nameInput?.value?.trim();
            const name = rawName || `Location (${this.lastAppliedGps.lat}, ${this.lastAppliedGps.lon})`;

            this.saveCustomGpsPreset({
                name,
                lat: this.lastAppliedGps.lat,
                lon: this.lastAppliedGps.lon,
                altitude: this.lastAppliedGps.alt
            });

            const prompt = document.getElementById('gpsSaveLocationPrompt');
            if (prompt) prompt.hidden = true;
            if (nameInput) nameInput.value = '';

            this.showToast(`Saved preset: "${name}"`, 'success');
            this.renderCustomGpsPresets();
        });

        // Dismiss / Cancel Save button
        const hidePrompt = () => {
            const prompt = document.getElementById('gpsSaveLocationPrompt');
            if (prompt) prompt.hidden = true;
        };
        document.getElementById('gpsDismissSaveBtn')?.addEventListener('click', hidePrompt);
        document.getElementById('gpsCancelSaveBtn')?.addEventListener('click', hidePrompt);

        this.renderCustomGpsPresets();
    }

    openMockGpsModal() {
        const modal = document.getElementById('mockGpsModal');
        if (!modal) return;
        modal.hidden = false;
        this.renderCustomGpsPresets();
    }

    getSavedGpsPresets() {
        if (Array.isArray(this._savedPresetsCache)) {
            return this._savedPresetsCache;
        }
        try {
            const storage = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
            const raw = storage?.getItem('airFlutterSavedGpsLocations');
            this._savedPresetsCache = raw ? JSON.parse(raw) : [];
            return this._savedPresetsCache;
        } catch {
            this._savedPresetsCache = this._savedPresetsCache || [];
            return this._savedPresetsCache;
        }
    }

    saveCustomGpsPreset(preset) {
        const presets = this.getSavedGpsPresets();
        presets.push(preset);
        this._savedPresetsCache = presets;
        try {
            const storage = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
            storage?.setItem('airFlutterSavedGpsLocations', JSON.stringify(presets));
        } catch {
            // ignore storage errors
        }
    }

    removeCustomGpsPreset(index) {
        const presets = this.getSavedGpsPresets();
        if (index >= 0 && index < presets.length) {
            presets.splice(index, 1);
            this._savedPresetsCache = presets;
            try {
                const storage = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
                storage?.setItem('airFlutterSavedGpsLocations', JSON.stringify(presets));
            } catch {
                // ignore
            }
            this.renderCustomGpsPresets();
        }
    }

    renderCustomGpsPresets() {
        const section = document.getElementById('gpsCustomPresetsSection');
        const grid = document.getElementById('gpsCustomPresetsGrid');
        if (!section || !grid) return;

        const presets = this.getSavedGpsPresets();
        if (presets.length === 0) {
            section.hidden = true;
            grid.innerHTML = '';
            return;
        }

        section.hidden = false;
        grid.innerHTML = '';

        presets.forEach((p, idx) => {
            const wrap = document.createElement('div');
            wrap.className = 'gps-custom-preset-chip';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-quiet gps-custom-btn';
            btn.innerHTML = `<i class="fas fa-location-dot"></i> ${p.name}`;
            btn.addEventListener('click', () => {
                const latInput = document.getElementById('gpsLatInput');
                const lonInput = document.getElementById('gpsLonInput');
                const altInput = document.getElementById('gpsAltInput');
                if (latInput) latInput.value = p.lat;
                if (lonInput) lonInput.value = p.lon;
                if (altInput) altInput.value = p.altitude || 0;
            });

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'gps-preset-del-btn';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Delete saved location';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeCustomGpsPreset(idx);
            });

            wrap.appendChild(btn);
            wrap.appendChild(delBtn);
            grid.appendChild(wrap);
        });
    }

    handleMockGpsState(data) {
        const card = document.getElementById('gpsStatusCard');
        const text = document.getElementById('gpsStatusText');
        const icon = document.getElementById('gpsStatusIcon');
        if (!card || !text || !icon) return;

        card.hidden = false;
        if (data.status === 'loading') {
            card.className = 'gps-status-card is-loading';
            icon.className = 'fas fa-spinner fa-spin';
            text.textContent = data.message || 'Applying GPS location…';
        } else if (data.status === 'success') {
            card.className = 'gps-status-card is-success';
            icon.className = 'fas fa-circle-check';
            text.textContent = data.result?.message || 'Location updated successfully!';

            // Prompt user if they want to save this location
            if (this.lastAppliedGps) {
                const prompt = document.getElementById('gpsSaveLocationPrompt');
                const nameInput = document.getElementById('gpsCustomLocationName');
                if (prompt) {
                    prompt.hidden = false;
                    if (nameInput) {
                        nameInput.value = '';
                        nameInput.focus?.();
                    }
                }
            }
        } else if (data.status === 'error') {
            card.className = 'gps-status-card is-error';
            icon.className = 'fas fa-circle-xmark';
            text.textContent = data.error || 'Failed to update location.';
        }
    }
};

