export function getApkSizeModalHtml(): string {
  return `
    <div class="modal-backdrop" id="apkSizeModal" hidden>
        <div class="modal-card apk-size-modal-card" role="dialog" aria-modal="true" aria-labelledby="apkSizeModalTitle">
            <div class="modal-head">
                <div>
                    <h2 id="apkSizeModalTitle"><i class="fas fa-boxes-packing"></i> APK &amp; App Bundle Size Analyzer</h2>
                    <p>Inspect compiled binary composition and isolate bloated assets.</p>
                </div>
                <button class="modal-close" id="closeApkSizeModalBtn" type="button" aria-label="Close">&times;</button>
            </div>

            <div class="modal-body apk-size-modal-body">
                <!-- Top controls -->
                <div class="apk-size-toolbar">
                    <div class="apk-file-selector">
                        <select id="apkDetectedSelect">
                            <option value="">Choose a built package…</option>
                        </select>
                        <button class="btn btn-quiet" id="apkBrowseFileBtn" type="button"><i class="fas fa-folder-open"></i> Browse…</button>
                    </div>
                    <button class="btn btn-primary" id="apkRunAnalyzeBtn" type="button"><i class="fas fa-chart-pie"></i> Analyze</button>
                </div>

                <!-- State: Loading -->
                <div class="apk-state-view" id="apkLoadingView" hidden>
                    <div class="sf-operation-spinner"></div>
                    <p>Decompressing package and calculating file sizes…</p>
                </div>

                <!-- State: Error -->
                <div class="apk-state-view apk-error-card" id="apkErrorView" hidden>
                    <i class="fas fa-triangle-exclamation"></i>
                    <div>
                        <strong id="apkErrorTitle">Analysis Failed</strong>
                        <p id="apkErrorMessage">Please build the APK first or choose a valid file.</p>
                    </div>
                </div>

                <!-- State: Success -->
                <div class="apk-report-layout" id="apkReportView" hidden>
                    <!-- Metrics Summary -->
                    <div class="apk-metrics-banner">
                        <div>
                            <span class="apk-metric-label">Package</span>
                            <strong id="apkReportFileName">&mdash;</strong>
                        </div>
                        <div>
                            <span class="apk-metric-label">Download Size</span>
                            <strong id="apkReportFileSize">&mdash;</strong>
                        </div>
                        <div>
                            <span class="apk-metric-label">Uncompressed</span>
                            <strong id="apkReportUncompressedSize">&mdash;</strong>
                        </div>
                    </div>

                    <!-- Category Breakdown Progress Bar -->
                    <div class="apk-bar-section">
                        <h4>Composition Breakdown</h4>
                        <div class="apk-composite-bar" id="apkCompositeBar"></div>
                        <div class="apk-legend-grid" id="apkLegendGrid"></div>
                    </div>

                    <!-- Largest Files Table -->
                    <div class="apk-files-section">
                        <h4>Top 25 Largest Files</h4>
                        <div class="apk-table-wrapper">
                            <table class="apk-table">
                                <thead>
                                    <tr>
                                        <th>File Path</th>
                                        <th>Category</th>
                                        <th>Size</th>
                                        <th>Compressed</th>
                                    </tr>
                                </thead>
                                <tbody id="apkTopFilesTbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- State: Initial Empty -->
                <div class="apk-state-view apk-initial-view" id="apkInitialView">
                    <i class="fas fa-box-open"></i>
                    <h3>No Package Analyzed Yet</h3>
                    <p>Select a built APK from your workspace or click Browse to inspect any APK or AAB archive.</p>
                </div>
            </div>
        </div>
    </div>
  `;
}

