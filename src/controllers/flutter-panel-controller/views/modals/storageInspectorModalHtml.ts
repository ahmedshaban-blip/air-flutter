export function getStorageInspectorModalHtml(): string {
  return `
    <div class="modal-backdrop" id="storageInspectorModal" hidden>
        <div class="modal-card storage-modal-card" role="dialog" aria-modal="true" aria-labelledby="storageModalTitle">
            <div class="modal-head">
                <div>
                    <h2 id="storageModalTitle"><i class="fas fa-database"></i> Storage &amp; SQLite Inspector</h2>
                    <p>Live sandbox inspector for SharedPreferences and SQLite without wiping app data.</p>
                </div>
                <button class="modal-close" id="closeStorageModalBtn" type="button" aria-label="Close">&times;</button>
            </div>

            <div class="modal-body storage-modal-body">
                <!-- Target controls -->
                <div class="storage-controls-bar">
                    <div class="storage-package-input-group">
                        <div class="storage-package-label-row">
                            <label for="storagePackageInput">Package ID</label>
                            <span class="storage-pkg-badge" id="storagePkgBadge" hidden><i class="fas fa-wand-magic-sparkles"></i> Auto-detected</span>
                        </div>
                        <div class="storage-input-action">
                            <div class="storage-input-wrapper">
                                <input type="text" id="storagePackageInput" placeholder="com.example.app" spellcheck="false" autocomplete="off" />
                                <button class="btn btn-quiet storage-edit-pkg-btn" id="storageEditPackageBtn" type="button" title="Edit Package ID manually">
                                    <i class="fas fa-pen"></i>
                                </button>
                            </div>
                            <button class="btn btn-primary" id="storageRefreshFilesBtn" type="button"><i class="fas fa-search"></i> Inspect</button>
                        </div>
                    </div>

                    <!-- Mode selection -->
                    <div class="storage-mode-toggle" role="radiogroup" aria-label="Discovery Mode">
                        <label class="storage-radio">
                            <input type="radio" name="storageModuleMode" value="auto" checked />
                            <span>Auto Discovery (/data)</span>
                        </label>
                        <label class="storage-radio">
                            <input type="radio" name="storageModuleMode" value="presets" />
                            <span>Specific Packages (Multi-select)</span>
                        </label>
                    </div>
                </div>

                <!-- Presets selector (visible when presets mode is selected) -->
                <div class="storage-presets-panel" id="storagePresetsPanel" hidden>
                    <span class="storage-presets-label">Choose packages to scan:</span>
                    <div class="storage-presets-grid" id="storagePresetsGrid">
                        <label class="storage-preset-chip">
                            <input type="checkbox" value="shared_preferences" checked />
                            <span><i class="fas fa-file-code"></i> SharedPreferences</span>
                        </label>
                        <label class="storage-preset-chip">
                            <input type="checkbox" value="sqflite" checked />
                            <span><i class="fas fa-table"></i> sqflite / Drift / Room</span>
                        </label>
                        <label class="storage-preset-chip">
                            <input type="checkbox" value="hive_isar" />
                            <span><i class="fas fa-box-archive"></i> Hive / Isar / ObjectBox</span>
                        </label>
                    </div>
                </div>

                <!-- State: Loading -->
                <div class="storage-state-view" id="storageLoadingView" hidden>
                    <div class="sf-operation-spinner"></div>
                    <p id="storageLoadingMessage">Inspecting storage container over ADB…</p>
                </div>

                <!-- State: Error -->
                <div class="storage-state-view storage-error-card" id="storageErrorView" hidden>
                    <i class="fas fa-triangle-exclamation"></i>
                    <div>
                        <strong id="storageErrorTitle">Unable to inspect storage</strong>
                        <p id="storageErrorMessage">Check if the application is installed in debug mode.</p>
                    </div>
                    <button class="btn btn-quiet" id="storageRetryBtn" type="button">Retry</button>
                </div>

                <!-- State: Success / Content layout -->
                <div class="storage-content-layout" id="storageContentView" hidden>
                    <!-- Sidebar list of files -->
                    <div class="storage-files-column">
                        <div class="storage-column-head">
                            <h3>Files found</h3>
                            <span class="ff-section-note" id="storageFileCount">0</span>
                        </div>
                        <div class="storage-files-list" id="storageFilesList"></div>
                    </div>

                    <!-- Detail editor pane -->
                    <div class="storage-detail-column">
                        <div class="storage-column-head">
                            <h3 id="storageSelectedFileTitle">Select a file</h3>
                            <span class="ff-section-note" id="storageFileTypeBadge">&mdash;</span>
                        </div>

                        <!-- SharedPreferences Editor -->
                        <div id="storagePrefsEditor" hidden>
                            <div class="storage-prefs-toolbar">
                                <input type="text" id="storagePrefFilter" placeholder="Filter keys…" spellcheck="false" />
                                <button class="btn btn-quiet" id="storagePrefAddKeyBtn" type="button"><i class="fas fa-plus"></i> New Key</button>
                            </div>
                            <div class="storage-table-wrapper">
                                <table class="storage-table" id="storagePrefsTable">
                                    <thead>
                                        <tr>
                                            <th>Key</th>
                                            <th>Type</th>
                                            <th>Value</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="storagePrefsTableBody"></tbody>
                                </table>
                            </div>
                        </div>

                        <!-- SQLite Editor -->
                        <div id="storageSqliteEditor" hidden>
                            <div class="storage-sqlite-bar">
                                <label for="storageTableSelect">Table:</label>
                                <select id="storageTableSelect"></select>
                                <button class="btn btn-quiet" id="storageQueryRunBtn" type="button"><i class="fas fa-play"></i> Query</button>
                            </div>
                            <div class="storage-table-wrapper">
                                <table class="storage-table" id="storageSqliteTable">
                                    <thead id="storageSqliteThead"></thead>
                                    <tbody id="storageSqliteTbody"></tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Empty selection state -->
                        <div class="storage-empty-detail" id="storageEmptyDetail">
                            <i class="fas fa-folder-open"></i>
                            <p>Pick a file on the left to inspect and edit its contents.</p>
                        </div>
                    </div>
                </div>

                <!-- State: Initial Empty -->
                <div class="storage-state-view storage-initial-view" id="storageInitialView">
                    <i class="fas fa-cubes-stacked"></i>
                    <h3>Storage Container Explorer</h3>
                    <p>Enter an application ID or select an active debug package to begin live inspection.</p>
                </div>
            </div>
        </div>
    </div>
  `;
}

