export function getMockGpsModalHtml(): string {
  return `
    <div class="modal-backdrop" id="mockGpsModal" hidden>
        <div class="modal-card gps-modal-card" role="dialog" aria-modal="true" aria-labelledby="gpsModalTitle">
            <div class="modal-head">
                <div>
                    <h2 id="gpsModalTitle"><i class="fas fa-location-dot"></i> Mock GPS &amp; Location Studio</h2>
                    <p id="gpsModalSubtitle">Inject mock GPS coordinates into connected phone or emulator.</p>
                </div>
                <button class="modal-close" id="closeMockGpsModalBtn" type="button" aria-label="Close">&times;</button>
            </div>

            <div class="modal-body gps-modal-body">
                <!-- Preset chips -->
                <div class="gps-section">
                    <label class="gps-label">Quick City Presets</label>
                    <div class="gps-presets-grid" id="gpsPresetsGrid">
                        <button class="btn btn-quiet gps-preset-btn" type="button" data-lat="30.0444" data-lon="31.2357">🇪🇬 Cairo</button>
                        <button class="btn btn-quiet gps-preset-btn" type="button" data-lat="24.7136" data-lon="46.6753">🇸🇦 Riyadh</button>
                        <button class="btn btn-quiet gps-preset-btn" type="button" data-lat="25.2048" data-lon="55.2708">🇦🇪 Dubai</button>
                        <button class="btn btn-quiet gps-preset-btn" type="button" data-lat="51.5074" data-lon="-0.1278">🇬🇧 London</button>
                        <button class="btn btn-quiet gps-preset-btn" type="button" data-lat="40.7128" data-lon="-74.0060">🇺🇸 New York</button>
                        <button class="btn btn-quiet gps-preset-btn" type="button" data-lat="37.7749" data-lon="-122.4194">🇺🇸 San Francisco</button>
                        <button class="btn btn-quiet gps-preset-btn" type="button" data-lat="35.6762" data-lon="139.6503">🇯🇵 Tokyo</button>
                        <button class="btn btn-quiet gps-preset-btn" type="button" data-lat="52.5200" data-lon="13.4050">🇩🇪 Berlin</button>
                    </div>
                </div>

                <!-- Custom Saved Locations -->
                <div class="gps-section" id="gpsCustomPresetsSection" hidden>
                    <label class="gps-label">Saved Locations</label>
                    <div class="gps-presets-grid" id="gpsCustomPresetsGrid"></div>
                </div>

                <!-- Custom coordinates form -->
                <div class="gps-form-grid">
                    <div class="modal-field">
                        <label for="gpsLatInput">Latitude (-90 to +90)</label>
                        <input type="number" id="gpsLatInput" step="any" placeholder="30.0444" />
                    </div>
                    <div class="modal-field">
                        <label for="gpsLonInput">Longitude (-180 to +180)</label>
                        <input type="number" id="gpsLonInput" step="any" placeholder="31.2357" />
                    </div>
                    <div class="modal-field">
                        <label for="gpsAltInput">Altitude (meters)</label>
                        <input type="number" id="gpsAltInput" step="any" placeholder="0" value="0" />
                    </div>
                </div>

                <div class="gps-actions-bar">
                    <button class="btn btn-primary" id="gpsSetLocationBtn" type="button">
                        <i class="fas fa-paper-plane"></i> Apply Location to Device
                    </button>
                    <button class="btn btn-quiet" id="gpsResetBtn" type="button" title="Reset coordinates to default">
                        <i class="fas fa-rotate-left"></i> Reset
                    </button>
                </div>

                <!-- Save Location Prompt Card -->
                <div class="gps-save-prompt" id="gpsSaveLocationPrompt" hidden>
                    <div class="gps-save-prompt-header">
                        <div class="gps-save-prompt-title">
                            <i class="fas fa-bookmark"></i>
                            <span>Save this location for future use?</span>
                        </div>
                        <button class="gps-save-prompt-close" id="gpsDismissSaveBtn" type="button" aria-label="Dismiss">&times;</button>
                    </div>
                    <div class="gps-save-prompt-body">
                        <input type="text" id="gpsCustomLocationName" placeholder="Enter name (e.g. My Office, Warehouse A)" spellcheck="false" autocomplete="off" />
                        <div class="gps-save-prompt-actions">
                            <button class="btn btn-primary btn-sm" id="gpsConfirmSaveBtn" type="button">
                                <i class="fas fa-floppy-disk"></i> Save Location
                            </button>
                            <button class="btn btn-quiet btn-sm" id="gpsCancelSaveBtn" type="button">Not Now</button>
                        </div>
                    </div>
                </div>

                <!-- State Feedback -->
                <div class="gps-status-card" id="gpsStatusCard" hidden>
                    <i class="fas fa-circle-check" id="gpsStatusIcon"></i>
                    <span id="gpsStatusText">Location applied successfully.</span>
                </div>
            </div>
        </div>
    </div>
  `;
}

