// Air Flutter — Panel navigation (grouped tabs + quick jump).
//
// The panel exposes ten tools. This module keeps every one of them reachable in
// one step: the tab strip is grouped into Device / Build / Ship, and a "jump"
// field filters across all tools by name and aliases, landing on a match with a
// click or Enter. Keyboard: "/" focuses the field, Escape clears it.
//
// It reuses the existing tab contract: selecting a tool clicks the matching
// [data-panel-tab] button, so AssetAssistantModule.selectPanelTab stays the one
// source of truth and the host message keys are untouched.
(function () {
    window.AirFlutterPanelNavModule = class AirFlutterPanelNavModule {
        initPanelNav() {
            const input = document.getElementById('panelJumpInput');
            const results = document.getElementById('panelJumpResults');
            if (!input || !results) return;

            this.jumpInput = input;
            this.jumpResults = results;
            this.jumpMatches = [];
            this.jumpOptions = [];
            this.activeIndex = -1;

            input.addEventListener('input', () => {
                this.activeIndex = -1;
                this.renderJump(this.filterTools(input.value));
            });
            input.addEventListener('focus', () => this.renderJump(this.filterTools(input.value)));
            input.addEventListener('keydown', event => this.onJumpKeydown(event));

            // Close only when focus genuinely leaves the whole jump control.
            // A bare timed close raced Tab-into-the-list (the option was hidden
            // before the user could reach it). This keeps the list open while
            // focus moves between the input and its options.
            this.jumpContainer = input.closest('.ff-jump') || input.parentElement;
            const onFocusOut = event => {
                const next = event.relatedTarget;
                if (next && (this.jumpResults.contains(next) || this.jumpContainer.contains(next))) return;
                this.closeJump();
            };
            input.addEventListener('focusout', onFocusOut);
            results.addEventListener('focusout', onFocusOut);

            document.addEventListener('keydown', event => {
                if (this.isJumpShortcut(event)) {
                    event.preventDefault();
                    input.focus();
                    input.select();
                }
            });

            document.addEventListener('click', event => {
                if (!event.target.closest('.ff-nav-bar')) this.closeJump();
            });

            this.applyTabGroupState();
        }

        // Tool registry: the ten real panels, with the words a developer would
        // actually type to find them. `alias` is matched, never shown twice.
        // Rows with a `command` deep-link to a Flutter command inside the
        // Workspace tab instead of switching tabs.
        get toolRegistry() {
            return [
                { tab: 'workspace', label: 'Workspace', group: 'Device', hint: 'Devices, mirroring, wireless ADB, localhost bridge', alias: 'devices usb network wireless adb mirror scrcpy connect logcat log bridge forward' },
                { tab: 'device-env', label: 'Device Sandbox', group: 'Device', hint: 'Font scale, locale, dark mode, mock GPS, overlays', alias: 'environment sandbox font scale dark mode locale battery mock gps permission overlay debug' },
                { tab: 'ssl-proxy', label: 'SSL & Proxy', group: 'Device', hint: 'Network security, proxy, Private DNS, offline', alias: 'ssl proxy network dns certificate doctor offline slow' },
                { tab: 'build-runner', label: 'Build Runner', group: 'Build', hint: 'Codegen cockpit: build_runner, watch, clean', alias: 'build runner codegen generate freezed json serializable watch' },
                { tab: 'icon-splash', label: 'Icon & Splash', group: 'Build', hint: 'App icon and native splash studios', alias: 'icon splash logo launcher adaptive branding asset image' },
                { tab: 'localization', label: 'Localization', group: 'Build', hint: 'ARB matrix, add and sync locales', alias: 'localization l10n i18n arb translations locale language' },
                { tab: 'assets', label: 'Assets & Media', group: 'Ship', hint: 'Scan, sync and generate asset constants', alias: 'assets media images files pubspec generate constants' },
                { tab: 'deep-links', label: 'Deep Links', group: 'Ship', hint: 'Deep link and intent studio', alias: 'deep link intent uri scheme app links universal' },
                { tab: 'permissions', label: 'Permissions', group: 'Ship', hint: 'Manifest and runtime permission manager', alias: 'permissions manifest runtime android ios privacy' },
                { tab: 'cleanup', label: 'Code Cleanup', group: 'Ship', hint: 'Dead code, unused assets, analyzer fixes', alias: 'cleanup dead code unused analyzer lint prune' },
                { command: 'runApp', label: 'Run app', group: 'Commands', hint: 'flutter run', alias: 'run start app launch debug hot reload' },
                { command: 'runFlutterDoctor', label: 'Flutter doctor', group: 'Commands', hint: 'flutter doctor', alias: 'doctor diagnose check setup sdk' },
                { command: 'getPackages', label: 'Get packages', group: 'Commands', hint: 'flutter pub get', alias: 'pub get packages dependencies install fetch' },
                { command: 'upgradePackages', label: 'Upgrade packages', group: 'Commands', hint: 'flutter pub upgrade', alias: 'pub upgrade packages outdated dependencies' },
                { command: 'buildAPK', label: 'Build APK', group: 'Commands', hint: 'flutter build apk', alias: 'build apk release android package' },
                { command: 'buildAAB', label: 'Build app bundle', group: 'Commands', hint: 'flutter build appbundle', alias: 'build aab appbundle release bundle play store' },
                { command: 'cleanProject', label: 'Clean project', group: 'Commands', hint: 'flutter clean', alias: 'clean wipe build cache reset' },
                { command: 'installApk', label: 'Install APK', group: 'Commands', hint: 'adb install -r', alias: 'install apk adb deploy' },
                { command: 'generateWorkflow', label: 'GitHub Workflow', group: 'Commands', hint: 'CI/CD APK Builder', alias: 'github actions workflow ci cd pipeline' },
                { command: 'signingKey', label: 'Signing Key Studio', group: 'Commands', hint: 'create Android upload key', alias: 'signing key keystore upload jks release' },
                { command: 'flavorsModal', label: 'Flutter Flavors', group: 'Commands', hint: 'manage, run & build', alias: 'flavors variants build types dev staging prod' },
                { command: 'apkSizeModal', label: 'Size Analyzer', group: 'Commands', hint: 'APK/AAB binary composition', alias: 'size analyzer apk aab bytes weight' },
                { command: 'pubHealthModal', label: 'Pub Health', group: 'Commands', hint: 'dependencies & outdated check', alias: 'pub health outdated dependencies audit' },
                { command: 'sendText', label: 'Send text', group: 'Commands', hint: 'paste to phone', alias: 'send text type input paste keyboard' },
                { command: 'toggleRecording', label: 'Record Screen', group: 'Commands', hint: 'record phone MP4', alias: 'record screen video mp4 capture' },
                { command: 'mockGpsModal', label: 'Mock GPS Studio', group: 'Commands', hint: 'mock coordinates & routes', alias: 'mock gps location coordinates route fake' },
                { command: 'debugOverlaysModal', label: 'Debug Overlays', group: 'Commands', hint: 'Debug Paint, Perf & Slow-mo', alias: 'debug overlays paint performance slow motion repaint' },
                { command: 'compatDoctorModal', label: 'Compat Doctor', group: 'Commands', hint: 'Gradle, AGP, Java & iOS', alias: 'compat doctor gradle agp java ios fix' },
                { command: 'proxyModal', label: 'Proxy & DNS', group: 'Commands', hint: 'network inspector', alias: 'proxy dns network inspect offline throttle' },
                { command: 'storageInspectorModal', label: 'Storage Inspector', group: 'Commands', hint: 'SharedPreferences & SQLite', alias: 'storage inspector sharedpreferences sqlite database prefs' },
                { command: 'mcpHubModal', label: 'MCP Hub', group: 'Commands', hint: 'AI agent MCP servers', alias: 'mcp hub ai agent servers config' },
                { command: 'agentScaffoldModal', label: 'Agent Engine', group: 'Commands', hint: 'AI sub-agents & teams', alias: 'agent engine ai scaffold subagents teams' }
            ];
        }

        isJumpShortcut(event) {
            if (event.metaKey || event.ctrlKey || event.altKey) return false;
            const tag = (event.target && event.target.tagName) || '';
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (event.target && event.target.isContentEditable);
            return event.key === '/' && !typing;
        }

        filterTools(query) {
            const q = (query || '').trim().toLowerCase();
            if (!q) {
                // Empty field: show the whole map, grouped, so it doubles as a directory.
                return this.toolRegistry.slice();
            }
            const terms = q.split(/\s+/).filter(Boolean);
            return this.toolRegistry.filter(tool => {
                const haystack = `${tool.label} ${tool.group} ${tool.hint} ${tool.alias}`.toLowerCase();
                return terms.every(term => haystack.includes(term));
            });
        }

        renderJump(matches) {
            const results = this.jumpResults;
            if (!results) return;
            this.jumpMatches = matches;
            this.jumpOptions = [];
            results.innerHTML = '';

            if (!matches.length) {
                this.activeIndex = -1;
                this.syncActiveDescendant();
                const empty = document.createElement('p');
                empty.className = 'ff-jump-empty';
                empty.textContent = 'No tool matches that. Try "icon", "ssl", "apk" or "perm".';
                results.appendChild(empty);
                results.hidden = false;
                this.jumpInput.setAttribute('aria-expanded', 'true');
                return;
            }

            let lastGroup = null;
            let optionIndex = 0;
            matches.forEach(tool => {
                if (tool.group !== lastGroup) {
                    lastGroup = tool.group;
                    const head = document.createElement('div');
                    head.className = 'ff-jump-group';
                    head.textContent = tool.group;
                    results.appendChild(head);
                }
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'ff-jump-option';
                option.setAttribute('role', 'option');
                option.id = 'ff-jump-opt-' + optionIndex;
                option.dataset.jumpIndex = String(optionIndex);
                if (tool.command) {
                    option.dataset.jumpCommand = tool.command;
                } else {
                    option.dataset.jumpTab = tool.tab;
                }
                optionIndex += 1;

                const label = document.createElement('span');
                label.className = 'ff-jump-option-label';
                label.textContent = tool.label;

                const hint = document.createElement('span');
                hint.className = 'ff-jump-option-hint';
                hint.textContent = tool.hint;

                option.appendChild(label);
                option.appendChild(hint);
                // An option is only reachable by pointer; keyboard navigation is
                // owned by the input via aria-activedescendant, so options stay
                // out of the tab order.
                option.tabIndex = -1;
                option.addEventListener('mousedown', event => {
                    event.preventDefault();
                    this.activateMatch(tool);
                });
                results.appendChild(option);
                this.jumpOptions.push(option);
            });

            // Keep the highlight within range after a re-filter.
            if (this.activeIndex >= matches.length) this.activeIndex = matches.length - 1;

            results.hidden = false;
            this.jumpInput.setAttribute('aria-expanded', 'true');
            this.applyActiveOption();
        }

        applyActiveOption() {
            if (!this.jumpOptions) return;
            this.jumpOptions.forEach((option, index) => {
                const isActive = index === this.activeIndex;
                option.classList.toggle('is-active', isActive);
                option.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            this.syncActiveDescendant();
            const active = this.jumpOptions[this.activeIndex];
            if (active && active.scrollIntoView) {
                active.scrollIntoView({ block: 'nearest' });
            }
        }

        syncActiveDescendant() {
            const active = this.jumpOptions && this.jumpOptions[this.activeIndex];
            if (active) {
                this.jumpInput.setAttribute('aria-activedescendant', active.id);
            } else {
                this.jumpInput.setAttribute('aria-activedescendant', '');
            }
        }

        moveActive(delta) {
            const count = this.jumpMatches.length;
            if (!count) return;
            if (this.activeIndex < 0) {
                this.activeIndex = delta > 0 ? 0 : count - 1;
            } else {
                this.activeIndex = (this.activeIndex + delta + count) % count;
            }
            this.applyActiveOption();
        }

        activateMatch(tool) {
            if (!tool) return;
            if (tool.command) {
                this.selectCommand(tool.command);
            } else {
                this.selectTool(tool.tab);
            }
        }

        onJumpKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.jumpInput.value = '';
                this.closeJump();
                this.jumpInput.blur();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.moveActive(1);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.moveActive(-1);
                return;
            }
            if (event.key === 'Home' && this.jumpMatches.length) {
                event.preventDefault();
                this.activeIndex = 0;
                this.applyActiveOption();
                return;
            }
            if (event.key === 'End' && this.jumpMatches.length) {
                event.preventDefault();
                this.activeIndex = this.jumpMatches.length - 1;
                this.applyActiveOption();
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                // Enter runs the highlighted option, or the first match when
                // nothing has been arrowed to yet.
                const match = this.jumpMatches[this.activeIndex] || this.jumpMatches[0];
                this.activateMatch(match);
            }
        }

        closeJump() {
            if (!this.jumpResults) return;
            this.jumpResults.hidden = true;
            this.activeIndex = -1;
            this.jumpInput.setAttribute('aria-expanded', 'false');
            this.jumpInput.setAttribute('aria-activedescendant', '');
        }

        selectTool(tab) {
            const target = document.querySelector(`[data-panel-tab="${tab}"]`);
            if (!target) return;
            target.click();
            if (this.jumpInput) {
                this.jumpInput.value = '';
                this.jumpInput.blur();
            }
            this.closeJump();
        }

        // Deep-link to a Flutter command row: switch to the Workspace tab,
        // open the disclosure that owns the row, then reveal and focus it.
        selectCommand(command) {
            const workspaceTab = document.querySelector('[data-panel-tab="workspace"]');
            if (workspaceTab) workspaceTab.click();

            const row = document.querySelector(`[data-command="${command}"]`);
            if (!row) {
                if (this.jumpInput) {
                    this.jumpInput.value = '';
                    this.jumpInput.blur();
                }
                this.closeJump();
                return;
            }

            const group = row.closest('details');
            if (group) group.open = true;

            if (row.scrollIntoView) {
                row.scrollIntoView({ block: 'center', inline: 'nearest' });
            }
            if (row.focus) {
                try {
                    row.focus({ preventScroll: true });
                } catch (e) {
                    row.focus();
                }
            }

            if (this.jumpInput) {
                this.jumpInput.value = '';
                this.jumpInput.blur();
            }
            this.closeJump();
        }

        // A selected tab inside a collapsed-width strip should scroll itself into
        // view, since grouping makes the row wider than the old flat bar.
        applyTabGroupState() {
            const tabStrip = document.querySelector('.ff-tabs');
            document.querySelectorAll('.ff-tab').forEach(button => {
                button.addEventListener('click', () => {
                    if (button.scrollIntoView) {
                        button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                    }
                });
            });
            if (tabStrip) this.applyRovingTabIndex(tabStrip);
        }

        // A role="tablist" is expected to behave as a single tab stop: only the
        // active tab is in the tab order, and Arrow keys move between tabs.
        applyRovingTabIndex(tablist) {
            const tabs = Array.from(tablist.querySelectorAll('.ff-tab'));
            if (!tabs.length) return;
            const syncTabStops = () => {
                const active = tabs.find(t => t.classList.contains('is-active')) || tabs[0];
                tabs.forEach(t => { t.tabIndex = t === active ? 0 : -1; });
            };
            syncTabStops();
            tablist.addEventListener('click', () => syncTabStops());
            tablist.addEventListener('keydown', event => {
                const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const current = tabs.findIndex(t => t.classList.contains('is-active'));
                const from = current === -1 ? 0 : current;
                let next = from;
                if (event.key === 'ArrowRight') next = (from + 1) % tabs.length;
                else if (event.key === 'ArrowLeft') next = (from - 1 + tabs.length) % tabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = tabs.length - 1;
                const target = tabs[next];
                target.focus();
                target.click();
                syncTabStops();
            });
        }

        // Public helper so other modules can deep-link into a tool without
        // duplicating the registry or the DOM contract.
        jumpToTool(tab) {
            this.selectTool(tab);
        }

        // Public helper for command deep-links (see selectCommand).
        jumpToCommand(command) {
            this.selectCommand(command);
        }
    };
})();
