const vscode = acquireVsCodeApi();

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
        function setBusy(tool, busy) {
            const button = document.querySelector('[data-tool="' + tool + '"]');
            if (button) {
                button.classList.toggle('is-busy', busy);
                button.disabled = busy;
                if (busy) {
                    button.classList.remove('is-done');
                }
            }
        }

        function markDone(tool) {
            const button = document.querySelector('[data-tool="' + tool + '"]');
            if (!button) {
                return;
            }
            button.classList.add('is-done');
            setTimeout(function () { button.classList.remove('is-done'); }, 2600);
        }

        let toolMessageTimer;

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

        [
            ['toolScreenshot', 'screenshot'],
            ['toolWake', 'wake'],
            ['toolWifi', 'fixWifi'],
            ['toolMirror', 'mirror'],
            ['toolMirrorKeys', 'mirrorKeys'],
            ['toolStopMirror', 'stopMirror'],
            ['toolSendText', 'sendText'],
            ['toolInstallApk', 'installApk'],
            ['toolWorkflow', 'workflow'],
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
                case 'toolProgress':
                    showToolMessage(message.message, true, true);
                    break;
                case 'recordingState':
                    handleRecordingState(Boolean(message.isRecording), message.duration || 0);
                    break;
                case 'toolResult':
                    showToolMessage(message.message, message.ok);
                    break;
                default:
                    break;
            }
        });

        vscode.postMessage({ command: 'ready' });
