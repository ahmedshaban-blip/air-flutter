// Flavors Manager Module
window.AirFlutterFlavorsModule = class AirFlutterFlavorsModule {
    initFlavorsModal() {
        const modal = document.getElementById('flavorsModal');
        if (!modal) return;

        const closeBtn = document.getElementById('closeFlavorsModalBtn');
        const cancelBtn = document.getElementById('cancelFlavorsModalBtn');
        const browseBtn = document.getElementById('browseFlavorsProjectBtn');
        const setupBtn = document.getElementById('setupFlavorsBtn');
        const runBtn = document.getElementById('runFlavorBtn');
        const buildApkBtn = document.getElementById('buildFlavorApkBtn');
        const buildAllBtn = document.getElementById('buildAllFlavorsBtn');

        const closeModal = () => { modal.hidden = true; };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.sendMessage('selectFlavorsProject', {});
            });
        }

        if (setupBtn) {
            setupBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('flavorsProjectPathInput')?.value?.trim();
                setupBtn.disabled = true;
                setupBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Setting up…';
                this.sendMessage('setupFlavors', { projectPath, flavors: ['dev', 'staging', 'prod'] });
            });
        }

        if (runBtn) {
            runBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('flavorsProjectPathInput')?.value?.trim();
                const selectedFlavor = this.getSelectedFlavor();
                if (!selectedFlavor) {
                    this.showToast('Select a flavor first', 'error');
                    return;
                }
                this.sendMessage('runFlavor', { projectPath, flavor: selectedFlavor.name, target: selectedFlavor.entrypoint });
                closeModal();
            });
        }

        if (buildApkBtn) {
            buildApkBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('flavorsProjectPathInput')?.value?.trim();
                const selectedFlavor = this.getSelectedFlavor();
                if (!selectedFlavor) {
                    this.showToast('Select a flavor first', 'error');
                    return;
                }
                buildApkBtn.disabled = true;
                buildApkBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Building…';
                this.sendMessage('buildFlavorApk', { projectPath, flavor: selectedFlavor.name, target: selectedFlavor.entrypoint });
            });
        }

        if (buildAllBtn) {
            buildAllBtn.addEventListener('click', () => {
                const projectPath = document.getElementById('flavorsProjectPathInput')?.value?.trim();
                const flavors = this.detectedFlavorsList || [];
                if (flavors.length === 0) {
                    this.showToast('No flavors detected to build', 'error');
                    return;
                }
                buildAllBtn.disabled = true;
                buildAllBtn.innerHTML = '<i class="fas fa-rotate fa-spin"></i> Building All…';
                this.sendMessage('buildAllFlavors', { projectPath, flavors: flavors.map(f => f.name) });
            });
        }
    }

    openFlavorsModal(defaultPath) {
        const modal = document.getElementById('flavorsModal');
        if (modal) {
            modal.hidden = false;
            const input = document.getElementById('flavorsProjectPathInput');
            if (input && defaultPath) {
                input.value = defaultPath;
            }
            const currentPath = input?.value?.trim() || defaultPath;
            this.sendMessage('detectFlavors', { projectPath: currentPath });
        }
    }

    renderFlavors(data) {
        this.detectedFlavorsList = data?.flavors || [];
        const container = document.getElementById('flavorsListContainer');
        const emptyState = document.getElementById('flavorsEmptyState');
        const actionsRow = document.getElementById('flavorsActionsRow');

        if (!container || !emptyState || !actionsRow) return;

        if (!data || !data.hasFlavors || data.flavors.length === 0) {
            container.innerHTML = '';
            emptyState.hidden = false;
            actionsRow.hidden = true;
            const setupBtn = document.getElementById('setupFlavorsBtn');
            if (setupBtn) {
                setupBtn.disabled = false;
                setupBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Setup Flavors (dev, staging, prod)';
            }
        } else {
            emptyState.hidden = true;
            actionsRow.hidden = false;

            container.innerHTML = data.flavors.map((flavor, index) => `
                <label class="flavor-item-card ${index === 0 ? 'is-selected' : ''}">
                    <div>
                        <input type="radio" name="selectedFlavorRadio" value="${this.escapeHtml(flavor.name)}" data-entrypoint="${this.escapeHtml(flavor.entrypoint || '')}" ${index === 0 ? 'checked' : ''} />
                        <span class="flavor-item-name">${this.escapeHtml(flavor.name)}</span>
                    </div>
                    <span class="flavor-item-entry">${this.escapeHtml(flavor.entrypoint || 'lib/main.dart')}</span>
                </label>
            `).join('');

            container.querySelectorAll('.flavor-item-card').forEach(card => {
                card.addEventListener('click', () => {
                    container.querySelectorAll('.flavor-item-card').forEach(c => c.classList.remove('is-selected'));
                    card.classList.add('is-selected');
                });
            });

            const buildApkBtn = document.getElementById('buildFlavorApkBtn');
            if (buildApkBtn) {
                buildApkBtn.disabled = false;
                buildApkBtn.innerHTML = '<i class="fas fa-box"></i> Build APK';
            }
            const buildAllBtn = document.getElementById('buildAllFlavorsBtn');
            if (buildAllBtn) {
                buildAllBtn.disabled = false;
                buildAllBtn.innerHTML = '<i class="fas fa-boxes-stacked"></i> Build All Flavors';
            }
        }
    }

    getSelectedFlavor() {
        const radio = document.querySelector('input[name="selectedFlavorRadio"]:checked');
        if (!radio) return null;
        return {
            name: radio.value,
            entrypoint: radio.dataset.entrypoint
        };
    }

    // --- Proxy & DNS Modal -------------------------------------------------

};
