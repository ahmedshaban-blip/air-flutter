window.AirFlutterBuildRunnerModule = class AirFlutterBuildRunnerModule {
    initBuildRunner() {
        const runBuildBtn = document.getElementById('brRunBuildBtn');
        const runWatchBtn = document.getElementById('brRunWatchBtn');
        const stopBtn = document.getElementById('brStopBtn');
        const cleanCacheBtn = document.getElementById('brCleanCacheBtn');
        const openTerminalBtn = document.getElementById('brOpenTerminalBtn');
        const clearLogBtn = document.getElementById('brClearLogBtn');
        const deleteConflictsCb = document.getElementById('brDeleteConflictsCheckbox');
        const filterInput = document.getElementById('brFilterInput');
        const logPre = document.getElementById('brOutputLog');

        if (!runBuildBtn) return;

        runBuildBtn.addEventListener('click', () => {
            this.sendMessage('startBuildRunner', {
                watch: false,
                deleteConflictingOutputs: deleteConflictsCb ? deleteConflictsCb.checked : true,
                buildFilter: filterInput ? filterInput.value.trim() : ''
            });
        });

        runWatchBtn?.addEventListener('click', () => {
            this.sendMessage('startBuildRunner', {
                watch: true,
                deleteConflictingOutputs: deleteConflictsCb ? deleteConflictsCb.checked : true,
                buildFilter: filterInput ? filterInput.value.trim() : ''
            });
        });

        stopBtn?.addEventListener('click', () => {
            this.sendMessage('stopBuildRunner', {});
        });

        cleanCacheBtn?.addEventListener('click', () => {
            this.sendMessage('clearBuildRunnerCache', {});
        });

        openTerminalBtn?.addEventListener('click', () => {
            this.sendMessage('openBuildRunnerTerminal', {
                watch: false,
                buildFilter: filterInput ? filterInput.value.trim() : ''
            });
        });

        clearLogBtn?.addEventListener('click', () => {
            if (logPre) logPre.textContent = 'Output cleared.\n';
        });
    }

    handleBuildRunnerLog(chunk, isError) {
        const logPre = document.getElementById('brOutputLog');
        if (!logPre) return;
        logPre.textContent += chunk;
        logPre.scrollTop = logPre.scrollHeight;
    }

    handleBuildRunnerStatus(status) {
        const badge = document.getElementById('brStatusBadge');
        const runBuildBtn = document.getElementById('brRunBuildBtn');
        const runWatchBtn = document.getElementById('brRunWatchBtn');
        const stopBtn = document.getElementById('brStopBtn');

        if (!badge) return;

        if (status.isRunning) {
            badge.className = 'status-badge is-enabled';
            badge.textContent = status.isWatching ? 'WATCHING' : 'BUILDING';
            if (runBuildBtn) runBuildBtn.disabled = true;
            if (runWatchBtn) runWatchBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
        } else {
            badge.className = 'status-badge is-disabled';
            badge.textContent = 'IDLE';
            if (runBuildBtn) runBuildBtn.disabled = false;
            if (runWatchBtn) runWatchBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
        }
    }
};

