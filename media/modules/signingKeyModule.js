window.AirFlutterSigningKeyModule = class AirFlutterSigningKeyModule {
    initSigningKeyModal() {
        const modal = document.getElementById('signingKeyModal');
        if (!modal) return;

        const close = () => {
            this.resetSigningKeyResult();
            modal.hidden = true;
        };
        document.getElementById('closeSigningKeyModalBtn')?.addEventListener('click', close);
        document.getElementById('cancelSigningKeyBtn')?.addEventListener('click', close);
        document.getElementById('browseSigningKeyProjectBtn')?.addEventListener('click', () => this.sendMessage('selectSigningKeyProject', {}));

        modal.querySelectorAll('[data-signing-mode]').forEach(button => {
            button.addEventListener('click', () => {
                modal.querySelectorAll('[data-signing-mode]').forEach(item => item.classList.toggle('is-active', item === button));
                document.getElementById('signingKeyAdvancedFields').hidden = button.dataset.signingMode !== 'advanced';
            });
        });

        document.getElementById('signingUseSamePassword')?.addEventListener('change', event => {
            document.getElementById('signingKeyPasswordFields').hidden = event.target.checked;
        });

        document.getElementById('toggleSigningPasswordsBtn')?.addEventListener('click', event => {
            const passwordInputs = modal.querySelectorAll('input[type="password"], input[data-password-visible="true"]');
            const shouldShow = Array.from(passwordInputs).some(input => input.type === 'password');
            passwordInputs.forEach(input => {
                input.type = shouldShow ? 'text' : 'password';
                input.dataset.passwordVisible = shouldShow ? 'true' : 'false';
            });
            event.currentTarget.innerHTML = shouldShow
                ? '<i class="fas fa-eye-slash"></i> Hide'
                : '<i class="fas fa-eye"></i> Show';
        });

        document.getElementById('createSigningKeyBtn')?.addEventListener('click', () => this.submitSigningKey());
        document.getElementById('createAnotherSigningKeyBtn')?.addEventListener('click', () => this.resetSigningKeyResult());
        document.getElementById('copySigningGuideBtn')?.addEventListener('click', async () => {
            if (!this.signingKeyGuide) return;
            try {
                await navigator.clipboard.writeText(this.signingKeyGuide);
                this.showToast('Complete signing guide copied', 'success');
            } catch (_error) {
                this.showToast('Could not copy the guide. Select the code blocks manually.', 'error');
            }
        });
    }

    openSigningKeyModal(defaultPath) {
        const modal = document.getElementById('signingKeyModal');
        if (!modal) return;
        modal.hidden = false;
        this.resetSigningKeyResult();
        const projectInput = document.getElementById('signingKeyProjectPath');
        if (projectInput && defaultPath) projectInput.value = defaultPath;
        document.getElementById('signingKeyFullName')?.focus();
    }

    submitSigningKey() {
        const inputValue = id => document.getElementById(id)?.value?.trim() || '';
        const storePassword = document.getElementById('signingStorePassword')?.value || '';
        const storePasswordConfirm = document.getElementById('signingStorePasswordConfirm')?.value || '';
        const useSamePassword = document.getElementById('signingUseSamePassword')?.checked ?? true;
        const keyPassword = useSamePassword ? storePassword : (document.getElementById('signingAliasPassword')?.value || '');
        const keyPasswordConfirm = useSamePassword ? storePasswordConfirm : (document.getElementById('signingAliasPasswordConfirm')?.value || '');
        const validityDays = Number(inputValue('signingValidityDays') || 10000);
        const keySize = Number(inputValue('signingKeySize') || 2048);

        const required = [
            ['signingKeyProjectPath', 'Select a Flutter project'],
            ['signingKeyFileName', 'Enter a key file name'],
            ['signingKeyAlias', 'Enter a key alias'],
            ['signingKeyFullName', 'Enter the certificate owner name']
        ];
        for (const [id, message] of required) {
            if (!inputValue(id)) {
                this.showToast(message, 'error');
                document.getElementById(id)?.focus();
                return;
            }
        }
        if (storePassword.length < 6) {
            this.showToast('Keystore password must contain at least 6 characters', 'error');
            document.getElementById('signingStorePassword')?.focus();
            return;
        }
        if (storePassword !== storePasswordConfirm) {
            this.showToast('Keystore passwords do not match', 'error');
            return;
        }
        if (keyPassword.length < 6 || keyPassword !== keyPasswordConfirm) {
            this.showToast('Key passwords must match and contain at least 6 characters', 'error');
            return;
        }
        if (!Number.isInteger(validityDays) || validityDays < 1) {
            this.showToast('Validity must be a positive whole number of days', 'error');
            return;
        }

        this.pendingSigningKey = {
            projectPath: inputValue('signingKeyProjectPath'),
            fileName: inputValue('signingKeyFileName'),
            alias: inputValue('signingKeyAlias'),
            storePassword,
            keyPassword,
            fullName: inputValue('signingKeyFullName'),
            organizationalUnit: inputValue('signingOrgUnit'),
            organization: inputValue('signingOrganization'),
            city: inputValue('signingCity'),
            state: inputValue('signingState'),
            countryCode: inputValue('signingCountry'),
            validityDays,
            keySize
        };

        const button = document.getElementById('createSigningKeyBtn');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating securely…';
        this.sendMessage('createSigningKey', this.pendingSigningKey);
    }

    handleSigningKeyCreated(generatedKey) {
        const options = this.pendingSigningKey;
        if (!options) return;

        document.getElementById('signingKeyFormView').hidden = true;
        document.getElementById('signingKeyResultView').hidden = false;
        document.getElementById('signingKeyModalFoot').hidden = true;
        document.getElementById('signingKeyResultPath').textContent = generatedKey.keyPath;

        const keyProperties = `storePassword=${options.storePassword}\nkeyPassword=${options.keyPassword}\nkeyAlias=${generatedKey.alias}\nstoreFile=${generatedKey.fileName}`;
        const gitignore = `android/key.properties\nandroid/app/*.jks\nandroid/app/*.keystore`;
        const base64Command = `[Convert]::ToBase64String([IO.File]::ReadAllBytes("${generatedKey.keyPath}")) | Set-Clipboard`;
        const groovyConfig = `def keystoreProperties = new Properties()\ndef keystorePropertiesFile = rootProject.file('key.properties')\nif (keystorePropertiesFile.exists()) {\n    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n}\n\nandroid {\n    signingConfigs {\n        release {\n            keyAlias keystoreProperties['keyAlias']\n            keyPassword keystoreProperties['keyPassword']\n            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null\n            storePassword keystoreProperties['storePassword']\n        }\n    }\n    buildTypes {\n        release {\n            signingConfig signingConfigs.release\n        }\n    }\n}`;
        const kotlinConfig = `import java.util.Properties\n\nval keystoreProperties = Properties()\nval keystorePropertiesFile = rootProject.file("key.properties")\nif (keystorePropertiesFile.exists()) {\n    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }\n}\n\nandroid {\n    signingConfigs {\n        create("release") {\n            keyAlias = keystoreProperties["keyAlias"] as String\n            keyPassword = keystoreProperties["keyPassword"] as String\n            storeFile = file(keystoreProperties["storeFile"] as String)\n            storePassword = keystoreProperties["storePassword"] as String\n        }\n    }\n    buildTypes {\n        getByName("release") {\n            signingConfig = signingConfigs.getByName("release")\n        }\n    }\n}`;
        const gradleGuide = `Groovy — android/app/build.gradle:\n${groovyConfig}\n\nKotlin DSL — android/app/build.gradle.kts:\n${kotlinConfig}`;
        const guide = [
            `ANDROID SIGNING KEY — NEXT STEPS`,
            `Key file: ${generatedKey.keyPath}`,
            `No move is needed: the file is already inside android/app.`,
            ``,
            `1. Create android/key.properties (never commit it):`,
            keyProperties,
            ``,
            `2. Add these lines to .gitignore:`,
            gitignore,
            ``,
            `3. Configure the release signingConfig (use the block matching your project):`,
            gradleGuide,
            ``,
            `4. Back up ${generatedKey.fileName} and both passwords in a secure password manager. Losing the upload key can block future app updates.`,
            ``,
            `5. For GitHub Actions, create KEYSTORE_BASE64 with PowerShell:`,
            base64Command,
            `Then add KEYSTORE_PASSWORD, KEY_PASSWORD, and KEY_ALIAS=${generatedKey.alias} as GitHub Actions secrets.`
        ].join('\n');
        this.signingKeyGuide = guide;

        const stepsList = document.getElementById('signingKeyResultSteps');
        stepsList.replaceChildren(
            this.createSigningResultStep('File location', 'No move is needed. The signing key is already in android/app.', generatedKey.keyPath),
            this.createSigningResultStep('Create android/key.properties', 'Create this local file and keep it out of Git.', keyProperties),
            this.createSigningResultStep('Protect secrets from Git', 'Add these patterns to the project .gitignore before your next commit.', gitignore),
            this.createSigningResultStep('Connect the release build', 'Use the section matching your Gradle file. Merge it with existing android and buildTypes blocks instead of duplicating them.', gradleGuide),
            this.createSigningResultStep('Back up the key', 'Store the .jks file and both passwords in a secure, separate location. Never rely on the project copy as your only backup.'),
            this.createSigningResultStep('Add GitHub Actions secrets', 'Create KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_PASSWORD, and KEY_ALIAS.', base64Command)
        );
        this.clearSigningPasswords();
        this.pendingSigningKey = undefined;
    }

    createSigningResultStep(title, description, code) {
        const item = document.createElement('li');
        const heading = document.createElement('strong');
        heading.textContent = title;
        const text = document.createElement('p');
        text.textContent = description;
        item.append(heading, text);
        if (code) {
            const pre = document.createElement('pre');
            const codeElement = document.createElement('code');
            codeElement.textContent = code;
            pre.append(codeElement);
            item.append(pre);
        }
        return item;
    }

    handleSigningKeyFailed(message) {
        const button = document.getElementById('createSigningKeyBtn');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-key"></i> Create Signing Key';
        this.showToast(message || 'Signing key creation failed', 'error');
    }

    resetSigningKeyResult() {
        document.getElementById('signingKeyFormView').hidden = false;
        document.getElementById('signingKeyResultView').hidden = true;
        document.getElementById('signingKeyModalFoot').hidden = false;
        const button = document.getElementById('createSigningKeyBtn');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-key"></i> Create Signing Key';
        }
        this.pendingSigningKey = undefined;
        this.signingKeyGuide = undefined;
        this.clearSigningPasswords();
    }

    clearSigningPasswords() {
        ['signingStorePassword', 'signingStorePasswordConfirm', 'signingAliasPassword', 'signingAliasPasswordConfirm'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
    }
};
