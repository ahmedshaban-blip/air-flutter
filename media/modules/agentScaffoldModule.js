// Agent Scaffold Module
window.AirFlutterAgentScaffoldModule = class AirFlutterAgentScaffoldModule {
    initAgentScaffoldModal() {
        const modal = document.getElementById('agentScaffoldModal');
        if (!modal) return;

        const ROLE_METADATA = {
            planner: { title: 'Planner / Analyst', icon: 'fa-clipboard-list', tools: ['read_file', 'list_dir', 'grep_search', 'find_by_name', 'search_web', 'read_url_content'] },
            architect: { title: 'System Architect', icon: 'fa-sitemap', tools: ['read_file', 'write_file', 'replace_file_content', 'list_dir', 'grep_search', 'find_by_name', 'search_web', 'read_url_content'] },
            developer: { title: 'Developer / Coder', icon: 'fa-code', tools: ['read_file', 'write_file', 'replace_file_content', 'list_dir', 'grep_search', 'find_by_name', 'run_command'] },
            qa: { title: 'QA & Reviewer', icon: 'fa-vial-circle-check', tools: ['read_file', 'write_file', 'replace_file_content', 'list_dir', 'grep_search', 'find_by_name', 'run_command'] },
            flutter_ui: { title: 'Flutter UI', icon: 'fa-mobile-screen', tools: ['read_file', 'write_file', 'replace_file_content', 'list_dir', 'grep_search', 'find_by_name', 'run_command'] },
            flutter_state: { title: 'Flutter Bloc', icon: 'fa-cubes', tools: ['read_file', 'write_file', 'replace_file_content', 'list_dir', 'grep_search', 'find_by_name', 'run_command'] },
            custom: { title: 'Custom Agent', icon: 'fa-sliders', tools: ['read_file', 'write_file', 'replace_file_content', 'list_dir', 'grep_search', 'find_by_name', 'run_command'] }
        };

        this.pipelineOrder = ['planner', 'architect', 'developer', 'qa'];
        this.agentToolsMap = {};
        this.activeToolRole = 'planner';

        // Pre-populate default tools map
        Object.keys(ROLE_METADATA).forEach(role => {
            this.agentToolsMap[role] = [...ROLE_METADATA[role].tools];
        });

        const closeBtn = document.getElementById('closeAgentScaffoldModalBtn');
        const cancelBtn = document.getElementById('cancelAgentScaffoldModalBtn');
        const browseBtn = document.getElementById('browseScaffoldProjectBtn');
        const submitBtn = document.getElementById('scaffoldSubmitBtn');

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.sendMessage('selectAgentScaffoldProject', {});
            });
        }

        // Stepper Navigation
        this.scaffoldCurrentStep = 1;
        const setStep = (step) => {
            this.scaffoldCurrentStep = Math.max(1, Math.min(5, step));
            modal.querySelectorAll('.stepper-step').forEach(s => {
                const stepNum = parseInt(s.dataset.step, 10);
                s.classList.toggle('is-active', stepNum === this.scaffoldCurrentStep);
                s.classList.toggle('is-completed', stepNum < this.scaffoldCurrentStep);
            });
            modal.querySelectorAll('.stepper-pane').forEach(p => {
                const stepNum = parseInt(p.dataset.step, 10);
                p.classList.toggle('is-active', stepNum === this.scaffoldCurrentStep);
            });

            // Trigger Step-specific UI refresh
            if (this.scaffoldCurrentStep === 4) {
                this.refreshToolsStepUI();
            }
        };

        modal.querySelectorAll('[data-stepper-next]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.scaffoldCurrentStep === 2) {
                    const mode = document.getElementById('scaffoldGenModeInput')?.value || 'single';
                    if (mode === 'team') {
                        if (this.pipelineOrder.length < 2) {
                            this.showToast('Please select at least 2 roles to build a workflow team', 'error');
                            return;
                        }
                    }
                }
                setStep(this.scaffoldCurrentStep + 1);
            });
        });

        modal.querySelectorAll('[data-stepper-back]').forEach(btn => {
            btn.addEventListener('click', () => setStep(this.scaffoldCurrentStep - 1));
        });

        // Location type change
        modal.querySelectorAll('input[name="scaffoldLocation"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const pathRow = document.getElementById('scaffoldExternalPathRow');
                if (pathRow) {
                    pathRow.hidden = !(radio.value === 'external' || radio.value === 'custom');
                }
            });
        });

        // --- Step 2: Segmented Control (Single vs Team) ---
        const segmentedControl = document.getElementById('genModeSegmentedControl');
        const genModeInput = document.getElementById('scaffoldGenModeInput');
        const singlePicker = document.getElementById('singleRolePickerContainer');
        const teamPicker = document.getElementById('teamRolePickerContainer');
        const customBuilder = document.getElementById('customAgentBuilderSection');

        const updateCustomBuilderVisibility = () => {
            const mode = genModeInput ? genModeInput.value : 'single';
            if (mode === 'single') {
                const currentSingleRole = document.querySelector('input[name="scaffoldRole"]:checked')?.value;
                if (customBuilder) customBuilder.hidden = currentSingleRole !== 'custom';
            } else {
                const customChecked = document.getElementById('scaffoldTeamCustomCheckbox')?.checked;
                if (customBuilder) customBuilder.hidden = !customChecked;
            }
        };

        if (segmentedControl) {
            segmentedControl.querySelectorAll('.segmented-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.dataset.mode;
                    segmentedControl.querySelectorAll('.segmented-btn').forEach(b => b.classList.toggle('is-active', b === btn));
                    if (genModeInput) genModeInput.value = mode;

                    if (singlePicker && teamPicker) {
                        const isTeam = mode === 'team';
                        singlePicker.hidden = isTeam;
                        teamPicker.hidden = !isTeam;
                    }
                    updateCustomBuilderVisibility();
                });
            });
        }

        // Single Role Change
        modal.querySelectorAll('input[name="scaffoldRole"]').forEach(radio => {
            radio.addEventListener('change', () => {
                updateCustomBuilderVisibility();
            });
        });

        // Team Mode: Pipeline Ordering Management
        const pipelineListEl = document.getElementById('pipelineOrderList');
        const flowPreviewEl = document.getElementById('pipelineFlowPreview');

        const renderPipeline = () => {
            if (!pipelineListEl) return;
            pipelineListEl.innerHTML = '';

            this.pipelineOrder.forEach((role, idx) => {
                const meta = ROLE_METADATA[role] || { title: role, icon: 'fa-robot' };
                const item = document.createElement('div');
                item.className = 'pipeline-item';

                item.innerHTML = `
                    <div class="pipeline-item-left">
                        <i class="fas fa-grip-vertical" style="color: var(--muted); cursor: grab;"></i>
                        <span class="pipeline-stage-badge">Stage ${idx + 1}</span>
                        <span class="pipeline-item-title"><i class="fas ${meta.icon}"></i> ${meta.title}</span>
                    </div>
                    <div class="pipeline-actions">
                        <button type="button" class="pipeline-btn btn-move-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Earlier">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <button type="button" class="pipeline-btn btn-move-down" data-idx="${idx}" ${idx === this.pipelineOrder.length - 1 ? 'disabled' : ''} title="Move Later">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <button type="button" class="pipeline-btn btn-remove-role" data-role="${role}" title="Remove from Team" ${this.pipelineOrder.length <= 2 ? 'disabled' : ''}>
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;

                // Move Up
                item.querySelector('.btn-move-up')?.addEventListener('click', () => {
                    if (idx > 0) {
                        const temp = this.pipelineOrder[idx];
                        this.pipelineOrder[idx] = this.pipelineOrder[idx - 1];
                        this.pipelineOrder[idx - 1] = temp;
                        renderPipeline();
                    }
                });

                // Move Down
                item.querySelector('.btn-move-down')?.addEventListener('click', () => {
                    if (idx < this.pipelineOrder.length - 1) {
                        const temp = this.pipelineOrder[idx];
                        this.pipelineOrder[idx] = this.pipelineOrder[idx + 1];
                        this.pipelineOrder[idx + 1] = temp;
                        renderPipeline();
                    }
                });

                // Remove
                item.querySelector('.btn-remove-role')?.addEventListener('click', () => {
                    if (this.pipelineOrder.length > 2) {
                        this.pipelineOrder = this.pipelineOrder.filter(r => r !== role);
                        const cb = modal.querySelector(`input[name="scaffoldTeamRoles"][value="${role}"]`);
                        if (cb) cb.checked = false;
                        updateCustomBuilderVisibility();
                        renderPipeline();
                    }
                });

                pipelineListEl.appendChild(item);
            });

            // Flow Preview Breadcrumb
            if (flowPreviewEl) {
                flowPreviewEl.innerHTML = this.pipelineOrder.map((r, i) => {
                    const meta = ROLE_METADATA[r] || { title: r };
                    const isLast = i === this.pipelineOrder.length - 1;
                    return `<span class="flow-step-tag">${meta.title}</span>${!isLast ? '<span class="flow-step-arrow"><i class="fas fa-arrow-right"></i></span>' : ''}`;
                }).join(' ');
            }
        };

        renderPipeline();

        // Checkbox toggle in Team Mode
        modal.querySelectorAll('input[name="scaffoldTeamRoles"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const role = cb.value;
                if (cb.checked) {
                    if (!this.pipelineOrder.includes(role)) {
                        this.pipelineOrder.push(role);
                    }
                } else {
                    if (this.pipelineOrder.length <= 2) {
                        cb.checked = true;
                        this.showToast('At least 2 roles must remain in the team pipeline', 'error');
                        return;
                    }
                    this.pipelineOrder = this.pipelineOrder.filter(r => r !== role);
                }
                updateCustomBuilderVisibility();
                renderPipeline();
            });
        });

        // --- Custom Agent Accordion Management ---
        modal.querySelectorAll('.accordion-head').forEach(head => {
            head.addEventListener('click', () => {
                const item = head.closest('.accordion-item');
                if (item) {
                    item.classList.toggle('is-open');
                }
            });
        });

        // --- Step 4: Per-Agent Tools Selection ---
        this.saveCurrentToolsFromCheckboxes = () => {
            const role = this.activeToolRole;
            if (!role) return;
            const checkedTools = [];
            modal.querySelectorAll('#toolGroupsContainer input[data-tool]:checked').forEach(input => {
                checkedTools.push(input.dataset.tool);
            });
            this.agentToolsMap[role] = checkedTools;
        };

        this.loadToolsIntoCheckboxes = (role) => {
            const tools = this.agentToolsMap[role] || ROLE_METADATA[role]?.tools || [];
            modal.querySelectorAll('#toolGroupsContainer input[data-tool]').forEach(input => {
                input.checked = tools.includes(input.dataset.tool);
            });
        };

        modal.querySelectorAll('#toolGroupsContainer input[data-tool]').forEach(input => {
            input.addEventListener('change', () => {
                this.saveCurrentToolsFromCheckboxes();
            });
        });

        const resetToolsBtn = document.getElementById('resetRoleToolsBtn');
        if (resetToolsBtn) {
            resetToolsBtn.addEventListener('click', () => {
                const role = this.activeToolRole;
                if (role && ROLE_METADATA[role]) {
                    this.agentToolsMap[role] = [...ROLE_METADATA[role].tools];
                    this.loadToolsIntoCheckboxes(role);
                    this.showToast(`Reset tools for ${ROLE_METADATA[role].title}`, 'info');
                }
            });
        }

        this.refreshToolsStepUI = () => {
            const mode = genModeInput ? genModeInput.value : 'single';
            const tabBar = document.getElementById('toolsAgentTabBar');
            const subtitle = document.getElementById('toolsStepSubtitle');

            if (mode === 'single') {
                if (tabBar) tabBar.hidden = true;
                const role = document.querySelector('input[name="scaffoldRole"]:checked')?.value || 'planner';
                this.activeToolRole = role;
                if (subtitle) subtitle.textContent = `Configuring allowed tools for: ${ROLE_METADATA[role]?.title || role}`;
                this.loadToolsIntoCheckboxes(role);
            } else {
                if (tabBar) {
                    tabBar.hidden = false;
                    tabBar.innerHTML = '';
                    this.pipelineOrder.forEach(role => {
                        const meta = ROLE_METADATA[role] || { title: role, icon: 'fa-robot' };
                        const tabBtn = document.createElement('button');
                        tabBtn.type = 'button';
                        tabBtn.className = `tool-agent-tab ${role === this.activeToolRole ? 'is-active' : ''}`;
                        tabBtn.innerHTML = `<i class="fas ${meta.icon}"></i> ${meta.title}`;

                        tabBtn.addEventListener('click', () => {
                            this.saveCurrentToolsFromCheckboxes();
                            this.activeToolRole = role;
                            tabBar.querySelectorAll('.tool-agent-tab').forEach(t => t.classList.toggle('is-active', t === tabBtn));
                            if (subtitle) subtitle.textContent = `Configuring tools for: ${meta.title}`;
                            this.loadToolsIntoCheckboxes(role);
                        });

                        tabBar.appendChild(tabBtn);
                    });
                }

                if (!this.pipelineOrder.includes(this.activeToolRole)) {
                    this.activeToolRole = this.pipelineOrder[0] || 'planner';
                }
                const meta = ROLE_METADATA[this.activeToolRole] || { title: this.activeToolRole };
                if (subtitle) subtitle.textContent = `Configuring tools for: ${meta.title}`;
                this.loadToolsIntoCheckboxes(this.activeToolRole);
            }
        };

        // --- Submit Generation ---
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.saveCurrentToolsFromCheckboxes();

                const locationRadio = document.querySelector('input[name="scaffoldLocation"]:checked');
                const targetLocationType = locationRadio ? locationRadio.value : 'workspace';
                const targetPath = document.getElementById('scaffoldExternalPathInput')?.value?.trim();

                const mode = genModeInput ? genModeInput.value : 'single';
                const generationMode = mode;

                let role = 'planner';
                let teamRoles = [];
                let pipelineOrder = [];

                if (generationMode === 'team') {
                    pipelineOrder = [...this.pipelineOrder];
                    teamRoles = [...this.pipelineOrder];
                    if (teamRoles.length < 2) {
                        this.showToast('Please select at least 2 roles for a workflow team', 'error');
                        return;
                    }
                } else {
                    const roleRadio = document.querySelector('input[name="scaffoldRole"]:checked');
                    role = roleRadio ? roleRadio.value : 'planner';
                }

                // Custom Agent Details
                const customRoleName = document.getElementById('customRoleNameInput')?.value?.trim();
                const customRoleDesc = document.getElementById('customRoleDescInput')?.value?.trim();
                const customRoleModel = document.getElementById('customRoleModelSelect')?.value;
                const customRolePrompt = document.getElementById('customRolePromptInput')?.value?.trim();
                const customRoleInputs = document.getElementById('customRoleInputsInput')?.value?.trim();
                const customRoleProcessing = document.getElementById('customRoleProcessingInput')?.value?.trim();
                const customRoleHandoff = document.getElementById('customRoleHandoffInput')?.value?.trim();
                const customRoleRulesRaw = document.getElementById('customRoleRulesInput')?.value?.trim();
                const customRoleRules = customRoleRulesRaw ? customRoleRulesRaw.split('\n').map(r => r.trim()).filter(r => r.length > 0) : undefined;
                const customRoleVerification = document.getElementById('customRoleVerificationInput')?.value?.trim();

                const customAgentDetails = {
                    name: customRoleName,
                    id: customRoleName ? customRoleName.toLowerCase().replace(/[^a-z0-9_]/g, '_') : undefined,
                    model: customRoleModel,
                    purpose: customRoleDesc,
                    systemPrompt: customRolePrompt,
                    inputs: customRoleInputs,
                    processing: customRoleProcessing,
                    handoff: customRoleHandoff,
                    rules: customRoleRules,
                    verification: customRoleVerification,
                    tools: this.agentToolsMap['custom']
                };

                const frameworkRadio = document.querySelector('input[name="scaffoldFramework"]:checked');
                const framework = frameworkRadio ? frameworkRadio.value : 'antigravity';

                const contentRadio = document.querySelector('input[name="scaffoldContentMode"]:checked');
                const contentMode = contentRadio ? contentRadio.value : 'fully_populated';

                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Scaffolding…';

                this.sendMessage('generateAgentScaffold', {
                    targetLocationType,
                    targetPath,
                    generationMode,
                    role,
                    teamRoles,
                    pipelineOrder,
                    agentToolsMap: this.agentToolsMap,
                    customRoleName,
                    customRoleDescription: customRoleDesc,
                    customAgentDetails,
                    framework,
                    toolLevel: 'standard',
                    contentMode
                });
            });
        }
    }

    openAgentScaffoldModal(defaultPath) {
        const modal = document.getElementById('agentScaffoldModal');
        if (modal) {
            modal.hidden = false;
            this.scaffoldCurrentStep = 1;
            modal.querySelectorAll('.stepper-step').forEach(s => {
                const stepNum = parseInt(s.dataset.step, 10);
                s.classList.toggle('is-active', stepNum === 1);
                s.classList.toggle('is-completed', false);
            });
            modal.querySelectorAll('.stepper-pane').forEach(p => {
                const stepNum = parseInt(p.dataset.step, 10);
                p.classList.toggle('is-active', stepNum === 1);
            });

            const pathInput = document.getElementById('scaffoldExternalPathInput');
            if (pathInput && defaultPath) {
                pathInput.value = defaultPath;
            }
            const submitBtn = document.getElementById('scaffoldSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-robot"></i> Generate Agent(s)';
            }
        }
    }
};
