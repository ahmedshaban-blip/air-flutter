(function () {
    class PermissionManagerModule {
        initPermissionManager() {
            this.declaredPermissions = new Set();
            this.permissionCatalog = [];
            const addButton = document.getElementById('addPermissionsBtn');
            if (addButton) addButton.addEventListener('click', () => this.addSelectedPermissions());

            const catalog = document.getElementById('permissionCatalog');
            if (catalog) catalog.addEventListener('change', () => this.updatePermissionActionState());
        }

        loadPermissionCatalog() {
            const catalog = document.getElementById('permissionCatalog');
            if (catalog) catalog.innerHTML = '<p class="empty"><i class="fas fa-spinner fa-spin"></i><span>Reading AndroidManifest.xml…</span></p>';
            this.setPermissionLoading(true);
            this.sendMessage('loadAndroidPermissions', {});
        }

        renderPermissionCatalog(catalog, declaredPermissions) {
            this.permissionCatalog = Array.isArray(catalog) ? catalog : [];
            this.declaredPermissions = new Set(declaredPermissions || []);
            const container = document.getElementById('permissionCatalog');
            if (!container) return;

            container.innerHTML = this.permissionCatalog.map(permission => {
                const alreadyPresent = this.declaredPermissions.has(permission.name);
                return `
                    <label class="permission-row ${alreadyPresent ? 'is-present' : ''}">
                        <input type="checkbox" value="${this.escapeHtml(permission.name)}" ${alreadyPresent ? 'disabled' : ''}>
                        <span class="permission-copy">
                            <span class="permission-title">${this.escapeHtml(permission.label)}</span>
                            <span class="permission-name">${this.escapeHtml(permission.name)}</span>
                            <span class="permission-description">${this.escapeHtml(permission.description)}</span>
                        </span>
                        ${alreadyPresent ? '<span class="permission-badge">Already Present</span>' : ''}
                    </label>`;
            }).join('');
            this.setPermissionLoading(false);
        }

        addSelectedPermissions() {
            const selectedPermissions = Array.from(document.querySelectorAll('#permissionCatalog input:checked:not(:disabled)'))
                .map(input => input.value)
                .filter(permission => !this.declaredPermissions.has(permission));

            this.setPermissionLoading(true);
            this.sendMessage('addAndroidPermissions', { selectedPermissions });
        }

        handlePermissionsAdded(message) {
            this.declaredPermissions = new Set(message.declaredPermissions || []);
            this.renderPermissionCatalog(this.permissionCatalog, message.declaredPermissions);
            this.showToast(message.message || 'Permissions added to AndroidManifest.xml.', 'success');
        }

        handlePermissionsUnchanged(message) {
            this.declaredPermissions = new Set(message.declaredPermissions || []);
            this.renderPermissionCatalog(this.permissionCatalog, message.declaredPermissions);
            this.showToast(message.message, 'success');
        }

        setPermissionLoading(loading) {
            const button = document.getElementById('addPermissionsBtn');
            if (button && loading) button.disabled = true;
            const status = document.getElementById('permissionStatus');
            if (status && loading) status.textContent = 'Checking AndroidManifest.xml…';
            if (!loading) this.updatePermissionActionState();
        }

        updatePermissionActionState() {
            const selectedCount = document.querySelectorAll('#permissionCatalog input:checked:not(:disabled)').length;
            const button = document.getElementById('addPermissionsBtn');
            if (button) button.disabled = selectedCount === 0;
            const status = document.getElementById('permissionStatus');
            if (status) status.textContent = selectedCount
                ? `${selectedCount} permission(s) selected.`
                : `${this.declaredPermissions.size} permission(s) already declared.`;
        }
    }

    window.AirFlutterPermissionManagerModule = PermissionManagerModule;
})();
