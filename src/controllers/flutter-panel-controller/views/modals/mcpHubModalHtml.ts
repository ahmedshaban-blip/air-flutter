/**
 * Air Flutter — MCP & AI Agent Hub modal.
 *
 * A self-contained stepper modal that mirrors the visual language of the
 * Agent Engine and Compat Doctor modals. The extension host renders this
 * markup; all state and server data arrive via postMessage from
 * `PanelMcpHandler`.
 */

export function getMcpHubModalHtml(): string {
  return `
        <!-- MCP & AI Agent Hub Stepper Modal -->
        <div class="modal-backdrop" id="mcpHubModal" hidden>
            <div class="modal-card modal-card-hub" role="dialog" aria-modal="true" aria-labelledby="mcpHubModalTitle">
                <div class="modal-head">
                    <h2 id="mcpHubModalTitle"><i class="fas fa-plug"></i> MCP &amp; AI Agent Hub</h2>
                    <button class="modal-close" id="closeMcpHubModalBtn" type="button" aria-label="Close">&times;</button>
                </div>

                <!-- Stepper Progress Bar -->
                <div class="stepper-header">
                    <div class="stepper-step is-active" data-step="1">
                        <span class="stepper-number">1</span>
                        <span class="stepper-title">Agents</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="2">
                        <span class="stepper-number">2</span>
                        <span class="stepper-title">Scope</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="3">
                        <span class="stepper-number">3</span>
                        <span class="stepper-title">Servers</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="4">
                        <span class="stepper-number">4</span>
                        <span class="stepper-title">Configure</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="5">
                        <span class="stepper-number">5</span>
                        <span class="stepper-title">Review</span>
                    </div>
                </div>

                <div class="modal-body" style="padding-top: 4px;">

                    <!-- STEP 1: Target Agents -->
                    <div class="stepper-pane is-active" data-step="1">
                        <div class="modal-field">
                            <label>Target AI Agent(s)</label>
                            <span class="field-desc">Choose native agents, SDK code templates, or setup guides.</span>
                            <div class="mcp-agent-list" id="mcpAgentList" role="group" aria-label="Target AI agents">
                                <p class="mcp-loading">Loading agents…</p>
                            </div>
                        </div>
                    </div>

                    <!-- STEP 2: Scope -->
                    <div class="stepper-pane" data-step="2">
                        <div class="modal-field">
                            <label>Installation Scope</label>
                            <span class="field-desc">Only scopes supported by every selected integration remain enabled.</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="mcpScope" value="workspace" checked />
                                    <span><strong>Project level (workspace)</strong> — write config into the current workspace folder</span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="mcpScope" value="global" />
                                    <span><strong>Global level (user / machine)</strong> — applies to every project on this machine</span>
                                </label>
                            </div>
                            <p class="field-desc" id="mcpScopeNote" style="margin-top: 10px;"></p>
                        </div>
                    </div>

                    <!-- STEP 3: Servers -->
                    <div class="stepper-pane" data-step="3">
                        <div class="modal-field">
                            <div class="mcp-servers-toolbar">
                                <label>MCP Servers</label>
                                <div class="mcp-toolbar-actions">
                                    <button class="link-btn" type="button" id="mcpSelectAllBtn">Select all</button>
                                    <button class="link-btn" type="button" id="mcpClearAllBtn">Clear</button>
                                </div>
                            </div>
                            <span class="field-desc">Pick any number of servers. Secrets are collected in the next step.</span>
                            <input type="text" id="mcpServerSearch" class="mcp-search" placeholder="Filter servers by name…" />
                            <div class="mcp-server-list" id="mcpServerList" role="group" aria-label="MCP servers">
                                <p class="mcp-loading">Loading catalog…</p>
                            </div>
                        </div>
                    </div>

                    <!-- STEP 4: Configure parameters + instructions -->
                    <div class="stepper-pane" data-step="4">
                        <div class="modal-field">
                            <label>Configure Selected Servers</label>
                            <span class="field-desc">
                                Values are written into native configs or generated integration artifacts. Leave a field empty to omit it.
                            </span>
                            <div class="mcp-config-list" id="mcpConfigList"></div>
                        </div>
                    </div>

                    <!-- STEP 5: Review -->
                    <div class="stepper-pane" data-step="5">
                        <div class="modal-field">
                            <label>Review &amp; Write</label>
                            <span class="field-desc">Native configs, code templates, or setup guides will be created or updated.</span>
                            <div class="mcp-review" id="mcpReview"></div>
                            <div class="mcp-prereq" id="mcpPrereqResult" hidden></div>
                        </div>
                    </div>

                </div>

                <div class="modal-foot mcp-foot">
                    <button class="btn btn-quiet" id="mcpPrevBtn" type="button" hidden>
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <span class="mcp-foot-spacer"></span>
                    <span class="mcp-step-hint" id="mcpStepHint"></span>
                    <button class="btn btn-quiet" id="mcpCancelBtn" type="button">Cancel</button>
                    <button class="btn btn-quiet" id="mcpCheckPrereqBtn" type="button" hidden>
                        <i class="fas fa-stethoscope"></i> Check prerequisites
                    </button>
                    <button class="btn" id="mcpNextBtn" type="button">
                        Next <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Companion package setup guide (nested modal) -->
        <div class="modal-backdrop mcp-guide-backdrop" id="mcpCompanionGuide" hidden>
            <div class="modal-card modal-card-hub-guide" role="dialog" aria-modal="true" aria-labelledby="mcpGuideTitle">
                <div class="modal-head">
                    <h2><i class="fas fa-book"></i> <span id="mcpGuideTitle">Setup guide</span></h2>
                    <button class="modal-close" id="closeMcpGuideBtn" type="button" aria-label="Close">&times;</button>
                </div>

                <div class="modal-body" style="padding-top: 4px;">
                    <div class="mcp-guide-status" id="mcpGuideStatus"></div>

                    <div class="mcp-guide-step">
                        <p class="mcp-guide-step-title"><span class="mcp-guide-num">1</span> Add the package</p>
                        <p class="mcp-guide-desc">Run this in your Flutter project. It also detects the dependency automatically if it is already present.</p>
                        <div class="mcp-code-block">
                            <code id="mcpGuideAddCmd"></code>
                            <button class="link-btn mcp-copy-btn" type="button" data-copy-target="mcpGuideAddCmd">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>

                    <div class="mcp-guide-step">
                        <p class="mcp-guide-step-title"><span class="mcp-guide-num">2</span> Initialise the binding in <code>main()</code></p>
                        <p class="mcp-guide-desc">
                            This activates the VM Service extension. The <code>kDebugMode</code> guard keeps it out of release builds.
                        </p>
                        <div class="mcp-code-block mcp-code-block-tall">
                            <pre id="mcpGuideSnippet"></pre>
                            <button class="link-btn mcp-copy-btn" type="button" data-copy-target="mcpGuideSnippet">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                        <p class="mcp-guide-note" id="mcpGuideImportNote"></p>
                    </div>

                    <div class="mcp-guide-step">
                        <p class="mcp-guide-step-title"><span class="mcp-guide-num">3</span> Full checklist</p>
                        <ol class="mcp-guide-steps" id="mcpGuideSteps"></ol>
                    </div>

                    <div class="mcp-guide-actions">
                        <button class="btn btn-quiet" type="button" id="mcpGuideFileBtn">
                            <i class="fas fa-file-lines"></i> Save as Markdown
                        </button>
                        <span class="mcp-foot-spacer"></span>
                        <button class="btn" type="button" id="mcpGuideInstallBtn">
                            <i class="fas fa-wand-magic-sparkles"></i> Add package &amp; wire main.dart
                        </button>
                    </div>
                </div>
            </div>
        </div>
`;
}
