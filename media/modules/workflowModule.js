// Workflow Generator Module
window.AirFlutterWorkflowModule = class AirFlutterWorkflowModule {
    initWorkflowModal() {
        const modal = document.getElementById('workflowModal');
        if (!modal) return;

        const closeBtn = document.getElementById('closeWorkflowModalBtn');
        const cancelBtn = document.getElementById('cancelWorkflowModalBtn');
        const browseBtn = document.getElementById('browseWorkflowProjectBtn');
        const signingToggle = document.getElementById('workflowEnableSigning');
        const secretsBox = document.getElementById('workflowSecretsBox');
        const submitBtn = document.getElementById('generateWorkflowSubmitBtn');

        const closeModal = () => {
            modal.hidden = true;
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.sendMessage('selectWorkflowProject', {});
            });
        }

        if (signingToggle && secretsBox) {
            signingToggle.addEventListener('change', () => {
                secretsBox.hidden = !signingToggle.checked;
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('workflowProjectPathInput')?.value?.trim();
                const branch = document.getElementById('workflowBranchInput')?.value?.trim() || 'main';
                const triggerOnPush = document.getElementById('workflowTriggerPush')?.checked ?? true;
                const triggerOnPr = document.getElementById('workflowTriggerPr')?.checked ?? false;
                const triggerManual = document.getElementById('workflowTriggerManual')?.checked ?? true;

                const targetRadio = document.querySelector('input[name="workflowBuildTarget"]:checked');
                const buildTarget = targetRadio ? targetRadio.value : 'universal_apk';

                const modeRadio = document.querySelector('input[name="workflowBuildMode"]:checked');
                const buildMode = modeRadio ? modeRadio.value : 'release';

                const enableSigning = document.getElementById('workflowEnableSigning')?.checked ?? false;
                const enableCache = document.getElementById('workflowEnableCache')?.checked ?? true;

                if (!projectPath) {
                    this.showToast('Please select a valid project path', 'error');
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Generating…';

                this.sendMessage('generateWorkflow', {
                    projectPath,
                    branch,
                    triggerOnPush,
                    triggerOnPr,
                    triggerManual,
                    buildTarget,
                    buildMode,
                    enableSigning,
                    enableCache
                });
            });
        }
    }

    openWorkflowModal(defaultPath) {
        const modal = document.getElementById('workflowModal');
        if (modal) {
            modal.hidden = false;
            const input = document.getElementById('workflowProjectPathInput');
            if (input && defaultPath) {
                input.value = defaultPath;
            } else if (!input?.value) {
                this.sendMessage('getWorkflowInitialPath', {});
            }
            const submitBtn = document.getElementById('generateWorkflowSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Workflow';
            }
        }
    }

    // --- Flavors Modal -----------------------------------------------------

};
