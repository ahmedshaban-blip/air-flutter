// Mirroring Setup Module — panel-side audio route + performance chooser
window.AirFlutterMirrorSetupModule = class AirFlutterMirrorSetupModule {
    initMirrorSetupModal() {
        const modal = document.getElementById('mirrorSetupModal');
        if (!modal) return;

        this.pendingMirrorTarget = null;
        const closeModal = () => {
            modal.hidden = true;
            this.pendingMirrorTarget = null;
        };

        document.getElementById('closeMirrorSetupModalBtn')?.addEventListener('click', closeModal);
        document.getElementById('cancelMirrorSetupBtn')?.addEventListener('click', closeModal);
        modal.addEventListener('click', event => {
            if (event.target === modal) closeModal();
        });
        document.getElementById('startMirrorSessionBtn')?.addEventListener('click', () => {
            this.startMirrorSession(modal);
        });

        this.loadMirrorSetupPreferences();
    }

    openMirrorSetup(deviceId, deviceName, mode) {
        const modal = document.getElementById('mirrorSetupModal');
        if (!modal || !deviceId) return;
        this.pendingMirrorTarget = { deviceId, deviceName, mode };
        document.getElementById('mirrorSetupModalTitle').textContent = mode === 'keyboard'
            ? 'Screen Off + Keyboard'
            : 'Start Mirroring';
        document.getElementById('mirrorSetupDeviceName').textContent = deviceName || deviceId;
        modal.hidden = false;
    }
    startMirrorSession(modal = document.getElementById('mirrorSetupModal')) {
        const target = this.pendingMirrorTarget;
        if (!target) return;

        const audioRoute = this.readRadio('panelMirrorAudio') || 'computer';
        const performanceProfile = this.readRadio('panelMirrorProfile') || 'balanced';

        try {
            localStorage.setItem('airFlutterMirrorSetup', JSON.stringify({ audioRoute, performanceProfile }));
        } catch {
            // Persistence is a convenience; the session starts regardless.
        }

        if (modal) modal.hidden = true;
        this.pendingMirrorTarget = null;
        this.addStatusMessage(`Starting mirroring for ${target.deviceName || target.deviceId}…`, 'info');
        this.sendMessage('mirrorDevice', {
            deviceId: target.deviceId,
            mode: target.mode,
            audioRoute,
            performanceProfile
        });
    }

    loadMirrorSetupPreferences() {
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem('airFlutterMirrorSetup') || '{}') || {};
        } catch {
            saved = {};
        }
        this.selectRadio('panelMirrorAudio', saved.audioRoute === 'phone' ? 'phone' : 'computer');
        const legacyProfiles = { quality: 'ultra' };
        const performance = legacyProfiles[saved.performanceProfile] || saved.performanceProfile;
        this.selectRadio('panelMirrorProfile', ['speed', 'balanced', 'ultra'].includes(performance) ? performance : 'balanced');
    }

    selectRadio(name, value) {
        const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (input) input.checked = true;
    }

    readRadio(name) {
        return document.querySelector(`input[name="${name}"]:checked`)?.value;
    }
};
