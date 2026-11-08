export function getDebugOverlaysModalHtml(): string {
  return `
    <div class="modal-backdrop" id="debugOverlaysModal" hidden>
        <div class="modal-card overlays-modal-card" role="dialog" aria-modal="true" aria-labelledby="debugOverlaysModalTitle">
            <div class="modal-head">
                <div>
                    <h2 id="debugOverlaysModalTitle"><i class="fas fa-layer-group"></i> Flutter Debug Overlays</h2>
                    <p>Live visual debugging flags without opening Flutter DevTools.</p>
                </div>
                <button class="modal-close" id="closeDebugOverlaysModalBtn" type="button" aria-label="Close">&times;</button>
            </div>

            <div class="modal-body overlays-modal-body">
                <div class="overlays-grid">
                    <!-- Debug Paint -->
                    <div class="overlay-card" data-overlay="debugPaint">
                        <div class="overlay-info">
                            <span class="overlay-icon"><i class="fas fa-border-all"></i></span>
                            <div>
                                <strong>Debug Paint</strong>
                                <small>Highlights widget boxes, padding, and layout bounds.</small>
                            </div>
                        </div>
                        <button class="btn btn-quiet overlay-toggle-btn" type="button" data-toggle-overlay="debugPaint">
                            <span class="overlay-status-pill">OFF</span>
                            <span class="overlay-hotkey"><kbd>p</kbd></span>
                        </button>
                    </div>

                    <!-- Performance Overlay -->
                    <div class="overlay-card" data-overlay="performanceOverlay">
                        <div class="overlay-info">
                            <span class="overlay-icon"><i class="fas fa-chart-line"></i></span>
                            <div>
                                <strong>Performance Overlay</strong>
                                <small>Real-time GPU and UI rasterization frame graphs.</small>
                            </div>
                        </div>
                        <button class="btn btn-quiet overlay-toggle-btn" type="button" data-toggle-overlay="performanceOverlay">
                            <span class="overlay-status-pill">OFF</span>
                            <span class="overlay-hotkey"><kbd>P</kbd></span>
                        </button>
                    </div>

                    <!-- Slow Animations -->
                    <div class="overlay-card" data-overlay="slowAnimations">
                        <div class="overlay-info">
                            <span class="overlay-icon"><i class="fas fa-gauge-simple"></i></span>
                            <div>
                                <strong>Slow Animations (5x)</strong>
                                <small>Slows motion and hero transitions to spot glitches.</small>
                            </div>
                        </div>
                        <button class="btn btn-quiet overlay-toggle-btn" type="button" data-toggle-overlay="slowAnimations">
                            <span class="overlay-status-pill">OFF</span>
                            <span class="overlay-hotkey"><kbd>S</kbd></span>
                        </button>
                    </div>

                    <!-- Repaint Rainbow -->
                    <div class="overlay-card" data-overlay="repaintRainbow">
                        <div class="overlay-info">
                            <span class="overlay-icon"><i class="fas fa-palette"></i></span>
                            <div>
                                <strong>Repaint Rainbow</strong>
                                <small>Rotates colors on RenderObjects when they repaint.</small>
                            </div>
                        </div>
                        <button class="btn btn-quiet overlay-toggle-btn" type="button" data-toggle-overlay="repaintRainbow">
                            <span class="overlay-status-pill">OFF</span>
                            <span class="overlay-hotkey"><kbd>t</kbd></span>
                        </button>
                    </div>

                    <!-- Paint Baselines -->
                    <div class="overlay-card" data-overlay="paintBaselines">
                        <div class="overlay-info">
                            <span class="overlay-icon"><i class="fas fa-font"></i></span>
                            <div>
                                <strong>Paint Baselines</strong>
                                <small>Displays typography baseline alignment rulers.</small>
                            </div>
                        </div>
                        <button class="btn btn-quiet overlay-toggle-btn" type="button" data-toggle-overlay="paintBaselines">
                            <span class="overlay-status-pill">OFF</span>
                            <span class="overlay-hotkey"><kbd>b</kbd></span>
                        </button>
                    </div>
                </div>

                <div class="overlays-footer">
                    <p class="overlays-note">Note: The Flutter app must be running in debug mode on the connected device.</p>
                    <button class="btn btn-quiet" id="resetOverlaysBtn" type="button"><i class="fas fa-rotate-left"></i> Reset All</button>
                </div>
            </div>
        </div>
    </div>
  `;
}

