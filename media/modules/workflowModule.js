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
        const preinstalledNdkToggle = document.getElementById('workflowUsePreinstalledNdk');
        const ndkVersionField = document.getElementById('workflowNdkVersionField');
        const preinstalledNdkInput = document.getElementById('workflowPreinstalledNdkVersion');
        const installAndroidToolsToggle = document.getElementById('workflowInstallAndroidTools');
        const androidToolsInstallFields = document.getElementById('workflowAndroidToolsInstallFields');
        const limitGradleMemoryToggle = document.getElementById('workflowLimitGradleMemory');
        const gradleMemoryFields = document.getElementById('workflowGradleMemoryFields');
        const troubleshootingBadge = document.getElementById('workflowTroubleshootingBadge');
        const flutterCacheToggle = document.getElementById('workflowFlutterCache');
        const publishToReleasesToggle = document.getElementById('workflowPublishToReleases');
        const releaseSettings = document.getElementById('workflowReleaseSettings');
        const releaseNameSource = document.getElementById('workflowReleaseNameSource');
        const releaseVersionSource = document.getElementById('workflowReleaseVersionSource');
        const releaseCustomNameField = document.getElementById('workflowReleaseCustomNameField');
        const releaseCustomVersionField = document.getElementById('workflowReleaseCustomVersionField');
        const releaseNameTemplateSelect = document.getElementById('workflowReleaseNameTemplate');
        const releaseTagTemplateSelect = document.getElementById('workflowReleaseTagTemplate');
        const artifactNameTemplateSelect = document.getElementById('workflowArtifactNameTemplate');
        const manualTriggerToggle = document.getElementById('workflowTriggerManual');
        const latestReleaseField = document.getElementById('workflowLatestReleaseField');

        const templateValue = (selectId, customInputId) => {
            const select = document.getElementById(selectId);
            const customInput = document.getElementById(customInputId);
            return select?.value === 'custom' ? customInput?.value?.trim() || '' : select?.value || '';
        };

        const slugify = value => value.toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[.-]+|[.-]+$/g, '');

        const renderReleaseTemplate = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => (
            Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
        ));

        const syncReleaseSettings = () => {
            const enabled = publishToReleasesToggle?.checked ?? false;
            const targetValue = document.querySelector('input[name="workflowBuildTarget"]:checked')?.value;
            const layoutValue = document.querySelector('input[name="workflowLayout"]:checked')?.value;
            const modeValue = document.querySelector('input[name="workflowBuildMode"]:checked')?.value || 'release';
            if (releaseSettings) releaseSettings.hidden = !enabled;
            if (latestReleaseField) {
                latestReleaseField.hidden = !(enabled && targetValue === 'both' && layoutValue === 'separate' && modeValue === 'release');
            }
            if (releaseCustomNameField) releaseCustomNameField.hidden = releaseNameSource?.value !== 'custom';
            if (releaseCustomVersionField) releaseCustomVersionField.hidden = releaseVersionSource?.value !== 'custom';

            const manualEnabled = manualTriggerToggle?.checked ?? false;
            [releaseNameSource, releaseVersionSource].forEach(select => {
                const option = select?.querySelector('option[value="manual"]');
                if (option) option.disabled = !manualEnabled;
                if (!manualEnabled && select?.value === 'manual') {
                    select.value = select === releaseNameSource ? 'repository' : 'pubspec';
                }
            });

            [
                [releaseNameTemplateSelect, 'workflowReleaseNameCustomTemplate'],
                [releaseTagTemplateSelect, 'workflowReleaseTagCustomTemplate'],
                [artifactNameTemplateSelect, 'workflowArtifactNameCustomTemplate']
            ].forEach(([select, inputId]) => {
                const input = document.getElementById(inputId);
                if (input) input.hidden = select?.value !== 'custom';
            });

            const projectPath = document.getElementById('workflowProjectPathInput')?.value?.trim() || 'my-app';
            const repositoryName = projectPath.split(/[\\/]/).filter(Boolean).at(-1) || 'my-app';
            const repositoryDisplay = repositoryName.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
            const customName = document.getElementById('workflowReleaseCustomName')?.value?.trim();
            const appName = releaseNameSource?.value === 'custom'
                ? customName || 'My App'
                : releaseNameSource?.value === 'manual' ? 'Manual App' : repositoryDisplay;
            const customVersion = document.getElementById('workflowReleaseCustomVersion')?.value?.trim();
            const version = releaseVersionSource?.value === 'run_number'
                ? '25'
                : releaseVersionSource?.value === 'custom' ? customVersion || '1.2.0' : '1.2.0';
            const target = targetValue === 'appbundle' ? 'aab' : targetValue === 'both' ? 'android' : 'apk';
            const latestTarget = document.querySelector('input[name="workflowLatestReleaseTarget"]:checked')?.value || 'apk';
            const previewTarget = targetValue === 'both' && layoutValue === 'separate' ? latestTarget : target;
            const mode = modeValue;
            const values = {
                app: appName,
                slug: slugify(appName),
                version,
                build: '15',
                fullVersion: `${version}+15`,
                run: '25',
                attempt: '1',
                target: previewTarget,
                mode,
                branch: document.getElementById('workflowBranchInput')?.value?.trim() || 'main'
            };
            const nameTemplate = templateValue('workflowReleaseNameTemplate', 'workflowReleaseNameCustomTemplate');
            const tagTemplate = templateValue('workflowReleaseTagTemplate', 'workflowReleaseTagCustomTemplate');
            const artifactTemplate = templateValue('workflowArtifactNameTemplate', 'workflowArtifactNameCustomTemplate');
            let tagPreview = renderReleaseTemplate(tagTemplate, values);
            if (!tagTemplate.includes('{run}')) tagPreview += '-build-25';
            if (!tagTemplate.includes('{attempt}')) tagPreview += '-attempt-1';
            if (targetValue === 'both' && layoutValue === 'separate' && !tagTemplate.includes('{target}')) tagPreview += `-${previewTarget}`;

            let releaseNamePreview = renderReleaseTemplate(nameTemplate, values);
            if (targetValue === 'both' && layoutValue === 'separate' && !nameTemplate.includes('{target}')) {
                releaseNamePreview += ` — ${previewTarget.toUpperCase()}`;
            }

            const namePreview = document.getElementById('workflowReleaseNamePreview');
            const tagPreviewElement = document.getElementById('workflowReleaseTagPreview');
            const artifactPreview = document.getElementById('workflowArtifactNamePreview');
            if (namePreview) namePreview.textContent = releaseNamePreview;
            if (tagPreviewElement) tagPreviewElement.textContent = slugify(tagPreview);
            if (artifactPreview) artifactPreview.textContent = slugify(renderReleaseTemplate(artifactTemplate, values));
        };

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
            input.addEventListener('change', () => {
                syncWorkflowLayoutVisibility();
                syncReleaseSettings();
            });
        });
        document.querySelectorAll('input[name="workflowLayout"]').forEach(input => {
            input.addEventListener('change', syncReleaseSettings);
        });
        syncWorkflowLayoutVisibility();

        const syncAndroidToolsState = () => {
            const usePreinstalledNdk = preinstalledNdkToggle?.checked ?? true;
            const installAndroidTools = installAndroidToolsToggle?.checked ?? false;
            if (ndkVersionField) ndkVersionField.hidden = !usePreinstalledNdk;
            if (preinstalledNdkInput) preinstalledNdkInput.disabled = !usePreinstalledNdk;
            if (androidToolsInstallFields) androidToolsInstallFields.hidden = !installAndroidTools;
            if (gradleMemoryFields) gradleMemoryFields.hidden = !(limitGradleMemoryToggle?.checked ?? false);

            const gradleCacheProvider = document.querySelector('input[name="workflowGradleCacheProvider"]:checked')?.value;
            const activeCount = Number(usePreinstalledNdk || installAndroidTools)
                + Number(limitGradleMemoryToggle?.checked ?? false)
                + Number(flutterCacheToggle?.checked ?? false)
                + Number(gradleCacheProvider !== 'none');
            if (troubleshootingBadge) troubleshootingBadge.textContent = `${activeCount} active`;
        };
        if (preinstalledNdkToggle) {
            preinstalledNdkToggle.addEventListener('change', () => {
                if (preinstalledNdkToggle.checked && installAndroidToolsToggle) {
                    installAndroidToolsToggle.checked = false;
                }
                syncAndroidToolsState();
            });
        }
        if (installAndroidToolsToggle) {
            installAndroidToolsToggle.addEventListener('change', () => {
                if (installAndroidToolsToggle.checked && preinstalledNdkToggle) {
                    preinstalledNdkToggle.checked = false;
                }
                syncAndroidToolsState();
            });
        }
        if (limitGradleMemoryToggle) {
            limitGradleMemoryToggle.addEventListener('change', syncAndroidToolsState);
        }
        if (flutterCacheToggle) {
            flutterCacheToggle.addEventListener('change', syncAndroidToolsState);
        }
        document.querySelectorAll('input[name="workflowGradleCacheProvider"]').forEach(input => {
            input.addEventListener('change', syncAndroidToolsState);
        });
        syncAndroidToolsState();

        [publishToReleasesToggle, releaseNameSource, releaseVersionSource, manualTriggerToggle,
            releaseNameTemplateSelect, releaseTagTemplateSelect, artifactNameTemplateSelect]
            .filter(Boolean)
            .forEach(input => input.addEventListener('change', syncReleaseSettings));
        document.querySelectorAll('input[name="workflowBuildMode"]').forEach(input => input.addEventListener('change', syncReleaseSettings));
        document.querySelectorAll('input[name="workflowLatestReleaseTarget"]').forEach(input => input.addEventListener('change', syncReleaseSettings));
        [
            'workflowProjectPathInput', 'workflowBranchInput', 'workflowReleaseCustomName', 'workflowReleaseCustomVersion',
            'workflowReleaseNameCustomTemplate', 'workflowReleaseTagCustomTemplate', 'workflowArtifactNameCustomTemplate'
        ].forEach(id => document.getElementById(id)?.addEventListener('input', syncReleaseSettings));
        syncReleaseSettings();

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
                const usePreinstalledNdk = document.getElementById('workflowUsePreinstalledNdk')?.checked ?? true;
                const installAndroidTools = document.getElementById('workflowInstallAndroidTools')?.checked ?? false;
                const preinstalledNdkVersion = document.getElementById('workflowPreinstalledNdkVersion')?.value?.trim();
                const installedNdkVersion = document.getElementById('workflowInstalledNdkVersion')?.value?.trim();
                const ndkVersion = installAndroidTools
                    ? installedNdkVersion || '28.2.13676358'
                    : preinstalledNdkVersion || '27.3.13750724';
                const cmakeVersion = document.getElementById('workflowCmakeVersion')?.value?.trim() || '3.22.1';
                const limitGradleMemory = document.getElementById('workflowLimitGradleMemory')?.checked ?? false;
                const gradleHeapMb = Number(document.getElementById('workflowGradleHeapMb')?.value ?? 2048);
                const gradleMetaspaceMb = Number(document.getElementById('workflowGradleMetaspaceMb')?.value ?? 512);
                const gradleWorkers = Number(document.getElementById('workflowGradleWorkers')?.value ?? 2);
                const disableGradleParallel = document.getElementById('workflowDisableGradleParallel')?.checked ?? true;
                const disableGradleDaemon = document.getElementById('workflowDisableGradleDaemon')?.checked ?? true;
                const flutterCache = document.getElementById('workflowFlutterCache')?.checked ?? true;
                const gradleCacheProvider = document.querySelector('input[name="workflowGradleCacheProvider"]:checked')?.value || 'setup-gradle';

                const enableSigning = document.getElementById('workflowEnableSigning')?.checked ?? false;
                const publishToReleases = document.getElementById('workflowPublishToReleases')?.checked ?? false;
                const releaseNameSourceValue = releaseNameSource?.value || 'repository';
                const releaseCustomName = document.getElementById('workflowReleaseCustomName')?.value?.trim() || '';
                const releaseVersionSourceValue = releaseVersionSource?.value || 'pubspec';
                const releaseCustomVersion = document.getElementById('workflowReleaseCustomVersion')?.value?.trim() || '';
                const releaseNameTemplate = templateValue('workflowReleaseNameTemplate', 'workflowReleaseNameCustomTemplate');
                const releaseTagTemplate = templateValue('workflowReleaseTagTemplate', 'workflowReleaseTagCustomTemplate');
                const artifactNameTemplate = templateValue('workflowArtifactNameTemplate', 'workflowArtifactNameCustomTemplate');
                const latestReleaseTarget = document.querySelector('input[name="workflowLatestReleaseTarget"]:checked')?.value || 'apk';
                const retentionDays = Number(document.getElementById('workflowRetentionDays')?.value ?? 14);
                const timeoutMinutes = Number(document.getElementById('workflowTimeoutMinutes')?.value ?? 60);

                if (!projectPath) {
                    this.showToast('Please select a valid project path', 'error');
                    return;
                }

                if (publishToReleases && releaseNameSourceValue === 'custom' && !releaseCustomName) {
                    this.showToast('Enter a custom app name for the release', 'error');
                    return;
                }
                if (publishToReleases && releaseVersionSourceValue === 'custom' && !releaseCustomVersion) {
                    this.showToast('Enter a fixed release version', 'error');
                    return;
                }
                const allowedVariables = new Set(['app', 'slug', 'version', 'build', 'fullVersion', 'run', 'attempt', 'target', 'mode', 'branch']);
                for (const [label, template] of [['Release name', releaseNameTemplate], ['Tag', releaseTagTemplate], ['Artifact name', artifactNameTemplate]]) {
                    const variables = [...template.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]);
                    if (publishToReleases && (!template || variables.some(variable => !allowedVariables.has(variable)))) {
                        this.showToast(`${label} template is empty or contains an unknown variable`, 'error');
                        return;
                    }
                }

                if (!Number.isInteger(retentionDays) || retentionDays < 1) {
                    this.showToast('Artifact retention must be a positive integer', 'error');
                    return;
                }

                if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > 360) {
                    this.showToast('Job timeout must be an integer between 1 and 360 minutes', 'error');
                    return;
                }

                if (limitGradleMemory && (!Number.isInteger(gradleHeapMb) || gradleHeapMb < 512 || gradleHeapMb > 6144)) {
                    this.showToast('Gradle heap must be an integer from 512 to 6144 MB', 'error');
                    return;
                }
                if (limitGradleMemory && (!Number.isInteger(gradleMetaspaceMb) || gradleMetaspaceMb < 256 || gradleMetaspaceMb > 2048)) {
                    this.showToast('Gradle Metaspace must be an integer from 256 to 2048 MB', 'error');
                    return;
                }
                if (limitGradleMemory && (!Number.isInteger(gradleWorkers) || gradleWorkers < 1 || gradleWorkers > 4)) {
                    this.showToast('Gradle workers must be an integer from 1 to 4', 'error');
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
                    usePreinstalledNdk,
                    installAndroidTools,
                    ndkVersion,
                    cmakeVersion,
                    limitGradleMemory,
                    gradleHeapMb,
                    gradleMetaspaceMb,
                    gradleWorkers,
                    disableGradleParallel,
                    disableGradleDaemon,
                    flutterCache,
                    gradleCacheProvider,
                    enableSigning,
                    enableCache: gradleCacheProvider !== 'none',
                    publishToReleases,
                    releaseNameSource: releaseNameSourceValue,
                    releaseCustomName,
                    releaseVersionSource: releaseVersionSourceValue,
                    releaseCustomVersion,
                    releaseNameTemplate,
                    releaseTagTemplate,
                    artifactNameTemplate,
                    latestReleaseTarget,
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
                input.dispatchEvent(new Event('input', { bubbles: true }));
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
