export function getLocalizationViewHtml(): string {
  return `
    <section data-panel-view="localization" hidden aria-label="ARB and Localization Studio">
        <div class="loc-layout">
            <div class="ff-section loc-head-bar">
                <div class="ff-section-head">
                    <div>
                        <h2>ARB &amp; Localization Studio</h2>
                        <p class="loc-kicker">Multi-locale matrix &middot; Missing translations auditor &middot; flutter gen-l10n</p>
                    </div>
                    <div class="loc-head-stats" id="locStatsSummary">
                        <span><strong>0</strong> keys</span>
                    </div>
                </div>

                <div class="loc-actions-bar">
                    <button class="btn btn-primary" id="locScanBtn" type="button">
                        <i class="fas fa-arrows-rotate"></i> Scan ARBs
                    </button>
                    <button class="btn btn-quiet" id="locAddKeyModalBtn" type="button">
                        <i class="fas fa-plus"></i> Add Key
                    </button>
                    <button class="btn btn-quiet" id="locCopyAiPromptBtn" type="button" title="Generate AI prompt to translate missing entries">
                        <i class="fas fa-wand-magic-sparkles"></i> Copy AI Prompt
                    </button>
                    <button class="btn btn-quiet" id="locRunGenBtn" type="button">
                        <i class="fas fa-code"></i> flutter gen-l10n
                    </button>
                    <button class="btn btn-quiet" id="locInitBtn" type="button" title="Create l10n.yaml and starter en/ar ARBs">
                        <i class="fas fa-folder-plus"></i> Init l10n
                    </button>
                </div>

                <div class="loc-filter-row">
                    <div class="loc-search-box">
                        <i class="fas fa-magnifying-glass"></i>
                        <input type="text" id="locSearchInput" placeholder="Filter by key or text...">
                    </div>
                    <label class="loc-filter-toggle">
                        <input type="checkbox" id="locMissingOnlyCheckbox">
                        <span>Show missing translations only</span>
                    </label>
                </div>
            </div>

            <div class="ff-section loc-table-section">
                <div class="loc-table-container" id="locTableContainer">
                    <p class="empty"><i class="fas fa-language"></i><span>Open this tab to scan ARB localization files.</span></p>
                </div>
            </div>

            <!-- Add Key Sub-Modal -->
            <div id="locAddKeyModal" class="asset-modal-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="locAddKeyTitle">
                <div class="asset-modal-content">
                    <div class="asset-modal-head">
                        <h3 id="locAddKeyTitle"><i class="fas fa-plus"></i> Add Localization Key</h3>
                        <button type="button" class="asset-modal-close" id="locAddKeyCloseBtn" aria-label="Close add-key dialog">&times;</button>
                    </div>
                    <div class="asset-modal-body">
                        <label class="loc-field-label">
                            <span>Key Identifier:</span>
                            <input type="text" id="locNewKeyInput" class="mono" placeholder="e.g. settingsAccountTitle">
                        </label>
                        <label class="loc-field-label">
                            <span>Description (Optional metadata):</span>
                            <input type="text" id="locNewKeyDescInput" placeholder="Context for translators">
                        </label>
                        <div id="locNewKeyInputsContainer"></div>
                    </div>
                    <div class="asset-modal-foot">
                        <button type="button" class="btn btn-quiet" id="locAddKeyCancelBtn">Cancel</button>
                        <button type="button" class="btn btn-primary" id="locAddKeySaveBtn">Save to ARBs</button>
                    </div>
                </div>
            </div>

            <!-- AI Prompt Modal -->
            <div id="locAiPromptModal" class="asset-modal-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="locAiPromptTitle">
                <div class="asset-modal-content" style="max-width: 600px;">
                    <div class="asset-modal-head">
                        <h3 id="locAiPromptTitle"><i class="fas fa-robot"></i> AI Translation Prompt</h3>
                        <button type="button" class="asset-modal-close" id="locAiPromptCloseBtn" aria-label="Close AI prompt dialog">&times;</button>
                    </div>
                    <div class="asset-modal-body">
                        <p class="asset-help">Copy this prompt into Claude, Gemini, or ChatGPT to generate translations for your missing keys:</p>
                        <textarea id="locAiPromptTextarea" class="loc-prompt-box mono" readonly rows="10"></textarea>
                    </div>
                    <div class="asset-modal-foot">
                        <button type="button" class="btn btn-quiet" id="locAiPromptDismissBtn">Close</button>
                        <button type="button" class="btn btn-primary" id="locAiPromptCopyBtn"><i class="fas fa-copy"></i> Copy Prompt</button>
                    </div>
                </div>
            </div>
        </div>
    </section>
  `;
}

