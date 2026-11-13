window.AirFlutterIconSplashModule = class AirFlutterIconSplashModule {
    initIconSplash() {
        const dropZone = document.getElementById('iconDropZone');
        if (!dropZone) return;

        this.iconStudioState = {
            foreground: null,
            ios: null,
            backgroundImage: null,
            monochrome: null,
            scale: 100,
            offsetX: 0,
            offsetY: 0,
            backgroundColor: '#FFFFFF',
            backgroundMode: 'color',
            gradientStops: [
                { id: 'stop-1', color: '#4C6EF5', position: 0 },
                { id: 'stop-2', color: '#F76707', position: 100 }
            ],
            gradientAngle: 180,
            gradientStopSequence: 2,
            backgroundScale: 100,
            backgroundOffsetX: 0,
            backgroundOffsetY: 0,
            backgroundFit: 'cover',
            splash: null,
            splashUseAppIcon: true,
            splashScale: 45,
            splashBackgroundColor: '#FFFFFF',
            splashBackgroundImage: null,
            splashBackgroundFit: 'cover',
            splashApplying: false,
            dirty: false,
            applying: false,
            latestBackupPath: null,
            savedIcon: null,
            savedSplash: null,
            operationSequence: 0,
            conversion: null,
            conversionOpen: false,
            conversionRequestSequence: 0,
            conversionRequests: new Map(),
            previewSignalSent: false,
            previewRevealDone: false
        };

        const fileInput = document.getElementById('iconFileInput');
        const iosFileInput = document.getElementById('iosIconFileInput');
        const clearIosBtn = document.getElementById('clearIosIconBtn');
        const backgroundFileInput = document.getElementById('iconBackgroundFileInput');
        const monochromeFileInput = document.getElementById('iconMonochromeFileInput');
        const controls = ['iconScaleInput', 'iconOffsetXInput', 'iconOffsetYInput'];

        fileInput?.addEventListener('change', event => this.handleIconStudioInputChange(event, 'foreground'));
        iosFileInput?.addEventListener('change', event => this.handleIconStudioInputChange(event, 'ios'));
        backgroundFileInput?.addEventListener('change', event => this.handleIconStudioInputChange(event, 'background'));
        monochromeFileInput?.addEventListener('change', event => this.handleIconStudioInputChange(event, 'monochrome'));
        clearIosBtn?.addEventListener('click', () => {
            this.iconStudioState.ios = null;
            if (iosFileInput) iosFileInput.value = '';
            clearIosBtn.hidden = true;
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        });
        document.getElementById('clearIconBackgroundBtn')?.addEventListener('click', () => {
            this.iconStudioState.backgroundImage = null;
            if (backgroundFileInput) backgroundFileInput.value = '';
            const status = document.getElementById('iconBackgroundStatus');
            if (status) status.textContent = 'Choose a background image.';
            document.getElementById('clearIconBackgroundBtn').disabled = true;
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        });
        document.getElementById('clearIconMonochromeBtn')?.addEventListener('click', () => {
            this.iconStudioState.monochrome = null;
            if (monochromeFileInput) monochromeFileInput.value = '';
            document.getElementById('clearIconMonochromeBtn').hidden = true;
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        });

        document.querySelectorAll('input[name="iconBackgroundMode"]').forEach(input => {
            input.addEventListener('change', event => {
                this.iconStudioState.backgroundMode = event.target.value;
                const controlsPanel = document.getElementById('iconBackgroundImageControls');
                if (controlsPanel) controlsPanel.hidden = event.target.value !== 'image';
                const gradientPanel = document.getElementById('iconGradientControls');
                if (gradientPanel) gradientPanel.hidden = event.target.value !== 'gradient';
                if (event.target.value === 'image' || event.target.value === 'gradient') {
                    const advanced = document.getElementById('iconAdvancedControls');
                    if (advanced) advanced.open = true;
                }
                this.syncGradientStopRows();
                this.iconStudioState.dirty = true;
                this.renderIconStudio();
            });
        });
        const backgroundControlMap = {
            iconBackgroundScaleInput: 'backgroundScale',
            iconBackgroundOffsetXInput: 'backgroundOffsetX',
            iconBackgroundOffsetYInput: 'backgroundOffsetY'
        };
        Object.entries(backgroundControlMap).forEach(([id, key]) => {
            document.getElementById(id)?.addEventListener('input', event => {
                this.iconStudioState[key] = Number(event.target.value);
                this.iconStudioState.dirty = true;
                this.renderIconStudio();
            });
        });
        document.getElementById('iconBackgroundFitSelect')?.addEventListener('change', event => {
            this.iconStudioState.backgroundFit = event.target.value;
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        });

        document.getElementById('iconGradientAngleInput')?.addEventListener('input', event => {
            this.setGradientAngle(event.target.value);
        });
        const angleSlider = document.getElementById('iconGradientAngleInput');
        angleSlider?.addEventListener('pointerdown', () => this.beginGradientStopDrag(angleSlider));
        angleSlider?.addEventListener('pointerup', () => this.endGradientStopDrag(angleSlider));
        angleSlider?.addEventListener('pointercancel', () => this.endGradientStopDrag(angleSlider));
        angleSlider?.addEventListener('change', () => this.endGradientStopDrag(angleSlider));
        document.getElementById('iconGradientAngleText')?.addEventListener('input', event => {
            const raw = event.target.value.trim();
            if (/^\d{1,3}$/.test(raw)) this.setGradientAngle(raw);
        });
        document.getElementById('addGradientStopBtn')?.addEventListener('click', () => this.addGradientStop());
        this.syncGradientStopRows();

        dropZone.addEventListener('click', event => {
            if (!event.target.closest('label')) fileInput?.click();
        });
        dropZone.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInput?.click();
            }
        });
        dropZone.addEventListener('dragover', event => {
            event.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', event => {
            event.preventDefault();
            dropZone.classList.remove('dragover');
            const files = event.dataTransfer?.files;
            if (files?.length !== 1) {
                this.rejectIconStudioFile('Drop one image file at a time.');
                return;
            }
            this.loadIconStudioFile(files[0], 'foreground');
        });

        for (const id of controls) {
            document.getElementById(id)?.addEventListener('input', event => {
                const key = id === 'iconScaleInput' ? 'scale' : id === 'iconOffsetXInput' ? 'offsetX' : 'offsetY';
                this.iconStudioState[key] = Number(event.target.value);
                this.iconStudioState.dirty = true;
                this.renderIconStudio();
                this.signalIconPreviewChange();
            });
        }
        document.getElementById('jumpToPreviewBtn')?.addEventListener('click', () => this.jumpToIconPreview());

        const bgColorInput = document.getElementById('iconBgColorInput');
        const bgColorText = document.getElementById('iconBgColorText');
        const syncColor = color => {
            if (!/^#[0-9A-F]{6}$/i.test(color)) return;
            this.iconStudioState.backgroundColor = color.toUpperCase();
            if (bgColorInput) bgColorInput.value = color;
            if (bgColorText) bgColorText.value = color.toUpperCase();
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        };
        bgColorInput?.addEventListener('input', event => syncColor(event.target.value));
        bgColorText?.addEventListener('input', event => syncColor(event.target.value));

        document.getElementById('fitIconSafeZoneBtn')?.addEventListener('click', () => {
            this.fitIconToSafeZone();
            this.signalIconPreviewChange();
        });
        document.getElementById('resetIconTransformBtn')?.addEventListener('click', () => {
            this.resetIconInspectionInteraction();
            this.iconStudioState.scale = 100;
            this.iconStudioState.offsetX = 0;
            this.iconStudioState.offsetY = 0;
            this.syncIconTransformControls();
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
            this.signalIconPreviewChange();
        });
        document.getElementById('showIconSafeZoneCheckbox')?.addEventListener('change', event => {
            document.querySelectorAll('[data-safe-zone-overlay]').forEach(overlay => {
                overlay.hidden = !event.target.checked;
            });
        });
        document.getElementById('previewWallpaperSelect')?.addEventListener('change', event => {
            document.querySelectorAll('.is-home-screen').forEach(screen => {
                screen.classList.toggle('is-wallpaper-dark', event.target.value === 'dark');
                screen.classList.toggle('is-wallpaper-light', event.target.value === 'light');
            });
        });
        document.getElementById('iconPreviewLabelInput')?.addEventListener('input', event => {
            const label = event.target.value.trim() || 'Your App';
            document.querySelectorAll('.is-app-label').forEach(element => { element.textContent = label; });
        });

        document.querySelectorAll('input[name="iconDeploymentMode"]').forEach(input => {
            input.addEventListener('change', () => {
                document.querySelectorAll('.is-mode-card').forEach(card => {
                    card.classList.toggle('is-selected', card.querySelector('input')?.checked === true);
                });
                this.syncLauncherIconsVisibility();
                this.iconStudioState.dirty = true;
            });
        });
        document.getElementById('deployAndroidCheckbox')?.addEventListener('change', () => this.updateIconApplyAvailability());
        document.getElementById('deployIosCheckbox')?.addEventListener('change', () => this.updateIconApplyAvailability());

        document.getElementById('deployNativeIconsBtn')?.addEventListener('click', () => this.openIconReview());
        document.getElementById('closeIconReviewBtn')?.addEventListener('click', () => this.closeIconReview());
        document.getElementById('cancelIconApplyBtn')?.addEventListener('click', () => this.closeIconReview());
        document.getElementById('confirmIconApplyBtn')?.addEventListener('click', () => this.applyIconStudio());
        document.getElementById('restoreNativeIconsBtn')?.addEventListener('click', () => {
            this.sendMessage('restoreLatestIcons', {});
        });
        document.getElementById('deleteBothAssetsBtn')?.addEventListener('click', () => {
            this.sendMessage('deleteIconSplashAsset', { asset: 'both' });
        });

        const splashFileInput = document.getElementById('splashFileInput');
        splashFileInput?.addEventListener('change', event => this.handleIconStudioInputChange(event, 'splash'));
        document.getElementById('useAppIconForSplashCheckbox')?.addEventListener('change', event => {
            this.iconStudioState.splashUseAppIcon = event.target.checked;
            const upload = document.getElementById('splashUploadRow');
            if (upload) upload.hidden = event.target.checked;
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        });
        document.getElementById('splashScaleInput')?.addEventListener('input', event => {
            this.iconStudioState.splashScale = Number(event.target.value);
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        });
        const splashBgInput = document.getElementById('splashBgColorInput');
        const splashBgText = document.getElementById('splashBgColorText');
        const syncSplashColor = color => {
            if (!/^#[0-9A-F]{6}$/i.test(color)) return;
            this.iconStudioState.splashBackgroundColor = color.toUpperCase();
            if (splashBgInput) splashBgInput.value = color;
            if (splashBgText) splashBgText.value = color.toUpperCase();
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        };
        splashBgInput?.addEventListener('input', event => syncSplashColor(event.target.value));
        splashBgText?.addEventListener('input', event => syncSplashColor(event.target.value));

        this.bindSplashOptions();
        this.bindLauncherIconsOptions();
        this.syncLauncherIconsVisibility();

        const splashBackgroundFileInput = document.getElementById('splashBackgroundFileInput');
        splashBackgroundFileInput?.addEventListener('change', event => this.handleIconStudioInputChange(event, 'splash-background'));
        document.getElementById('clearSplashBackgroundBtn')?.addEventListener('click', () => {
            this.iconStudioState.splashBackgroundImage = null;
            if (splashBackgroundFileInput) splashBackgroundFileInput.value = '';
            const clear = document.getElementById('clearSplashBackgroundBtn');
            if (clear) clear.hidden = true;
            const fitRow = document.getElementById('splashBackgroundFitRow');
            if (fitRow) fitRow.hidden = true;
            const status = document.getElementById('splashBackgroundStatus');
            if (status) status.hidden = true;
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        });
        document.getElementById('splashBackgroundFitSelect')?.addEventListener('change', event => {
            this.iconStudioState.splashBackgroundFit = event.target.value;
            this.iconStudioState.dirty = true;
            this.renderIconStudio();
        });
        document.getElementById('configNativeSplashBtn')?.addEventListener('click', () => {
            const panel = document.getElementById('splashReviewPanel');
            if (panel) {
                const note = document.getElementById('splashReviewBackgroundNote');
                if (note) {
                    const hasBackground = Boolean(this.iconStudioState.splashBackgroundImage);
                    note.hidden = !hasBackground;
                    if (hasBackground) {
                        note.textContent = `Background image (${this.iconStudioState.splashBackgroundFit}) covers legacy Android and iOS; Android 12+ keeps the solid icon background.`;
                    }
                }
                panel.hidden = false;
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        const closeSplashReview = () => {
            const panel = document.getElementById('splashReviewPanel');
            if (panel) panel.hidden = true;
        };
        document.getElementById('closeSplashReviewBtn')?.addEventListener('click', closeSplashReview);
        document.getElementById('cancelSplashApplyBtn')?.addEventListener('click', closeSplashReview);
        document.getElementById('confirmSplashApplyBtn')?.addEventListener('click', () => this.applySplashStudio());

        document.getElementById('closeIconConvertBtn')?.addEventListener('click', () => this.closeIconConversion());
        document.getElementById('cancelIconConvertBtn')?.addEventListener('click', () => this.closeIconConversion());
        document.getElementById('confirmIconConvertBtn')?.addEventListener('click', () => this.confirmIconConversion());
        document.querySelectorAll('input[name="iconConvertMode"]').forEach(input => {
            input.addEventListener('change', event => {
                if (!this.iconStudioState?.conversion) return;
                this.iconStudioState.conversion.mode = event.target.value === 'cover' ? 'cover' : 'fit';
                this.renderIconConversion();
            });
        });
        for (const [id, key] of [
            ['iconConvertOffsetXInput', 'offsetX'],
            ['iconConvertOffsetYInput', 'offsetY']
        ]) {
            document.getElementById(id)?.addEventListener('input', event => {
                if (!this.iconStudioState?.conversion) return;
                this.iconStudioState.conversion[key] = Number(event.target.value);
                this.renderIconConversion();
            });
        }
        document.getElementById('iconConvertTransparentCheckbox')?.addEventListener('change', event => {
            if (!this.iconStudioState?.conversion) return;
            this.iconStudioState.conversion.transparent = event.target.checked;
            const colorInput = document.getElementById('iconConvertBgInput');
            if (colorInput) colorInput.disabled = event.target.checked;
            this.renderIconConversion();
        });
        document.getElementById('iconConvertBgInput')?.addEventListener('input', event => {
            if (!this.iconStudioState?.conversion) return;
            this.iconStudioState.conversion.color = event.target.value.toUpperCase();
            this.renderIconConversion();
        });
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || !this.iconStudioState?.conversionOpen) return;
            event.preventDefault();
            this.closeIconConversion();
        });

        window.addEventListener('beforeunload', event => {
            if (!this.iconStudioState?.dirty || this.iconStudioState?.applying || this.iconStudioState?.splashApplying) return;
            event.preventDefault();
            event.returnValue = '';
        });

        this.sendMessage('getIconStudioProjectInfo', {});
        this.iconStudioRenderFrame = null;
        this.gradientStopDragSlider = null;
        this.gradientStopPointerDown = false;
        this.bindIconInspectionInteraction();
        this.renderIconStudio();
    }

    handleIconStudioInputChange(event, target) {
        const file = event.target.files?.[0];
        if (event.target) event.target.value = '';
        this.loadIconStudioFile(file, target);
    }

    async loadIconStudioFile(file, target) {
        if (!file) return;
        const operationId = ++this.iconStudioState.operationSequence;
        try {
            const inspection = await this.inspectIconStudioSource(file);
            if (operationId !== this.iconStudioState.operationSequence) return;
            if (!inspection.ok) {
                this.rejectIconStudioFile(inspection.message, target);
                return;
            }

            const dataUrl = await this.readIconFileAsDataUrl(file);
            const image = await this.decodeIconImage(dataUrl);
            if (operationId !== this.iconStudioState.operationSequence) return;

            const details = {
                fileName: file.name,
                format: inspection.format,
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height
            };

            if (inspection.format === 'png' && details.width === 1024 && details.height === 1024) {
                this.commitIconStudioSource(target, {
                    fileName: file.name,
                    displayName: file.name,
                    dataUrl,
                    image,
                    analysis: this.analyzeIconPixels(image)
                });
                return;
            }

            this.openIconConversion(target, details, image);
        } catch (error) {
            if (operationId !== this.iconStudioState.operationSequence) return;
            this.rejectIconStudioFile(error instanceof Error ? error.message : String(error), target);
        }
    }

    async inspectIconStudioSource(file) {
        if (file.size > 10 * 1024 * 1024) {
            return { ok: false, message: `Rejected ${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the 10 MB limit.` };
        }
        const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
        const startsWith = signature => signature.every((value, index) => bytes[index] === value);
        let format = null;
        if (startsWith([137, 80, 78, 71, 13, 10, 26, 10])) format = 'png';
        else if (startsWith([0xFF, 0xD8, 0xFF])) format = 'jpeg';
        else if (startsWith([82, 73, 70, 70]) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') format = 'webp';
        if (!format) {
            return { ok: false, message: `Rejected ${file.name}: only PNG, JPEG, and WebP images are supported.` };
        }
        return { ok: true, format };
    }

    commitIconStudioSource(target, source) {
        if (target === 'foreground') {
            this.iconStudioState.foreground = source;
            const dropZone = document.getElementById('iconDropZone');
            dropZone?.classList.remove('is-invalid');
            dropZone?.classList.add('is-valid');
            this.setIconStudioControlsEnabled(true);
            this.setIconStatus(`Validated ${source.displayName} — 1024×1024 PNG. Inspect every launcher mask before applying.`);
        } else if (target === 'ios') {
            this.iconStudioState.ios = source;
            const clear = document.getElementById('clearIosIconBtn');
            if (clear) clear.hidden = false;
            this.setIconStatus(`Loaded separate iOS artwork: ${source.displayName}.`);
        } else if (target === 'background') {
            this.iconStudioState.backgroundImage = source;
            const clear = document.getElementById('clearIconBackgroundBtn');
            if (clear) clear.disabled = false;
            const status = document.getElementById('iconBackgroundStatus');
            if (status) status.textContent = `Validated ${source.displayName} — 1024×1024 PNG.`;
            this.setIconStatus(`Loaded adaptive background: ${source.displayName}.`);
        } else if (target === 'monochrome') {
            this.iconStudioState.monochrome = source;
            const clear = document.getElementById('clearIconMonochromeBtn');
            if (clear) clear.hidden = false;
            this.setIconStatus(`Loaded Android themed-icon layer: ${source.displayName}.`);
        } else if (target === 'splash') {
            this.iconStudioState.splash = source;
            this.setIconStatus(`Loaded dedicated splash artwork: ${source.displayName}.`);
        } else if (target === 'splash-background') {
            this.iconStudioState.splashBackgroundImage = source;
            const clear = document.getElementById('clearSplashBackgroundBtn');
            if (clear) clear.hidden = false;
            const fitRow = document.getElementById('splashBackgroundFitRow');
            if (fitRow) fitRow.hidden = false;
            const status = document.getElementById('splashBackgroundStatus');
            if (status) {
                status.hidden = false;
                status.textContent = `Background: ${source.displayName} — 1024×1024 PNG. Applies to legacy Android and iOS.`;
            }
            this.setIconStatus(`Loaded splash background: ${source.displayName}.`);
        }
        this.iconStudioState.dirty = true;
        this.hideIconValidationError();
        this.renderIconStudio();
    }

    openIconConversion(role, details, image) {
        this.iconStudioState.conversion = {
            role,
            fileName: details.fileName,
            format: details.format,
            width: details.width,
            height: details.height,
            image,
            mode: 'fit',
            offsetX: 0,
            offsetY: 0,
            transparent: true,
            color: '#FFFFFF',
            busy: false
        };
        this.iconStudioState.conversionOpen = true;
        this.iconStudioState.conversionReturnFocus = document.activeElement;
        this.resetIconConversionControls();
        const error = document.getElementById('iconConvertError');
        if (error) error.hidden = true;
        const backdrop = document.getElementById('iconConvertModal');
        if (backdrop) backdrop.hidden = false;
        this.renderIconConversion();
        const dialog = backdrop?.querySelector('.is-convert-dialog');
        if (dialog) dialog.dataset.busy = 'false';
        document.getElementById('confirmIconConvertBtn')?.focus();
    }

    closeIconConversion() {
        const conversion = this.iconStudioState.conversion;
        if (conversion?.busy) return;
        const previousFocus = this.iconStudioState.conversionReturnFocus;
        this.iconStudioState.conversion = null;
        this.iconStudioState.conversionOpen = false;
        this.iconStudioState.conversionReturnFocus = null;
        const backdrop = document.getElementById('iconConvertModal');
        if (backdrop) backdrop.hidden = true;
        this.setIconConversionBusy(false);
        const error = document.getElementById('iconConvertError');
        if (error) error.hidden = true;
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
        else document.getElementById('iconDropZone')?.focus();
        this.setIconStatus('Conversion cancelled. The previous source was kept.');
    }

    resetIconConversionControls() {
        const conversion = this.iconStudioState.conversion;
        if (!conversion) return;
        document.querySelectorAll('input[name="iconConvertMode"]').forEach(input => {
            input.checked = (input.value === 'fit');
        });
        const offsets = { iconConvertOffsetXInput: 0, iconConvertOffsetYInput: 0 };
        Object.entries(offsets).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.value = String(value);
        });
        const transparent = document.getElementById('iconConvertTransparentCheckbox');
        if (transparent) transparent.checked = true;
        const colorInput = document.getElementById('iconConvertBgInput');
        if (colorInput) {
            colorInput.value = conversion.color;
            colorInput.disabled = true;
        }
        const sourceMeta = document.getElementById('iconConvertSourceMeta');
        if (sourceMeta) {
            sourceMeta.textContent = `${conversion.width}×${conversion.height} · ${conversion.format.toUpperCase()}`;
        }
        const subtitle = document.getElementById('iconConvertSubtitle');
        if (subtitle) {
            subtitle.textContent = `${conversion.fileName} will be converted to an exact 1024×1024 PNG.`;
        }
        const title = document.getElementById('iconConvertTitle');
        if (title) title.textContent = `Prepare ${this.iconRoleLabel(conversion.role)} image`;
    }

    iconRoleLabel(role) {
        return {
            foreground: 'app icon',
            ios: 'iOS artwork',
            background: 'adaptive background',
            monochrome: 'themed icon layer',
            splash: 'splash artwork'
        }[role] || 'source';
    }

    renderIconConversion() {
        const conversion = this.iconStudioState?.conversion;
        if (!conversion) return;
        const error = document.getElementById('iconConvertError');
        if (error && !conversion.busy) error.hidden = true;
        document.getElementById('iconConvertOffsetXOutput').textContent = `${conversion.offsetX}%`;
        document.getElementById('iconConvertOffsetYOutput').textContent = `${conversion.offsetY}%`;
        if (navigator.userAgent.toLowerCase().includes('jsdom')) return;

        this.drawIconConversionStage(document.getElementById('iconConvertSourceCanvas'), conversion.image, 'contain');
        const target = document.getElementById('iconConvertResultCanvas');
        if (target) {
            const context = target.getContext('2d');
            if (context) {
                context.clearRect(0, 0, target.width, target.height);
                context.drawImage(this.renderIconConversionCanvas(target.width), 0, 0);
            }
        }

        const warning = document.getElementById('iconConvertWarning');
        if (warning) {
            const message = this.getIconConversionWarning(conversion);
            warning.textContent = message || '';
            warning.hidden = !message;
            warning.dataset.level = 'warn';
        }
    }

    drawIconConversionStage(canvas, image, fit) {
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (!image) return;
        const scale = fit === 'contain'
            ? Math.min(canvas.width / image.width, canvas.height / image.height)
            : Math.max(canvas.width / image.width, canvas.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    }

    getIconConversionWarning(conversion) {
        if (!conversion || !conversion.width || !conversion.height) return '';
        const factor = conversion.mode === 'cover'
            ? Math.max(1024 / conversion.width, 1024 / conversion.height)
            : Math.min(1024 / conversion.width, 1024 / conversion.height);
        const warnings = [];
        if (factor > 1.01) {
            warnings.push(`Upscaled ${factor.toFixed(1)}× — fine detail may look soft on high-density screens.`);
        }
        const ratio = Math.max(conversion.width, conversion.height) / Math.min(conversion.width, conversion.height);
        if (ratio >= 2.5) {
            warnings.push('Wide or tall source — expect visible padding or heavy cropping.');
        }
        return warnings.join(' ');
    }

    renderIconConversionCanvas(size) {
        const conversion = this.iconStudioState?.conversion;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        if (!conversion?.image) return canvas;
        if (navigator.userAgent.toLowerCase().includes('jsdom')) return canvas;
        const context = canvas.getContext('2d');
        if (!context) return canvas;
        if (!conversion.transparent) {
            context.fillStyle = conversion.color;
            context.fillRect(0, 0, size, size);
        }
        const image = conversion.image;
        const scale = conversion.mode === 'cover'
            ? Math.max(size / image.width, size / image.height)
            : Math.min(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (size - width) / 2 + (size * conversion.offsetX) / 100;
        const y = (size - height) / 2 + (size * conversion.offsetY) / 100;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, x, y, width, height);
        return canvas;
    }

    setIconConversionBusy(busy) {
        const button = document.getElementById('confirmIconConvertBtn');
        if (button) {
            button.disabled = busy;
            button.innerHTML = busy
                ? '<span class="af-spinner af-spinner-sm"></span> Converting…'
                : 'Convert &amp; Continue';
        }
        const cancelButton = document.getElementById('cancelIconConvertBtn');
        if (cancelButton) cancelButton.disabled = busy;
        const closeButton = document.getElementById('closeIconConvertBtn');
        if (closeButton) closeButton.disabled = busy;
        const dialog = document.querySelector('#iconConvertModal .is-convert-dialog');
        if (dialog) dialog.dataset.busy = busy ? 'true' : 'false';
    }

    showIconConversionError(message) {
        const error = document.getElementById('iconConvertError');
        if (!error) return;
        error.textContent = message;
        error.hidden = false;
    }

    async confirmIconConversion() {
        const conversion = this.iconStudioState?.conversion;
        if (!conversion || conversion.busy) return;
        conversion.busy = true;
        this.setIconConversionBusy(true);
        const error = document.getElementById('iconConvertError');
        if (error) error.hidden = true;
        try {
            const dataUrl = this.renderIconConversionCanvas(1024).toDataURL('image/png');
            const validation = await this.requestIconAssetValidation(dataUrl);
            if (!validation.ok) throw new Error(validation.message || 'The converted PNG failed validation.');
            const image = await this.decodeIconImage(dataUrl);
            const label = `${conversion.fileName} → PNG 1024×1024`;
            const source = {
                fileName: conversion.fileName,
                displayName: label,
                dataUrl,
                image,
                analysis: this.analyzeIconPixels(image),
                convertedFrom: {
                    format: conversion.format,
                    width: conversion.width,
                    height: conversion.height,
                    mode: conversion.mode
                }
            };
            const role = conversion.role;
            conversion.busy = false;
            this.iconStudioState.conversion = null;
            this.iconStudioState.conversionOpen = false;
            const backdrop = document.getElementById('iconConvertModal');
            if (backdrop) backdrop.hidden = true;
            this.setIconConversionBusy(false);
            this.commitIconStudioSource(role, source);
            this.showToast(`Converted ${conversion.fileName} to PNG 1024×1024.`, 'success');
        } catch (failure) {
            conversion.busy = false;
            this.setIconConversionBusy(false);
            this.showIconConversionError(failure instanceof Error ? failure.message : String(failure));
        }
    }

    requestIconAssetValidation(dataUrl) {
        if (typeof this.sendMessage !== 'function') return Promise.resolve({ ok: true });
        const requestId = `icon-convert-${Date.now()}-${++this.iconStudioState.conversionRequestSequence}`;
        return new Promise(resolve => {
            let timer;
            const settle = result => {
                if (!this.iconStudioState.conversionRequests.has(requestId)) return;
                this.iconStudioState.conversionRequests.delete(requestId);
                clearTimeout(timer);
                resolve(result);
            };
            timer = setTimeout(() => settle({ ok: false, message: 'Host validation timed out. Try again.' }), 15000);
            this.iconStudioState.conversionRequests.set(requestId, settle);
            this.sendMessage('validateIconAsset', { requestId, base64Png: dataUrl });
        });
    }

    handleIconAssetValidated(message) {
        const settle = this.iconStudioState?.conversionRequests?.get(message.requestId);
        if (settle) settle({ ok: message.ok === true, message: message.message });
    }

    readIconFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
            reader.readAsDataURL(file);
        });
    }

    decodeIconImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('The PNG could not be decoded.'));
            image.src = dataUrl;
        });
    }

    analyzeIconPixels(image) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.clearRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        const pixels = context.getImageData(0, 0, size, size).data;
        let minX = size;
        let minY = size;
        let maxX = -1;
        let maxY = -1;
        let hasTransparency = false;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const alpha = pixels[(y * size + x) * 4 + 3];
                if (alpha < 250) hasTransparency = true;
                if (alpha > 12) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }
        const empty = maxX < 0;
        return {
            hasTransparency,
            bounds: empty
                ? { left: 0.5, top: 0.5, right: 0.5, bottom: 0.5 }
                : { left: minX / size, top: minY / size, right: (maxX + 1) / size, bottom: (maxY + 1) / size }
        };
    }

    clearIconStudioForeground() {
        this.iconStudioState.foreground = null;
        this.iconStudioState.ios = null;
        this.iconStudioState.dirty = false;
        const input = document.getElementById('iconFileInput');
        const iosInput = document.getElementById('iosIconFileInput');
        if (input) input.value = '';
        if (iosInput) iosInput.value = '';
        document.getElementById('iconDropZone')?.classList.remove('is-valid');
        this.setIconStudioControlsEnabled(false);
        this.closeIconReview();
        this.renderIconStudio();
    }

    rejectIconStudioFile(message, target = 'foreground') {
        const dropZone = document.getElementById('iconDropZone');
        if (target === 'foreground' && !this.iconStudioState?.foreground) dropZone?.classList.add('is-invalid');
        const error = document.getElementById('iconValidationError');
        if (error) {
            error.textContent = message;
            error.hidden = false;
        }
        this.setIconStatus(message, 'error');
        this.showToast(message, 'error');
    }

    hideIconValidationError() {
        const error = document.getElementById('iconValidationError');
        if (error) error.hidden = true;
    }

    setIconStudioControlsEnabled(enabled) {
        ['iconScaleInput', 'iconOffsetXInput', 'iconOffsetYInput', 'fitIconSafeZoneBtn', 'resetIconTransformBtn']
            .forEach(id => {
                const element = document.getElementById(id);
                if (element) element.disabled = !enabled;
            });
        document.getElementById('iconAdjustmentSection')?.setAttribute('aria-disabled', String(!enabled));
        this.updateIconApplyAvailability();
    }

    updateIconApplyAvailability() {
        const valid = Boolean(this.iconStudioState?.foreground);
        const backgroundReady = this.iconStudioState?.backgroundMode !== 'image'
            || Boolean(this.iconStudioState?.backgroundImage);
        const android = document.getElementById('deployAndroidCheckbox')?.checked === true;
        const ios = document.getElementById('deployIosCheckbox')?.checked === true;
        const button = document.getElementById('deployNativeIconsBtn');
        if (button) button.disabled = !valid || !backgroundReady || (!android && !ios) || this.iconStudioState.applying;
    }

    syncIconTransformControls() {
        const values = {
            iconScaleInput: this.iconStudioState.scale,
            iconOffsetXInput: this.iconStudioState.offsetX,
            iconOffsetYInput: this.iconStudioState.offsetY
        };
        Object.entries(values).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.value = String(value);
        });
    }

    signalIconPreviewChange() {
        if (!this.iconStudioState?.foreground) return;
        const badge = document.getElementById('iconPreviewLiveBadge');
        if (badge) badge.hidden = false;
        if (this.iconStudioState.previewSignalSent) return;
        this.iconStudioState.previewSignalSent = true;
        const section = document.querySelector('.is-preview-section');
        if (section) {
            section.classList.remove('is-pulsing');
            section.classList.add('is-pulsing');
            if (typeof window.setTimeout === 'function') {
                window.setTimeout(() => section.classList.remove('is-pulsing'), 900);
            }
        }
        this.revealIconPreviewOnce();
    }

    prefersReducedMotion() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)')?.matches === true;
    }

    isIconPreviewVisible() {
        const section = document.querySelector('.is-preview-section');
        if (!section || typeof section.getBoundingClientRect !== 'function') return true;
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight || 0;
        if (!rect || (!rect.height && !rect.width) || !viewportHeight) return true;
        return rect.top < viewportHeight && rect.bottom > 0;
    }

    revealIconPreviewOnce() {
        if (this.iconStudioState.previewRevealDone) return;
        if (this.prefersReducedMotion()) return;
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA'
            || (active.tagName === 'INPUT' && active.type === 'text'))) return;
        if (this.isIconPreviewVisible()) {
            this.iconStudioState.previewRevealDone = true;
            return;
        }
        const target = document.getElementById('iconPreviewHeading');
        if (!target || typeof target.scrollIntoView !== 'function') return;
        this.iconStudioState.previewRevealDone = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    jumpToIconPreview() {
        const target = document.getElementById('iconPreviewHeading');
        if (!target || typeof target.scrollIntoView !== 'function') return;
        target.scrollIntoView({
            behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'center'
        });
    }

    // ---- Phase 3: direct manipulation on the crop inspection canvas ----

    bindIconInspectionInteraction() {
        const canvas = document.getElementById('iconInspectionCanvas');
        if (!canvas || typeof canvas.setPointerCapture !== 'function') return;
        const interaction = { pointers: new Map(), drag: null, pinch: null };
        this.iconInspectionInteraction = interaction;
        canvas.addEventListener('pointerdown', event => this.handleIconInspectionPointerDown(event, canvas, interaction));
        canvas.addEventListener('pointermove', event => this.handleIconInspectionPointerMove(event, canvas, interaction));
        canvas.addEventListener('pointerup', event => this.endIconInspectionPointer(event, canvas, interaction));
        canvas.addEventListener('pointercancel', event => this.endIconInspectionPointer(event, canvas, interaction));
        canvas.addEventListener('wheel', event => this.handleIconInspectionWheel(event, canvas), { passive: false });
        canvas.addEventListener('keydown', event => this.handleIconInspectionKeydown(event));
    }

    clampIconScale(value) {
        return Math.min(160, Math.max(40, Math.round(Number(value) || 0)));
    }

    clampIconOffset(value) {
        return Math.min(40, Math.max(-40, Math.round(Number(value) || 0)));
    }

    getIconInspectionSize(canvas) {
        const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
        return (rect && rect.width) || canvas.width || 320;
    }

    applyIconTransform(patch) {
        if (!this.iconStudioState) return;
        if (typeof patch.scale === 'number') this.iconStudioState.scale = this.clampIconScale(patch.scale);
        if (typeof patch.offsetX === 'number') this.iconStudioState.offsetX = this.clampIconOffset(patch.offsetX);
        if (typeof patch.offsetY === 'number') this.iconStudioState.offsetY = this.clampIconOffset(patch.offsetY);
        this.iconStudioState.dirty = true;
        this.syncIconTransformControls();
        this.requestIconStudioRender();
    }

    requestIconStudioRender() {
        if (typeof window.requestAnimationFrame !== 'function') {
            this.renderIconStudio();
            return;
        }
        if (this.iconStudioRenderFrame != null) return;
        this.iconStudioRenderFrame = window.requestAnimationFrame(() => {
            this.iconStudioRenderFrame = null;
            this.renderIconStudio();
        });
    }

    flushIconStudioRender() {
        if (this.iconStudioRenderFrame != null && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(this.iconStudioRenderFrame);
        }
        this.iconStudioRenderFrame = null;
        this.renderIconStudio();
    }

    resetIconInspectionInteraction() {
        const interaction = this.iconInspectionInteraction;
        if (!interaction) return;
        interaction.drag = null;
        interaction.pinch = null;
        interaction.pointers.clear();
        document.getElementById('iconInspectionCanvas')?.classList.remove('is-dragging', 'is-pinching');
    }

    handleIconInspectionPointerDown(event, canvas, interaction) {
        if (!this.iconStudioState?.foreground) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (typeof canvas.setPointerCapture === 'function') {
            try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
        }
        interaction.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (interaction.pointers.size === 2) {
            const [first, second] = [...interaction.pointers.values()];
            interaction.drag = null;
            interaction.pinch = {
                distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
                scale: this.iconStudioState.scale
            };
            canvas.classList.remove('is-dragging');
            canvas.classList.add('is-pinching');
            event.preventDefault();
            return;
        }
        interaction.drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: this.iconStudioState.offsetX,
            offsetY: this.iconStudioState.offsetY
        };
        canvas.classList.add('is-dragging');
        event.preventDefault();
    }

    handleIconInspectionPointerMove(event, canvas, interaction) {
        if (!this.iconStudioState?.foreground) return;
        if (!interaction.pointers.has(event.pointerId)) return;
        interaction.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (interaction.pinch) {
            const points = [...interaction.pointers.values()];
            if (points.length < 2) return;
            const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
            this.applyIconTransform({ scale: interaction.pinch.scale * distance / interaction.pinch.distance });
            event.preventDefault();
            return;
        }

        const drag = interaction.drag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const size = this.getIconInspectionSize(canvas);
        this.applyIconTransform({
            offsetX: drag.offsetX + (event.clientX - drag.startX) / size * 100,
            offsetY: drag.offsetY + (event.clientY - drag.startY) / size * 100
        });
        event.preventDefault();
    }

    endIconInspectionPointer(event, canvas, interaction) {
        interaction.pointers.delete(event.pointerId);
        if (interaction.pointers.size === 0) {
            interaction.drag = null;
            interaction.pinch = null;
            canvas.classList.remove('is-dragging', 'is-pinching');
        } else if (interaction.pointers.size === 1) {
            const [pointerId, position] = [...interaction.pointers.entries()][0];
            interaction.pinch = null;
            interaction.drag = {
                pointerId,
                startX: position.x,
                startY: position.y,
                offsetX: this.iconStudioState.offsetX,
                offsetY: this.iconStudioState.offsetY
            };
            canvas.classList.remove('is-pinching');
            canvas.classList.add('is-dragging');
        }
        if (typeof canvas.releasePointerCapture === 'function') {
            try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
        }
        if (this.iconStudioState?.foreground) {
            this.flushIconStudioRender();
            this.signalIconPreviewChange();
        }
    }

    handleIconInspectionWheel(event, canvas) {
        if (!this.iconStudioState?.foreground) return;
        const zoomIntent = event.ctrlKey === true || event.metaKey === true || document.activeElement === canvas;
        if (!zoomIntent) return;
        event.preventDefault();
        this.applyIconTransform({
            scale: this.iconStudioState.scale + (event.deltaY < 0 ? 2 : -2)
        });
    }

    handleIconInspectionKeydown(event) {
        if (!this.iconStudioState?.foreground) return;
        const step = event.shiftKey ? 5 : 1;
        if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            this.applyIconTransform({ scale: this.iconStudioState.scale + step });
            return;
        }
        if (event.key === '-' || event.key === '_') {
            event.preventDefault();
            this.applyIconTransform({ scale: this.iconStudioState.scale - step });
            return;
        }
        const delta = {
            ArrowLeft: { offsetX: -step },
            ArrowRight: { offsetX: step },
            ArrowUp: { offsetY: -step },
            ArrowDown: { offsetY: step }
        }[event.key];
        if (!delta) return;
        event.preventDefault();
        this.applyIconTransform({
            offsetX: this.iconStudioState.offsetX + (delta.offsetX || 0),
            offsetY: this.iconStudioState.offsetY + (delta.offsetY || 0)
        });
    }

    fitIconToSafeZone() {
        const bounds = this.iconStudioState.foreground?.analysis.bounds;
        if (!bounds) return;
        this.resetIconInspectionInteraction();
        const contentWidth = Math.max(0.01, bounds.right - bounds.left);
        const contentHeight = Math.max(0.01, bounds.bottom - bounds.top);
        const scale = Math.min(0.6111 / contentWidth, 0.6111 / contentHeight, 1.6);
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        this.iconStudioState.scale = Math.round(scale * 100);
        this.iconStudioState.offsetX = Math.round((0.5 - centerX) * scale * 100);
        this.iconStudioState.offsetY = Math.round((0.5 - centerY) * scale * 100);
        this.syncIconTransformControls();
        this.iconStudioState.dirty = true;
        this.renderIconStudio();
    }

    renderIconStudio() {
        if (!this.iconStudioState) return;
        document.getElementById('iconScaleOutput').textContent = `${this.iconStudioState.scale}%`;
        document.getElementById('iconOffsetXOutput').textContent = `${this.iconStudioState.offsetX}%`;
        document.getElementById('iconOffsetYOutput').textContent = `${this.iconStudioState.offsetY}%`;
        document.getElementById('iconBackgroundScaleOutput').textContent = `${this.iconStudioState.backgroundScale}%`;
        document.getElementById('iconBackgroundOffsetXOutput').textContent = `${this.iconStudioState.backgroundOffsetX}%`;
        document.getElementById('iconBackgroundOffsetYOutput').textContent = `${this.iconStudioState.backgroundOffsetY}%`;
        document.getElementById('splashScaleOutput').textContent = `${this.iconStudioState.splashScale}%`;

        const advancedSummary = document.getElementById('iconAdvancedSummary');
        if (advancedSummary) {
            const mode = this.iconStudioState.backgroundMode;
            const background = mode === 'image'
                ? (this.iconStudioState.backgroundImage?.displayName
                    || this.iconStudioState.backgroundImage?.fileName
                    || 'Image')
                : mode === 'gradient'
                    ? `Gradient ${this.iconStudioState.gradientStops.length} stops · ${this.iconStudioState.gradientAngle}°`
                    : `Solid ${this.iconStudioState.backgroundColor}`;
            advancedSummary.textContent = this.iconStudioState.monochrome
                ? `${background} · monochrome`
                : background;
        }

        const angleOutput = document.getElementById('iconGradientAngleOutput');
        if (angleOutput) angleOutput.textContent = `${this.iconStudioState.gradientAngle}°`;
        const fallbackStatus = document.getElementById('iconGradientFallbackStatus');
        if (fallbackStatus) {
            const first = this.iconStudioState.gradientStops[0];
            fallbackStatus.textContent = `Flat fallback color: ${first ? first.color : this.iconStudioState.backgroundColor} (first stop).`;
        }

        const foreground = this.iconStudioState.foreground;
        const canRenderCanvas = !navigator.userAgent.toLowerCase().includes('jsdom');
        if (canRenderCanvas) {
            document.querySelectorAll('canvas[data-icon-preview]').forEach(canvas => {
                this.drawIconPreview(canvas, canvas.dataset.iconPreview, foreground);
            });
            const inspection = document.getElementById('iconInspectionCanvas');
            if (inspection) this.drawIconPreview(inspection, 'inspection', foreground);
            document.querySelectorAll('canvas[data-splash-preview]').forEach(canvas => {
                this.drawSplashPreview(canvas, canvas.dataset.splashPreview);
            });
            const strip = document.getElementById('iconGradientStripCanvas');
            if (strip) this.drawGradientStrip(strip);
        }
        this.updateIconValidationChecklist();
        this.updateIconApplyAvailability();
        this.updateSplashAvailability();
    }

    getSplashSource() {
        return this.iconStudioState.splashUseAppIcon
            ? this.iconStudioState.foreground
            : this.iconStudioState.splash;
    }

    updateSplashAvailability() {
        const source = this.getSplashSource();
        const button = document.getElementById('configNativeSplashBtn');
        if (button) button.disabled = !source || this.iconStudioState.splashApplying;
        const status = document.getElementById('splashSourceStatus');
        if (status) {
            status.textContent = source
                ? `${this.iconStudioState.splashUseAppIcon ? 'App icon foreground' : source.displayName || source.fileName} ready · 1024×1024 PNG.`
                : this.iconStudioState.splashUseAppIcon
                    ? 'Upload a valid app icon to use it as splash artwork.'
                    : 'Choose dedicated splash artwork.';
        }
    }

    /** Wires every field in the "All splash options" panel: colour pairing + live count. */
    bindSplashOptions() {
        const panel = document.getElementById('splashOptionsPanel');
        if (!panel) return;
        this.splashTouched = this.splashTouched || new Set();
        panel.querySelectorAll('[data-splash-for]').forEach(text => {
            const key = text.dataset.splashFor;
            const picker = panel.querySelector(`input[type="color"][data-splash-key="${key}"]`);
            picker?.addEventListener('input', event => {
                this.splashTouched.add(key);
                text.value = event.target.value.toUpperCase();
                this.refreshSplashOptionsCount();
            });
            text?.addEventListener('input', event => {
                this.splashTouched.add(key);
                const raw = event.target.value.trim();
                if (/^#[0-9a-f]{6}$/i.test(raw)) picker.value = raw;
                this.refreshSplashOptionsCount();
            });
        });
        panel.querySelectorAll('[data-splash-key]').forEach(field => {
            const event = field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input';
            field.addEventListener(event, () => {
                // A colour picker emits #ffffff before the user chooses; only count it once touched.
                if (field.dataset.splashKind === 'color' && field.type === 'color') return;
                this.splashTouched.add(field.dataset.splashKey);
                this.refreshSplashOptionsCount();
            });
        });
        this.refreshSplashOptionsCount();
    }

    /** Reads every panel field into a flutter_native_splash config object. Untouched or blank fields are omitted. */
    collectSplashConfig() {
        const panel = document.getElementById('splashOptionsPanel');
        const touched = this.splashTouched || new Set();
        const config = {};
        if (!panel) return config;
        panel.querySelectorAll('[data-splash-key]').forEach(field => {
            const key = field.dataset.splashKey;
            const kind = field.dataset.splashKind;
            let value;
            if (kind === 'bool') {
                // A checked box is meaningful; the default (unchecked) is omitted unless
                // the user explicitly toggled it on.
                if (!field.checked) return;
                value = true;
            } else {
                const raw = field.value.trim();
                if (raw === '') return; // omit blanks so pubspec stays minimal
                // Browsers default colour inputs to #000000/#ffffff; ignore an
                // untouched picker unless the user actually interacted with it.
                if (kind === 'color' && field.type === 'color' && !touched.has(key)) return;
                if (kind === 'number') {
                    const num = Number(raw);
                    if (!Number.isFinite(num)) return;
                    value = num;
                } else if (kind === 'list') {
                    const items = raw.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
                    if (!items.length) return;
                    value = items;
                } else {
                    value = kind === 'color' ? raw.toUpperCase() : raw;
                }
            }
            if (key.includes('.')) {
                const [group, leaf] = key.split('.');
                config[group] = config[group] || {};
                config[group][leaf] = value;
            } else {
                config[key] = value;
            }
        });
        return config;
    }

    refreshSplashOptionsCount() {
        const label = document.getElementById('splashOptionsCount');
        if (label) label.textContent = `${Object.keys(this.collectSplashConfig()).length} set`;
    }

    /**
     * Shows the package-only chrome (asset path row + every flutter_launcher_icons
     * option) only while "Flutter package" mode is selected, so direct-native users
     * never see settings that do not apply to them.
     */
    syncLauncherIconsVisibility() {
        const mode = document.querySelector('input[name="iconDeploymentMode"]:checked')?.value || 'native';
        const isPackages = mode === 'packages';
        const panel = document.getElementById('launcherIconsOptionsPanel');
        const pathRow = document.getElementById('launcherIconsAssetPathRow');
        if (panel) panel.hidden = !isPackages;
        if (pathRow) pathRow.hidden = !isPackages;
    }

    /** Wires every field in the "All launcher icon options" panel: colour pairing + live count. */
    bindLauncherIconsOptions() {
        const panel = document.getElementById('launcherIconsOptionsPanel');
        if (!panel) return;
        this.liconTouched = this.liconTouched || new Set();
        panel.querySelectorAll('[data-licon-for]').forEach(text => {
            const key = text.dataset.liconFor;
            const picker = panel.querySelector(`input[type="color"][data-licon-key="${key}"]`);
            picker?.addEventListener('input', event => {
                this.liconTouched.add(key);
                text.value = event.target.value.toUpperCase();
                this.refreshLauncherIconsCount();
            });
            text?.addEventListener('input', event => {
                this.liconTouched.add(key);
                const raw = event.target.value.trim();
                if (/^#[0-9a-f]{6}$/i.test(raw)) picker.value = raw;
                this.refreshLauncherIconsCount();
            });
        });
        panel.querySelectorAll('[data-licon-key]').forEach(field => {
            const event = field.type === 'checkbox' ? 'change' : 'input';
            field.addEventListener(event, () => {
                if (field.dataset.liconKind === 'color' && field.type === 'color') return;
                this.liconTouched.add(field.dataset.liconKey);
                this.refreshLauncherIconsCount();
            });
        });
        this.refreshLauncherIconsCount();
    }

    /** Reads every panel field into a flutter_launcher_icons config object. Untouched or blank fields are omitted. */
    collectLauncherIconsConfig() {
        const panel = document.getElementById('launcherIconsOptionsPanel');
        const touched = this.liconTouched || new Set();
        const config = {};
        if (!panel) return config;
        panel.querySelectorAll('[data-licon-key]').forEach(field => {
            const key = field.dataset.liconKey;
            const kind = field.dataset.liconKind;
            let value;
            if (kind === 'bool') {
                // A checked box is meaningful; the default (unchecked) is omitted unless
                // the user explicitly toggled it on.
                if (!field.checked) return;
                value = true;
            } else {
                const raw = field.value.trim();
                if (raw === '') return; // omit blanks so pubspec stays minimal
                if (kind === 'color' && field.type === 'color' && !touched.has(key)) return;
                if (kind === 'number') {
                    const num = Number(raw);
                    if (!Number.isFinite(num)) return;
                    value = num;
                } else if (key === 'android' || key === 'ios') {
                    // The package accepts a boolean or a custom icon name.
                    if (raw === 'true' || raw === 'false') value = raw === 'true';
                    else value = raw;
                } else {
                    value = kind === 'color' ? raw.toUpperCase() : raw;
                }
            }
            if (key.includes('.')) {
                const [group, leaf] = key.split('.');
                config[group] = config[group] || {};
                config[group][leaf] = value;
            } else {
                config[key] = value;
            }
        });
        return config;
    }

    refreshLauncherIconsCount() {
        const label = document.getElementById('launcherIconsOptionsCount');
        if (label) label.textContent = `${Object.keys(this.collectLauncherIconsConfig()).length} set`;
    }

    /** Restores the "All launcher icon options" panel from a saved config object. */
    populateLauncherIconsOptions(config) {
        const panel = document.getElementById('launcherIconsOptionsPanel');
        if (!panel) return;
        this.liconTouched = this.liconTouched || new Set();
        panel.querySelectorAll('[data-licon-key]').forEach(field => {
            const key = field.dataset.liconKey;
            const kind = field.dataset.liconKind;
            let value;
            if (key.includes('.')) {
                const [group, leaf] = key.split('.');
                value = config?.[group]?.[leaf];
            } else {
                value = config?.[key];
            }
            if (kind === 'bool') {
                field.checked = value === true;
                if (value === true) this.liconTouched.add(key);
            } else if (value === undefined || value === null) {
                field.value = '';
            } else {
                field.value = String(value);
                this.liconTouched.add(key);
                if (kind === 'color') {
                    const text = panel.querySelector(`[data-licon-for="${key}"]`);
                    if (text && /^#[0-9a-f]{6}$/i.test(String(value))) text.value = String(value).toUpperCase();
                }
            }
        });
        this.refreshLauncherIconsCount();
    }

    drawSplashPreview(canvas, kind) {
        const context = canvas.getContext('2d');
        if (!context) return;
        const width = canvas.width;
        const height = canvas.height;
        context.fillStyle = this.iconStudioState.splashBackgroundColor;
        context.fillRect(0, 0, width, height);
        // The background image applies to legacy Android and iOS only; Android 12+
        // splashes are icon-on-color and have no background-image slot.
        if (kind !== 'android12' && this.iconStudioState.splashBackgroundImage) {
            context.drawImage(this.createSplashBackgroundCanvas(width), 0, 0, width, height);
        }
        const source = this.getSplashSource();
        if (!source) {
            context.fillStyle = 'rgba(100,100,100,.28)';
            context.fillRect(width * 0.38, height * 0.43, width * 0.24, width * 0.24);
            return;
        }
        const ratio = kind === 'android12' ? 0.56 : kind === 'androidLegacy' ? 0.68 : 0.62;
        const windowSize = width * ratio;
        const x = (width - windowSize) / 2;
        const y = (height - windowSize) / 2;
        context.save();
        if (kind === 'android12') {
            context.beginPath();
            context.arc(width / 2, height / 2, windowSize / 2, 0, Math.PI * 2);
            context.clip();
        }
        context.drawImage(this.createSplashAssetCanvas(512), x, y, windowSize, windowSize);
        context.restore();
        if (kind === 'android12') {
            context.fillStyle = 'rgba(0,0,0,.18)';
            context.fillRect(0, height - 4, width, 4);
        }
    }

    createSplashAssetCanvas(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const source = this.getSplashSource();
        if (!source) return canvas;
        const drawSize = size * this.iconStudioState.splashScale / 100;
        const position = (size - drawSize) / 2;
        context.drawImage(source.image, position, position, drawSize, drawSize);
        return canvas;
    }

    applySplashStudio() {
        const source = this.getSplashSource();
        if (!source || this.iconStudioState.splashApplying) return;
        this.iconStudioState.splashApplying = true;
        this.updateSplashAvailability();
        const button = document.getElementById('confirmSplashApplyBtn');
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Preparing splash…';
        }
        const asset = this.createSplashAssetCanvas(1024).toDataURL('image/png');
        const backgroundImage = this.iconStudioState.splashBackgroundImage;
        const background = backgroundImage ? this.createSplashBackgroundCanvas(1024).toDataURL('image/png') : undefined;
        this.sendMessage('applySplashStudio', {
            imageBase64: asset,
            backgroundColorHex: this.iconStudioState.splashBackgroundColor,
            fullscreen: document.getElementById('splashFullscreenCheckbox')?.checked !== false,
            backgroundImageBase64: background,
            backgroundFit: this.iconStudioState.splashBackgroundFit,
            config: this.collectSplashConfig(),
            record: {
                useAppIcon: this.iconStudioState.splashUseAppIcon,
                splashScale: this.iconStudioState.splashScale,
                artworkBase64: this.iconStudioState.splashUseAppIcon ? undefined : this.iconStudioState.splash?.dataUrl
            }
        });
    }

    /**
     * Bakes the splash background image into a square PNG using the chosen fit.
     * flutter_native_splash has no fit key, so the fit is applied here.
     */
    createSplashBackgroundCanvas(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const source = this.iconStudioState.splashBackgroundImage;
        if (!context || !source) return canvas;
        const image = source.image;
        const fit = this.iconStudioState.splashBackgroundFit || 'cover';
        let width;
        let height;
        if (fit === 'center') {
            width = image.width;
            height = image.height;
        } else if (fit === 'contain') {
            const scale = Math.min(size / image.width, size / image.height);
            width = image.width * scale;
            height = image.height * scale;
        } else {
            const scale = Math.max(size / image.width, size / image.height);
            width = image.width * scale;
            height = image.height * scale;
        }
        const x = (size - width) / 2;
        const y = (size - height) / 2;
        context.drawImage(image, x, y, width, height);
        return canvas;
    }

    drawIconPreview(canvas, mask, source) {
        const context = canvas.getContext('2d');
        if (!context) return;
        const size = canvas.width;
        context.clearRect(0, 0, size, size);
        if (!source) {
            context.fillStyle = '#D5D0BF';
            context.fillRect(size * 0.24, size * 0.24, size * 0.52, size * 0.52);
            context.strokeStyle = '#8A887D';
            context.lineWidth = Math.max(1, size * 0.015);
            context.strokeRect(size * 0.24, size * 0.24, size * 0.52, size * 0.52);
            return;
        }

        context.save();
        if (mask !== 'inspection' && mask !== 'legacy') {
            this.traceIconMask(context, size, mask === 'themed' ? 'pixel' : mask);
            context.clip();
        }
        if (mask === 'themed') {
            context.fillStyle = '#D9C7B7';
            context.fillRect(0, 0, size, size);
            this.drawMonochromeLayer(context, size, '#5D3427');
            context.restore();
            return;
        }
        this.drawIconBackground(context, size);
        const iosSource = mask === 'ios' && this.iconStudioState.ios ? this.iconStudioState.ios : null;
        if (iosSource) context.drawImage(iosSource.image, 0, 0, size, size);
        else this.drawIconForeground(context, size, source.image);
        context.restore();
    }

    /* --- Gradient helpers (pure, canvas-free so they stay testable) --------- */

    clampGradientAngle(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        const wrapped = Math.round(numeric) % 360;
        return wrapped < 0 ? wrapped + 360 : wrapped;
    }

    clampGradientPosition(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Math.min(100, Math.max(0, Math.round(numeric)));
    }

    /** Converts a CSS-style angle (0deg = bottom to top, clockwise) into gradient endpoints. */
    computeGradientEndpoints(angleDeg, size) {
        const angle = this.clampGradientAngle(angleDeg);
        const radians = angle * Math.PI / 180;
        const dx = Math.sin(radians);
        const dy = -Math.cos(radians);
        const half = size / 2;
        const span = Math.abs(dx) * size + Math.abs(dy) * size;
        const lineLength = span / 2;
        return {
            x0: half - dx * lineLength,
            y0: half - dy * lineLength,
            x1: half + dx * lineLength,
            y1: half + dy * lineLength
        };
    }

    /** Clamps stop positions and exposes them as canvas-ready color stops. */
    normalizeGradientStops(stops) {
        return (stops || []).map(stop => ({
            id: stop.id,
            color: /^#[0-9a-f]{6}$/i.test(stop.color || '') ? stop.color.toUpperCase() : '#FFFFFF',
            position: this.clampGradientPosition(stop.position)
        }));
    }

    gradientCssPreview(stops, angleDeg) {
        const normalized = this.normalizeGradientStops(stops);
        const list = normalized.map(stop => `${stop.color} ${stop.position}%`).join(', ');
        return `linear-gradient(${this.clampGradientAngle(angleDeg)}deg, ${list})`;
    }

    setGradientAngle(value) {
        const angle = this.clampGradientAngle(value);
        this.iconStudioState.gradientAngle = angle;
        const range = document.getElementById('iconGradientAngleInput');
        if (range && !this.isGradientPositionSliderActive(range)) range.value = String(angle);
        const text = document.getElementById('iconGradientAngleText');
        if (text && document.activeElement !== text) text.value = String(angle);
        this.iconStudioState.dirty = true;
        this.requestIconStudioRender();
    }

    addGradientStop() {
        const stops = this.iconStudioState.gradientStops;
        if (stops.length >= 8) return;
        const last = stops[stops.length - 1];
        const start = last ? last.position : 0;
        this.iconStudioState.gradientStopSequence += 1;
        stops.push({
            id: `stop-${this.iconStudioState.gradientStopSequence}`,
            color: last ? last.color : '#FFFFFF',
            position: this.clampGradientPosition(start + (100 - start) / 2)
        });
        this.syncGradientStopRows();
        this.iconStudioState.dirty = true;
        this.renderIconStudio();
    }

    removeGradientStop(stopId) {
        const stops = this.iconStudioState.gradientStops;
        if (stops.length <= 2) return;
        const index = stops.findIndex(stop => stop.id === stopId);
        if (index === -1) return;
        stops.splice(index, 1);
        this.syncGradientStopRows();
        this.iconStudioState.dirty = true;
        this.renderIconStudio();
    }

    moveGradientStop(stopId, delta) {
        const stops = this.iconStudioState.gradientStops;
        const index = stops.findIndex(stop => stop.id === stopId);
        const target = index + delta;
        if (index === -1 || target < 0 || target >= stops.length) return;
        const [moved] = stops.splice(index, 1);
        stops.splice(target, 0, moved);
        this.syncGradientStopRows();
        this.iconStudioState.dirty = true;
        this.renderIconStudio();
    }

    updateGradientStopColor(stopId, rawColor) {
        const stop = this.iconStudioState.gradientStops.find(item => item.id === stopId);
        if (!stop) return;
        const hex = String(rawColor || '').trim();
        const valid = /^#[0-9a-f]{6}$/i.test(hex);
        stop.color = valid ? hex.toUpperCase() : stop.color;
        this.syncGradientStopRows();
        this.iconStudioState.dirty = true;
        this.requestIconStudioRender();
    }

    updateGradientStopPosition(stopId, value) {
        const stop = this.iconStudioState.gradientStops.find(item => item.id === stopId);
        if (!stop) return;
        stop.position = this.clampGradientPosition(value);
        this.syncGradientStopRows();
        this.iconStudioState.dirty = true;
        // Live preview on every tick, coalesced to one paint per animation frame so a
        // fast drag never queues a full canvas re-render per pointer event.
        this.requestIconStudioRender();
    }

    /** Reconciles stop rows by id so typing in a hex field never loses focus. */
    syncGradientStopRows() {
        const list = document.getElementById('iconGradientStopList');
        if (!list || !this.iconStudioState) return;
        const stops = this.iconStudioState.gradientStops;
        const active = document.activeElement;
        const activeStopId = active?.dataset?.stopField ? active.closest('.is-gradient-stop')?.dataset.stopId : null;
        const activeField = active?.dataset?.stopField || null;
        const selectionStart = activeStopId && activeField ? active.selectionStart : null;

        stops.forEach((stop, index) => {
            let row = list.querySelector(`.is-gradient-stop[data-stop-id="${stop.id}"]`);
            if (!row) {
                row = document.createElement('div');
                row.className = 'is-gradient-stop';
                row.dataset.stopId = stop.id;
                row.innerHTML = this.gradientStopRowHtml(stop);
                this.bindGradientStopRow(row, stop.id);
            }
            const colorInput = row.querySelector('input[data-stop-field="color"]');
            const hexInput = row.querySelector('input[data-stop-field="hex"]');
            const positionInput = row.querySelector('input[data-stop-field="position"]');
            const positionOutput = row.querySelector('output[data-stop-field="position"]');
            if (colorInput && colorInput.value.toUpperCase() !== stop.color) colorInput.value = stop.color;
            if (hexInput && document.activeElement !== hexInput) hexInput.value = stop.color;
            if (hexInput) hexInput.classList.toggle('is-invalid', !/^#[0-9a-f]{6}$/i.test(hexInput.value.trim()));
            // Never write `.value` back onto the range input the user is actively
            // dragging: in Chromium/Electron a programmatic value write on an
            // actively-dragged range aborts the drag session, so the thumb starts to
            // move and then "drops". The user's own `input` events keep state in sync,
            // and `change` re-syncs once the gesture ends, so skipping the write is safe.
            if (positionInput && !this.isGradientPositionSliderActive(positionInput)) {
                if (positionInput.value !== String(stop.position)) positionInput.value = String(stop.position);
            }
            if (positionOutput) {
                const label = `${stop.position}%`;
                if (positionOutput.textContent !== label) positionOutput.textContent = label;
            }
            const up = row.querySelector('.is-gradient-stop-up');
            const down = row.querySelector('.is-gradient-stop-down');
            const remove = row.querySelector('.is-gradient-stop-remove');
            if (up) up.disabled = index === 0;
            if (down) down.disabled = index === stops.length - 1;
            if (remove) remove.disabled = stops.length <= 2;
            const ordinal = row.querySelector('.is-gradient-stop-index');
            if (ordinal) {
                const label = String(index + 1);
                if (ordinal.textContent !== label) ordinal.textContent = label;
            }
            // Only touch the DOM when the row is new or out of order. Re-appending a
            // live row re-parents it and makes the browser abort an in-progress
            // slider drag, so the user perceives the range input as "stuck".
            if (list.children[index] !== row) {
                list.insertBefore(row, list.children[index] || null);
            }
        });

        [...list.querySelectorAll('.is-gradient-stop')].forEach(row => {
            if (!stops.some(stop => stop.id === row.dataset.stopId)) row.remove();
        });

        const addButton = document.getElementById('addGradientStopBtn');
        if (addButton) addButton.disabled = stops.length >= 8;

        if (activeStopId && activeField) {
            const restored = list.querySelector(
                `.is-gradient-stop[data-stop-id="${activeStopId}"] input[data-stop-field="${activeField}"]`
            );
            if (restored && document.activeElement !== restored) {
                restored.focus();
                if (selectionStart !== null && typeof restored.setSelectionRange === 'function') {
                    try { restored.setSelectionRange(selectionStart, selectionStart); } catch { /* unsupported input type */ }
                }
            }
        }
    }

    /**
     * True while a gradient position range input is the user's active drag target.
     * A range input is "being dragged" when it holds focus (the pointer grabbed the
     * thumb) and we have not yet seen the matching pointerup/change. We track the
     * specific element so unrelated sliders are unaffected.
     */
    isGradientPositionSliderActive(slider) {
        if (!slider) return false;
        if (this.gradientStopDragSlider === slider) return true;
        const active = document.activeElement;
        return active === slider && this.gradientStopPointerDown === true;
    }

    beginGradientStopDrag(slider) {
        this.gradientStopDragSlider = slider;
        this.gradientStopPointerDown = true;
    }

    endGradientStopDrag(slider) {
        if (slider && this.gradientStopDragSlider === slider) this.gradientStopDragSlider = null;
        this.gradientStopPointerDown = false;
        // Re-sync the slider from state now that the gesture is over.
        this.syncGradientStopRows();
    }

    gradientStopRowHtml(stop) {
        return [
            `<span class="is-gradient-stop-index mono" aria-hidden="true"></span>`,
            `<input type="color" data-stop-field="color" value="${stop.color}" aria-label="Stop color">`,
            `<input type="text" data-stop-field="hex" class="mono" value="${stop.color}" maxlength="7" aria-label="Stop hex">`,
            `<input type="range" data-stop-field="position" min="0" max="100" step="1" value="${stop.position}" aria-label="Stop position">`,
            `<output data-stop-field="position">${stop.position}%</output>`,
            `<span class="is-gradient-stop-actions">`,
            `<button type="button" class="is-gradient-stop-up" aria-label="Move stop up"><i class="fas fa-arrow-up"></i></button>`,
            `<button type="button" class="is-gradient-stop-down" aria-label="Move stop down"><i class="fas fa-arrow-down"></i></button>`,
            `<button type="button" class="is-gradient-stop-remove" aria-label="Remove stop"><i class="fas fa-times"></i></button>`,
            `</span>`
        ].join('');
    }

    bindGradientStopRow(row, stopId) {
        row.querySelector('input[data-stop-field="color"]')?.addEventListener('input', event => {
            this.updateGradientStopColor(stopId, event.target.value);
        });
        const hexInput = row.querySelector('input[data-stop-field="hex"]');
        hexInput?.addEventListener('input', event => {
            const raw = event.target.value.trim();
            event.target.classList.toggle('is-invalid', !/^#[0-9a-f]{6}$/i.test(raw));
            if (/^#[0-9a-f]{6}$/i.test(raw)) this.updateGradientStopColor(stopId, raw);
        });
        hexInput?.addEventListener('blur', event => {
            const stop = this.iconStudioState.gradientStops.find(item => item.id === stopId);
            if (stop) event.target.value = stop.color;
        });
        const positionSlider = row.querySelector('input[data-stop-field="position"]');
        positionSlider?.addEventListener('pointerdown', () => this.beginGradientStopDrag(positionSlider));
        positionSlider?.addEventListener('pointerup', () => this.endGradientStopDrag(positionSlider));
        positionSlider?.addEventListener('pointercancel', () => this.endGradientStopDrag(positionSlider));
        // Keyboard focus also counts as active while the pointer is down; keep the
        // drag flag in sync for keyboard-driven changes via `change`.
        positionSlider?.addEventListener('change', () => this.endGradientStopDrag(positionSlider));
        positionSlider?.addEventListener('blur', () => {
            if (this.gradientStopDragSlider === positionSlider) this.endGradientStopDrag(positionSlider);
        });
        positionSlider?.addEventListener('input', event => {
            this.updateGradientStopPosition(stopId, event.target.value);
        });
        row.querySelector('.is-gradient-stop-up')?.addEventListener('click', () => this.moveGradientStop(stopId, -1));
        row.querySelector('.is-gradient-stop-down')?.addEventListener('click', () => this.moveGradientStop(stopId, 1));
        row.querySelector('.is-gradient-stop-remove')?.addEventListener('click', () => this.removeGradientStop(stopId));
    }

    /** Paints the raw gradient strip. Uses true CSS math on a non-square box. */
    drawGradientStrip(canvas) {
        const context = canvas.getContext('2d');
        if (!context) return;
        const width = canvas.width;
        const height = canvas.height;
        const stops = this.normalizeGradientStops(this.iconStudioState.gradientStops);
        context.clearRect(0, 0, width, height);
        if (!stops.length) return;
        const angle = this.clampGradientAngle(this.iconStudioState.gradientAngle);
        const radians = angle * Math.PI / 180;
        const dx = Math.sin(radians);
        const dy = -Math.cos(radians);
        const lineLength = (Math.abs(dx) * width + Math.abs(dy) * height) / 2;
        const gradient = context.createLinearGradient(
            width / 2 - dx * lineLength,
            height / 2 - dy * lineLength,
            width / 2 + dx * lineLength,
            height / 2 + dy * lineLength
        );
        stops.forEach(stop => gradient.addColorStop(stop.position / 100, stop.color));
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
    }

    /** Paints the gradient into a square canvas using CSS-equivalent angle math. */
    drawGradientLayer(context, size) {
        const stops = this.normalizeGradientStops(this.iconStudioState.gradientStops);
        if (!stops.length) {
            context.fillStyle = this.iconStudioState.backgroundColor;
            context.fillRect(0, 0, size, size);
            return;
        }
        const { x0, y0, x1, y1 } = this.computeGradientEndpoints(this.iconStudioState.gradientAngle, size);
        const gradient = context.createLinearGradient(x0, y0, x1, y1);
        stops.forEach(stop => gradient.addColorStop(stop.position / 100, stop.color));
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
    }

    drawIconBackground(context, size) {
        const source = this.iconStudioState.backgroundMode === 'image'
            ? this.iconStudioState.backgroundImage
            : null;
        if (this.iconStudioState.backgroundMode === 'gradient') {
            this.drawGradientLayer(context, size);
        } else {
            context.fillStyle = this.iconStudioState.backgroundColor;
            context.fillRect(0, 0, size, size);
        }
        if (!source) return;
        const image = source.image;
        const baseScale = this.iconStudioState.backgroundFit === 'contain'
            ? Math.min(size / image.width, size / image.height)
            : Math.max(size / image.width, size / image.height);
        const scale = baseScale * this.iconStudioState.backgroundScale / 100;
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (size - width) / 2 + size * this.iconStudioState.backgroundOffsetX / 100;
        const y = (size - height) / 2 + size * this.iconStudioState.backgroundOffsetY / 100;
        context.drawImage(image, x, y, width, height);
    }

    drawMonochromeLayer(context, size, color) {
        const source = this.iconStudioState.monochrome || this.iconStudioState.foreground;
        if (!source) return;
        const layer = document.createElement('canvas');
        layer.width = size;
        layer.height = size;
        const layerContext = layer.getContext('2d');
        this.drawIconForeground(layerContext, size, source.image);
        layerContext.globalCompositeOperation = 'source-in';
        layerContext.fillStyle = color;
        layerContext.fillRect(0, 0, size, size);
        context.drawImage(layer, 0, 0);
    }

    traceIconMask(context, size, mask) {
        context.beginPath();
        if (mask === 'pixel') {
            context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            return;
        }
        if (mask === 'teardrop') {
            context.moveTo(size * 0.5, 0);
            context.bezierCurveTo(size * 0.82, 0, size, size * 0.18, size, size * 0.5);
            context.bezierCurveTo(size, size * 0.86, size * 0.76, size, size * 0.5, size);
            context.bezierCurveTo(size * 0.15, size, 0, size * 0.76, 0, size * 0.5);
            context.bezierCurveTo(0, size * 0.23, size * 0.2, 0, size * 0.5, 0);
            return;
        }
        const radiusRatio = mask === 'ios' ? 0.225 : mask === 'samsung' ? 0.26 : mask === 'xiaomi' ? 0.31 : 0.08;
        this.roundedRectPath(context, 0, 0, size, size, size * radiusRatio);
    }

    roundedRectPath(context, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        context.moveTo(x + r, y);
        context.lineTo(x + width - r, y);
        context.quadraticCurveTo(x + width, y, x + width, y + r);
        context.lineTo(x + width, y + height - r);
        context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        context.lineTo(x + r, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - r);
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);
        context.closePath();
    }

    drawIconForeground(context, size, image) {
        const scale = this.iconStudioState.scale / 100;
        const drawSize = size * scale;
        const x = (size - drawSize) / 2 + size * this.iconStudioState.offsetX / 100;
        const y = (size - drawSize) / 2 + size * this.iconStudioState.offsetY / 100;
        context.drawImage(image, x, y, drawSize, drawSize);
    }

    updateIconValidationChecklist() {
        const source = this.iconStudioState.foreground;
        const checks = {
            png: source ? 'pass' : 'idle',
            size: source ? 'pass' : 'idle',
            weight: source ? 'pass' : 'idle',
            alpha: !source ? 'idle' : source.analysis.hasTransparency ? 'pass' : 'warn',
            safe: !source ? 'idle' : this.isIconInsideSafeZone() ? 'pass' : 'warn',
            'ios-alpha': source ? 'pass' : 'idle'
        };
        Object.entries(checks).forEach(([name, status]) => {
            const row = document.querySelector(`[data-check="${name}"]`);
            if (!row) return;
            row.classList.remove('is-pass', 'is-warn', 'is-fail');
            if (status !== 'idle') row.classList.add(`is-${status}`);
            const icon = row.querySelector('i');
            if (icon) icon.className = status === 'pass'
                ? 'fas fa-circle-check'
                : status === 'warn' ? 'fas fa-triangle-exclamation' : 'fas fa-circle';
        });
    }

    isIconInsideSafeZone() {
        const bounds = this.iconStudioState.foreground?.analysis.bounds;
        if (!bounds) return false;
        const scale = this.iconStudioState.scale / 100;
        const offsetX = this.iconStudioState.offsetX / 100;
        const offsetY = this.iconStudioState.offsetY / 100;
        const transformed = {
            left: 0.5 + offsetX + (bounds.left - 0.5) * scale,
            right: 0.5 + offsetX + (bounds.right - 0.5) * scale,
            top: 0.5 + offsetY + (bounds.top - 0.5) * scale,
            bottom: 0.5 + offsetY + (bounds.bottom - 0.5) * scale
        };
        const safeMin = 18 / 108;
        const safeMax = 1 - safeMin;
        return transformed.left >= safeMin && transformed.top >= safeMin
            && transformed.right <= safeMax && transformed.bottom <= safeMax;
    }

    openIconReview() {
        if (!this.iconStudioState.foreground) return;
        const android = document.getElementById('deployAndroidCheckbox')?.checked === true;
        const ios = document.getElementById('deployIosCheckbox')?.checked === true;
        const mode = document.querySelector('input[name="iconDeploymentMode"]:checked')?.value || 'native';
        const items = [];
        if (android) {
            items.push(mode === 'native'
                ? 'Android: 5 legacy densities + round icons + adaptive foreground + v26 XML'
                : 'Android: assets/air_flutter_icon masters + flutter_launcher_icons config');
            items.push(this.iconStudioState.backgroundMode === 'image'
                ? 'Adaptive background: processed PNG layer'
                : this.iconStudioState.backgroundMode === 'gradient'
                    ? `Adaptive background: ${this.iconStudioState.gradientStops.length}-stop gradient @ ${this.iconStudioState.gradientAngle}deg`
                    : `Adaptive background: ${this.iconStudioState.backgroundColor}`);
            items.push(this.iconStudioState.monochrome
                ? 'Themed icon: custom monochrome layer'
                : 'Themed icon: foreground alpha fallback');
        }
        if (ios) items.push(mode === 'native' ? 'iOS: complete AppIcon.appiconset + Contents.json' : 'iOS: opaque processed master + package config');
        if (mode === 'packages') {
            const licon = this.collectLauncherIconsConfig();
            const extra = ['web', 'windows', 'macos']
                .filter(platform => licon[platform]?.generate === true);
            if (extra.length) items.push(`Also generating: ${extra.map(name => name === 'macos' ? 'macOS' : name[0].toUpperCase() + name.slice(1)).join(', ')}`);
            items.push('Command: flutter pub add --dev flutter_launcher_icons && dart run flutter_launcher_icons');
        }
        items.push('Backup: .air-flutter/backups/icons/<timestamp> (latest 5 retained)');
        const list = document.getElementById('iconReviewList');
        if (list) list.innerHTML = items.map(item => `<li>${this.escapeIconStudioHtml(item)}</li>`).join('');
        const summary = document.getElementById('iconReviewSummary');
        if (summary) summary.textContent = `${android && ios ? 'Android and iOS' : android ? 'Android' : 'iOS'} · ${mode === 'native' ? 'Direct native assets' : 'Flutter package mode'}`;
        const panel = document.getElementById('iconReviewPanel');
        if (panel) {
            panel.hidden = false;
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    closeIconReview() {
        const panel = document.getElementById('iconReviewPanel');
        if (panel) panel.hidden = true;
    }

    async applyIconStudio() {
        if (!this.iconStudioState.foreground || this.iconStudioState.applying) return;
        this.iconStudioState.applying = true;
        this.updateIconApplyAvailability();
        const confirmButton = document.getElementById('confirmIconApplyBtn');
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.innerHTML = '<span class="af-spinner af-spinner-sm"></span> Preparing assets…';
        }
        this.setIconStatus('Rendering final assets from the approved preview...', 'info');
        try {
            const applyAndroid = document.getElementById('deployAndroidCheckbox')?.checked === true;
            const applyIos = document.getElementById('deployIosCheckbox')?.checked === true;
            const mode = document.querySelector('input[name="iconDeploymentMode"]:checked')?.value || 'native';
            const gradientMode = this.iconStudioState.backgroundMode === 'gradient';
            const backgroundRaster = gradientMode
                || (this.iconStudioState.backgroundMode === 'image' && Boolean(this.iconStudioState.backgroundImage));
            const fallbackColor = gradientMode
                ? (this.iconStudioState.gradientStops[0]?.color || this.iconStudioState.backgroundColor)
                : this.iconStudioState.backgroundColor;
            const payload = {
                mode,
                applyAndroid,
                applyIos,
                backgroundColorHex: fallbackColor,
                record: {
                    backgroundMode: this.iconStudioState.backgroundMode,
                    gradientStops: this.iconStudioState.gradientStops.map(stop => ({ color: stop.color, position: stop.position })),
                    gradientAngle: this.iconStudioState.gradientAngle,
                    foregroundBase64: this.iconStudioState.foreground?.dataUrl,
                    backgroundBase64: this.iconStudioState.backgroundMode === 'image'
                        ? this.iconStudioState.backgroundImage?.dataUrl
                        : undefined,
                    monochromeBase64: this.iconStudioState.monochrome?.dataUrl
                }
            };
            if (applyAndroid) {
                payload.legacyIcons = this.generateAndroidIconSet(false);
                payload.adaptiveForegroundIcons = this.generateAndroidIconSet(true);
                payload.adaptiveMonochromeIcons = this.generateAndroidLayerSet('monochrome');
                payload.androidLegacyMasterBase64 = this.renderIconExport(1024, 'legacy');
                payload.androidForegroundMasterBase64 = this.renderIconExport(1024, 'foreground');
                payload.androidMonochromeMasterBase64 = this.renderIconExport(1024, 'monochrome');
                if (backgroundRaster) {
                    payload.adaptiveBackgroundIcons = this.generateAndroidLayerSet('background');
                    payload.androidBackgroundMasterBase64 = this.renderIconExport(1024, 'background');
                }
            }
            if (applyIos) {
                payload.iosIcons = this.generateIosIconSet();
                payload.iosMasterBase64 = this.renderIconExport(1024, 'ios');
            }
            if (mode === 'packages') {
                payload.launcherIconsConfig = this.collectLauncherIconsConfig();
            }
            this.sendMessage('applyIconStudio', payload);
        } catch (error) {
            this.iconStudioState.applying = false;
            this.updateIconApplyAvailability();
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.textContent = 'Generate & Apply';
            }
            this.setIconStatus(error instanceof Error ? error.message : String(error), 'error');
        }
    }

    generateAndroidIconSet(foregroundOnly) {
        const definitions = [
            ['mdpi', foregroundOnly ? 108 : 48],
            ['hdpi', foregroundOnly ? 162 : 72],
            ['xhdpi', foregroundOnly ? 216 : 96],
            ['xxhdpi', foregroundOnly ? 324 : 144],
            ['xxxhdpi', foregroundOnly ? 432 : 192]
        ];
        return definitions.map(([density, size]) => ({
            density,
            base64Png: this.renderIconExport(size, foregroundOnly ? 'foreground' : 'legacy')
        }));
    }

    generateAndroidLayerSet(kind) {
        const definitions = [['mdpi', 108], ['hdpi', 162], ['xhdpi', 216], ['xxhdpi', 324], ['xxxhdpi', 432]];
        return definitions.map(([density, size]) => ({ density, base64Png: this.renderIconExport(size, kind) }));
    }

    generateIosIconSet() {
        const definitions = [
            ['Icon-App-20x20@2x.png', 'iphone', '20x20', '2x', 40],
            ['Icon-App-20x20@3x.png', 'iphone', '20x20', '3x', 60],
            ['Icon-App-29x29@2x.png', 'iphone', '29x29', '2x', 58],
            ['Icon-App-29x29@3x.png', 'iphone', '29x29', '3x', 87],
            ['Icon-App-40x40@2x.png', 'iphone', '40x40', '2x', 80],
            ['Icon-App-40x40@3x.png', 'iphone', '40x40', '3x', 120],
            ['Icon-App-60x60@2x.png', 'iphone', '60x60', '2x', 120],
            ['Icon-App-60x60@3x.png', 'iphone', '60x60', '3x', 180],
            ['Icon-App-20x20@1x.png', 'ipad', '20x20', '1x', 20],
            ['Icon-App-20x20@2x-ipad.png', 'ipad', '20x20', '2x', 40],
            ['Icon-App-29x29@1x.png', 'ipad', '29x29', '1x', 29],
            ['Icon-App-29x29@2x-ipad.png', 'ipad', '29x29', '2x', 58],
            ['Icon-App-40x40@1x.png', 'ipad', '40x40', '1x', 40],
            ['Icon-App-40x40@2x-ipad.png', 'ipad', '40x40', '2x', 80],
            ['Icon-App-76x76@1x.png', 'ipad', '76x76', '1x', 76],
            ['Icon-App-76x76@2x.png', 'ipad', '76x76', '2x', 152],
            ['Icon-App-83.5x83.5@2x.png', 'ipad', '83.5x83.5', '2x', 167],
            ['Icon-App-1024x1024@1x.png', 'ios-marketing', '1024x1024', '1x', 1024]
        ];
        return definitions.map(([filename, idiom, sizeName, scale, pixels]) => ({
            filename,
            idiom,
            size: sizeName,
            scale,
            base64Png: this.renderIconExport(pixels, 'ios')
        }));
    }

    renderIconExport(size, kind) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (kind === 'background') {
            this.drawIconBackground(context, size);
            return canvas.toDataURL('image/png');
        }
        if (kind === 'monochrome') {
            this.drawMonochromeLayer(context, size, '#FFFFFF');
            return canvas.toDataURL('image/png');
        }
        if (kind !== 'foreground') this.drawIconBackground(context, size);
        if (kind === 'ios' && this.iconStudioState.ios) {
            context.drawImage(this.iconStudioState.ios.image, 0, 0, size, size);
        } else {
            this.drawIconForeground(context, size, this.iconStudioState.foreground.image);
        }
        return canvas.toDataURL('image/png');
    }

    handleIconStudioProjectInfo(message) {
        const label = document.getElementById('iconStudioProjectName');
        if (label) label.textContent = message.error || message.appName || 'Flutter project';
        const previewLabel = document.getElementById('iconPreviewLabelInput');
        if (previewLabel && message.appName) {
            previewLabel.value = message.appName;
            previewLabel.dispatchEvent(new Event('input', { bubbles: true }));
        }
        this.iconStudioState.latestBackupPath = message.latestBackupPath || null;
        const restore = document.getElementById('restoreNativeIconsBtn');
        if (restore) restore.disabled = !message.latestBackupPath;
        this.applySavedAssets(message);
    }

    /** Stores the persisted previews and repaints the "Your current assets" cards. */
    applySavedAssets(message) {
        if ('savedIcon' in message || 'savedSplash' in message) {
            this.iconStudioState.savedIcon = message.savedIcon || null;
            this.iconStudioState.savedSplash = message.savedSplash || null;
        }
        this.renderCurrentAssets();
    }

    renderCurrentAssets() {
        const section = document.getElementById('iconSplashCurrentAssets');
        const grid = document.getElementById('currentAssetsGrid');
        const empty = document.getElementById('currentAssetsEmpty');
        const deleteBoth = document.getElementById('deleteBothAssetsBtn');
        if (!section || !grid) return;
        const icon = this.iconStudioState.savedIcon;
        const splash = this.iconStudioState.savedSplash;
        const hasAny = Boolean(icon || splash);
        section.hidden = !hasAny;
        if (empty) empty.hidden = hasAny;
        if (deleteBoth) deleteBoth.hidden = !hasAny;
        grid.innerHTML = [
            icon ? this.currentAssetCardHtml('icon', icon) : '',
            splash ? this.currentAssetCardHtml('splash', splash) : ''
        ].join('');
        grid.querySelectorAll('[data-asset-action]').forEach(button => {
            button.addEventListener('click', () => this.handleCurrentAssetAction(button.dataset.assetAction, button.dataset.asset));
        });
    }

    currentAssetCardHtml(asset, record) {
        const isIcon = asset === 'icon';
        const title = isIcon ? 'App icon' : 'Splash screen';
        const thumbnail = this.currentAssetThumbnailDataUrl(asset, record);
        const choices = isIcon ? this.iconRecordChoices(record) : this.splashRecordChoices(record);
        const thumb = thumbnail
            ? `<img src="${thumbnail}" alt="${title} preview" class="is-current-thumb-img">`
            : `<span class="is-current-thumb-fallback"><i class="fas fa-${isIcon ? 'icons' : 'image'}"></i></span>`;
        return [
            `<article class="is-current-card" data-asset="${asset}">`,
            `<div class="is-current-thumb">${thumb}</div>`,
            `<div class="is-current-body">`,
            `<div class="is-current-head"><strong>${title}</strong><span class="is-current-swatch" style="background:${record.backgroundColorHex}"></span></div>`,
            `<ul class="is-current-list">${choices.map(line => `<li>${this.escapeIconStudioHtml(line)}</li>`).join('')}</ul>`,
            `<div class="is-current-actions">`,
            `<button class="btn btn-quiet btn-xs" type="button" data-asset-action="edit" data-asset="${asset}"><i class="fas fa-pen"></i> Edit</button>`,
            `<button class="btn btn-quiet btn-xs is-danger" type="button" data-asset-action="delete" data-asset="${asset}"><i class="fas fa-trash-can"></i> Delete</button>`,
            `</div></div></article>`
        ].join('');
    }

    currentAssetThumbnailDataUrl(asset, record) {
        if (asset === 'splash') return record.backgroundDataUrl || record.artworkDataUrl || null;
        return record.foregroundDataUrl || null;
    }

    iconRecordChoices(record) {
        const lines = [
            `${record.mode === 'packages' ? 'Flutter package' : 'Direct native'} · ${record.applyAndroid && record.applyIos ? 'Android + iOS' : record.applyAndroid ? 'Android' : 'iOS'}`,
            record.backgroundMode === 'gradient'
                ? `Gradient ${record.gradientStops?.length || 0} stops @ ${record.gradientAngle}°`
                : record.backgroundMode === 'image'
                    ? 'Background image'
                    : `Solid ${record.backgroundColorHex}`,
            `Generated ${this.formatAssetTimestamp(record.generatedAt)}`
        ];
        return lines;
    }

    splashRecordChoices(record) {
        const lines = [
            record.useAppIcon ? 'Artwork: app icon foreground' : 'Artwork: dedicated splash image',
            record.backgroundImagePath ? `Background image (${record.backgroundFit || 'cover'})` : `Solid ${record.backgroundColorHex}`,
            `${record.fullscreen ? 'Fullscreen' : 'Windowed'} · Generated ${this.formatAssetTimestamp(record.generatedAt)}`
        ];
        return lines;
    }

    formatAssetTimestamp(value) {
        if (!value) return 'unknown time';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'unknown time';
        return date.toLocaleString();
    }

    handleCurrentAssetAction(action, asset) {
        if (action === 'delete') {
            this.sendMessage('deleteIconSplashAsset', { asset });
            return;
        }
        if (action === 'edit') {
            if (asset === 'icon') this.hydrateIconFromRecord(this.iconStudioState.savedIcon);
            else this.hydrateSplashFromRecord(this.iconStudioState.savedSplash);
        }
    }

    /** Repaints the live icon studio from a persisted record so it can be tweaked. */
    hydrateIconFromRecord(record) {
        if (!record) return;
        this.decodeDataUrlImage(record.foregroundDataUrl).then(image => {
            if (image) {
                this.commitIconStudioSource('foreground', {
                    fileName: 'saved-foreground.png',
                    displayName: 'Saved icon foreground',
                    dataUrl: record.foregroundDataUrl,
                    image,
                    analysis: this.analyzeIconPixels(image)
                });
            }
        });
        if (record.backgroundMode && record.backgroundMode !== 'color') {
            const radio = document.querySelector(`input[name="iconBackgroundMode"][value="${record.backgroundMode}"]`);
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        if (record.backgroundMode === 'gradient' && Array.isArray(record.gradientStops) && record.gradientStops.length >= 2) {
            this.iconStudioState.gradientStops = record.gradientStops.map((stop, index) => ({
                id: `stop-${index + 1}`,
                color: stop.color,
                position: stop.position
            }));
            this.iconStudioState.gradientStopSequence = record.gradientStops.length;
            this.iconStudioState.gradientAngle = record.gradientAngle || 180;
            this.syncGradientStopRows();
        }
        if (record.backgroundMode === 'image' && record.backgroundDataUrl) {
            this.decodeDataUrlImage(record.backgroundDataUrl).then(image => {
                if (image) this.commitIconStudioSource('background', {
                    fileName: 'saved-background.png',
                    displayName: 'Saved background',
                    dataUrl: record.backgroundDataUrl,
                    image,
                    analysis: this.analyzeIconPixels(image)
                });
            });
        }
        if (record.backgroundColorHex) {
            const input = document.getElementById('iconBgColorInput');
            const text = document.getElementById('iconBgColorText');
            if (input) input.value = record.backgroundColorHex;
            if (text) text.value = record.backgroundColorHex;
            this.iconStudioState.backgroundColor = record.backgroundColorHex;
        }
        this.populateLauncherIconsOptions(record.config);
        // Restore the generation mode so package-only chrome matches the saved record.
        const modeRadio = document.querySelector(`input[name="iconDeploymentMode"][value="${record.mode === 'packages' ? 'packages' : 'native'}"]`);
        if (modeRadio) {
            modeRadio.checked = true;
            document.querySelectorAll('.is-mode-card').forEach(card => {
                card.classList.toggle('is-selected', card.querySelector('input')?.checked === true);
            });
        }
        this.syncLauncherIconsVisibility();
        this.iconStudioState.dirty = true;
        this.renderIconStudio();
        this.setIconStatus('Loaded saved icon settings. Adjust and generate again.');
    }

    /** Repaints the live splash studio from a persisted record. */
    hydrateSplashFromRecord(record) {
        if (!record) return;
        const useAppIcon = document.getElementById('useAppIconForSplashCheckbox');
        if (useAppIcon) {
            useAppIcon.checked = record.useAppIcon !== false;
            useAppIcon.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (record.artworkDataUrl && record.useAppIcon === false) {
            this.decodeDataUrlImage(record.artworkDataUrl).then(image => {
                if (image) this.commitIconStudioSource('splash', {
                    fileName: 'saved-splash.png',
                    displayName: 'Saved splash artwork',
                    dataUrl: record.artworkDataUrl,
                    image,
                    analysis: this.analyzeIconPixels(image)
                });
            });
        }
        const scale = document.getElementById('splashScaleInput');
        if (scale && record.splashScale) {
            scale.value = String(record.splashScale);
            this.iconStudioState.splashScale = record.splashScale;
        }
        const color = document.getElementById('splashBgColorInput');
        const colorText = document.getElementById('splashBgColorText');
        if (color && record.backgroundColorHex) color.value = record.backgroundColorHex;
        if (colorText && record.backgroundColorHex) colorText.value = record.backgroundColorHex;
        if (record.backgroundColorHex) this.iconStudioState.splashBackgroundColor = record.backgroundColorHex;
        if (record.backgroundDataUrl) {
            this.decodeDataUrlImage(record.backgroundDataUrl).then(image => {
                if (image) this.commitIconStudioSource('splash-background', {
                    fileName: 'saved-splash-background.png',
                    displayName: 'Saved splash background',
                    dataUrl: record.backgroundDataUrl,
                    image,
                    analysis: this.analyzeIconPixels(image)
                });
                const fit = document.getElementById('splashBackgroundFitSelect');
                if (fit && record.backgroundFit) fit.value = record.backgroundFit;
                this.iconStudioState.splashBackgroundFit = record.backgroundFit || 'cover';
            });
        }
        const fullscreen = document.getElementById('splashFullscreenCheckbox');
        if (fullscreen) fullscreen.checked = record.fullscreen !== false;
        this.populateSplashOptions(record.config);
        this.iconStudioState.dirty = true;
        this.renderIconStudio();
        this.setIconStatus('Loaded saved splash settings. Adjust and generate again.');
    }

    /** Restores the "All splash options" panel from a saved config object. */
    populateSplashOptions(config) {
        const panel = document.getElementById('splashOptionsPanel');
        if (!panel) return;
        this.splashTouched = this.splashTouched || new Set();
        panel.querySelectorAll('[data-splash-key]').forEach(field => {
            const key = field.dataset.splashKey;
            const kind = field.dataset.splashKind;
            let value;
            if (key.includes('.')) {
                const [group, leaf] = key.split('.');
                value = config?.[group]?.[leaf];
            } else {
                value = config?.[key];
            }
            if (kind === 'bool') {
                field.checked = value === true;
                if (value === true) this.splashTouched.add(key);
            } else if (value === undefined || value === null) {
                field.value = '';
            } else if (kind === 'list') {
                field.value = Array.isArray(value) ? value.join('\n') : String(value);
                this.splashTouched.add(key);
            } else {
                field.value = String(value);
                this.splashTouched.add(key);
                if (kind === 'color') {
                    const text = panel.querySelector(`[data-splash-for="${key}"]`);
                    if (text && /^#[0-9a-f]{6}$/i.test(String(value))) text.value = String(value).toUpperCase();
                }
            }
        });
        this.refreshSplashOptionsCount();
    }

    decodeDataUrlImage(dataUrl) {
        if (!dataUrl) return Promise.resolve(null);
        return new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = dataUrl;
        });
    }

    handleIconStudioApplied(message) {
        this.iconStudioState.applying = false;
        const confirmButton = document.getElementById('confirmIconApplyBtn');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Generate & Apply';
        }
        this.updateIconApplyAvailability();
        if (!message.success) {
            this.setIconStatus(message.message || 'Icon generation failed.', 'error');
            this.showToast(message.message || 'Icon generation failed.', 'error');
            return;
        }
        this.iconStudioState.dirty = false;
        this.iconStudioState.latestBackupPath = message.backupPath || null;
        this.closeIconReview();
        const summary = document.getElementById('iconApplySummary');
        const summaryText = document.getElementById('iconApplySummaryText');
        const files = document.getElementById('iconApplyFiles');
        if (summary) summary.hidden = false;
        if (summaryText) summaryText.textContent = `${message.writtenFiles?.length || 0} files generated in ${message.mode === 'packages' ? 'Flutter package' : 'direct native'} mode. Backup: ${message.backupPath}`;
        if (files) files.innerHTML = (message.writtenFiles || []).map(file => `<li>${this.escapeIconStudioHtml(file)}</li>`).join('');
        const restore = document.getElementById('restoreNativeIconsBtn');
        if (restore) restore.disabled = false;
        this.setIconStatus(message.message || 'Icons applied successfully.', 'success');
        this.showToast('App icons generated successfully.', 'success');
        this.applySavedAssets(message);
    }

    handleIconStudioApplyCancelled() {
        this.iconStudioState.applying = false;
        const button = document.getElementById('confirmIconApplyBtn');
        if (button) {
            button.disabled = false;
            button.textContent = 'Generate & Apply';
        }
        this.updateIconApplyAvailability();
        this.setIconStatus('Generation cancelled. No files were changed.');
    }

    handleIconStudioRestoreResult(message) {
        this.setIconStatus(message.message, message.success ? 'success' : 'error');
        this.showToast(message.message, message.success ? 'success' : 'error');
    }

    handleSplashStudioApplied(message) {
        this.iconStudioState.splashApplying = false;
        const button = document.getElementById('confirmSplashApplyBtn');
        if (button) {
            button.disabled = false;
            button.textContent = 'Generate Splash';
        }
        this.updateSplashAvailability();
        if (!message.success) {
            this.setIconStatus(message.message || 'Splash generation failed.', 'error');
            this.showToast(message.message || 'Splash generation failed.', 'error');
            return;
        }
        this.iconStudioState.dirty = false;
        this.iconStudioState.latestBackupPath = message.backupPath || null;
        const review = document.getElementById('splashReviewPanel');
        const summary = document.getElementById('splashApplySummary');
        const summaryText = document.getElementById('splashApplySummaryText');
        if (review) review.hidden = true;
        if (summary) summary.hidden = false;
        if (summaryText) summaryText.textContent = `${message.message} Backup: ${message.backupPath}`;
        const restore = document.getElementById('restoreNativeIconsBtn');
        if (restore) restore.disabled = false;
        this.setIconStatus(message.message, 'success');
        this.showToast(message.message, 'success');
        this.applySavedAssets(message);
    }

    handleIconSplashDeleted(message) {
        this.applySavedAssets(message);
        this.setIconStatus(message.message, 'success');
        this.showToast(message.message, 'success');
    }

    handleIconSplashDeleteCancelled() {
        this.setIconStatus('Deletion cancelled. No files were changed.');
    }

    handleSplashStudioApplyCancelled() {
        this.iconStudioState.splashApplying = false;
        const button = document.getElementById('confirmSplashApplyBtn');
        if (button) {
            button.disabled = false;
            button.textContent = 'Generate Splash';
        }
        this.updateSplashAvailability();
        this.setIconStatus('Splash generation cancelled. No files were changed.');
    }

    setIconStatus(message, type) {
        const status = document.getElementById('iconSplashStatusBar');
        if (!status) return;
        status.textContent = message;
        status.dataset.type = type || 'info';
    }

    escapeIconStudioHtml(value) {
        const element = document.createElement('span');
        element.textContent = String(value);
        return element.innerHTML;
    }

    // Backward-compatible helper retained for older tests and callers.
    generateDensityIcons(image) {
        const previous = this.iconStudioState?.foreground;
        if (this.iconStudioState) {
            this.iconStudioState.foreground = { image, analysis: { hasTransparency: true, bounds: { left: 0, top: 0, right: 1, bottom: 1 } } };
        }
        const result = this.generateAndroidIconSet(false);
        if (this.iconStudioState) this.iconStudioState.foreground = previous;
        return result;
    }
};
