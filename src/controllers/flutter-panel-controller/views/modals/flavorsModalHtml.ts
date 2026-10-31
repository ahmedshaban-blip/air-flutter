export function getFlavorsModalHtml(): string {
  return `
        <!-- Flutter Flavors Modal -->
        <div class="modal-backdrop" id="flavorsModal" hidden>
            <div class="modal-card">
                <div class="modal-head">
                    <h2><i class="fas fa-layer-group"></i> Flutter Flavors Manager</h2>
                    <button class="modal-close" id="closeFlavorsModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="modal-field">
                        <label>Target Flutter Project</label>
                        <div class="path-picker-row">
                            <input type="text" id="flavorsProjectPathInput" placeholder="Select Flutter project folder..." />
                            <button class="btn btn-quiet" id="browseFlavorsProjectBtn" type="button">
                                <i class="fas fa-folder-open"></i> Browse
                            </button>
                        </div>
                        <span class="field-desc">Choose current or external Flutter project with pubspec.yaml</span>
                    </div>

                    <div class="modal-field">
                        <label>Flavors</label>
                        <div id="flavorsListContainer" style="display: flex; flex-direction: column; gap: 8px;"></div>
                    </div>

                    <div id="flavorsEmptyState" class="secrets-notice-box" hidden>
                        <h4><i class="fas fa-info-circle"></i> No Flavors Configured</h4>
                        <p style="margin: 0 0 10px 0;">This project does not have productFlavors defined in android/app/build.gradle.</p>
                        <button class="btn btn-primary" id="setupFlavorsBtn" type="button">
                            <i class="fas fa-wand-magic-sparkles"></i> Setup Flavors (dev, staging, prod)
                        </button>
                    </div>
                </div>
                <div class="modal-foot">
                    <button class="btn btn-quiet" id="cancelFlavorsModalBtn" type="button">Cancel</button>
                    <div id="flavorsActionsRow" style="display: flex; gap: 8px;">
                        <button class="btn btn-quiet" id="runFlavorBtn" type="button">
                            <i class="fas fa-play"></i> Run
                        </button>
                        <button class="btn btn-primary" id="buildFlavorApkBtn" type="button">
                            <i class="fas fa-box"></i> Build APK
                        </button>
                        <button class="btn btn-primary" id="buildAllFlavorsBtn" type="button">
                            <i class="fas fa-boxes-stacked"></i> Build All Flavors
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
}

