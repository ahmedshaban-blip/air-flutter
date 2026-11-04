const vscode = acquireVsCodeApi();
        const viewState = vscode.getState() || {};

        const MAX_ROWS = 1200;
        const lines = [];
        let activeFilter = 'all';
        let searchText = '';
        let follow = true;

        const logView = document.getElementById('logView');
        const logCount = document.getElementById('logCount');
        const logSource = document.getElementById('logSource');
        const logToggle = document.getElementById('logToggle');
        const logPlaceholder = document.getElementById('logPlaceholder');
        const toolMessage = document.getElementById('toolMessage');
        const ICON = { verbose: 'V', debug: 'D', info: 'I', warn: 'W', error: 'E' };

        function matches(line) {
            if (activeFilter === 'flutter' && !/flutter|dart/i.test(line.tag)) {
                return false;
            }
            if (activeFilter === 'errors' && line.level !== 'error') {
                return false;
            }
            if (activeFilter === 'warn' && line.level !== 'warn' && line.level !== 'error') {
                return false;
            }
            if (searchText && !(line.text + ' ' + line.tag).toLowerCase().includes(searchText)) {
                return false;
            }
            return true;
        }

        function row(line) {
            const element = document.createElement('div');
            element.className = 'sf-log-line lvl-' + line.level;
            const time = document.createElement('span');
            time.className = 'sf-log-time';
            time.textContent = line.time.slice(6);
            const level = document.createElement('span');
            level.className = 'sf-log-level';
            level.textContent = ICON[line.level] || 'I';
            const tag = document.createElement('span');
            tag.className = 'sf-log-tag';
            tag.textContent = line.tag;
            const text = document.createElement('span');
            text.className = 'sf-log-text';
            text.textContent = line.text;
            element.append(time, level, tag, text);
            return element;
        }

        // --- pause: freeze the view, keep collecting in the background ---
        let paused = false;
        let heldSince = 0;

        const logPause = document.getElementById('logPause');
        const logHold = document.getElementById('logHold');
        const logHeld = document.getElementById('logHeld');

        function setPaused(next) {
            paused = next;
            logPause.textContent = paused ? 'Resume' : 'Pause';
            logPause.setAttribute('data-paused', paused ? 'true' : 'false');
            logHold.hidden = !paused;
            if (paused) {
                heldSince = lines.length;
            } else {
                // Catch up on everything that arrived while frozen.
                render();
            }
        }

        logPause.addEventListener('click', function () {
            setPaused(!paused);
        });

        function render() {
            const visible = lines.filter(matches).slice(-MAX_ROWS);
            logView.replaceChildren();
            if (visible.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'sf-log-empty';
                empty.textContent = lines.length === 0
                    ? 'Idle. Press Start to stream logcat.'
                    : 'Nothing matches this filter.';
                logView.append(empty);
            } else {
                const fragment = document.createDocumentFragment();
                visible.forEach(line => fragment.append(row(line)));
                logView.append(fragment);
            }
            logCount.textContent = visible.length + (visible.length === 1 ? ' line' : ' lines');
            if (logHeld) {
                logHeld.textContent = String(Math.max(0, lines.length - heldSince));
            }
            if (follow && !paused && visible.length > 0) {
                logView.scrollTop = logView.scrollHeight;
            }
        }

        function push(incoming) {
            const wasAtBottom = logView.scrollHeight - logView.scrollTop - logView.clientHeight < 40;
            incoming.forEach(line => lines.push(line));
            if (lines.length > MAX_ROWS * 2) {
                lines.splice(0, lines.length - MAX_ROWS * 2);
            }
            if (paused) {
                // Keep the screen still; only the pending counter moves.
                if (logHeld) {
                    logHeld.textContent = String(Math.max(0, lines.length - heldSince));
                }
                return;
            }
            appendRows(incoming);
            if (follow && wasAtBottom) {
                logView.scrollTop = logView.scrollHeight;
            }
        }

        /**
         * Appends to the live view instead of rebuilding it. Rebuilding on every
         * batch made the container look stale mid-frame at very high log rates.
         */
        function appendRows(incoming) {
            const visible = incoming.filter(matches);
            if (visible.length === 0) {
                return;
            }
            const empty = logView.querySelector('.sf-log-empty');
            if (empty) {
                empty.remove();
            }
            const fragment = document.createDocumentFragment();
            visible.slice(-MAX_ROWS).forEach(line => fragment.append(row(line)));
            logView.append(fragment);

            // Trim from the top so the DOM never grows past the window.
            while (logView.childElementCount > MAX_ROWS) {
                logView.removeChild(logView.firstElementChild);
            }
            logCount.textContent = logView.childElementCount +
                (logView.childElementCount === 1 ? ' line' : ' lines');
        }

        // --- launcher buttons ---
        document.querySelectorAll('[data-run]').forEach(function (button) {
            button.addEventListener('click', function () {
                vscode.postMessage({ command: 'run', id: button.getAttribute('data-run') });
            });
        });
        document.querySelectorAll('[data-open]').forEach(function (button) {
            button.addEventListener('click', function () {
                vscode.postMessage({ command: 'open', url: button.getAttribute('data-open') });
            });
        });

        // --- log controls ---
        document.querySelectorAll('.sf-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                activeFilter = tab.getAttribute('data-filter');
                document.querySelectorAll('.sf-tab').forEach(function (other) {
                    other.classList.toggle('is-active', other === tab);
                });
                if (paused) {
                    // Changing the filter is a read action: resume so the result
                    // is visible instead of silently buffering.
                    setPaused(false);
                }
                render();
            });
        });

        document.getElementById('logSearch').addEventListener('input', function (event) {
            searchText = event.target.value.trim().toLowerCase();
            render();
        });

        document.getElementById('logFollow').addEventListener('change', function (event) {
            follow = event.target.checked;
            if (follow && !paused) {
                logView.scrollTop = logView.scrollHeight;
            }
        });

        logToggle.addEventListener('click', function () {
            const running = logToggle.getAttribute('data-running') === 'true';
            vscode.postMessage({
                command: running ? 'stopLogcat' : 'startLogcat',
                priority: document.getElementById('logVerbose').checked ? 'verbose' : 'normal'
            });
        });

        document.getElementById('logVerbose').addEventListener('change', function (event) {
            vscode.postMessage({
                command: 'setPriority',
                priority: event.target.checked ? 'verbose' : 'normal'
            });
        });

        document.getElementById('copyLogBtn').addEventListener('click', function () {
            const text = Array.from(logView.querySelectorAll('.sf-log-line'))
                .map(function (element) { return element.textContent; })
                .join('\\n');
            vscode.postMessage({ command: 'copyLog', text: text });
        });

        document.getElementById('openLogBtn').addEventListener('click', function () {
            vscode.postMessage({ command: 'openLogFile' });
        });

        // --- device card ---
        function renderInfo(info) {
            const card = document.getElementById('deviceCard');
            if (!info) {
                card.setAttribute('data-state', 'empty');
                document.getElementById('deviceEmpty').hidden = false;
                document.getElementById('deviceBody').hidden = true;
                return;
            }
            card.setAttribute('data-state', 'ready');
            document.getElementById('deviceEmpty').hidden = true;
            document.getElementById('deviceBody').hidden = false;

            document.getElementById('devModel').textContent = info.model || 'Android device';
            const androidValue = (info.androidVersion || '?') +
                (info.apiLevel ? ' / API ' + info.apiLevel : '');
            document.getElementById('devAndroid').textContent = androidValue;
            const networkValue = info.wifiSsid
                ? info.networkType + ' / ' + info.wifiSsid
                : info.networkType;
            document.getElementById('devNetwork').textContent = networkValue;
            document.getElementById('devIp').textContent = info.ipAddress || 'not reported';
            document.getElementById('devScreen').textContent = info.screenOn ? 'awake' : 'asleep';
            const serialLine = document.getElementById('devSerial');
            serialLine.textContent = info.serial;
            serialLine.title = info.serial;

            const level = info.batteryLevel;
            const fill = document.getElementById('battFill');
            if (level === null || level === undefined) {
                fill.style.width = '0%';
                document.getElementById('battValue').textContent = '--%';
            } else {
                fill.style.width = Math.max(0, Math.min(100, level)) + '%';
                fill.classList.toggle('is-low', level <= 15 && info.batteryStatus === 'discharging');
                document.getElementById('battValue').textContent = level + '%';
            }

            document.getElementById('battState').textContent = info.batteryStatus || 'unknown';
            document.getElementById('battTemp').textContent = info.batteryTemperature
                ? info.batteryTemperature.toFixed(1) + ' C'
                : 'n/a';
        }

        document.getElementById('refreshInfoBtn').addEventListener('click', function () {
            vscode.postMessage({ command: 'refreshInfo' });
        });

        // --- tools ---
        const toolGroupState = viewState.toolGroups || {};
        document.querySelectorAll('[data-tool-group]').forEach(function (group) {
            const key = group.getAttribute('data-tool-group');
            if (Object.prototype.hasOwnProperty.call(toolGroupState, key)) {
                group.open = Boolean(toolGroupState[key]);
            }
            group.addEventListener('toggle', function () {
                toolGroupState[key] = group.open;
                viewState.toolGroups = toolGroupState;
                vscode.setState(viewState);
            });
        });

        function findToolButtons(tool) {
            if (tool === 'wipe') {
                return Array.from(document.querySelectorAll('[data-wipe]'));
            }
            if (tool === 'localhostBridge') {
                return Array.from(document.querySelectorAll('[data-bridge-port], [data-bridge-action]'));
            }
            const button = document.querySelector('[data-tool="' + tool + '"]');
            return button ? [button] : [];
        }

        function setBusy(tool, busy) {
            findToolButtons(tool).forEach(function (button) {
                button.classList.toggle('is-busy', busy);
                button.disabled = busy;
                if (busy) {
                    button.classList.remove('is-done');
                }
            });
        }

        function markDone(tool) {
            findToolButtons(tool).forEach(function (button) {
                button.classList.add('is-done');
                setTimeout(function () { button.classList.remove('is-done'); }, 2600);
            });
        }

        let toolMessageTimer;
        const activeSidebarOperations = new Map();

        function sidebarOperationLabel(operation) {
            const labels = {
                ready: 'Loading device state…',
                refreshInfo: 'Refreshing device information…',
                startLogcat: 'Starting Logcat…',
                stopLogcat: 'Stopping Logcat…',
                setPriority: 'Updating Logcat priority…',
                openLogFile: 'Opening log file…',
                screenshot: 'Capturing screenshot…',
                wakeScreen: 'Waking phone display…',
                toggleScreenPower: 'Updating phone display…',
                startMirror: 'Starting screen mirroring…',
                fixWifi: 'Repairing wireless connection…',
                stopMirror: 'Stopping screen mirroring…',
                installApk: 'Installing APK…',
                sendText: 'Sending text to phone…',
                workflow: 'Opening workflow generator…',
                signingKey: 'Opening signing key tool…',
                record: 'Updating screen recording…',
                flavors: 'Opening flavors manager…',
                proxy: 'Reading network settings…',
                agentEngine: 'Opening agent scaffolder…',
                compatDoctor: 'Scanning compatibility…',
                wipeApp: 'Resetting app storage…',
                pickWipePackage: 'Loading app packages…',
                applyLocalhostBridge: 'Linking localhost port…',
                refreshLocalhostBridge: 'Refreshing localhost ports…',
                removeLocalhostBridge: 'Removing localhost port…',
                removeAllLocalhostBridges: 'Removing localhost ports…'
            };
            return labels[operation] || 'Working…';
        }

        function setSidebarOperation(message) {
            const operation = String(message.operation || 'operation');
            if (message.loading) activeSidebarOperations.set(operation, operation);
            else activeSidebarOperations.delete(operation);
            const indicator = document.getElementById('sidebarOperationIndicator');
            const label = document.getElementById('sidebarOperationLabel');
            if (!indicator || !label) return;
            const active = Array.from(activeSidebarOperations.values()).at(-1);
            indicator.hidden = !active;
            if (active) label.textContent = sidebarOperationLabel(active);
        }

        function showToolMessage(message, ok, sticky) {
            if (toolMessageTimer) {
                clearTimeout(toolMessageTimer);
                toolMessageTimer = undefined;
            }
            toolMessage.hidden = !message;
            toolMessage.textContent = message || '';
            toolMessage.classList.toggle('is-error', ok === false);
            if (message && !sticky) {
                toolMessageTimer = setTimeout(function () {
                    toolMessage.hidden = true;
                    toolMessage.textContent = '';
                }, 6000);
            }
        }

        let wasRecording = false;
        function formatDuration(sec) {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        }

        function handleRecordingState(isRecording, duration) {
            const button = document.getElementById('toolRecord');
            if (!button) {
                return;
            }
            const nameEl = button.querySelector('.sf-tool-name');
            const noteEl = button.querySelector('.sf-tool-note');

            if (isRecording) {
                wasRecording = true;
                button.classList.add('is-recording');
                button.title = 'Recording in progress. Click to stop and save MP4';
                if (nameEl) {
                    nameEl.textContent = '⏹ Stop Rec';
                }
                if (noteEl) {
                    noteEl.textContent = 'REC ' + formatDuration(duration);
                }
            } else {
                if (wasRecording) {
                    wasRecording = false;
                    markDone('record');
                    showToolMessage('🎬 Recording saved', true);
                }
                button.classList.remove('is-recording');
                button.title = 'Record device screen to MP4';
                if (nameEl) {
                    nameEl.textContent = 'Record Video';
                }
                if (noteEl) {
                    noteEl.textContent = 'start MP4 recording';
                }
            }
        }

        let mirroringState = { isMirroring: false, displayOff: false };

        function renderScreenPowerAction(state) {
            mirroringState = state || mirroringState;
            const button = document.getElementById('toolWake');
            const name = button && button.querySelector('.sf-tool-name');
            const note = button && button.querySelector('.sf-tool-note');
            if (!button || !name || !note) {
                return;
            }
            const shouldTurnOff = mirroringState.isMirroring && !mirroringState.displayOff;
            name.textContent = shouldTurnOff ? 'Turn display off' : 'Wake screen';
            note.textContent = shouldTurnOff ? 'keep mirror running' : 'power on display';
            button.title = shouldTurnOff
                ? 'Turn off the physical phone display and keep mirroring'
                : 'Wake up the physical phone display';
            button.setAttribute('data-display-action', shouldTurnOff ? 'off' : 'wake');
        }

        document.getElementById('toolWake').addEventListener('click', function () {
            showToolMessage('', true);
            vscode.postMessage({ command: 'toggleScreenPower' });
        });

        const mirrorSetup = document.getElementById('mirrorSetup');
        const savedMirrorSetup = viewState.mirrorSetup || {
            audioRoute: 'computer',
            performanceProfile: 'balanced'
        };
        // Profiles saved before the Ultra rename used the old 'quality' value.
        if (savedMirrorSetup.performanceProfile === 'quality') {
            savedMirrorSetup.performanceProfile = 'ultra';
        }
        let pendingMirrorMode = 'standard';

        function selectMirrorPreference(name, value) {
            const input = mirrorSetup.querySelector('input[name="' + name + '"][value="' + value + '"]');
            if (input) {
                input.checked = true;
            }
        }

        selectMirrorPreference('mirrorAudio', savedMirrorSetup.audioRoute);
        selectMirrorPreference('mirrorProfile', savedMirrorSetup.performanceProfile);

        function openMirrorSetup(mode) {
            pendingMirrorMode = mode;
            document.getElementById('mirrorSetupTitle').textContent = mode === 'keyboard'
                ? 'Screen off + keyboard'
                : 'Standard mirroring';
            mirrorSetup.hidden = false;
            mirrorSetup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const checked = mirrorSetup.querySelector('input:checked');
            if (checked) {
                checked.focus({ preventScroll: true });
            }
        }

        document.getElementById('toolMirror').addEventListener('click', function () {
            openMirrorSetup('standard');
        });
        document.getElementById('toolMirrorKeys').addEventListener('click', function () {
            openMirrorSetup('keyboard');
        });
        document.getElementById('mirrorSetupClose').addEventListener('click', function () {
            mirrorSetup.hidden = true;
        });
        mirrorSetup.addEventListener('submit', function (event) {
            event.preventDefault();
            const audioRoute = mirrorSetup.querySelector('input[name="mirrorAudio"]:checked').value;
            const performanceProfile = mirrorSetup.querySelector('input[name="mirrorProfile"]:checked').value;
            viewState.mirrorSetup = { audioRoute: audioRoute, performanceProfile: performanceProfile };
            vscode.setState(viewState);
            mirrorSetup.hidden = true;
            showToolMessage('Starting mirroring…', true, true);
            vscode.postMessage({
                command: 'startMirror',
                mode: pendingMirrorMode,
                audioRoute: audioRoute,
                performanceProfile: performanceProfile
            });
        });

        [
            ['toolScreenshot', 'screenshot'],
            ['toolWifi', 'fixWifi'],
            ['toolStopMirror', 'stopMirror'],
            ['toolSendText', 'sendText'],
            ['toolInstallApk', 'installApk'],
            ['toolWorkflow', 'workflow'],
            ['toolSigningKey', 'signingKey'],
            ['toolRecord', 'record'],
            ['toolFlavors', 'flavors'],
            ['toolProxy', 'proxy'],
            ['toolAgentEngine', 'agentEngine'],
            ['toolCompatDoctor', 'compatDoctor']
        ].forEach(function (pair) {
            const button = document.getElementById(pair[0]);
            if (!button) {
                return;
            }
            button.addEventListener('click', function () {
                if (pair[0] === 'toolRecord' && button.classList.contains('is-recording')) {
                    showToolMessage('⏹ Stopping recording & finalizing MP4...', true, true);
                } else {
                    showToolMessage('', true);
                }
                vscode.postMessage({ command: pair[1] });
            });
        });

        // --- deep storage & cache wiper ---
        let wipePackage = '';

        function renderWipePackage(packageId) {
            wipePackage = packageId || '';
            const line = document.getElementById('wipePackage');
            if (!line) {
                return;
            }
            if (wipePackage) {
                line.textContent = wipePackage;
                line.title = wipePackage;
                line.setAttribute('data-state', 'ready');
            } else {
                line.textContent = 'no package detected — pick one';
                line.removeAttribute('title');
                line.setAttribute('data-state', 'empty');
            }
        }

        document.querySelectorAll('[data-wipe]').forEach(function (button) {
            button.addEventListener('click', function () {
                if (!wipePackage) {
                    showToolMessage('Pick a target package first.', false, true);
                    vscode.postMessage({ command: 'pickWipePackage' });
                    return;
                }
                showToolMessage('', true);
                vscode.postMessage({
                    command: 'wipeApp',
                    operation: button.getAttribute('data-wipe'),
                    packageId: wipePackage
                });
            });
        });

        const pickWipeBtn = document.getElementById('pickWipePackageBtn');
        if (pickWipeBtn) {
            pickWipeBtn.addEventListener('click', function () {
                vscode.postMessage({ command: 'pickWipePackage' });
            });
        }

        // --- Localhost Bridge ---
        document.querySelectorAll('[data-bridge-port]').forEach(function (button) {
            button.addEventListener('click', function () {
                vscode.postMessage({
                    command: 'applyLocalhostBridge',
                    port: Number(button.getAttribute('data-bridge-port'))
                });
            });
        });

        document.getElementById('bridgeCustomForm').addEventListener('submit', function (event) {
            event.preventDefault();
            const input = document.getElementById('bridgeCustomPort');
            const port = Number(input.value);
            if (!Number.isInteger(port) || port < 1 || port > 65535) {
                showToolMessage('Enter a whole port number from 1 to 65535.', false, true);
                return;
            }
            vscode.postMessage({ command: 'applyLocalhostBridge', port: port });
        });

        document.getElementById('refreshBridgeBtn').addEventListener('click', function () {
            vscode.postMessage({ command: 'refreshLocalhostBridge' });
        });

        document.getElementById('removeAllBridgesBtn').addEventListener('click', function () {
            vscode.postMessage({ command: 'removeAllLocalhostBridges' });
        });

        document.getElementById('bridgeRules').addEventListener('click', function (event) {
            const button = event.target.closest('[data-remove-bridge-port]');
            if (button) {
                vscode.postMessage({
                    command: 'removeLocalhostBridge',
                    port: Number(button.getAttribute('data-remove-bridge-port'))
                });
            }
        });

        function renderLocalhostBridge(deviceId, rules) {
            document.getElementById('bridgeDevice').textContent = deviceId || 'No online phone';
            const list = document.getElementById('bridgeRules');
            list.replaceChildren();
            if (!rules.length) {
                const empty = document.createElement('p');
                empty.className = 'sf-empty';
                empty.textContent = 'No active forwards';
                list.append(empty);
            } else {
                rules.forEach(function (rule) {
                    const row = document.createElement('div');
                    row.className = 'sf-bridge-rule';
                    const port = document.createElement('span');
                    port.textContent = 'tcp:' + rule.port + ' → tcp:' + rule.port;
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.setAttribute('data-remove-bridge-port', String(rule.port));
                    remove.textContent = 'Unlink';
                    row.append(port, remove);
                    list.append(row);
                });
            }
            document.getElementById('removeAllBridgesBtn').disabled = !deviceId || !rules.length;
        }

        // --- host messages ---
        window.addEventListener('message', function (event) {
            const message = event.data || {};
            switch (message.command) {
                case 'deviceInfo':
                    renderInfo(message.info);
                    break;
                case 'logLines':
                    push(message.lines || []);
                    break;
                case 'logStatus':
                    logToggle.textContent = message.running ? 'Stop' : 'Start';
                    logToggle.setAttribute('data-running', message.running ? 'true' : 'false');
                    if (!message.running && paused) {
                        // The stream is gone; nothing more can arrive.
                        setPaused(false);
                    }
                    logSource.textContent = (message.file ? message.file.split(/[\\\\/]/).pop() : 'no file') +
                        (message.priority === 'verbose' ? ' / verbose' : '');
                    document.getElementById('logVerbose').checked = message.priority === 'verbose';
                    if (Array.isArray(message.lines) && lines.length === 0) {
                        push(message.lines);
                    }
                    if (message.message) {
                        showToolMessage(message.message, false, true);
                    } else if (message.running) {
                        // A clean start clears whatever the last attempt left behind.
                        showToolMessage('', true);
                    }
                    break;
                case 'toolBusy':
                    setBusy(message.tool, Boolean(message.busy));
                    if (!message.busy) {
                        markDone(message.tool);
                    }
                    break;
                case 'sidebarOperation':
                    setSidebarOperation(message);
                    break;
                case 'toolProgress':
                    showToolMessage(message.message, true, true);
                    break;
                case 'recordingState':
                    handleRecordingState(Boolean(message.isRecording), message.duration || 0);
                    break;
                case 'mirroringState':
                    renderScreenPowerAction({
                        isMirroring: Boolean(message.isMirroring),
                        displayOff: Boolean(message.displayOff),
                        serial: message.serial || ''
                    });
                    break;
                case 'wipeState':
                    renderWipePackage(message.packageId || '');
                    break;
                case 'localhostBridgeState':
                    renderLocalhostBridge(message.deviceId || '', message.rules || []);
                    break;
                case 'toolResult':
                    showToolMessage(message.message, message.ok);
                    break;
                default:
                    break;
            }
        });

        vscode.postMessage({ command: 'ready' });
