window.AirFlutterIconSplashModule = class AirFlutterIconSplashModule {
    initIconSplash() {
        this.masterIconImage = null;
        this.masterIconBase64 = null;

        const dropZone = document.getElementById('iconDropZone');
        const fileInput = document.getElementById('iconFileInput');
        const bgColorInput = document.getElementById('iconBgColorInput');
        const bgColorText = document.getElementById('iconBgColorText');
        const deployBtn = document.getElementById('deployNativeIconsBtn');
        const configIconsBtn = document.getElementById('configLauncherIconsBtn');
        const runIconsCliBtn = document.getElementById('runLauncherIconsCliBtn');
        const configSplashBtn = document.getElementById('configNativeSplashBtn');
        const runSplashCliBtn = document.getElementById('runNativeSplashCliBtn');
        const pkgAssetInput = document.getElementById('pkgAssetPathInput');

        if (!dropZone) return;

        const handleImageFile = (file) => {
            if (!file || !file.type.startsWith('image/')) {
                this.showToast('Please upload a valid image file (PNG/JPEG/WebP).', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                const img = new Image();
                img.onload = () => {
                    this.masterIconImage = img;
                    this.masterIconBase64 = base64;
                    this.updateIconPreviews(base64);
                    if (deployBtn) deployBtn.disabled = false;
                    const status = document.getElementById('iconSplashStatusBar');
                    if (status) status.textContent = `Loaded ${file.name} (${img.width}x${img.height} px). Ready to deploy.`;
                };
                img.src = base64;
            };
            reader.readAsDataURL(file);
        };

        fileInput?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageFile(e.target.files[0]);
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageFile(e.dataTransfer.files[0]);
            }
        });

        const syncColor = (color) => {
            if (bgColorInput) bgColorInput.value = color;
            if (bgColorText) bgColorText.value = color;
            const frames = ['iconFrameCircle', 'iconFrameSquircle', 'iconFrameIos'];
            frames.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.backgroundColor = color;
            });
        };

        bgColorInput?.addEventListener('input', (e) => syncColor(e.target.value));
        bgColorText?.addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                syncColor(e.target.value);
            }
        });

        deployBtn?.addEventListener('click', () => {
            if (!this.masterIconImage) {
                this.showToast('Please upload an icon image first.', 'warning');
                return;
            }

            const densities = this.generateDensityIcons(this.masterIconImage);
            const deployAndroid = document.getElementById('deployAndroidCheckbox')?.checked ?? true;
            const deployIos = document.getElementById('deployIosCheckbox')?.checked ?? true;

            this.sendMessage('saveNativeAppIcons', {
                master1024Base64: this.masterIconBase64,
                densities,
                backgroundColorHex: bgColorText?.value || '#FFFFFF',
                applyAndroid: deployAndroid,
                applyIos: deployIos
            });
        });

        configIconsBtn?.addEventListener('click', () => {
            this.sendMessage('configureLauncherIconsYaml', {
                imagePath: pkgAssetInput?.value?.trim() || 'assets/icon/app_icon.png',
                backgroundColorHex: bgColorText?.value || '#FFFFFF'
            });
        });

        runIconsCliBtn?.addEventListener('click', () => {
            this.sendMessage('runLauncherIconsCli', {});
        });

        configSplashBtn?.addEventListener('click', () => {
            this.sendMessage('configureNativeSplashYaml', {
                imagePath: pkgAssetInput?.value?.trim() || 'assets/icon/app_icon.png',
                backgroundColorHex: bgColorText?.value || '#FFFFFF',
                fullscreen: true
            });
        });

        runSplashCliBtn?.addEventListener('click', () => {
            this.sendMessage('runNativeSplashCli', {});
        });
    }

    updateIconPreviews(base64) {
        const previewIds = ['iconPreviewRaw', 'iconPreviewCircle', 'iconPreviewSquircle', 'iconPreviewIos'];
        previewIds.forEach(id => {
            const img = document.getElementById(id);
            if (img) {
                img.src = base64;
                img.hidden = false;
            }
        });
        const placeholder = document.getElementById('iconPlaceholderRaw');
        if (placeholder) placeholder.hidden = true;
    }

    generateDensityIcons(img) {
        const sizes = [
            { density: 'mdpi', size: 48 },
            { density: 'hdpi', size: 72 },
            { density: 'xhdpi', size: 96 },
            { density: 'xxhdpi', size: 144 },
            { density: 'xxxhdpi', size: 192 }
        ];

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const results = [];

        for (const item of sizes) {
            canvas.width = item.size;
            canvas.height = item.size;
            ctx.clearRect(0, 0, item.size, item.size);
            ctx.drawImage(img, 0, 0, item.size, item.size);
            const base64 = canvas.toDataURL('image/png');
            results.push({
                density: item.density,
                base64Png: base64
            });
        }

        return results;
    }
};

