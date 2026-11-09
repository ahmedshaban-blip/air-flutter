window.AirFlutterDeviceEnvironmentModule = class AirFlutterDeviceEnvironmentModule {
    initDeviceEnvironment() {
        const refreshBtn = document.getElementById('deRefreshBtn');
        const slider = document.getElementById('deFontScaleSlider');
        const sliderVal = document.getElementById('deFontScaleSliderVal');
        const applyCustomFontBtn = document.getElementById('deApplyCustomFontBtn');

        if (!refreshBtn) return;

        refreshBtn.addEventListener('click', () => {
            this.sendMessage('getDeviceEnvironmentState', {});
        });

        // Font scale pills
        document.querySelectorAll('.de-font-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const scale = parseFloat(btn.getAttribute('data-scale'));
                if (!isNaN(scale)) {
                    this.sendMessage('setDeviceFontScale', { scale });
                }
            });
        });

        slider?.addEventListener('input', (e) => {
            if (sliderVal) sliderVal.textContent = parseFloat(e.target.value).toFixed(2) + '×';
        });

        applyCustomFontBtn?.addEventListener('click', () => {
            const scale = parseFloat(slider?.value || '1.0');
            this.sendMessage('setDeviceFontScale', { scale });
        });

        // Dark mode buttons
        document.getElementById('deDarkModeOnBtn')?.addEventListener('click', () => {
            this.sendMessage('setDeviceDarkMode', { enabled: true });
        });
        document.getElementById('deDarkModeOffBtn')?.addEventListener('click', () => {
            this.sendMessage('setDeviceDarkMode', { enabled: false });
        });

        // Battery pills
        document.querySelectorAll('.de-battery-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const level = parseInt(btn.getAttribute('data-level'), 10);
                const charging = btn.getAttribute('data-charging') === 'true';
                this.sendMessage('setDeviceBatteryLevel', { level, charging });
            });
        });

        document.getElementById('deResetBatteryBtn')?.addEventListener('click', () => {
            this.sendMessage('resetDeviceBattery', {});
        });

        // Locale pills
        document.querySelectorAll('.de-locale-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const locale = btn.getAttribute('data-locale');
                if (locale) this.sendMessage('setDeviceLocale', { localeTag: locale });
            });
        });

        document.getElementById('deApplyCustomLocaleBtn')?.addEventListener('click', () => {
            const val = document.getElementById('deCustomLocaleInput')?.value?.trim();
            if (val) this.sendMessage('setDeviceLocale', { localeTag: val });
        });

        // Density pills
        document.querySelectorAll('.de-density-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = btn.getAttribute('data-density');
                const dpi = d === 'reset' ? 'reset' : parseInt(d, 10);
                this.sendMessage('setDeviceDensity', { dpi });
            });
        });

        // Rotation buttons
        document.getElementById('deRotatePortraitBtn')?.addEventListener('click', () => {
            this.sendMessage('setDeviceRotation', { rotation: 0 });
        });
        document.getElementById('deRotateLandscapeBtn')?.addEventListener('click', () => {
            this.sendMessage('setDeviceRotation', { rotation: 1 });
        });
        document.getElementById('deRotateAutoBtn')?.addEventListener('click', () => {
            this.sendMessage('setDeviceRotation', { rotation: 'auto' });
        });
    }

    handleDeviceEnvironmentState(data, error) {
        const statusBar = document.getElementById('deviceEnvStatusBar');
        if (error) {
            if (statusBar) statusBar.textContent = `Status: ${error}`;
            return;
        }
        if (!data) return;

        const fontBadge = document.getElementById('deCurrentFontScaleBadge');
        if (fontBadge) fontBadge.textContent = `${data.fontScale.toFixed(2)}×`;

        const darkBadge = document.getElementById('deCurrentDarkModeBadge');
        if (darkBadge) {
            darkBadge.textContent = data.isDarkMode ? 'Night Mode (ON)' : 'Day Mode (OFF)';
            darkBadge.className = data.isDarkMode ? 'status-badge is-enabled' : 'status-badge is-disabled';
        }

        const batteryBadge = document.getElementById('deBatteryBadge');
        if (batteryBadge) {
            batteryBadge.textContent = `${data.batteryLevel}%${data.isBatteryOverridden ? ' (Simulated)' : ''}`;
            batteryBadge.className = data.batteryLevel <= 15 ? 'status-badge is-disabled' : 'status-badge is-enabled';
        }

        const localeBadge = document.getElementById('deCurrentLocaleBadge');
        if (localeBadge) localeBadge.textContent = data.locale;

        const densityBadge = document.getElementById('deDensityBadge');
        if (densityBadge) densityBadge.textContent = data.density ? `${data.density} DPI` : 'Default';

        if (statusBar) statusBar.textContent = `Updated from device at ${new Date().toLocaleTimeString()}.`;
    }
};

