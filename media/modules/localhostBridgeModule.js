(function () {
    class LocalhostBridgeModule {
        initLocalhostBridge() {
            this.localhostBridgeDevices = [];
            this.localhostBridgeRules = [];

            document.querySelectorAll('[data-localhost-port]').forEach(button => {
                button.addEventListener('click', () => {
                    this.applyLocalhostBridge(Number(button.dataset.localhostPort));
                });
            });

            document.getElementById('localhostBridgeForm')?.addEventListener('submit', event => {
                event.preventDefault();
                const input = document.getElementById('localhostBridgePort');
                const port = Number(input?.value);
                if (!Number.isInteger(port) || port < 1 || port > 65535) {
                    this.showToast('Enter a whole port number from 1 to 65535.', 'error');
                    return;
                }
                this.applyLocalhostBridge(port);
            });

            document.getElementById('refreshLocalhostBridgeBtn')?.addEventListener('click', () => {
                this.sendMessage('refreshLocalhostBridge', {});
            });

            document.getElementById('localhostBridgeDevice')?.addEventListener('change', event => {
                const removeAll = document.getElementById('removeAllLocalhostBridgesBtn');
                if (removeAll) {
                    removeAll.disabled = !this.localhostBridgeRules.some(
                        rule => rule.deviceId === event.target.value
                    );
                }
            });

            document.getElementById('removeAllLocalhostBridgesBtn')?.addEventListener('click', () => {
                const deviceId = this.getLocalhostBridgeDevice();
                if (deviceId) {
                    this.sendMessage('removeAllLocalhostBridges', { deviceId });
                }
            });

            document.getElementById('localhostBridgeRules')?.addEventListener('click', event => {
                const button = event.target.closest('[data-remove-localhost-port]');
                if (button) {
                    this.sendMessage('removeLocalhostBridge', {
                        deviceId: button.dataset.deviceId,
                        port: Number(button.dataset.removeLocalhostPort)
                    });
                }
            });

            this.sendMessage('refreshLocalhostBridge', {});
        }

        getLocalhostBridgeDevice() {
            const select = document.getElementById('localhostBridgeDevice');
            const deviceId = select?.value || '';
            if (!deviceId) {
                this.showToast('Select an online Android device first.', 'error');
            }
            return deviceId;
        }

        applyLocalhostBridge(port) {
            const deviceId = this.getLocalhostBridgeDevice();
            if (deviceId) {
                this.sendMessage('applyLocalhostBridge', { deviceId, port });
            }
        }

        renderLocalhostBridgeState(devices, rules) {
            this.localhostBridgeDevices = devices;
            this.localhostBridgeRules = rules;
            const select = document.getElementById('localhostBridgeDevice');
            const previous = select?.value;

            if (select) {
                select.replaceChildren();
                if (devices.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No online device';
                    select.append(option);
                } else {
                    devices.forEach(device => {
                        const option = document.createElement('option');
                        option.value = device.id;
                        option.textContent = `${device.name} — ${device.id}`;
                        select.append(option);
                    });
                    if (devices.some(device => device.id === previous)) {
                        select.value = previous;
                    }
                }
            }

            const list = document.getElementById('localhostBridgeRules');
            if (!list) return;
            list.replaceChildren();
            if (rules.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'empty';
                empty.textContent = 'No active forwards';
                list.append(empty);
            } else {
                rules.forEach(rule => {
                    const row = document.createElement('div');
                    row.className = 'localhost-rule';
                    const text = document.createElement('span');
                    text.innerHTML = `<strong>tcp:${this.escapeHtml(rule.port)}</strong><small>${this.escapeHtml(rule.deviceId)}</small>`;
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.className = 'link-btn link-danger';
                    remove.dataset.removeLocalhostPort = String(rule.port);
                    remove.dataset.deviceId = rule.deviceId;
                    remove.textContent = 'Unlink';
                    row.append(text, remove);
                    list.append(row);
                });
            }

            const selected = select?.value;
            const removeAll = document.getElementById('removeAllLocalhostBridgesBtn');
            if (removeAll) {
                removeAll.disabled = !selected || !rules.some(rule => rule.deviceId === selected);
            }
        }
    }

    window.AirFlutterLocalhostBridgeModule = LocalhostBridgeModule;
})();
