// MCP & AI Agent Hub Module
// Drives the in-panel stepper modal. State lives here; the extension host
// supplies the agent + server catalog and performs the actual file writes.
//
// NOTE: this module is mixed into the webview class by copying prototype
// methods only, so a `constructor()` is never invoked. All instance state is
// therefore initialised inside `initMcpModal()`, matching every other module.
window.AirFlutterMcpModule = class AirFlutterMcpModule {

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------
    initMcpModal() {
        const modal = document.getElementById('mcpHubModal');
        if (!modal) return;

        // A second call must not stack duplicate listeners.
        if (this.mcpInitialised) return;
        this.mcpInitialised = true;

        // --- instance state (constructor() is not called for mixins) ---
        this.agents = [];
        this.servers = [];
        this.selectedAgents = new Set();
        this.selectedServers = new Set();
        this.scope = 'workspace';
        this.workspaceRoot = '';
        this.step = 1;
        this.totalSteps = 5;
        this.serverSearch = '';

        this.modal = modal;

        const closeBtn = document.getElementById('closeMcpHubModalBtn');
        const cancelBtn = document.getElementById('mcpCancelBtn');
        const nextBtn = document.getElementById('mcpNextBtn');
        const prevBtn = document.getElementById('mcpPrevBtn');
        const prereqBtn = document.getElementById('mcpCheckPrereqBtn');

        const close = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (cancelBtn) cancelBtn.addEventListener('click', close);

        if (nextBtn) nextBtn.addEventListener('click', () => this.next());
        if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
        if (prereqBtn) prereqBtn.addEventListener('click', () => this.checkPrerequisites());

        // Scope radios.
        modal.querySelectorAll('input[name="mcpScope"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                this.scope = radio.value;
                this.updateScopeNote();
            });
        });

        // Server list toolbar.
        const searchInput = document.getElementById('mcpServerSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.serverSearch = searchInput.value.trim().toLowerCase();
                this.renderServers();
            });
        }
        const selectAll = document.getElementById('mcpSelectAllBtn');
        if (selectAll) {
            selectAll.addEventListener('click', () => {
                this.visibleServers().forEach((s) => this.selectedServers.add(s.id));
                this.renderServers();
            });
        }
        const clearAll = document.getElementById('mcpClearAllBtn');
        if (clearAll) {
            clearAll.addEventListener('click', () => {
                this.selectedServers.clear();
                this.renderServers();
            });
        }

        // Click outside the card closes the modal.
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });

        // --- companion guide modal ---
        this.guideServerId = null;

        const guideClose = document.getElementById('closeMcpGuideBtn');
        const guideBackdrop = document.getElementById('mcpCompanionGuide');
        if (guideClose) guideClose.addEventListener('click', () => this.closeCompanionGuide());
        if (guideBackdrop) {
            guideBackdrop.addEventListener('click', (event) => {
                if (event.target === guideBackdrop) this.closeCompanionGuide();
            });
        }

        const guideInstallBtn = document.getElementById('mcpGuideInstallBtn');
        if (guideInstallBtn) {
            guideInstallBtn.addEventListener('click', () => this.installCompanionPackage());
        }
        const guideFileBtn = document.getElementById('mcpGuideFileBtn');
        if (guideFileBtn) {
            guideFileBtn.addEventListener('click', () => this.saveCompanionGuideFile());
        }

        // Copy buttons inside the guide.
        guideBackdrop?.querySelectorAll('.mcp-copy-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-copy-target');
                const target = targetId ? document.getElementById(targetId) : null;
                if (!target) return;
                const text = target.textContent || '';
                navigator.clipboard.writeText(text).then(() => {
                    this.showToast('Copied to clipboard.', 'success');
                });
            });
        });

        // The config list is re-rendered dynamically, so companion install
        // buttons are handled by delegation.
        const configHost = document.getElementById('mcpConfigList');
        if (configHost) {
            configHost.addEventListener('click', (event) => {
                const target = event.target.closest('[data-companion-install]');
                if (!target) return;
                const serverId = target.getAttribute('data-companion-install');
                this.guideServerId = serverId;
                this.installCompanionPackage();
            });
        }
    }

    // -------------------------------------------------------------------------
    // Host data
    // -------------------------------------------------------------------------
    setData(agents, servers) {
        this.agents = agents || [];
        this.servers = servers || [];
        this.renderAgents();
        this.renderServers();
    }

    /** Re-render everything that depends on live project state. */
    refresh() {
        this.renderServers();
        if (this.step === 4) this.renderConfig();
    }

    open(workspaceRoot) {
        this.workspaceRoot = workspaceRoot || '';
        this.step = 1;
        this.selectedAgents = new Set();
        this.selectedServers = new Set();
        this.scope = 'workspace';
        this.serverSearch = '';
        this.writtenServers = [];

        const modal = document.getElementById('mcpHubModal');
        if (modal) modal.hidden = false;

        const search = document.getElementById('mcpServerSearch');
        if (search) search.value = '';

        const prereq = document.getElementById('mcpPrereqResult');
        if (prereq) { prereq.hidden = true; prereq.innerHTML = ''; }

        this.renderAgents();
        this.renderServers();
        this.updateScopeNote();
        this.goToStep(1);
    }

    /**
     * Open the MCP Hub modal and ask the host for the current catalog.
     *
     * Called both by the bridge (when the panel button is clicked) and by the
     * message router (when the host confirms). It opens the modal immediately
     * so the UI responds without waiting for a round trip, then refreshes the
     * data once the host replies with `mcpHubData`.
     */
    openMcpHub(workspaceRoot) {
        // Defensive: if the modal was never initialised (for example because a
        // host-side script ordering issue prevented initMcpModal from running),
        // initialise it now rather than failing silently on the first click.
        if (!this.mcpInitialised) {
            this.initMcpModal();
        }

        const modal = document.getElementById('mcpHubModal');
        const alreadyOpen = modal && modal.hidden === false;

        // Opening resets the wizard; a host confirmation of an already-open
        // modal must not wipe the user's in-progress selections.
        if (!alreadyOpen) {
            this.open(workspaceRoot);
        }

        this.sendMessage('mcpRequestData', {
            workspaceRoot: this.workspaceRoot
        });
    }

    visibleServers() {
        if (!this.serverSearch) return this.servers;
        return this.servers.filter((s) =>
            s.name.toLowerCase().includes(this.serverSearch) ||
            s.id.toLowerCase().includes(this.serverSearch) ||
            s.category.toLowerCase().includes(this.serverSearch) ||
            (s.description || '').toLowerCase().includes(this.serverSearch)
        );
    }

    // -------------------------------------------------------------------------
    // Step 1 — agents
    // -------------------------------------------------------------------------
    renderAgents() {
        const host = document.getElementById('mcpAgentList');
        if (!host) return;

        if (this.agents.length === 0) {
            host.innerHTML = '<p class="mcp-empty">No agents available.</p>';
            return;
        }

        host.innerHTML = this.agents.map((a) => `
            <label class="mcp-row" data-agent="${this.escape(a.id)}">
                <input type="checkbox" data-agent-id="${this.escape(a.id)}" />
                <span class="mcp-row-body">
                    <span class="mcp-row-title">
                        ${this.escape(a.name)}
                        <span class="mcp-badge">${this.escape(this.integrationModeLabel(a.capabilities?.integrationMode))}</span>
                    </span>
                    <span class="mcp-row-sub">${this.escape(a.description)}</span>
                    ${a.capabilities?.note ? `<span class="mcp-row-sub">${this.escape(a.capabilities.note)}</span>` : ''}
                </span>
            </label>
        `).join('');

        host.querySelectorAll('input[data-agent-id]').forEach((box) => {
            box.addEventListener('change', () => {
                const id = box.getAttribute('data-agent-id');
                if (box.checked) this.selectedAgents.add(id);
                else this.selectedAgents.delete(id);
                this.syncScopeOptions();
                this.updateFoot();
            });
        });

        this.syncScopeOptions();
        this.updateFoot();
    }

    integrationModeLabel(mode) {
        const labels = {
            'native-config': 'Native config',
            'global-only': 'Global only',
            'code-template': 'Code template',
            'setup-guide': 'Setup guide'
        };
        return labels[mode] || 'Integration';
    }

    selectedAgentRecords() {
        return this.agents.filter((agent) => this.selectedAgents.has(agent.id));
    }

    commonScopes() {
        const selected = this.selectedAgentRecords();
        if (selected.length === 0) return ['workspace', 'global'];
        return ['workspace', 'global'].filter((scope) =>
            selected.every((agent) => (agent.capabilities?.supportedScopes || []).includes(scope))
        );
    }

    syncScopeOptions() {
        const scopes = this.commonScopes();
        document.querySelectorAll('input[name="mcpScope"]').forEach((radio) => {
            radio.disabled = !scopes.includes(radio.value);
            const card = radio.closest('.modal-option-card');
            if (card) card.classList.toggle('is-disabled', radio.disabled);
        });
        if (!scopes.includes(this.scope) && scopes.length > 0) {
            this.scope = scopes[0];
        }
        const selected = document.querySelector(`input[name="mcpScope"][value="${this.scope}"]`);
        if (selected) selected.checked = true;
        this.updateScopeNote();
    }

    // -------------------------------------------------------------------------
    // Step 3 — servers
    // -------------------------------------------------------------------------
    renderServers() {
        const host = document.getElementById('mcpServerList');
        if (!host) return;

        const list = this.visibleServers();
        if (list.length === 0) {
            host.innerHTML = '<p class="mcp-empty">No servers match your filter.</p>';
            return;
        }

        // Group by category, preserving catalog order.
        const groups = [];
        for (const server of list) {
            let group = groups.find((g) => g.category === server.category);
            if (!group) {
                group = { category: server.category, servers: [] };
                groups.push(group);
            }
            group.servers.push(server);
        }

        host.innerHTML = groups.map((g) => `
            <div class="mcp-group">
                <p class="mcp-group-title">${this.escape(g.category)}</p>
                ${g.servers.map((s) => `
                    <label class="mcp-row mcp-row-server">
                        <input type="checkbox" data-server-id="${this.escape(s.id)}"
                            ${this.selectedServers.has(s.id) ? 'checked' : ''} />
                        <span class="mcp-row-body">
                            <span class="mcp-row-title">
                                ${this.escape(s.name)}
                                ${s.badge ? `<span class="mcp-badge">${this.escape(s.badge)}</span>` : ''}
                            </span>
                            <span class="mcp-row-sub">${this.escape(s.description)}</span>
                        </span>
                    </label>
                `).join('')}
            </div>
        `).join('');

        host.querySelectorAll('input[data-server-id]').forEach((box) => {
            box.addEventListener('change', () => {
                const id = box.getAttribute('data-server-id');
                if (box.checked) this.selectedServers.add(id);
                else this.selectedServers.delete(id);
                this.updateFoot();
            });
        });

        this.updateFoot();
    }

    // -------------------------------------------------------------------------
    // Step 2 — scope note
    // -------------------------------------------------------------------------
    updateScopeNote() {
        const note = document.getElementById('mcpScopeNote');
        if (!note) return;

        const scopes = this.commonScopes();
        if (scopes.length === 0) {
            note.textContent = 'These agents do not share a compatible scope. Configure global-only agents separately from workspace templates.';
        } else if (scopes.length === 1) {
            note.textContent = `The selected agent(s) support ${scopes[0]} integration only.`;
        } else if (this.scope === 'global') {
            note.textContent = 'Global scope writes to your OS user directories and applies to every project.';
        } else {
            note.textContent = this.workspaceRoot
                ? `Config will be written into: ${this.workspaceRoot}`
                : 'No workspace folder detected — you will be asked to pick one.';
        }
    }

    // -------------------------------------------------------------------------
    // Step 4 — configuration forms
    // -------------------------------------------------------------------------
    renderConfig() {
        const host = document.getElementById('mcpConfigList');
        if (!host) return;

        const selected = this.servers.filter((s) => this.selectedServers.has(s.id));
        if (selected.length === 0) {
            host.innerHTML = '<p class="mcp-empty">No servers selected.</p>';
            return;
        }

        host.innerHTML = selected.map((s) => {
            const params = (s.parameters || []).map((p) => `
                <div class="mcp-field">
                    <label class="mcp-field-label">
                        ${this.escape(p.label)}
                        ${p.required ? '<span class="mcp-req">required</span>' : ''}
                    </label>
                    ${p.description ? `<span class="mcp-field-desc">${this.escape(p.description)}</span>` : ''}
                    <input type="${p.secret ? 'password' : 'text'}"
                        class="mcp-input"
                        data-param-server="${this.escape(s.id)}"
                        data-param-key="${this.escape(p.key)}"
                        placeholder="${this.escape(p.placeholder)}"
                        value="${this.escape(p.defaultValue)}" />
                </div>
            `).join('');

            const templates = (s.instructionTemplates || []);
            const templateOptions = templates.map((t, index) =>
                `<option value="${index}">${this.escape(t.label)}</option>`
            ).join('');

            const companion = s.companionPackage
                ? this.renderCompanionBanner(s)
                : '';

            return `
                <div class="mcp-config-card">
                    <div class="mcp-config-head">
                        <span class="mcp-row-title">${this.escape(s.name)}</span>
                        <span class="mcp-config-meta">${this.escape(s.transport)} · ${this.escape(s.runtime)}</span>
                    </div>

                    ${companion}

                    ${params || '<p class="mcp-row-sub">No parameters required.</p>'}

                    <div class="mcp-field mcp-instr-field">
                        <label class="mcp-field-label">
                            Instructions <span class="mcp-optional">optional</span>
                        </label>
                        <span class="mcp-field-desc">
                            Tell the agent how to use this server in your project.
                        </span>
                        ${templates.length > 0 ? `
                            <div class="mcp-template-row">
                                <select class="mcp-select"
                                    data-template-server="${this.escape(s.id)}">
                                    <option value="">— Start from a template —</option>
                                    ${templateOptions}
                                    <option value="__custom__">Write my own</option>
                                </select>
                            </div>
                        ` : ''}
                        <textarea class="mcp-textarea"
                            data-instr-server="${this.escape(s.id)}"
                            rows="3"
                            placeholder="${this.escape(s.defaultInstructions || 'Example: Always operate strictly within the truck_store schema.')}"></textarea>
                    </div>
                </div>
            `;
        }).join('');

        // Wire template selectors into their textareas.
        host.querySelectorAll('select[data-template-server]').forEach((select) => {
            select.addEventListener('change', () => {
                const serverId = select.getAttribute('data-template-server');
                const textarea = host.querySelector(`textarea[data-instr-server="${serverId}"]`);
                if (!textarea) return;
                const value = select.value;
                if (value === '' ) return;
                if (value === '__custom__') { textarea.focus(); return; }
                const server = this.servers.find((s) => s.id === serverId);
                const template = server && server.instructionTemplates
                    ? server.instructionTemplates[Number(value)]
                    : null;
                if (template) textarea.value = template.value;
            });
        });

        // Companion banners: guide + install buttons.
        host.querySelectorAll('[data-companion-guide]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.openCompanionGuide(btn.getAttribute('data-companion-guide'));
            });
        });

        // Ask the host whether each companion package is already installed.
        selected
            .filter((s) => s.companionPackage)
            .forEach((s) => this.requestCompanionStatus(s.id));

        this.updateFoot();
    }

    /** Render the call-out that appears for servers needing an app package. */
    renderCompanionBanner(server) {
        const pkg = server.companionPackage;
        return `
            <div class="mcp-companion" data-companion="${this.escape(server.id)}">
                <div class="mcp-companion-head">
                    <i class="fas fa-cube"></i>
                    <span>Requires the <code>${this.escape(pkg.packageName)}</code> package in your app</span>
                </div>
                <p class="mcp-companion-status" data-companion-status="${this.escape(server.id)}">
                    Checking project…
                </p>
                <div class="mcp-companion-actions">
                    <button class="btn btn-quiet mcp-companion-btn" type="button"
                        data-companion-guide="${this.escape(server.id)}">
                        <i class="fas fa-book"></i> Setup guide
                    </button>
                    <button class="btn mcp-companion-btn" type="button"
                        data-companion-install="${this.escape(server.id)}">
                        <i class="fas fa-download"></i> Add package
                    </button>
                </div>
            </div>
        `;
    }

    /** Ask the host whether the companion package is already a dependency. */
    requestCompanionStatus(serverId) {
        this.sendMessage('mcpCompanionStatus', {
            serverId,
            workspaceRoot: this.workspaceRoot
        });
    }

    /** Update the banner once the host reports the dependency state. */
    onCompanionStatus(payload) {
        const el = document.querySelector(
            `[data-companion-status="${payload.serverId}"]`
        );
        if (!el) return;

        if (payload.installed) {
            el.innerHTML = '<i class="fas fa-check-circle"></i> Already in your pubspec.yaml';
            el.classList.add('is-ok');
        } else {
            el.innerHTML = '<i class="fas fa-circle-info"></i> Not installed yet in this project';
            el.classList.remove('is-ok');
        }

        // Reflect the real state on the install button.
        const installBtn = document.querySelector(
            `[data-companion-install="${payload.serverId}"]`
        );
        if (installBtn) {
            installBtn.innerHTML = payload.installed
                ? '<i class="fas fa-wand-magic-sparkles"></i> Wire main.dart'
                : '<i class="fas fa-download"></i> Add package';
        }
    }

    /** Open the setup guide with the server's snippet and checklist. */
    openCompanionGuide(serverId) {
        const server = this.servers.find((s) => s.id === serverId);
        if (!server || !server.companionPackage) return;

        this.guideServerId = serverId;
        const pkg = server.companionPackage;

        const title = document.getElementById('mcpGuideTitle');
        if (title) title.textContent = `${server.name} — setup guide`;

        const addCmd = document.getElementById('mcpGuideAddCmd');
        if (addCmd) addCmd.textContent = pkg.addCommand;

        const snippet = document.getElementById('mcpGuideSnippet');
        if (snippet) snippet.textContent = pkg.mainDartSnippet;

        const note = document.getElementById('mcpGuideImportNote');
        if (note) {
            note.textContent =
                'kDebugMode comes from package:flutter/foundation.dart. Add that import if main.dart does not have it yet.';
        }

        const steps = document.getElementById('mcpGuideSteps');
        if (steps) {
            steps.innerHTML = (pkg.setupSteps || [])
                .map((step) => `<li>${this.escape(step)}</li>`)
                .join('');
        }

        const status = document.getElementById('mcpGuideStatus');
        if (status) status.innerHTML = '';

        const guide = document.getElementById('mcpCompanionGuide');
        if (guide) guide.hidden = false;
    }

    closeCompanionGuide() {
        const guide = document.getElementById('mcpCompanionGuide');
        if (guide) guide.hidden = true;
    }

    /** Run the automated install for the server whose guide is open. */
    installCompanionPackage() {
        const serverId = this.guideServerId;
        if (!serverId) return;

        const status = document.getElementById('mcpGuideStatus');
        if (status) {
            status.innerHTML =
                '<p class="mcp-loading"><i class="fas fa-spinner fa-spin"></i> Working… follow the prompts.</p>';
        }

        this.sendMessage('mcpCompanionInstall', {
            serverId,
            workspaceRoot: this.workspaceRoot
        });
    }

    /** Save the guide as a Markdown file via the host. */
    saveCompanionGuideFile() {
        if (!this.guideServerId) return;
        this.sendMessage('mcpCompanionGuideFile', {
            serverId: this.guideServerId,
            workspaceRoot: this.workspaceRoot
        });
    }

    /** Host reports the companion install flow finished. */
    onCompanionDone(payload) {
        const status = document.getElementById('mcpGuideStatus');
        if (status) {
            if (payload.ok) {
                const bits = [];
                if (payload.alreadyWired) bits.push('main.dart was already configured.');
                else if (payload.mainDartEdited) bits.push('main.dart updated.');
                else if (payload.mainDartSkipped) bits.push('Dependency handled; review main.dart manually.');
                status.innerHTML =
                    `<p class="mcp-guide-ok"><i class="fas fa-check-circle"></i> ${this.escape(bits.join(' ') || 'Done.')}</p>`;
            } else if (payload.declined) {
                status.innerHTML =
                    '<p class="mcp-guide-info">Cancelled.</p>';
            } else {
                status.innerHTML =
                    `<p class="mcp-guide-error"><i class="fas fa-times-circle"></i> ${this.escape(payload.error || 'Something went wrong.')}</p>`;
            }
        }

        // Refresh the banner so the button reflects the new state.
        if (payload.serverId) this.requestCompanionStatus(payload.serverId);
    }

    /** Read the current configuration forms into flat maps. */
    collectConfig() {
        const parameters = {};
        const instructions = {};
        const host = document.getElementById('mcpConfigList');
        if (!host) return { parameters, instructions };

        host.querySelectorAll('input[data-param-server]').forEach((input) => {
            const serverId = input.getAttribute('data-param-server');
            const key = input.getAttribute('data-param-key');
            if (!parameters[serverId]) parameters[serverId] = {};
            parameters[serverId][key] = input.value;
        });

        host.querySelectorAll('textarea[data-instr-server]').forEach((area) => {
            const serverId = area.getAttribute('data-instr-server');
            const text = (area.value || '').trim();
            if (text.length > 0) instructions[serverId] = text;
        });

        return { parameters, instructions };
    }

    /** Returns the first missing required parameter, or null when complete. */
    validateConfig() {
        const host = document.getElementById('mcpConfigList');
        if (!host) return null;

        const selected = this.servers.filter((s) => this.selectedServers.has(s.id));
        for (const server of selected) {
            for (const param of server.parameters || []) {
                if (!param.required) continue;
                const input = host.querySelector(
                    `input[data-param-server="${server.id}"][data-param-key="${param.key}"]`
                );
                const value = input ? input.value.trim() : '';
                if (value.length === 0) {
                    return `${server.name}: "${param.label}" is required.`;
                }
            }
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Step 5 — review
    // -------------------------------------------------------------------------
    renderReview() {
        const host = document.getElementById('mcpReview');
        if (!host) return;

        const selectedAgents = this.agents.filter((a) => this.selectedAgents.has(a.id));
        const selectedServers = this.servers.filter((s) => this.selectedServers.has(s.id));
        const config = this.collectConfig();

        const scopeLabel = this.scope === 'workspace' ? 'Project (workspace)' : 'Global (user / machine)';

        const withInstructions = Object.keys(config.instructions);

        host.innerHTML = `
            <div class="mcp-review-block">
                <p class="mcp-review-label">Agents</p>
                <ul class="mcp-review-list">
                    ${selectedAgents.map((a) => `<li>${this.escape(a.name)}</li>`).join('')}
                </ul>
            </div>
            <div class="mcp-review-block">
                <p class="mcp-review-label">Scope</p>
                <p class="mcp-review-value">${this.escape(scopeLabel)}</p>
            </div>
            <div class="mcp-review-block">
                <p class="mcp-review-label">Servers (${selectedServers.length})</p>
                <ul class="mcp-review-list">
                    ${selectedServers.map((s) =>
                        `<li>${this.escape(s.name)}${withInstructions.includes(s.id) ? ' <span class="mcp-badge">instructions</span>' : ''}</li>`
                    ).join('')}
                </ul>
            </div>
            <p class="mcp-review-note">
                A timestamped backup is created before any existing file is modified.
                Pre-existing servers and unrelated settings are preserved.
            </p>
        `;
    }

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------
    goToStep(step) {
        this.step = step;

        const modal = document.getElementById('mcpHubModal');
        if (!modal) return;

        modal.querySelectorAll('.stepper-step').forEach((el) => {
            const n = Number(el.getAttribute('data-step'));
            el.classList.toggle('is-active', n === step);
            el.classList.toggle('is-completed', n < step);
        });

        modal.querySelectorAll('.stepper-pane').forEach((el) => {
            const n = Number(el.getAttribute('data-step'));
            el.classList.toggle('is-active', n === step);
        });

        const prevBtn = document.getElementById('mcpPrevBtn');
        if (prevBtn) prevBtn.hidden = step === 1;

        this.updateFoot();
    }

    next() {
        if (this.step === 1 && this.selectedAgents.size === 0) {
            this.showToast('Select at least one AI agent.', 'error');
            return;
        }
        if (this.step === 1 && this.commonScopes().length === 0) {
            this.showToast('Selected agents do not share a compatible scope.', 'error');
            return;
        }
        if (this.step === 3 && this.selectedServers.size === 0) {
            this.showToast('Select at least one MCP server.', 'error');
            return;
        }
        if (this.step === 4) {
            const problem = this.validateConfig();
            if (problem) {
                this.showToast(problem, 'error');
                return;
            }
            this.goToStep(5);
            this.renderReview();
            return;
        }
        if (this.step === this.totalSteps) {
            this.submit();
            return;
        }

        // Entering step 4 builds the config forms; entering 5 builds the review.
        if (this.step + 1 === 4) {
            this.goToStep(4);
            this.renderConfig();
            return;
        }

        this.goToStep(this.step + 1);
    }

    prev() {
        if (this.step > 1) this.goToStep(this.step - 1);
    }

    updateFoot() {
        const nextBtn = document.getElementById('mcpNextBtn');
        const hint = document.getElementById('mcpStepHint');
        const prereqBtn = document.getElementById('mcpCheckPrereqBtn');

        const hints = {
            1: 'Select one or more AI agents',
            2: 'Choose where to write the configuration',
            3: 'Select the MCP servers to install',
            4: 'Fill in credentials and optional instructions',
            5: 'Review and write the configuration files'
        };

        if (hint) hint.textContent = hints[this.step] || '';

        if (nextBtn) {
            if (this.step === this.totalSteps) {
                nextBtn.innerHTML = '<i class="fas fa-check"></i> Write integration files';
            } else {
                nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
            }
        }

        if (prereqBtn) {
            prereqBtn.hidden = this.step !== 5;
        }
    }

    // -------------------------------------------------------------------------
    // Prerequisites
    // -------------------------------------------------------------------------
    checkPrerequisites() {
        const result = document.getElementById('mcpPrereqResult');
        if (result) {
            result.hidden = false;
            result.innerHTML = '<p class="mcp-loading"><span class="af-spinner af-spinner-sm"></span> Checking prerequisites across tools…</p>';
        }
        this.sendMessage('mcpCheckPrerequisites', {
            serverIds: Array.from(this.selectedServers)
        });
    }

    showPrerequisiteResult(payload) {
        const result = document.getElementById('mcpPrereqResult');
        if (!result) return;

        result.hidden = false;

        const lines = (payload.lines || []).map((line) => {
            const ok = line.indexOf('$(check)') === 0;
            const text = line.replace('$(check) ', '').replace('$(error) ', '');
            return `<li class="${ok ? 'is-ok' : 'is-missing'}">
                <i class="fas ${ok ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                ${this.escape(text)}
            </li>`;
        }).join('');

        const missing = (payload.missing || []).map((m) => `
            <div class="mcp-missing-item">
                <p class="mcp-missing-name">${this.escape(m.name)}</p>
                <p class="mcp-missing-why">${this.escape(m.purpose)}</p>
                <div class="mcp-missing-cmd">
                    <code>${this.escape(m.command)}</code>
                    <button class="link-btn mcp-copy-btn" type="button"
                        data-copy="${this.escape(m.command)}">Copy</button>
                </div>
            </div>
        `).join('');

        result.innerHTML = `
            <p class="mcp-prereq-title">
                ${payload.satisfied
                    ? '<i class="fas fa-check-circle"></i> All prerequisites are installed'
                    : '<i class="fas fa-exclamation-triangle"></i> Missing prerequisites'}
            </p>
            <ul class="mcp-prereq-list">${lines}</ul>
            ${missing ? `<div class="mcp-missing">${missing}</div>` : ''}
        `;

        result.querySelectorAll('.mcp-copy-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-copy') || '';
                navigator.clipboard.writeText(text).then(() => {
                    this.showToast('Install command copied to clipboard.', 'success');
                });
            });
        });
    }

    // -------------------------------------------------------------------------
    // Submit
    // -------------------------------------------------------------------------
    submit() {
        const config = this.collectConfig();

        this.sendMessage('mcpWrite', {
            agentIds: Array.from(this.selectedAgents),
            scope: this.scope,
            serverIds: Array.from(this.selectedServers),
            parameters: config.parameters,
            instructions: config.instructions,
            workspaceRoot: this.workspaceRoot
        });

        const nextBtn = document.getElementById('mcpNextBtn');
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Writing…';
        }
    }

    onWriteDone(payload) {
        const nextBtn = document.getElementById('mcpNextBtn');
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.innerHTML = '<i class="fas fa-check"></i> Write integration files';
        }

        if (payload.cancelled) return;

        const modal = document.getElementById('mcpHubModal');
        if (modal) modal.hidden = true;

        if (payload.warnings && payload.warnings.length > 0) {
            this.showToast(`Written with ${payload.warnings.length} warning(s).`, 'error');
        }
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------
    sendMessage(command, data) {
        if (window.vscode && window.vscode.postMessage) {
            window.vscode.postMessage(Object.assign({ command }, data || {}));
        }
    }

    showToast(message, type) {
        // showToast lives on the real webview instance, not on the panel
        // bridge, so resolve it from window.airFlutterApp and avoid an
        // infinite loop through the bridge.
        const app = window.airFlutterApp;
        if (app && typeof app.showToast === 'function') {
            app.showToast(message, type);
        }
    }

    escape(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};
