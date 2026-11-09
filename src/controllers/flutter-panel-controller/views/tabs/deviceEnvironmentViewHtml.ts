export function getDeviceEnvironmentViewHtml(): string {
  return `
    <section data-panel-view="device-env" hidden aria-label="Device Environment Sandbox">
        <div class="de-layout">
            <div class="ff-section de-head-bar">
                <div class="ff-section-head">
                    <div>
                        <h2>Device Environment Sandbox</h2>
                        <p class="de-kicker">Real-time font scaling, dark mode, simulated battery, locale &amp; screen overrides</p>
                    </div>
                    <div class="de-actions-head">
                        <button class="btn btn-quiet" id="deRefreshBtn" type="button">
                            <i class="fas fa-rotate"></i> Read Device State
                        </button>
                    </div>
                </div>
            </div>

            <div class="de-grid">
                <!-- Font Scale Card -->
                <div class="ff-section de-card">
                    <div class="ff-section-head">
                        <h3><i class="fas fa-text-height"></i> System Font Scale</h3>
                        <span id="deCurrentFontScaleBadge" class="status-badge is-enabled">1.0&times;</span>
                    </div>
                    <p class="de-card-desc">Tests accessibility layouts, text truncation, and RenderFlex overflows instantly.</p>
                    <div class="de-pills-row">
                        <button class="preset-pill de-font-pill" type="button" data-scale="0.85">0.85&times; (Small)</button>
                        <button class="preset-pill de-font-pill is-active" type="button" data-scale="1.0">1.0&times; (Normal)</button>
                        <button class="preset-pill de-font-pill" type="button" data-scale="1.15">1.15&times; (Large)</button>
                        <button class="preset-pill de-font-pill" type="button" data-scale="1.3">1.3&times; (XL)</button>
                        <button class="preset-pill de-font-pill" type="button" data-scale="1.5">1.5&times; (Huge)</button>
                        <button class="preset-pill de-font-pill" type="button" data-scale="2.0">2.0&times; (A11y)</button>
                    </div>
                    <div class="de-slider-row">
                        <input type="range" id="deFontScaleSlider" min="0.8" max="2.0" step="0.05" value="1.0">
                        <span id="deFontScaleSliderVal" class="mono">1.00&times;</span>
                        <button class="btn btn-quiet btn-xs" id="deApplyCustomFontBtn" type="button">Apply</button>
                    </div>
                </div>

                <!-- Dark / Light Mode Card -->
                <div class="ff-section de-card">
                    <div class="ff-section-head">
                        <h3><i class="fas fa-moon"></i> System UI Night Mode</h3>
                        <span id="deCurrentDarkModeBadge" class="status-badge">Detecting...</span>
                    </div>
                    <p class="de-card-desc">Toggles Android system night mode to test Flutter theme brightness adaptation.</p>
                    <div class="de-btn-group">
                        <button class="btn btn-quiet de-full-btn" id="deDarkModeOnBtn" type="button">
                            <i class="fas fa-moon"></i> Night Mode (Dark)
                        </button>
                        <button class="btn btn-quiet de-full-btn" id="deDarkModeOffBtn" type="button">
                            <i class="fas fa-sun"></i> Day Mode (Light)
                        </button>
                    </div>
                </div>

                <!-- Simulated Battery Card -->
                <div class="ff-section de-card">
                    <div class="ff-section-head">
                        <h3><i class="fas fa-battery-half"></i> Battery &amp; Power Simulator</h3>
                        <span id="deBatteryBadge" class="status-badge">100%</span>
                    </div>
                    <p class="de-card-desc">Forces low battery states to test power saving modes, background sync, or battery warnings.</p>
                    <div class="de-pills-row">
                        <button class="preset-pill de-battery-pill" type="button" data-level="5" data-charging="false">5% (Critical)</button>
                        <button class="preset-pill de-battery-pill" type="button" data-level="15" data-charging="false">15% (Low)</button>
                        <button class="preset-pill de-battery-pill" type="button" data-level="50" data-charging="false">50%</button>
                        <button class="preset-pill de-battery-pill" type="button" data-level="100" data-charging="true">100% (Charging)</button>
                    </div>
                    <div class="de-btn-group" style="margin-top: 10px;">
                        <button class="btn btn-danger de-full-btn" id="deResetBatteryBtn" type="button">
                            <i class="fas fa-arrow-rotate-left"></i> Reset to Hardware Battery
                        </button>
                    </div>
                </div>

                <!-- Locale & RTL/LTR Card -->
                <div class="ff-section de-card">
                    <div class="ff-section-head">
                        <h3><i class="fas fa-language"></i> System Locale &amp; RTL Test</h3>
                        <span id="deCurrentLocaleBadge" class="status-badge mono">en</span>
                    </div>
                    <p class="de-card-desc">Switches device locale to verify bidirectional Arabic RTL layout and font rendering.</p>
                    <div class="de-pills-row">
                        <button class="preset-pill de-locale-pill" type="button" data-locale="ar-EG">ar-EG (Arabic RTL)</button>
                        <button class="preset-pill de-locale-pill" type="button" data-locale="ar-SA">ar-SA (Saudi)</button>
                        <button class="preset-pill de-locale-pill" type="button" data-locale="en-US">en-US (English)</button>
                        <button class="preset-pill de-locale-pill" type="button" data-locale="fr-FR">fr-FR (French)</button>
                    </div>
                    <div class="de-input-row" style="margin-top: 8px;">
                        <input type="text" id="deCustomLocaleInput" class="mono" placeholder="Custom locale (e.g. de-DE, es-ES)">
                        <button class="btn btn-quiet btn-xs" id="deApplyCustomLocaleBtn" type="button">Apply</button>
                    </div>
                </div>

                <!-- Display Density & Orientation Card -->
                <div class="ff-section de-card">
                    <div class="ff-section-head">
                        <h3><i class="fas fa-mobile-screen-button"></i> Density &amp; Rotation</h3>
                        <span id="deDensityBadge" class="status-badge mono">Default</span>
                    </div>
                    <p class="de-card-desc">Overrides screen DPI and tests forced portrait / landscape orientation locks.</p>
                    <div class="de-pills-row">
                        <button class="preset-pill de-density-pill" type="button" data-density="320">320 DPI (Compact)</button>
                        <button class="preset-pill de-density-pill" type="button" data-density="420">420 DPI (Standard)</button>
                        <button class="preset-pill de-density-pill" type="button" data-density="480">480 DPI (Large)</button>
                        <button class="preset-pill de-density-pill" type="button" data-density="reset">Reset Density</button>
                    </div>
                    <div class="de-btn-group" style="margin-top: 10px;">
                        <button class="btn btn-quiet" id="deRotatePortraitBtn" type="button"><i class="fas fa-mobile"></i> Portrait</button>
                        <button class="btn btn-quiet" id="deRotateLandscapeBtn" type="button"><i class="fas fa-mobile fa-rotate-90"></i> Landscape</button>
                        <button class="btn btn-quiet" id="deRotateAutoBtn" type="button"><i class="fas fa-arrows-rotate"></i> Auto-Rotate</button>
                    </div>
                </div>
            </div>

            <div class="de-status-bar" id="deviceEnvStatusBar" role="status">Ready.</div>
        </div>
    </section>
  `;
}

