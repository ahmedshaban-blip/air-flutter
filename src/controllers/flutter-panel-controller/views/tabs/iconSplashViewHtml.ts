const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

export function getIconSplashViewHtml(): string {
  return `
    <section data-panel-view="icon-splash" hidden aria-label="App Icon and Splash Studio">
        <div class="is-layout">
            <header class="is-studio-header">
                <div>
                    <h2>App Icon &amp; Splash Studio</h2>
                    <p>Validate once, inspect every launcher mask, then generate the exact assets you previewed.</p>
                </div>
                <div class="is-studio-actions">
                    <span class="is-project-label mono" id="iconStudioProjectName">No project loaded</span>
                    <button class="btn btn-quiet btn-xs" id="restoreNativeIconsBtn" type="button" disabled>
                        <i class="fas fa-rotate-left"></i> Restore previous assets
                    </button>
                </div>
            </header>

            <section class="ff-section is-current-assets" id="iconSplashCurrentAssets" hidden>
                <div class="ff-section-head">
                    <div>
                        <h2>Your current assets</h2>
                        <p class="is-kicker">The last icon and splash you generated, ready to re-edit or remove.</p>
                    </div>
                    <button class="btn btn-quiet btn-xs" id="deleteBothAssetsBtn" type="button">
                        <i class="fas fa-trash-can"></i> Delete both
                    </button>
                </div>
                <div class="is-current-grid" id="currentAssetsGrid"></div>
                <p class="is-current-empty" id="currentAssetsEmpty">
                    Nothing generated yet. Your finished icon and splash will appear here.
                </p>
            </section>

            <details class="is-guidance" id="iconGuidance" open>
                <summary>
                    <span><i class="fas fa-compass-drafting"></i> How to prepare a production-ready app icon</span>
                    <span class="mono">1024&times;1024 PNG</span>
                </summary>
                <div class="is-guidance-grid">
                    <div>
                        <h3>General requirements</h3>
                        <ul>
                            <li>Use a real, lossless <strong>PNG at exactly 1024&times;1024 px</strong>.</li>
                            <li>Keep the logo centered and inspect it at launcher size.</li>
                            <li>Do not add an outer shadow or pre-cut rounded corners.</li>
                            <li>Avoid tiny text and fine detail that disappears after downscaling.</li>
                        </ul>
                    </div>
                    <div>
                        <h3>Android adaptive icon</h3>
                        <ul>
                            <li>Use a transparent foreground over a separate background.</li>
                            <li>Official layer canvas: <strong>108&times;108 dp</strong>.</li>
                            <li>Keep critical artwork inside the centered <strong>66&times;66 dp safe zone</strong>.</li>
                            <li>On this 1024 px canvas, the safe zone is approximately <strong>626&times;626 px</strong>.</li>
                            <li>The outer 18 dp can be cropped or animated by Pixel, Samsung, Xiaomi, and other launchers.</li>
                        </ul>
                    </div>
                    <div>
                        <h3>iOS app icon</h3>
                        <ul>
                            <li>Supply square 1024&times;1024 artwork; iOS applies its own mask.</li>
                            <li>The final iOS export must be opaque; alpha is flattened onto the chosen background.</li>
                            <li>Keep important artwork away from the edge and preview the system crop.</li>
                        </ul>
                    </div>
                    <div>
                        <h3>Common mistakes</h3>
                        <ul>
                            <li>Upscaling a small or compressed source image.</li>
                            <li>Combining Android foreground and background into one layer.</li>
                            <li>Judging only the large artwork instead of the real launcher size.</li>
                            <li>Assuming every Android launcher uses the same mask.</li>
                        </ul>
                    </div>
                </div>
                <p class="is-play-note"><strong>Google Play listing:</strong> upload a separate 512&times;512, 32-bit sRGB PNG under 1024 KB. Google Play applies its own radius and shadow.</p>
            </details>

            <div class="is-workbench-grid">
                <section class="ff-section is-uploader-section">
                    <div class="ff-section-head">
                        <div>
                            <h2>Source artwork</h2>
                            <p class="is-kicker">PNG signature + dimensions are checked before any action is enabled.</p>
                        </div>
                        <span class="ff-section-note">Step 1</span>
                    </div>

                    <div id="iconDropZone" class="is-dropzone" tabindex="0" role="button" aria-controls="iconFileInput">
                        <i class="fas fa-image is-dropzone-icon"></i>
                        <div class="is-dropzone-text">
                            <strong>Drop Android foreground</strong>
                            <span>PNG, JPEG, or WebP · max 10 MB · normalized to 1024&times;1024 PNG</span>
                            <label class="btn btn-quiet btn-xs">
                                <input type="file" id="iconFileInput" accept="${IMAGE_ACCEPT}" hidden>
                                <span>Browse image</span>
                            </label>
                        </div>
                    </div>

                    <div class="is-secondary-upload">
                        <div>
                            <strong>Optional iOS artwork</strong>
                            <span>Leave empty to compose iOS from the Android foreground and background.</span>
                        </div>
                        <label class="btn btn-quiet btn-xs">
                            <input type="file" id="iosIconFileInput" accept="${IMAGE_ACCEPT}" hidden>
                            <span>Choose iOS image</span>
                        </label>
                        <button class="btn btn-quiet btn-xs" id="clearIosIconBtn" type="button" hidden>Use Android source</button>
                    </div>

                    <div class="is-validation" id="iconValidationChecklist" aria-live="polite">
                        <div data-check="png"><i class="fas fa-circle"></i><span>Real PNG file</span></div>
                        <div data-check="size"><i class="fas fa-circle"></i><span>Exactly 1024&times;1024 px</span></div>
                        <div data-check="weight"><i class="fas fa-circle"></i><span>10 MB or smaller</span></div>
                        <div data-check="alpha"><i class="fas fa-circle"></i><span>Foreground transparency detected</span></div>
                        <div data-check="safe"><i class="fas fa-circle"></i><span>Critical artwork inside 66&times;66 dp safe zone</span></div>
                        <div data-check="ios-alpha"><i class="fas fa-circle"></i><span>iOS export will be fully opaque</span></div>
                    </div>
                    <p class="is-validation-error" id="iconValidationError" role="alert" hidden></p>
                </section>

                <section class="ff-section is-controls-section" id="iconAdjustmentSection" aria-disabled="true">
                    <div class="ff-section-head">
                        <div>
                            <h2>Position &amp; safe area</h2>
                            <p class="is-kicker">The same transform drives preview and generated files.</p>
                        </div>
                        <div class="is-controls-head-actions">
                            <button class="btn btn-quiet btn-xs" id="jumpToPreviewBtn" type="button">
                                <i class="fas fa-arrow-down"></i> Preview
                            </button>
                            <span class="ff-section-note">Step 2</span>
                        </div>
                    </div>
                    <div class="is-mini-preview" id="iconMiniPreview">
                        <div class="is-mini-preview-stage">
                            <canvas id="iconMiniPreviewCanvas" width="224" height="224" data-icon-preview="inspection" aria-label="Live safe-area preview"></canvas>
                            <div id="iconMiniSafeZoneOverlay" class="is-safe-zone-overlay" data-safe-zone-overlay><span>66&times;66 dp</span></div>
                        </div>
                        <div class="is-mini-preview-copy">
                            <strong>Live preview</strong>
                            <span>Same transform as Crop inspection and the generated files.</span>
                        </div>
                    </div>
                    <div class="is-control-stack">
                        <label class="is-range-control">
                            <span>Scale <output id="iconScaleOutput" class="mono">100%</output></span>
                            <input type="range" id="iconScaleInput" min="40" max="160" value="100" step="1" disabled>
                        </label>
                        <label class="is-range-control">
                            <span>Horizontal <output id="iconOffsetXOutput" class="mono">0%</output></span>
                            <input type="range" id="iconOffsetXInput" min="-40" max="40" value="0" step="1" disabled>
                        </label>
                        <label class="is-range-control">
                            <span>Vertical <output id="iconOffsetYOutput" class="mono">0%</output></span>
                            <input type="range" id="iconOffsetYInput" min="-40" max="40" value="0" step="1" disabled>
                        </label>
                    </div>
                    <details class="is-advanced-controls" id="iconAdvancedControls">
                        <summary>
                            <span><i class="fas fa-layer-group"></i> Adaptive layers &amp; advanced</span>
                            <span class="is-advanced-summary mono" id="iconAdvancedSummary">Solid #FFFFFF</span>
                            <i class="fas fa-chevron-down is-advanced-chevron" aria-hidden="true"></i>
                        </summary>
                        <div class="is-advanced-body">
                            <div class="is-color-row">
                                <label for="iconBgColorInput">Background</label>
                                <input type="color" id="iconBgColorInput" value="#FFFFFF">
                                <input type="text" id="iconBgColorText" class="mono" value="#FFFFFF" maxlength="7" aria-label="Background color hex">
                            </div>
                            <fieldset class="is-layer-choice">
                                <legend>Adaptive background layer</legend>
                                <label><input type="radio" name="iconBackgroundMode" value="color" checked> Solid color</label>
                                <label><input type="radio" name="iconBackgroundMode" value="gradient"> Gradient</label>
                                <label><input type="radio" name="iconBackgroundMode" value="image"> PNG image</label>
                            </fieldset>
                            <div class="is-gradient-editor" id="iconGradientControls" hidden>
                                <canvas id="iconGradientStripCanvas" class="is-gradient-strip" width="240" height="40" role="img" aria-label="Gradient preview"></canvas>
                                <div class="is-gradient-angle">
                                    <label for="iconGradientAngleInput">Angle</label>
                                    <input type="range" id="iconGradientAngleInput" min="0" max="359" value="180" step="1" aria-label="Gradient angle in degrees">
                                    <input type="text" id="iconGradientAngleText" class="mono" value="180" maxlength="3" aria-label="Gradient angle degrees">
                                    <output id="iconGradientAngleOutput" class="mono">180&deg;</output>
                                </div>
                                <p class="is-layer-status">0&deg; = bottom to top, clockwise. Direction applies to every exported density.</p>
                                <div id="iconGradientStopList" class="is-gradient-stop-list" role="group" aria-label="Gradient color stops"></div>
                                <button class="btn btn-quiet btn-xs" id="addGradientStopBtn" type="button">
                                    <i class="fas fa-plus"></i> Add stop
                                </button>
                                <p class="is-layer-status" id="iconGradientFallbackStatus">Flat fallback color: #FFFFFF (first stop).</p>
                            </div>
                            <div class="is-background-upload" id="iconBackgroundImageControls" hidden>
                                <label class="btn btn-quiet btn-xs">
                                    <input type="file" id="iconBackgroundFileInput" accept="${IMAGE_ACCEPT}" hidden>
                                    <span>Choose background image</span>
                                </label>
                                <button class="btn btn-quiet btn-xs" id="clearIconBackgroundBtn" type="button" disabled>Clear</button>
                                <label class="is-range-control">
                                    <span>Background scale <output id="iconBackgroundScaleOutput" class="mono">100%</output></span>
                                    <input type="range" id="iconBackgroundScaleInput" min="40" max="200" value="100" step="1">
                                </label>
                                <label class="is-range-control">
                                    <span>Background horizontal <output id="iconBackgroundOffsetXOutput" class="mono">0%</output></span>
                                    <input type="range" id="iconBackgroundOffsetXInput" min="-40" max="40" value="0" step="1">
                                </label>
                                <label class="is-range-control">
                                    <span>Background vertical <output id="iconBackgroundOffsetYOutput" class="mono">0%</output></span>
                                    <input type="range" id="iconBackgroundOffsetYInput" min="-40" max="40" value="0" step="1">
                                </label>
                                <label class="is-input-row">
                                    <span>Image fit</span>
                                    <select id="iconBackgroundFitSelect"><option value="cover">Cover</option><option value="contain">Contain</option></select>
                                </label>
                                <p class="is-layer-status" id="iconBackgroundStatus">Choose a background image.</p>
                            </div>
                            <div class="is-monochrome-upload">
                                <div>
                                    <strong>Android themed icon</strong>
                                    <span>Optional monochrome 1024&times;1024 PNG for Android 13+. Foreground alpha is used as fallback.</span>
                                </div>
                                <label class="btn btn-quiet btn-xs">
                                    <input type="file" id="iconMonochromeFileInput" accept="${IMAGE_ACCEPT}" hidden>
                                    <span>Choose monochrome image</span>
                                </label>
                                <button class="btn btn-quiet btn-xs" id="clearIconMonochromeBtn" type="button" hidden>Use fallback</button>
                            </div>
                        </div>
                    </details>
                    <div class="is-btn-row">
                        <button class="btn btn-quiet" id="fitIconSafeZoneBtn" type="button" disabled>Fit to safe zone</button>
                        <button class="btn btn-quiet" id="resetIconTransformBtn" type="button" disabled>Reset</button>
                    </div>
                    <label class="is-switch-row">
                        <input type="checkbox" id="showIconSafeZoneCheckbox" checked>
                        <span>Show official 66&times;66 dp safe zone</span>
                    </label>
                </section>
            </div>

            <section class="ff-section is-preview-section" aria-labelledby="iconPreviewHeading">
                <div class="ff-section-head">
                    <div>
                        <div class="is-preview-title-row">
                            <h2 id="iconPreviewHeading">Launcher preview lab</h2>
                            <span class="is-live-badge" id="iconPreviewLiveBadge" hidden>Live</span>
                        </div>
                        <p class="is-kicker">High-fidelity masks; themes and third-party icon packs can still alter the final result.</p>
                    </div>
                    <div class="is-preview-toolbar">
                        <label for="previewWallpaperSelect">Wallpaper</label>
                        <select id="previewWallpaperSelect" class="mono">
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                        <input type="text" id="iconPreviewLabelInput" value="Your App" maxlength="24" aria-label="Preview app label">
                    </div>
                </div>

                <div class="is-preview-grid" id="iconPreviewGrid">
                    ${previewCard('pixel', 'Google Pixel', 'Circle mask')}
                    ${previewCard('samsung', 'Samsung One UI', 'Rounded-square mask')}
                    ${previewCard('xiaomi', 'Xiaomi HyperOS', 'Squircle mask')}
                    ${previewCard('generic-square', 'Android Generic', 'Square mask')}
                    ${previewCard('teardrop', 'Android Alternate', 'Teardrop mask')}
                    ${previewCard('legacy', 'Legacy Android', 'Flattened bitmap')}
                    ${previewCard('ios', 'Apple iOS', 'System rounded rectangle')}
                    ${previewCard('themed', 'Android Themed', 'Monochrome layer preview')}
                </div>

                <div class="is-inspection-row">
                    <div class="is-inspection-canvas-wrap">
                        <canvas id="iconInspectionCanvas" width="320" height="320" tabindex="0" role="img" aria-label="Large icon crop inspection. Drag to reposition, Ctrl plus scroll to zoom, arrow keys to nudge."></canvas>
                        <div id="iconSafeZoneOverlay" class="is-safe-zone-overlay" data-safe-zone-overlay><span>66&times;66 dp safe zone</span></div>
                    </div>
                    <div class="is-inspection-copy">
                        <h3>Crop inspection</h3>
                        <p>Anything outside the dashed square may be clipped by an OEM mask. Drag inside the crop to reposition, hold <kbd>Ctrl</kbd> and scroll to zoom, or use the arrow keys. The launcher cards show real-size detail and contrast.</p>
                        <div class="is-preview-legend">
                            <span><i class="is-legend-swatch is-safe"></i> Guaranteed safe zone</span>
                            <span><i class="is-legend-swatch is-crop"></i> OEM crop area</span>
                        </div>
                    </div>
                </div>
            </section>

            <section class="ff-section is-generator-section">
                <div class="ff-section-head">
                    <div>
                        <h2>Generation plan</h2>
                        <p class="is-kicker">Nothing is written until you review and confirm the plan.</p>
                    </div>
                    <span class="ff-section-note">Step 3</span>
                </div>

                <div class="is-checkbox-group is-platform-choice">
                    <label><input type="checkbox" id="deployAndroidCheckbox" checked> Android</label>
                    <label><input type="checkbox" id="deployIosCheckbox" checked> iOS</label>
                </div>

                <div class="is-modes-grid" role="radiogroup" aria-label="Icon generation mode">
                    <label class="is-mode-card is-selected">
                        <input type="radio" name="iconDeploymentMode" value="native" checked>
                        <span class="is-card-head">
                            <strong><i class="fas fa-bolt"></i> Direct native assets</strong>
                            <span class="status-badge is-enabled">Zero dependency</span>
                        </span>
                        <span class="is-card-desc">Writes legacy Android densities, adaptive XML and foreground layers, plus the complete iOS AppIcon asset catalog.</span>
                    </label>
                    <label class="is-mode-card">
                        <input type="radio" name="iconDeploymentMode" value="packages">
                        <span class="is-card-head">
                            <strong><i class="fas fa-boxes-stacked"></i> Flutter package</strong>
                            <span class="status-badge">CLI</span>
                        </span>
                        <span class="is-card-desc">Saves processed masters, configures <span class="mono">flutter_launcher_icons</span>, adds the dependency, and runs its generator.</span>
                    </label>
                </div>

                <div class="is-input-row is-generated-path" id="launcherIconsAssetPathRow" hidden>
                    <label for="pkgAssetPathInput">Generated package asset directory</label>
                    <input type="text" id="pkgAssetPathInput" class="mono" value="assets/air_flutter_icon/" readonly>
                </div>

                <details class="is-splash-options" id="launcherIconsOptionsPanel" hidden>
                    <summary>
                        <span><i class="fas fa-sliders"></i> All launcher icon options</span>
                        <span class="is-splash-options-count mono" id="launcherIconsOptionsCount">0 set</span>
                    </summary>
                    <p class="is-opt-detail">Every <span class="mono">flutter_launcher_icons</span> setting. Used in Flutter package mode; leave a field blank to omit it. Blank image paths fall back to the masters this studio generates.</p>

                    ${iconOptionGroup({
                      id: 'liconOptCore',
                      title: 'Core',
                      detail: 'The single master image used wherever no platform-specific image is given, plus the Android/iOS toggles.',
                      open: true,
                      fields: [
                        iconOptionField({ key: 'image_path', label: 'Master image', kind: 'path', placeholder: 'assets/icon/app.png' }),
                        iconOptionField({ key: 'android', label: 'Generate Android (true / false / name)', kind: 'text', placeholder: 'launcher_icon' }),
                        iconOptionField({ key: 'ios', label: 'Generate iOS (true / false / name)', kind: 'text', placeholder: 'true' }),
                        iconOptionField({ key: 'image_path_android', label: 'Android image', kind: 'path', placeholder: 'assets/icon/android.png' }),
                        iconOptionField({ key: 'image_path_ios', label: 'iOS image', kind: 'path', placeholder: 'assets/icon/ios.png' }),
                        iconOptionField({ key: 'min_sdk_android', label: 'Android min SDK', kind: 'number', min: 16, placeholder: '21' })
                      ].join('')
                    })}

                    ${iconOptionGroup({
                      id: 'liconOptAdaptive',
                      title: 'Android adaptive icon',
                      detail: 'Generated only when both a background and a foreground are set. Background accepts a color like #121212 or an image path.',
                      fields: [
                        iconOptionField({ key: 'adaptive_icon_background', label: 'Adaptive background', kind: 'text', placeholder: '#121212' }),
                        iconOptionField({ key: 'adaptive_icon_foreground', label: 'Adaptive foreground', kind: 'path', placeholder: 'assets/icon/foreground.png' }),
                        iconOptionField({ key: 'adaptive_icon_foreground_inset', label: 'Foreground inset (%)', kind: 'number', min: 0, max: 50, placeholder: '16' }),
                        iconOptionField({ key: 'adaptive_icon_monochrome', label: 'Monochrome (Android 13+)', kind: 'path', placeholder: 'assets/icon/mono.png' })
                      ].join('')
                    })}

                    ${iconOptionGroup({
                      id: 'liconOptIos',
                      title: 'iOS',
                      detail: 'App Store behaviour, plus the iOS 18+ dark and tinted icon variants.',
                      fields: [
                        iconOptionField({ key: 'remove_alpha_ios', label: 'Remove alpha channel', kind: 'checkbox' }),
                        iconOptionField({ key: 'background_color_ios', label: 'Alpha flatten color', kind: 'color', placeholder: '#121212' }),
                        iconOptionField({ key: 'desaturate_tinted_to_grayscale_ios', label: 'Desaturate tinted to grayscale', kind: 'checkbox' }),
                        iconOptionField({ key: 'image_path_ios_dark_transparent', label: 'Dark mode icon (iOS 18+)', kind: 'path' }),
                        iconOptionField({ key: 'image_path_ios_tinted_grayscale', label: 'Tinted icon (iOS 18+)', kind: 'path' })
                      ].join('')
                    })}

                    ${iconOptionGroup({
                      id: 'liconOptWeb',
                      title: 'Web',
                      detail: 'Generates favicon.png and the PWA icon set, and updates manifest.json. Requires the web/ folder, manifest.json and index.html.',
                      fields: [
                        iconOptionField({ key: 'web.generate', label: 'Generate for web', kind: 'checkbox' }),
                        iconOptionField({ key: 'web.image_path', label: 'Web image', kind: 'path' }),
                        iconOptionField({ key: 'web.background_color', label: 'Manifest background', kind: 'color', placeholder: '#121212' }),
                        iconOptionField({ key: 'web.theme_color', label: 'Manifest theme', kind: 'color', placeholder: '#1E88E5' })
                      ].join('')
                    })}

                    ${iconOptionGroup({
                      id: 'liconOptWindows',
                      title: 'Windows',
                      detail: 'Writes windows/runner/resources/app_icon.ico at the chosen size.',
                      fields: [
                        iconOptionField({ key: 'windows.generate', label: 'Generate for Windows', kind: 'checkbox' }),
                        iconOptionField({ key: 'windows.image_path', label: 'Windows image', kind: 'path' }),
                        iconOptionField({ key: 'windows.icon_size', label: 'Icon size (48–256)', kind: 'number', min: 48, max: 256, placeholder: '256' })
                      ].join('')
                    })}

                    ${iconOptionGroup({
                      id: 'liconOptMacos',
                      title: 'macOS',
                      detail: 'Writes the AppIcon.appiconset and its Contents.json.',
                      fields: [
                        iconOptionField({ key: 'macos.generate', label: 'Generate for macOS', kind: 'checkbox' }),
                        iconOptionField({ key: 'macos.image_path', label: 'macOS image', kind: 'path' })
                      ].join('')
                    })}
                </details>

                <button class="btn btn-primary btn-block" id="deployNativeIconsBtn" type="button" disabled>
                    <i class="fas fa-clipboard-check"></i> Review changes
                </button>

                <div class="is-review-panel" id="iconReviewPanel" hidden>
                    <div class="is-review-head">
                        <div>
                            <h3>Review before applying</h3>
                            <p id="iconReviewSummary">Generated assets will replace the selected platform icons.</p>
                        </div>
                        <button class="btn btn-quiet btn-xs" id="closeIconReviewBtn" type="button">Close</button>
                    </div>
                    <ul id="iconReviewList" class="is-review-list"></ul>
                    <div class="is-review-warning"><i class="fas fa-shield-halved"></i><span>A timestamped backup is created before the first write. Failed CLI runs roll back automatically.</span></div>
                    <div class="is-btn-row">
                        <button class="btn btn-primary" id="confirmIconApplyBtn" type="button">Generate &amp; Apply</button>
                        <button class="btn btn-quiet" id="cancelIconApplyBtn" type="button">Cancel</button>
                    </div>
                </div>

                <div class="is-success-summary" id="iconApplySummary" hidden>
                    <div><i class="fas fa-circle-check"></i><strong>Icons applied successfully</strong></div>
                    <p id="iconApplySummaryText"></p>
                    <ul id="iconApplyFiles"></ul>
                </div>

                <div class="is-legacy-actions" hidden aria-hidden="true">
                    <button id="configLauncherIconsBtn" type="button"></button>
                    <button id="runLauncherIconsCliBtn" type="button"></button>
                </div>
            </section>

            <section class="ff-section is-splash-studio" aria-labelledby="splashPhaseHeading">
                <div class="ff-section-head">
                    <div>
                        <h2 id="splashPhaseHeading">Splash screen studio</h2>
                        <p class="is-kicker">Preview Android 12, legacy Android, and iOS before flutter_native_splash changes platform files.</p>
                    </div>
                    <span class="ff-section-note">Independent workflow</span>
                </div>

                <div class="is-splash-grid">
                    <div class="is-splash-controls">
                        <label class="is-switch-row">
                            <input type="checkbox" id="useAppIconForSplashCheckbox" checked>
                            <span>Use the validated app-icon foreground</span>
                        </label>
                        <div class="is-secondary-upload" id="splashUploadRow" hidden>
                            <div>
                                <strong>Dedicated splash artwork</strong>
                                <span>PNG, JPEG, or WebP up to 10 MB, normalized to 1024&times;1024 PNG.</span>
                            </div>
                            <label class="btn btn-quiet btn-xs">
                                <input type="file" id="splashFileInput" accept="${IMAGE_ACCEPT}" hidden>
                                <span>Choose splash image</span>
                            </label>
                        </div>
                        <label class="is-range-control">
                            <span>Artwork scale <output id="splashScaleOutput" class="mono">45%</output></span>
                            <input type="range" id="splashScaleInput" min="20" max="100" value="45" step="1">
                        </label>
                        <div class="is-color-row">
                            <label for="splashBgColorInput">Splash background</label>
                            <input type="color" id="splashBgColorInput" value="#FFFFFF">
                            <input type="text" id="splashBgColorText" class="mono" value="#FFFFFF" maxlength="7" aria-label="Splash background color hex">
                        </div>

                        <div class="is-secondary-upload is-splash-background-row">
                            <div>
                                <strong>Background image <span class="is-optional">optional</span></strong>
                                <span>Full-screen layer behind the artwork. Applies to legacy Android and iOS.</span>
                            </div>
                            <div class="is-splash-bg-actions">
                                <label class="btn btn-quiet btn-xs">
                                    <input type="file" id="splashBackgroundFileInput" accept="${IMAGE_ACCEPT}" hidden>
                                    <span>Choose background</span>
                                </label>
                                <button class="btn btn-quiet btn-xs" id="clearSplashBackgroundBtn" type="button" hidden>
                                    <i class="fas fa-times"></i> Remove
                                </button>
                            </div>
                        </div>
                        <label class="is-range-control" id="splashBackgroundFitRow" hidden>
                            <span>Background fit</span>
                            <select id="splashBackgroundFitSelect">
                                <option value="cover" selected>Cover — fill the screen</option>
                                <option value="contain">Contain — whole image visible</option>
                                <option value="center">Center — original size</option>
                            </select>
                        </label>
                        <p class="is-layer-status" id="splashBackgroundStatus" hidden></p>

                        <label class="is-switch-row">
                            <input type="checkbox" id="splashFullscreenCheckbox" checked>
                            <span>Generate fullscreen native splash</span>
                        </label>
                        <p class="is-layer-status" id="splashSourceStatus">Upload a valid app icon or choose dedicated splash artwork.</p>
                    </div>
                    <div class="is-splash-previews">
                        ${splashPreviewCard('android12', 'Android 12+', 'System icon window and background')}
                        ${splashPreviewCard('androidLegacy', 'Legacy Android', 'Centered launch artwork')}
                        ${splashPreviewCard('iosSplash', 'Apple iOS', 'Launch screen composition')}
                    </div>
                </div>

                <details class="is-splash-options" id="splashOptionsPanel">
                    <summary>
                        <span><i class="fas fa-sliders"></i> All splash options</span>
                        <span class="is-splash-options-count mono" id="splashOptionsCount">0 set</span>
                    </summary>
                    <p class="is-opt-detail">Every flutter_native_splash setting, grouped. Leave a field blank to omit it from pubspec.yaml.</p>

                    ${splashOptionGroup({
                      id: 'splashOptGeneral',
                      title: 'Dark mode',
                      detail: 'Appearance when the device is in dark mode. The base color and images are set above.',
                      open: true,
                      fields: [
                        splashOptionField({ key: 'color_dark', label: 'Background color (dark)', kind: 'color' }),
                        splashOptionField({ key: 'background_image_dark', label: 'Background image (dark)', kind: 'path' }),
                        splashOptionField({ key: 'image_dark', label: 'Logo image (dark)', kind: 'path' })
                      ].join('')
                    })}

                    ${splashOptionGroup({
                      id: 'splashOptBranding',
                      title: 'Branding',
                      detail: 'A secondary image pinned to an edge of the splash.',
                      fields: [
                        splashOptionField({ key: 'branding', label: 'Branding image', kind: 'path', placeholder: 'assets/brand.png' }),
                        splashOptionField({ key: 'branding_dark', label: 'Branding image (dark)', kind: 'path' }),
                        splashOptionField({ key: 'branding_mode', label: 'Branding position', kind: 'select', options: [
                          { value: '', label: 'Default (bottom)' },
                          { value: 'bottom', label: 'Bottom' },
                          { value: 'bottomRight', label: 'Bottom right' },
                          { value: 'bottomLeft', label: 'Bottom left' }
                        ] }),
                        splashOptionField({ key: 'branding_bottom_padding', label: 'Bottom padding (px)', kind: 'number', min: 0, placeholder: '0' }),
                        splashOptionField({ key: 'branding_bottom_padding_android', label: 'Bottom padding — Android (px)', kind: 'number', min: 0 }),
                        splashOptionField({ key: 'branding_bottom_padding_ios', label: 'Bottom padding — iOS (px)', kind: 'number', min: 0 })
                      ].join('')
                    })}

                    ${splashOptionGroup({
                      id: 'splashOptAlignment',
                      title: 'Alignment &amp; behaviour',
                      detail: 'How images sit on each platform, plus orientation and SDK floor. Fullscreen lives in the controls above.',
                      fields: [
                        splashOptionField({ key: 'android_gravity', label: 'Android image alignment', kind: 'select', options: [
                          { value: '', label: 'Default (center)' },
                          { value: 'center', label: 'center' },
                          { value: 'top', label: 'top' },
                          { value: 'bottom', label: 'bottom' },
                          { value: 'left', label: 'left' },
                          { value: 'right', label: 'right' },
                          { value: 'fill', label: 'fill' },
                          { value: 'fill_horizontal', label: 'fill_horizontal' },
                          { value: 'fill_vertical', label: 'fill_vertical' },
                          { value: 'center_horizontal', label: 'center_horizontal' },
                          { value: 'center_vertical', label: 'center_vertical' }
                        ] }),
                        splashOptionField({ key: 'ios_content_mode', label: 'iOS content mode', kind: 'select', options: [
                          { value: '', label: 'Default (center)' },
                          { value: 'center', label: 'center' },
                          { value: 'scaleToFill', label: 'scaleToFill' },
                          { value: 'scaleAspectFit', label: 'scaleAspectFit' },
                          { value: 'scaleAspectFill', label: 'scaleAspectFill' },
                          { value: 'top', label: 'top' },
                          { value: 'bottom', label: 'bottom' },
                          { value: 'left', label: 'left' },
                          { value: 'right', label: 'right' },
                          { value: 'topLeft', label: 'topLeft' },
                          { value: 'topRight', label: 'topRight' },
                          { value: 'bottomLeft', label: 'bottomLeft' },
                          { value: 'bottomRight', label: 'bottomRight' }
                        ] }),
                        splashOptionField({ key: 'web_image_mode', label: 'Web image mode', kind: 'select', options: [
                          { value: '', label: 'Default (center)' },
                          { value: 'center', label: 'center' },
                          { value: 'contain', label: 'contain' },
                          { value: 'stretch', label: 'stretch' },
                          { value: 'cover', label: 'cover' }
                        ] }),
                        splashOptionField({ key: 'android_screen_orientation', label: 'Android screen orientation', kind: 'select', options: [
                          { value: '', label: 'Default' },
                          { value: 'portrait', label: 'portrait' },
                          { value: 'landscape', label: 'landscape' },
                          { value: 'sensorPortrait', label: 'sensorPortrait' },
                          { value: 'sensorLandscape', label: 'sensorLandscape' },
                          { value: 'fullSensor', label: 'fullSensor' },
                          { value: 'locked', label: 'locked' }
                        ] }),
                        splashOptionField({ key: 'android_min_sdk', label: 'Minimum Android SDK', kind: 'number', min: 16, placeholder: '16' }),
                        splashOptionField({ key: 'info_plist_files', label: 'Custom Info.plist files', kind: 'list', placeholder: 'ios/Runner/Info-Debug.plist' })
                      ].join('')
                    })}

                    ${splashOptionGroup({
                      id: 'splashOptPlatform',
                      title: 'Platform overrides',
                      detail: 'Per-platform values. When set, they replace the general value for that platform.',
                      fields: [
                        splashOptionField({ key: 'color_android', label: 'Color — Android', kind: 'color' }),
                        splashOptionField({ key: 'color_dark_android', label: 'Color dark — Android', kind: 'color' }),
                        splashOptionField({ key: 'color_ios', label: 'Color — iOS', kind: 'color' }),
                        splashOptionField({ key: 'color_dark_ios', label: 'Color dark — iOS', kind: 'color' }),
                        splashOptionField({ key: 'color_web', label: 'Color — Web', kind: 'color' }),
                        splashOptionField({ key: 'color_dark_web', label: 'Color dark — Web', kind: 'color' }),
                        splashOptionField({ key: 'background_image_android', label: 'Background — Android', kind: 'path' }),
                        splashOptionField({ key: 'background_image_dark_android', label: 'Background dark — Android', kind: 'path' }),
                        splashOptionField({ key: 'background_image_ios', label: 'Background — iOS', kind: 'path' }),
                        splashOptionField({ key: 'background_image_dark_ios', label: 'Background dark — iOS', kind: 'path' }),
                        splashOptionField({ key: 'background_image_web', label: 'Background — Web', kind: 'path' }),
                        splashOptionField({ key: 'background_image_dark_web', label: 'Background dark — Web', kind: 'path' }),
                        splashOptionField({ key: 'image_android', label: 'Logo — Android', kind: 'path' }),
                        splashOptionField({ key: 'image_dark_android', label: 'Logo dark — Android', kind: 'path' }),
                        splashOptionField({ key: 'image_ios', label: 'Logo — iOS', kind: 'path' }),
                        splashOptionField({ key: 'image_dark_ios', label: 'Logo dark — iOS', kind: 'path' }),
                        splashOptionField({ key: 'image_web', label: 'Logo — Web', kind: 'path' }),
                        splashOptionField({ key: 'image_dark_web', label: 'Logo dark — Web', kind: 'path' }),
                        splashOptionField({ key: 'branding_android', label: 'Branding — Android', kind: 'path' }),
                        splashOptionField({ key: 'branding_dark_android', label: 'Branding dark — Android', kind: 'path' }),
                        splashOptionField({ key: 'branding_ios', label: 'Branding — iOS', kind: 'path' }),
                        splashOptionField({ key: 'branding_dark_ios', label: 'Branding dark — iOS', kind: 'path' }),
                        splashOptionField({ key: 'branding_web', label: 'Branding — Web', kind: 'path' }),
                        splashOptionField({ key: 'branding_dark_web', label: 'Branding dark — Web', kind: 'path' })
                      ].join('')
                    })}

                    ${splashOptionGroup({
                      id: 'splashOptAndroid12',
                      title: 'Android 12+',
                      detail: 'Android 12+ uses its own icon-window model. Background images are not supported here.',
                      fields: [
                        splashOptionField({ key: 'android_12.color', label: 'Window color', kind: 'color' }),
                        splashOptionField({ key: 'android_12.color_dark', label: 'Window color (dark)', kind: 'color' }),
                        splashOptionField({ key: 'android_12.image', label: 'Center icon', kind: 'path' }),
                        splashOptionField({ key: 'android_12.image_dark', label: 'Center icon (dark)', kind: 'path' }),
                        splashOptionField({ key: 'android_12.icon_background_color', label: 'Icon background', kind: 'color' }),
                        splashOptionField({ key: 'android_12.icon_background_color_dark', label: 'Icon background (dark)', kind: 'color' }),
                        splashOptionField({ key: 'android_12.branding', label: 'Branding 800×320', kind: 'path' }),
                        splashOptionField({ key: 'android_12.branding_dark', label: 'Branding (dark) 800×320', kind: 'path' })
                      ].join('')
                    })}

                    ${splashOptionGroup({
                      id: 'splashOptPlatforms',
                      title: 'Platform selection',
                      detail: 'Turn generation on or off per platform. Android and iOS are on by default.',
                      fields: [
                        splashOptionField({ key: 'android', label: 'Generate for Android', kind: 'checkbox', checked: true }),
                        splashOptionField({ key: 'ios', label: 'Generate for iOS', kind: 'checkbox', checked: true }),
                        splashOptionField({ key: 'web', label: 'Generate for web', kind: 'checkbox' })
                      ].join('')
                    })}
                </details>

                <div class="is-splash-warning"><i class="fas fa-circle-info"></i><span>These previews model native composition. Device aspect ratio, status bars, and OEM launch animation can vary.</span></div>
                <button class="btn btn-primary btn-block" id="configNativeSplashBtn" type="button" disabled>
                    <i class="fas fa-clipboard-check"></i> Review &amp; Generate Splash
                </button>
                <button id="runNativeSplashCliBtn" type="button" hidden aria-hidden="true"></button>
                <div class="is-review-panel" id="splashReviewPanel" hidden>
                    <div class="is-review-head">
                        <div><h3>Review splash changes</h3><p>Android and iOS platform snapshots will be captured before generation.</p></div>
                        <button class="btn btn-quiet btn-xs" id="closeSplashReviewBtn" type="button">Close</button>
                    </div>
                    <ul class="is-review-list">
                        <li>Asset: assets/air_flutter_icon/splash.png</li>
                        <li>Configuration: flutter_native_splash in pubspec.yaml</li>
                        <li id="splashReviewBackgroundNote" hidden></li>
                        <li>Command: flutter pub add --dev flutter_native_splash &amp;&amp; dart run flutter_native_splash:create</li>
                        <li>Snapshot: Android res + iOS Assets.xcassets and LaunchScreen.storyboard</li>
                    </ul>
                    <div class="is-btn-row">
                        <button class="btn btn-primary" id="confirmSplashApplyBtn" type="button">Generate Splash</button>
                        <button class="btn btn-quiet" id="cancelSplashApplyBtn" type="button">Cancel</button>
                    </div>
                </div>
                <div class="is-success-summary" id="splashApplySummary" hidden>
                    <div><i class="fas fa-circle-check"></i><strong>Splash screens generated</strong></div>
                    <p id="splashApplySummaryText"></p>
                </div>
            </section>

            <div class="is-convert-backdrop" id="iconConvertModal" hidden>
                <div class="is-convert-dialog" role="dialog" aria-modal="true" aria-labelledby="iconConvertTitle" aria-describedby="iconConvertSubtitle">
                    <header class="is-convert-head">
                        <div>
                            <h2 id="iconConvertTitle">Prepare source image</h2>
                            <p id="iconConvertSubtitle">This file will be converted to an exact 1024&times;1024 PNG.</p>
                        </div>
                        <button class="btn btn-quiet btn-xs" id="closeIconConvertBtn" type="button">Close</button>
                    </header>

                    <div class="is-convert-body">
                        <figure class="is-convert-figure">
                            <div class="is-convert-stage"><canvas id="iconConvertSourceCanvas" width="208" height="208" aria-label="Original image preview"></canvas></div>
                            <figcaption id="iconConvertSourceMeta">Source</figcaption>
                        </figure>
                        <div class="is-convert-arrow" aria-hidden="true"><i class="fas fa-arrow-right"></i></div>
                        <figure class="is-convert-figure">
                            <div class="is-convert-stage is-target"><canvas id="iconConvertResultCanvas" width="208" height="208" aria-label="Converted 1024 by 1024 PNG preview"></canvas></div>
                            <figcaption id="iconConvertResultMeta">1024&times;1024 · PNG</figcaption>
                        </figure>
                    </div>

                    <div class="is-convert-controls">
                        <fieldset class="is-layer-choice is-convert-modes">
                            <legend>Conversion mode</legend>
                            <label><input type="radio" name="iconConvertMode" value="fit" checked> Fit — keep the whole image</label>
                            <label><input type="radio" name="iconConvertMode" value="cover"> Cover — fill the square, crop edges</label>
                        </fieldset>
                        <label class="is-range-control">
                            <span>Horizontal <output id="iconConvertOffsetXOutput" class="mono">0%</output></span>
                            <input type="range" id="iconConvertOffsetXInput" min="-40" max="40" value="0" step="1">
                        </label>
                        <label class="is-range-control">
                            <span>Vertical <output id="iconConvertOffsetYOutput" class="mono">0%</output></span>
                            <input type="range" id="iconConvertOffsetYInput" min="-40" max="40" value="0" step="1">
                        </label>
                        <div class="is-color-row is-convert-padding">
                            <label for="iconConvertBgInput">Padding</label>
                            <input type="color" id="iconConvertBgInput" value="#FFFFFF" disabled>
                            <label class="is-switch-row is-convert-transparent">
                                <input type="checkbox" id="iconConvertTransparentCheckbox" checked>
                                <span>Transparent</span>
                            </label>
                        </div>
                        <p class="is-convert-warning" id="iconConvertWarning" hidden></p>
                        <p class="is-convert-error" id="iconConvertError" role="alert" hidden></p>
                    </div>

                    <footer class="is-convert-foot">
                        <span class="is-convert-note" id="iconConvertNote">No project files are written by this conversion.</span>
                        <div class="is-btn-row">
                            <button class="btn btn-quiet" id="cancelIconConvertBtn" type="button">Cancel</button>
                            <button class="btn btn-primary" id="confirmIconConvertBtn" type="button">Convert &amp; Continue</button>
                        </div>
                    </footer>
                </div>
            </div>

            <div class="is-status-bar" id="iconSplashStatusBar" role="status">Upload a PNG, JPEG, or WebP to begin.</div>
        </div>
    </section>
  `;
}

