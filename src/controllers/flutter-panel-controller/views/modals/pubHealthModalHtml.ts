export function getPubHealthModalHtml(): string {
  return `
    <div class="modal-backdrop" id="pubHealthModal" hidden>
        <div class="modal-card pub-health-modal-card" role="dialog" aria-modal="true" aria-labelledby="pubHealthModalTitle">
            <div class="modal-head">
                <div>
                    <h2 id="pubHealthModalTitle"><i class="fas fa-stethoscope"></i> Pub Dependencies Health &amp; Updates</h2>
                    <p>Detect outdated packages, breaking changes, and upgrade dependencies safely.</p>
                </div>
                <button class="modal-close" id="closePubHealthModalBtn" type="button" aria-label="Close">&times;</button>
            </div>

            <div class="modal-body pub-health-modal-body">
                <!-- Top Actions & Project Selector -->
                <div class="pub-health-toolbar">
                    <div class="pub-project-selector">
                        <span class="pub-project-path-label" id="pubProjectPathDisplay">Detecting Flutter project…</span>
                        <button class="btn btn-quiet" id="pubBrowseProjectBtn" type="button"><i class="fas fa-folder-open"></i> Browse…</button>
                    </div>
                    <div class="pub-actions-group">
                        <button class="btn btn-primary" id="pubUpdateSelectedBtn" type="button" disabled><i class="fas fa-arrow-up"></i> Update Selected (<span id="pubSelectedCount">0</span>)</button>
                        <button class="btn btn-quiet" id="pubHealthCheckBtn" type="button"><i class="fas fa-rotate"></i> Refresh</button>
                        <button class="btn btn-quiet" id="pubHealthUpgradeBtn" type="button"><i class="fas fa-terminal"></i> Run flutter pub upgrade</button>
                    </div>
                </div>

                <!-- Tabs: All, Direct, Dev, Transitive -->
                <div class="pub-tabs-bar" id="pubTabsBar" hidden>
                    <button class="pub-tab is-active" data-tab="all" type="button">
                        <i class="fas fa-layer-group"></i> All <span class="pub-tab-badge" id="pubTabAllCount">0</span>
                    </button>
                    <button class="pub-tab" data-tab="direct" type="button">
                        <i class="fas fa-box"></i> Direct <span class="pub-tab-badge" id="pubTabDirectCount">0</span>
                    </button>
                    <button class="pub-tab" data-tab="dev" type="button">
                        <i class="fas fa-flask"></i> Dev <span class="pub-tab-badge" id="pubTabDevCount">0</span>
                    </button>
                    <button class="pub-tab" data-tab="transitive" type="button">
                        <i class="fas fa-diagram-project"></i> Transitive <span class="pub-tab-badge" id="pubTabTransitiveCount">0</span>
                    </button>
                </div>

                <!-- Transitive Context Banner -->
                <div class="pub-transitive-banner" id="pubTransitiveBanner" hidden>
                    <i class="fas fa-circle-info"></i>
                    <div>
                        <strong>Transitive Dependencies:</strong>
                        These are sub-dependencies pulled in by your direct packages. They are not defined directly in <code>pubspec.yaml</code>. The parent packages that depend on them are shown below (e.g. <code>via supabase_flutter</code>). Upgrading transitive dependencies via CLI might cause version conflicts.
                    </div>
                </div>

                <!-- State: Loading -->
                <div class="pub-health-state-view" id="pubHealthLoadingView" hidden>
                    <div class="sf-operation-spinner"></div>
                    <p>Querying pub.dev for dependency versions…</p>
                </div>

                <!-- State: Error -->
                <div class="pub-health-state-view pub-health-error-wrapper" id="pubHealthErrorView" hidden>
                    <div class="pub-health-error-card">
                        <i class="fas fa-triangle-exclamation"></i>
                        <div class="pub-health-error-text">
                            <strong id="pubHealthErrorTitle">Pub Check Failed</strong>
                            <p id="pubHealthErrorMessage">Make sure flutter is in your PATH and pubspec.yaml is valid.</p>
                        </div>
                    </div>

                    <!-- Syntax / Configuration Diagnostics -->
                    <div class="pub-diagnostic-box" id="pubHealthDiagnosticBox" hidden>
                        <div class="pub-diagnostic-header">
                            <div class="pub-diagnostic-title-wrap">
                                <span class="pub-diagnostic-badge"><i class="fas fa-bug"></i> Syntax Issue</span>
                                <strong id="pubDiagnosticTitle">pubspec.yaml issue detected</strong>
                            </div>
                            <button class="btn btn-primary btn-sm" id="pubOpenPubspecLineBtn" type="button">
                                <i class="fas fa-arrow-up-right-from-square"></i> <span id="pubOpenBtnText">Open pubspec.yaml</span>
                            </button>
                        </div>
                        <p class="pub-diagnostic-detail" id="pubDiagnosticDetail"></p>
                        <div class="pub-diagnostic-suggestion-card">
                            <i class="fas fa-lightbulb"></i>
                            <div>
                                <strong>How to fix:</strong>
                                <p id="pubDiagnosticSuggestion"></p>
                            </div>
                        </div>
                        <div class="pub-diagnostic-snippet-container" id="pubDiagnosticSnippetContainer" hidden>
                            <div class="pub-snippet-bar">
                                <span><i class="fas fa-file-code"></i> pubspec.yaml preview</span>
                            </div>
                            <pre class="pub-diagnostic-snippet"><code id="pubDiagnosticSnippetCode"></code></pre>
                        </div>
                    </div>
                </div>

                <!-- State: Success -->
                <div class="pub-health-report" id="pubHealthReportView" hidden>
                    <!-- Summary Cards -->
                    <div class="pub-health-summary-cards">
                        <div class="pub-summary-card">
                            <span class="pub-summary-label">Total Packages</span>
                            <strong id="pubTotalCount">0</strong>
                        </div>
                        <div class="pub-summary-card is-success">
                            <span class="pub-summary-label">Up to Date</span>
                            <strong id="pubUpToDateCount">0</strong>
                        </div>
                        <div class="pub-summary-card is-warning">
                            <span class="pub-summary-label">Upgradable</span>
                            <strong id="pubUpgradableCount">0</strong>
                        </div>
                        <div class="pub-summary-card is-danger">
                            <span class="pub-summary-label">Major Available</span>
                            <strong id="pubMajorCount">0</strong>
                        </div>
                    </div>

                    <!-- Packages Table -->
                    <div class="pub-table-wrapper">
                        <table class="pub-table">
                            <thead>
                                <tr>
                                    <th class="pub-th-check"><input type="checkbox" id="pubSelectAllCheckbox" title="Select all visible upgradable packages"></th>
                                    <th>Package</th>
                                    <th>Kind</th>
                                    <th>Current</th>
                                    <th>Upgradable</th>
                                    <th>Latest</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="pubPackagesTbody"></tbody>
                        </table>
                    </div>
                </div>

                <!-- State: Initial Empty -->
                <div class="pub-health-state-view pub-health-initial-view" id="pubHealthInitialView">
                    <i class="fas fa-cubes"></i>
                    <h3>Scan Workspace Dependencies</h3>
                    <p>Click "Check Dependencies" to run an automated audit of your pubspec.yaml against pub.dev.</p>
                </div>
            </div>

            <!-- In-Modal Confirmation Dialog -->
            <div class="pub-confirm-overlay" id="pubConfirmModal" hidden>
                <div class="pub-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="pubConfirmTitle">
                    <div class="pub-confirm-head">
                        <i class="fas fa-triangle-exclamation"></i>
                        <h3 id="pubConfirmTitle">Confirm Package Update</h3>
                    </div>
                    <div class="pub-confirm-body">
                        <p id="pubConfirmMessage"></p>
                        <div class="pub-confirm-list-wrap" id="pubConfirmListWrap">
                            <ul id="pubConfirmList" class="pub-confirm-list"></ul>
                        </div>
                    </div>
                    <div class="pub-confirm-footer">
                        <button class="btn btn-quiet" id="pubConfirmCancelBtn" type="button">Cancel</button>
                        <button class="btn btn-danger" id="pubConfirmProceedBtn" type="button"><i class="fas fa-bolt"></i> Confirm &amp; Proceed</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  `;
}

