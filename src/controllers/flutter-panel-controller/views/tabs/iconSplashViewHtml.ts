export function getIconSplashViewHtml(): string {
  return `
    <section data-panel-view="icon-splash" hidden aria-label="App Icon and Splash Studio">
        <div class="is-layout">
            <div class="ff-section is-uploader-section">
                <div class="ff-section-head">
                    <div>
                        <h2>App Icon &amp; Splash Studio</h2>
                        <p class="is-kicker">Android Adaptive Icons &middot; iOS Assets &middot; Native Splash</p>
                    </div>
                    <span class="ff-section-note">1024&times;1024 Master</span>
                </div>

                <div id="iconDropZone" class="is-dropzone">
                    <i class="fas fa-image is-dropzone-icon"></i>
                    <div class="is-dropzone-text">
                        <span>Drop Master 1024&times;1024 PNG here or</span>
                        <label class="btn btn-quiet btn-xs">
                            <input type="file" id="iconFileInput" accept="image/png,image/jpeg,image/webp" hidden>
                            <span>Browse Image</span>
                        </label>
                    </div>
                </div>

                <div class="is-preview-strip">
                    <div class="is-preview-box">
                        <span class="is-preview-label">Original</span>
                        <div class="is-icon-frame frame-raw">
                            <img id="iconPreviewRaw" src="" alt="Icon preview" hidden />
                            <i id="iconPlaceholderRaw" class="fas fa-cube"></i>
                        </div>
                    </div>
                    <div class="is-preview-box">
                        <span class="is-preview-label">Android Circle</span>
                        <div class="is-icon-frame frame-circle" id="iconFrameCircle">
                            <img id="iconPreviewCircle" src="" alt="Circle preview" hidden />
                        </div>
                    </div>
                    <div class="is-preview-box">
                        <span class="is-preview-label">Squircle (Adaptive)</span>
                        <div class="is-icon-frame frame-squircle" id="iconFrameSquircle">
                            <img id="iconPreviewSquircle" src="" alt="Squircle preview" hidden />
                        </div>
                    </div>
                    <div class="is-preview-box">
                        <span class="is-preview-label">iOS Rounded</span>
                        <div class="is-icon-frame frame-ios" id="iconFrameIos">
                            <img id="iconPreviewIos" src="" alt="iOS preview" hidden />
                        </div>
                    </div>
                </div>

                <div class="is-color-row">
                    <label for="iconBgColorInput">Adaptive Background Color:</label>
                    <input type="color" id="iconBgColorInput" value="#FFFFFF">
                    <input type="text" id="iconBgColorText" class="mono" value="#FFFFFF" maxlength="7">
                </div>
            </div>

            <div class="ff-section is-generator-section">
                <div class="ff-section-head">
                    <h2>Deployment Modes</h2>
                    <span class="ff-section-note">dual support</span>
                </div>

                <div class="is-modes-grid">
                    <div class="is-mode-card">
                        <div class="is-card-head">
                            <h3><i class="fas fa-bolt"></i> Mode 1: Direct Native Assets</h3>
                            <span class="status-badge is-enabled">Zero-dependency</span>
                        </div>
                        <p class="is-card-desc">
                            Directly resizes and distributes icons into Android <span class="mono">mipmap-{m,h,xh,xxh,xxxh}dpi</span>
                            and iOS <span class="mono">Assets.xcassets/AppIcon</span> using high-performance canvas sampling.
                        </p>
                        <div class="is-checkbox-group">
                            <label><input type="checkbox" id="deployAndroidCheckbox" checked> Android (<span class="mono">res/mipmap-*</span>)</label>
                            <label><input type="checkbox" id="deployIosCheckbox" checked> iOS (<span class="mono">Assets.xcassets</span>)</label>
                        </div>
                        <button class="btn btn-primary btn-block" id="deployNativeIconsBtn" type="button" disabled>
                            <i class="fas fa-wand-magic-sparkles"></i> Deploy Native Icons to Project
                        </button>
                    </div>

                    <div class="is-mode-card">
                        <div class="is-card-head">
                            <h3><i class="fas fa-boxes-stacked"></i> Mode 2: Flutter Packages</h3>
                            <span class="status-badge">YAML Config</span>
                        </div>
                        <p class="is-card-desc">
                            Configures <span class="mono">flutter_launcher_icons</span> and <span class="mono">flutter_native_splash</span> in <span class="mono">pubspec.yaml</span>.
                        </p>
                        <div class="is-input-row">
                            <label for="pkgAssetPathInput">Source asset path:</label>
                            <input type="text" id="pkgAssetPathInput" class="mono" value="assets/icon/app_icon.png" placeholder="assets/icon/app_icon.png">
                        </div>
                        <div class="is-btn-row">
                            <button class="btn btn-quiet" id="configLauncherIconsBtn" type="button">
                                <i class="fas fa-file-pen"></i> Update Icons YAML
                            </button>
                            <button class="btn btn-quiet" id="runLauncherIconsCliBtn" type="button">
                                <i class="fas fa-play"></i> Run Icons CLI
                            </button>
                        </div>
                        <div class="is-btn-row" style="margin-top: 8px;">
                            <button class="btn btn-quiet" id="configNativeSplashBtn" type="button">
                                <i class="fas fa-file-pen"></i> Update Splash YAML
                            </button>
                            <button class="btn btn-quiet" id="runNativeSplashCliBtn" type="button">
                                <i class="fas fa-play"></i> Run Splash CLI
                            </button>
                        </div>
                    </div>
                </div>

                <div class="is-status-bar" id="iconSplashStatusBar" role="status">Upload an icon to begin.</div>
            </div>
        </div>
    </section>
  `;
}