function splashPreviewCard(kind: string, title: string, detail: string): string {
  return `
    <article class="is-splash-preview-card">
        <div class="is-phone-preview">
            <span class="is-phone-speaker" aria-hidden="true"></span>
            <canvas data-splash-preview="${kind}" width="270" height="540" aria-label="${title} splash preview"></canvas>
        </div>
        <div class="is-launcher-meta"><strong>${title}</strong><span>${detail}</span></div>
    </article>`;
}

/**
 * Renders one flutter_native_splash option as a labelled control. `data-splash-key`
 * is the exact YAML key, so the webview can serialize every field without a lookup table.
 */
function splashOptionField(spec: {
  key: string;
  label: string;
  kind: 'text' | 'color' | 'number' | 'path' | 'select' | 'checkbox' | 'list';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  checked?: boolean;
}): string {
  const id = `splashOpt_${spec.key}`;
  const hint = spec.hint ? `<span class="is-opt-hint">${spec.hint}</span>` : '';
  let control: string;
  if (spec.kind === 'checkbox') {
    control = `<input type="checkbox" id="${id}" data-splash-key="${spec.key}" data-splash-kind="bool"${spec.checked ? ' checked' : ''}>`;
    return `<label class="is-opt-check">${control}<span>${spec.label}</span>${hint}</label>`;
  }
  if (spec.kind === 'select') {
    const opts = (spec.options || []).map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    control = `<select id="${id}" data-splash-key="${spec.key}" data-splash-kind="string">${opts}</select>`;
  } else if (spec.kind === 'color') {
    control = `<span class="is-opt-color"><input type="color" id="${id}" data-splash-key="${spec.key}" data-splash-kind="color" value="#FFFFFF">` +
      `<input type="text" class="mono" data-splash-for="${spec.key}" maxlength="7" placeholder="${spec.placeholder || '#RRGGBB'}"></span>`;
  } else if (spec.kind === 'number') {
    control = `<input type="number" id="${id}" data-splash-key="${spec.key}" data-splash-kind="number"${spec.min !== undefined ? ` min="${spec.min}"` : ''}${spec.max !== undefined ? ` max="${spec.max}"` : ''} placeholder="${spec.placeholder || ''}">`;
  } else if (spec.kind === 'list') {
    control = `<textarea id="${id}" data-splash-key="${spec.key}" data-splash-kind="list" rows="2" placeholder="${spec.placeholder || ''}"></textarea>`;
  } else {
    control = `<input type="text" id="${id}" data-splash-key="${spec.key}" data-splash-kind="string" class="mono" placeholder="${spec.placeholder || ''}">`;
  }
  return `<label class="is-opt-field"><span class="is-opt-label">${spec.label}</span>${control}${hint}</label>`;
}

