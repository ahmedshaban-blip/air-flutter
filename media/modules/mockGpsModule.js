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

            this.sendMessage('setMockGpsLocation', {
                lat,
                lon,
                altitude: alt
            });
        });
    }

    openMockGpsModal() {
        const modal = document.getElementById('mockGpsModal');
        if (!modal) return;
        modal.hidden = false;
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
        } else if (data.status === 'error') {
            card.className = 'gps-status-card is-error';
            icon.className = 'fas fa-circle-xmark';
            text.textContent = data.error || 'Failed to update location.';
        }
    }
};

