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
                        <button class="btn btn-primary" id="pubHealthCheckBtn" type="button"><i class="fas fa-rotate"></i> Check Dependencies</button>
                        <button class="btn btn-quiet" id="pubHealthUpgradeBtn" type="button"><i class="fas fa-arrow-up"></i> Run flutter pub upgrade</button>
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
                                    <th>Package</th>
                                    <th>Kind</th>
                                    <th>Current</th>
                                    <th>Upgradable</th>
                                    <th>Latest</th>
                                    <th>Status</th>
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
        </div>
    </div>
  `;
}

