/**
 * HTML Template for Flutter Compatibility Doctor & Auto-Fixer Modal
 * and Compatibility Stack Diff Preview Modal
 */
export function getCompatDoctorModalHtml(): string {
  return `
        <!-- Flutter Compatibility Doctor & Auto-Fixer Modal -->
        <div class="modal-backdrop" id="compatDoctorModal" hidden>
            <div class="modal-card" style="max-width: 740px;">
                <div class="modal-head">
                    <h2><i class="fas fa-stethoscope"></i> Flutter Compatibility Doctor &amp; Auto-Fixer</h2>
                    <button class="modal-close" id="closeCompatDoctorModalBtn" type="button" aria-label="Close">&times;</button>
                </div>

                <div class="modal-body" style="padding-top: 8px;">
                    <!-- Project Selector Header -->
                    <div class="modal-field" style="margin-bottom: 10px;">
                        <label>Active Project Path</label>
                        <div class="custom-path-row" style="display: flex; gap: 8px; margin-top: 4px;">
                            <input type="text" id="compatProjectPathInput" class="modal-input" placeholder="Select a Flutter project..." readonly style="flex: 1;" />
                            <button class="btn btn-secondary" id="browseCompatProjectBtn" type="button">
                                <i class="fas fa-folder-open"></i> Browse
                            </button>
                            <button class="btn btn-primary" id="reScanCompatDoctorBtn" type="button">
                                <i class="fas fa-sync-alt"></i> Re-scan
                            </button>
                        </div>
                    </div>

                    <!-- Two Tabs Navigation Header -->
                    <div class="compat-tabs-nav">
                        <button class="compat-tab-btn is-active" id="tabBtnCompatAudit" type="button">
                            <i class="fas fa-search-plus"></i> Audit Findings
                        </button>
                        <button class="compat-tab-btn" id="tabBtnCompatConfig" type="button">
                            <i class="fas fa-sliders-h"></i> Version Configurator &amp; Auto-Sync
                        </button>
                    </div>

                    <!-- Loading / Spinner State -->
                    <div id="compatDoctorLoading" style="display: none; text-align: center; padding: 32px 0;">
                        <i class="fas fa-circle-notch fa-spin fa-2x" style="color: var(--primary);"></i>
                        <p style="margin-top: 12px; font-weight: 500;">Inspecting Gradle, AGP, Java runtime &amp; iOS deployment target...</p>
                    </div>

                    <!-- TAB 1: Audit Findings Content -->
                    <div id="tabContentCompatAudit">
                        <!-- Overview Cards Grid -->
                        <div class="compat-cards-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;">
                            <div class="compat-status-card" id="compatCardGradle">
                                <div class="compat-card-title"><i class="fas fa-cubes"></i> Gradle Wrapper</div>
                                <div class="compat-card-value" id="compatValGradle">-</div>
                                <div class="compat-card-sub" id="compatSubGradle">Checking...</div>
                            </div>
                            <div class="compat-status-card" id="compatCardAgp">
                                <div class="compat-card-title"><i class="fab fa-android"></i> Android Gradle Plugin</div>
                                <div class="compat-card-value" id="compatValAgp">-</div>
                                <div class="compat-card-sub" id="compatSubAgp">Checking...</div>
                            </div>
                            <div class="compat-status-card" id="compatCardJava">
                                <div class="compat-card-title"><i class="fab fa-java"></i> Java Runtime (JDK)</div>
                                <div class="compat-card-value" id="compatValJava">-</div>
                                <div class="compat-card-sub" id="compatSubJava">Checking...</div>
                            </div>
                            <div class="compat-status-card" id="compatCardIos">
                                <div class="compat-card-title"><i class="fab fa-apple"></i> iOS Target (Podfile)</div>
                                <div class="compat-card-value" id="compatValIos">-</div>
                                <div class="compat-card-sub" id="compatSubIos">Checking...</div>
                            </div>
                        </div>

                        <!-- Issues & Recommendations List -->
                        <div class="modal-field">
                            <label><i class="fas fa-clipboard-check"></i> Diagnostic Findings &amp; Upgrades</label>
                            <div id="compatIssuesContainer" style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto;">
                                <!-- Dynamic issue items injected here -->
                            </div>
                        </div>

                        <!-- Recommended Stack Banner -->
                        <div class="secrets-notice-box" id="compatTargetNotice" style="margin-top: 14px;">
                            <h4><i class="fas fa-shield-alt"></i> Verified Stable Baseline</h4>
                            <p id="compatTargetText" style="margin: 0;">AGP 8.5.2 | Gradle 8.7 | JDK 17 | iOS 13.0+</p>
                        </div>

                        <div class="modal-foot" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;">
                            <button class="btn btn-quiet" id="cancelCompatDoctorBtn" type="button">Close</button>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary" id="openCompatOutputBtn" type="button">
                                    <i class="fas fa-terminal"></i> View Detailed Log
                                </button>
                                <button class="btn btn-primary" id="autoUpgradeStackBtn" type="button" disabled>
                                    <i class="fas fa-wrench"></i> Upgrade Stack (Auto-Fix)
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: Version Configurator & Auto-Sync -->
                    <div id="tabContentCompatConfig" style="display: none;">
                        <p style="margin: 0 0 12px; font-size: 12px; color: var(--muted);">
                            Customize your project build stack with real-time smart cascading compatibility enforcement. Incompatible options are automatically filtered or disabled to guarantee build stability.
                        </p>

                        <div class="compat-config-grid">
                            <div class="modal-field">
                                <label for="configAgpSelect"><i class="fab fa-android"></i> Android Gradle Plugin (AGP)</label>
                                <select id="configAgpSelect" class="modal-input" style="width: 100%;">
                                    <!-- Populated dynamically -->
                                </select>
                            </div>
                            <div class="modal-field">
                                <label for="configGradleSelect"><i class="fas fa-cubes"></i> Gradle Wrapper Version</label>
                                <select id="configGradleSelect" class="modal-input" style="width: 100%;">
                                    <!-- Populated & filtered dynamically -->
                                </select>
                            </div>
                            <div class="modal-field">
                                <label for="configKotlinSelect"><i class="fas fa-code"></i> Kotlin Version</label>
                                <select id="configKotlinSelect" class="modal-input" style="width: 100%;">
                                    <!-- Populated dynamically -->
                                </select>
                            </div>
                            <div class="modal-field">
                                <label for="configJavaSelect"><i class="fab fa-java"></i> Java / JDK Target</label>
                                <select id="configJavaSelect" class="modal-input" style="width: 100%;">
                                    <!-- Populated dynamically -->
                                </select>
                            </div>
                            <div class="modal-field" style="grid-column: span 2;">
                                <label for="configIosSelect"><i class="fab fa-apple"></i> iOS Minimum Deployment Target (Podfile)</label>
                                <select id="configIosSelect" class="modal-input" style="width: 100%;">
                                    <!-- Populated dynamically -->
                                </select>
                            </div>
                        </div>

                        <!-- Live Compatibility Notification -->
                        <div id="configStatusBanner" class="compat-status-card is-success" style="padding: 10px 14px; margin-top: 10px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-check-circle" style="color: #4caf50;"></i>
                                <span id="configStatusText" style="font-size: 12px; font-weight: 600;">Selected combination is fully compatible and verified.</span>
                            </div>
                        </div>

                        <div class="modal-foot" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;">
                            <button class="btn btn-quiet" id="cancelCompatConfigBtn" type="button">Close</button>
                            <button class="btn btn-primary" id="previewCustomStackBtn" type="button">
                                <i class="fas fa-eye"></i> Review &amp; Apply Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Compatibility Stack Diff Preview Modal -->
        <div class="modal-backdrop" id="compatDiffModal" hidden style="z-index: 10001;">
            <div class="modal-card" style="max-width: 640px;">
                <div class="modal-head">
                    <h2><i class="fas fa-code-branch"></i> Review Target Stack Modifications</h2>
                    <button class="modal-close" id="closeCompatDiffModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body" style="padding-top: 8px;">
                    <p style="margin: 0 0 10px; font-size: 12px; color: var(--muted);">
                        The following file modifications will be applied to your workspace via non-destructive edits. You can undo all changes at any time using <code>Ctrl+Z</code>.
                    </p>
                    <div id="compatDiffList" style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
                        <!-- Diff items injected dynamically -->
                    </div>
                </div>
                <div class="modal-foot" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px;">
                    <button class="btn btn-quiet" id="cancelCompatDiffModalBtn" type="button">Cancel</button>
                    <button class="btn btn-primary" id="confirmApplyDiffBtn" type="button">
                        <i class="fas fa-check"></i> Apply Selected Modifications
                    </button>
                </div>
            </div>
        </div>
`;
}