function splashOptionGroup(spec: {
  id: string;
  title: string;
  detail: string;
  fields: string;
  open?: boolean;
}): string {
  return `
    <details class="is-opt-group" id="${spec.id}"${spec.open ? ' open' : ''}>
        <summary><span>${spec.title}</span><span class="is-opt-count"></span></summary>
        <p class="is-opt-detail">${spec.detail}</p>
        <div class="is-opt-grid">${spec.fields}</div>
    </details>`;
}

/**
 * Renders one flutter_launcher_icons option as a labelled control. `data-licon-key`
 * is the exact YAML key (dotted for `web`/`windows`/`macos` sub-blocks), so the
 * webview can serialize every field without a lookup table. Reuses the `.is-opt-*`
 * styling shared with the splash options panel.
 */
function iconOptionField(spec: {
  key: string;
  label: string;
  kind: 'text' | 'color' | 'number' | 'path' | 'checkbox';
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  checked?: boolean;
}): string {
  const id = `liconOpt_${spec.key}`;
  const hint = spec.hint ? `<span class="is-opt-hint">${spec.hint}</span>` : '';
  let control: string;
  if (spec.kind === 'checkbox') {
    control = `<input type="checkbox" id="${id}" data-licon-key="${spec.key}" data-licon-kind="bool"${spec.checked ? ' checked' : ''}>`;
    return `<label class="is-opt-check">${control}<span>${spec.label}</span>${hint}</label>`;
  }
  if (spec.kind === 'color') {
    control = `<span class="is-opt-color"><input type="color" id="${id}" data-licon-key="${spec.key}" data-licon-kind="color" value="#121212">` +
      `<input type="text" class="mono" data-licon-for="${spec.key}" maxlength="7" placeholder="${spec.placeholder || '#RRGGBB'}"></span>`;
  } else if (spec.kind === 'number') {
    control = `<input type="number" id="${id}" data-licon-key="${spec.key}" data-licon-kind="number"${spec.min !== undefined ? ` min="${spec.min}"` : ''}${spec.max !== undefined ? ` max="${spec.max}"` : ''} placeholder="${spec.placeholder || ''}">`;
  } else {
    control = `<input type="text" id="${id}" data-licon-key="${spec.key}" data-licon-kind="string" class="mono" placeholder="${spec.placeholder || ''}">`;
  }
  return `<label class="is-opt-field"><span class="is-opt-label">${spec.label}</span>${control}${hint}</label>`;
}

function iconOptionGroup(spec: {
  id: string;
  title: string;
  detail: string;
  fields: string;
  open?: boolean;
}): string {
  return `
    <details class="is-opt-group" id="${spec.id}"${spec.open ? ' open' : ''}>
        <summary><span>${spec.title}</span><span class="is-opt-count"></span></summary>
        <p class="is-opt-detail">${spec.detail}</p>
        <div class="is-opt-grid">${spec.fields}</div>
    </details>`;
}


function previewCard(mask: string, title: string, detail: string): string {
  return `
    <article class="is-launcher-card" data-launcher="${mask}">
        <div class="is-home-screen is-wallpaper-dark">
            <div class="is-neighbor-icons" aria-hidden="true"><span></span><span></span><span></span></div>
            <canvas class="is-launcher-canvas" data-icon-preview="${mask}" width="144" height="144" aria-label="${title} icon preview"></canvas>
            <span class="is-app-label">Your App</span>
        </div>
        <div class="is-launcher-meta"><strong>${title}</strong><span>${detail}</span></div>
    </article>`;
}
