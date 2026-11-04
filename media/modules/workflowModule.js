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
        const layoutField = document.getElementById('workflowLayoutField');

        const syncWorkflowLayoutVisibility = () => {
            const target = document.querySelector('input[name="workflowBuildTarget"]:checked')?.value;
            if (layoutField) layoutField.hidden = target !== 'both';
        };

        const closeModal = () => {
            modal.hidden = true;
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        document.querySelectorAll('input[name="workflowBuildTarget"]').forEach(input => {
            input.addEventListener('change', syncWorkflowLayoutVisibility);
        });
        syncWorkflowLayoutVisibility();

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
                const layoutRadio = document.querySelector('input[name="workflowLayout"]:checked');
                const workflowLayout = buildTarget === 'both' && layoutRadio ? layoutRadio.value : 'single';

                const modeRadio = document.querySelector('input[name="workflowBuildMode"]:checked');
                const buildMode = modeRadio ? modeRadio.value : 'release';

                const enableSigning = document.getElementById('workflowEnableSigning')?.checked ?? false;
                const enableCache = document.getElementById('workflowEnableCache')?.checked ?? true;
                const publishToReleases = document.getElementById('workflowPublishToReleases')?.checked ?? false;
                const retentionDays = Number(document.getElementById('workflowRetentionDays')?.value ?? 14);
                const timeoutMinutes = Number(document.getElementById('workflowTimeoutMinutes')?.value ?? 60);

                if (!projectPath) {
                    this.showToast('Please select a valid project path', 'error');
                    return;
                }

                if (!Number.isInteger(retentionDays) || retentionDays < 1) {
                    this.showToast('Artifact retention must be a positive integer', 'error');
                    return;
                }

                if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > 360) {
                    this.showToast('Job timeout must be an integer between 1 and 360 minutes', 'error');
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
                    workflowLayout,
                    buildMode,
                    enableSigning,
                    enableCache,
                    publishToReleases,
                    retentionDays,
                    timeoutMinutes
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
