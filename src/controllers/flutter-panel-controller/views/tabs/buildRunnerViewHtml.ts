export function getBuildRunnerViewHtml(): string {
  return `
    <section data-panel-view="build-runner" hidden aria-label="Build Runner Cockpit">
        <div class="br-layout">
            <div class="ff-section br-control-panel">
                <div class="ff-section-head">
                    <div>
                        <h2>Build Runner Cockpit</h2>
                        <p class="br-kicker">dart run build_runner &middot; code generation engine</p>
                    </div>
                    <div class="br-head-status">
                        <span id="brStatusBadge" class="status-badge is-disabled">IDLE</span>
                    </div>
                </div>

                <div class="br-actions-row">
                    <button class="btn btn-primary" id="brRunBuildBtn" type="button">
                        <i class="fas fa-play"></i> Run Build
                    </button>
                    <button class="btn btn-quiet" id="brRunWatchBtn" type="button">
                        <i class="fas fa-eye"></i> Watch Mode
                    </button>
                    <button class="btn btn-danger" id="brStopBtn" type="button" disabled>
                        <i class="fas fa-stop"></i> Stop
                    </button>
                    <button class="btn btn-quiet" id="brCleanCacheBtn" type="button" title="Delete .dart_tool/build cache">
                        <i class="fas fa-trash-can"></i> Clean Cache
                    </button>
                    <button class="btn btn-quiet" id="brOpenTerminalBtn" type="button" title="Run in dedicated VS Code Terminal">
                        <i class="fas fa-terminal"></i> VS Code Terminal
                    </button>
                </div>

                <div class="br-options-card">
                    <label class="br-checkbox-label">
                        <input type="checkbox" id="brDeleteConflictsCheckbox" checked>
                        <span>--delete-conflicting-outputs <em>(recommended to prevent collision errors)</em></span>
                    </label>

                    <div class="br-filter-row">
                        <label for="brFilterInput">Build Filter:</label>
                        <input id="brFilterInput" class="br-input mono" type="text" placeholder="e.g. lib/models/**.dart or package:my_app/**">
                    </div>
                </div>

                <p class="br-hint">
                    Accelerates Riverpod, Freezed, JsonSerializable, Drift and AutoRoute generation.
                    Cleaning cache fixes stale output bugs without running a slow <span class="mono">flutter clean</span>.
                </p>
            </div>

            <div class="ff-section br-terminal-section">
                <div class="ff-section-head">
                    <h2>Live Process Output</h2>
                    <div class="br-terminal-actions">
                        <button class="link-btn" id="brClearLogBtn" type="button">Clear output</button>
                    </div>
                </div>
                <div class="br-terminal-container">
                    <pre id="brOutputLog" class="br-terminal" role="log" aria-live="polite">Ready. Click "Run Build" or "Watch Mode" to start.</pre>
                </div>
            </div>
        </div>
    </section>
  `;
}

