// Agent Scaffold Module
window.AirFlutterAgentScaffoldModule = class AirFlutterAgentScaffoldModule {
    initAgentScaffoldModal() {
        const modal = document.getElementById('agentScaffoldModal');
        if (!modal) return;

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
        };

        modal.querySelectorAll('[data-stepper-next]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.scaffoldCurrentStep === 2) {
                    const modeRadio = document.querySelector('input[name="scaffoldGenMode"]:checked');
                    if (modeRadio && modeRadio.value === 'team') {
                        const checkedRoles = Array.from(modal.querySelectorAll('input[name="scaffoldTeamRoles"]:checked'));
                        if (checkedRoles.length < 2) {
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

        // Mode change (single vs team)
        modal.querySelectorAll('input[name="scaffoldGenMode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const singlePicker = document.getElementById('singleRolePickerContainer');
                const teamPicker = document.getElementById('teamRolePickerContainer');
                if (singlePicker && teamPicker) {
                    const isTeam = radio.value === 'team';
                    singlePicker.hidden = isTeam;
                    teamPicker.hidden = !isTeam;
                }
            });
        });

        // Role change (show custom role if custom)
        modal.querySelectorAll('input[name="scaffoldRole"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const customRoleRow = document.getElementById('customRoleRow');
                if (customRoleRow) {
                    customRoleRow.hidden = radio.value !== 'custom';
                }
            });
        });

        // Team custom checkbox change
        const teamCustomCheckbox = document.getElementById('scaffoldTeamCustomCheckbox');
        if (teamCustomCheckbox) {
            teamCustomCheckbox.addEventListener('change', () => {
                const customTeamRoleRow = document.getElementById('customTeamRoleRow');
                if (customTeamRoleRow) {
                    customTeamRoleRow.hidden = !teamCustomCheckbox.checked;
                }
            });
        }

        // Tool level change (show custom tools if custom)
        modal.querySelectorAll('input[name="scaffoldToolLevel"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const customToolsRow = document.getElementById('customToolsRow');
                if (customToolsRow) {
                    customToolsRow.hidden = radio.value !== 'custom';
                }
            });
        });

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const locationRadio = document.querySelector('input[name="scaffoldLocation"]:checked');
                const targetLocationType = locationRadio ? locationRadio.value : 'workspace';
                const targetPath = document.getElementById('scaffoldExternalPathInput')?.value?.trim();

                const modeRadio = document.querySelector('input[name="scaffoldGenMode"]:checked');
                const generationMode = modeRadio ? modeRadio.value : 'single';

                let role = 'planner';
                let teamRoles = [];
                let customRoleName = '';
                let customRoleDescription = '';

                if (generationMode === 'team') {
                    teamRoles = Array.from(modal.querySelectorAll('input[name="scaffoldTeamRoles"]:checked')).map(cb => cb.value);
                    if (teamRoles.length < 2) {
                        this.showToast('Please select at least 2 roles for a workflow team', 'error');
                        return;
                    }
                    customRoleName = document.getElementById('customTeamRoleNameInput')?.value?.trim();
                    customRoleDescription = document.getElementById('customTeamRoleDescInput')?.value?.trim();
                } else {
                    const roleRadio = document.querySelector('input[name="scaffoldRole"]:checked');
                    role = roleRadio ? roleRadio.value : 'planner';
                    customRoleName = document.getElementById('customRoleNameInput')?.value?.trim();
                    customRoleDescription = document.getElementById('customRoleDescInput')?.value?.trim();
                }

                const frameworkRadio = document.querySelector('input[name="scaffoldFramework"]:checked');
                const framework = frameworkRadio ? frameworkRadio.value : 'antigravity';

                const toolRadio = document.querySelector('input[name="scaffoldToolLevel"]:checked');
                const toolLevel = toolRadio ? toolRadio.value : 'standard';
                const customTools = document.getElementById('customToolsInput')?.value?.trim();

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
                    customRoleName,
                    customRoleDescription,
                    framework,
                    toolLevel,
                    customTools,
                    contentMode
                });
            });
        }
    }

    // --- Compatibility Doctor & Auto-Fixer Modal ----------------------------
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
