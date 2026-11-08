window.AirFlutterDebugOverlaysModule = class AirFlutterDebugOverlaysModule {
    initDebugOverlays() {
        const modal = document.getElementById('debugOverlaysModal');
        if (!modal) return;

        const close = () => { modal.hidden = true; };
        document.getElementById('closeDebugOverlaysModalBtn')?.addEventListener('click', close);

        // Toggle buttons
        modal.querySelectorAll('[data-toggle-overlay]').forEach(btn => {
            btn.addEventListener('click', () => {
                const overlay = btn.getAttribute('data-toggle-overlay');
                this.sendMessage('toggleDebugOverlay', { overlay });
            });
        });

        // Reset all
        document.getElementById('resetOverlaysBtn')?.addEventListener('click', () => {
            this.sendMessage('resetDebugOverlays', {});
        });
    }

    openDebugOverlaysModal() {
        const modal = document.getElementById('debugOverlaysModal');
        if (!modal) return;
        modal.hidden = false;
        this.sendMessage('getDebugOverlaysState', {});
    }

    handleDebugOverlaysState(state) {
        if (!state) return;
        const modal = document.getElementById('debugOverlaysModal');
        if (!modal) return;

        Object.keys(state).forEach(key => {
            const card = modal.querySelector(`[data-overlay="${key}"]`);
            if (card) {
                const isActive = Boolean(state[key]);
                card.classList.toggle('is-active', isActive);
                const pill = card.querySelector('.overlay-status-pill');
                if (pill) {
                    pill.textContent = isActive ? 'ON' : 'OFF';
                    pill.classList.toggle('is-active', isActive);
                }
            }
        });
    }
};

