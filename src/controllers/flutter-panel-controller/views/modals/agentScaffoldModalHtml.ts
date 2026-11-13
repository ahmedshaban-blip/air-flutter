export function getAgentScaffoldModalHtml(): string {
  return `
        <!-- AI Agent Architect & Scaffolding Stepper Modal -->
        <div class="modal-backdrop" id="agentScaffoldModal" hidden>
            <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="agentScaffoldModalTitle" style="max-width: 760px;">
                <div class="modal-head">
                    <h2 id="agentScaffoldModalTitle"><i class="fas fa-robot"></i> AI Agent Architect &amp; Scaffolding Engine</h2>
                    <button class="modal-close" id="closeAgentScaffoldModalBtn" type="button" aria-label="Close">&times;</button>
                </div>

                <!-- Stepper Progress Bar -->
                <div class="stepper-header">
                    <div class="stepper-step is-active" data-step="1">
                        <span class="stepper-number">1</span>
                        <span class="stepper-title">Scope</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="2">
                        <span class="stepper-number">2</span>
                        <span class="stepper-title">Roles &amp; Pipeline</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="3">
                        <span class="stepper-number">3</span>
                        <span class="stepper-title">Framework</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="4">
                        <span class="stepper-number">4</span>
                        <span class="stepper-title">Tools</span>
                    </div>
                    <div class="stepper-divider"></div>
                    <div class="stepper-step" data-step="5">
                        <span class="stepper-number">5</span>
                        <span class="stepper-title">Mode</span>
                    </div>
                </div>

                <div class="modal-body" style="padding-top: 4px;">
                    <!-- STEP 1: Target Location & Scope -->
                    <div class="stepper-pane is-active" data-step="1">
                        <div class="modal-field">
                            <label>Target Location &amp; Scope</label>
                            <span class="field-desc">Where should the agent specifications be scaffolded?</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldLocation" value="workspace" checked />
                                    <span><strong>Current Project Workspace</strong> (Scaffold into <code>./.agents/agents/</code> in the active project)</span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldLocation" value="external" />
                                    <span><strong>External Project Directory</strong> (Specify an absolute path to another project on your machine)</span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldLocation" value="global" />
                                    <span><strong>Global Machine Scope</strong> (Scaffold into <code>~/.gemini/config/agents/</code> for system-wide Antigravity discovery)</span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldLocation" value="custom" />
                                    <span><strong>Custom Target Directory Path</strong></span>
                                </label>
                            </div>
                        </div>

                        <div class="modal-field" id="scaffoldExternalPathRow" hidden>
                            <label>Directory Path</label>
                            <div class="path-picker-row">
                                <input type="text" id="scaffoldExternalPathInput" placeholder="e.g. C:\\Projects\\MyProject or D:\\Workspace" />
                                <button class="btn btn-quiet" id="browseScaffoldProjectBtn" type="button">
                                    <i class="fas fa-folder-open"></i> Browse
                                </button>
                            </div>
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" id="cancelAgentScaffoldModalBtn" type="button">Cancel</button>
                            <button class="btn btn-primary" type="button" data-stepper-next>
                                Next: Roles &amp; Pipeline <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>

                    <!-- STEP 2: Generation Mode, Role Archetype & Pipeline Ordering -->
                    <div class="stepper-pane" data-step="2">
                        <!-- Mode Selector: Segmented Control -->
                        <div class="modal-field" style="margin-bottom: 12px;">
                            <label>Generation Architecture</label>
                            <div class="segmented-control" id="genModeSegmentedControl">
                                <button type="button" class="segmented-btn is-active" data-mode="single">
                                    <i class="fas fa-user-ninja"></i> Single Sub-Agent
                                </button>
                                <button type="button" class="segmented-btn" data-mode="team">
                                    <i class="fas fa-users-gear"></i> Multi-Agent Team Pipeline
                                </button>
                            </div>
                            <!-- Hidden input to preserve compatibility -->
                            <input type="hidden" name="scaffoldGenMode" id="scaffoldGenModeInput" value="single" />
                        </div>

                        <!-- SECTION A: Single Role Picker -->
                        <div id="singleRolePickerContainer" class="modal-field">
                            <label>Select Agent Archetype</label>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="planner" checked />
                                    <span><strong>Planner / Analyst</strong><br/><span style="font-size: 11px; color: var(--muted);">PRDs, scopes, task breakdown</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="architect" />
                                    <span><strong>System Architect</strong><br/><span style="font-size: 11px; color: var(--muted);">Schemas, API contracts, seams</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="developer" />
                                    <span><strong>Developer / Coder</strong><br/><span style="font-size: 11px; color: var(--muted);">Fullstack &amp; core coding</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="qa" />
                                    <span><strong>QA &amp; Code Reviewer</strong><br/><span style="font-size: 11px; color: var(--muted);">Unit/widget tests, edge cases</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="flutter_ui" />
                                    <span><strong>Flutter UI Specialist</strong><br/><span style="font-size: 11px; color: var(--muted);">Responsive widgets &amp; RTL</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="flutter_state" />
                                    <span><strong>Flutter Architecture &amp; Bloc</strong><br/><span style="font-size: 11px; color: var(--muted);">Clean Arch, Cubit flow</span></span>
                                </label>
                                <label class="modal-option-card" style="grid-column: 1 / -1;">
                                    <input type="radio" name="scaffoldRole" value="custom" />
                                    <span><strong><i class="fas fa-sliders"></i> Custom Domain Agent</strong><br/><span style="font-size: 11px; color: var(--muted);">Design bespoke agent specifications from scratch</span></span>
                                </label>
                            </div>
                        </div>

                        <!-- SECTION B: Team Mode Role Checklist & Pipeline Ordering -->
                        <div id="teamRolePickerContainer" class="modal-field" hidden>
                            <label><i class="fas fa-users-gear"></i> Include Roles in Team Pipeline</label>
                            <span class="field-desc">Toggle the agents participating in this workflow:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px;">
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="planner" checked />
                                    <span><strong>Planner / Analyst</strong></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="architect" checked />
                                    <span><strong>System Architect</strong></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="developer" checked />
                                    <span><strong>Developer / Coder</strong></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="qa" checked />
                                    <span><strong>QA &amp; Code Reviewer</strong></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="flutter_ui" />
                                    <span><strong>Flutter UI Specialist</strong></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="flutter_state" />
                                    <span><strong>Flutter Bloc Specialist</strong></span>
                                </label>
                                <label class="modal-option-card" style="grid-column: 1 / -1;">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="custom" id="scaffoldTeamCustomCheckbox" />
                                    <span><strong>Custom Role Member</strong></span>
                                </label>
                            </div>

                            <!-- Interactive Pipeline Ordering Card -->
                            <div class="pipeline-order-container" style="margin-top: 14px;">
                                <div class="pipeline-header">
                                    <span class="pipeline-title"><i class="fas fa-route"></i> Orchestrator Pipeline Sequence</span>
                                    <span class="pipeline-subtitle">Arrange stage order with Up/Down buttons. Orchestrator executes subagents in this exact sequence:</span>
                                </div>
                                <div id="pipelineOrderList" class="pipeline-list">
                                    <!-- Populated dynamically via JavaScript -->
                                </div>
                                <div class="pipeline-flow-preview" id="pipelineFlowPreview">
                                    <!-- e.g. Planner ➔ Architect ➔ Developer ➔ QA -->
                                </div>
                            </div>
                        </div>

                        <!-- SECTION C: Detailed Custom Agent Builder (Accordion) -->
                        <div id="customAgentBuilderSection" class="custom-builder-container" hidden>
                            <div class="custom-builder-header">
                                <h4><i class="fas fa-wand-magic-sparkles"></i> Custom Agent Specification Builder</h4>
                                <span class="custom-builder-subtitle">Define all parameters and constraints for your custom agent:</span>
                            </div>

                            <!-- Accordion 1: Identity & Model -->
                            <div class="accordion-item is-open" data-acc="1">
                                <button type="button" class="accordion-head">
                                    <span><i class="fas fa-id-badge"></i> 1. Identity &amp; Target Model</span>
                                    <i class="fas fa-chevron-down accordion-icon"></i>
                                </button>
                                <div class="accordion-body">
                                    <div class="form-row">
                                        <div class="form-group" style="flex: 2;">
                                            <label>Agent Title / Name</label>
                                            <input type="text" id="customRoleNameInput" placeholder="e.g. Security Auditor Agent" />
                                        </div>
                                        <div class="form-group" style="flex: 1;">
                                            <label>Target LLM Model</label>
                                            <select id="customRoleModelSelect">
                                                <option value="inherit" selected>inherit (Parent)</option>
                                                <option value="Gemini 1.5 Pro">Gemini 1.5 Pro</option>
                                                <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                                                <option value="GPT-4o">GPT-4o</option>
                                                <option value="flash">flash (Fast Tier)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="form-group" style="margin-top: 6px;">
                                        <label>Core Purpose &amp; Mission</label>
                                        <input type="text" id="customRoleDescInput" placeholder="e.g. Performs security vulnerability scans and audits API authentication." />
                                    </div>
                                </div>
                            </div>

                            <!-- Accordion 2: Operational Loop & Artifacts -->
                            <div class="accordion-item" data-acc="2">
                                <button type="button" class="accordion-head">
                                    <span><i class="fas fa-arrows-spin"></i> 2. Operational Loop &amp; Artifacts</span>
                                    <i class="fas fa-chevron-down accordion-icon"></i>
                                </button>
                                <div class="accordion-body">
                                    <div class="form-group">
                                        <label>System Prompt (Directive Instructions)</label>
                                        <textarea id="customRolePromptInput" rows="3" placeholder="You are the Lead Security Auditor. Inspect source code for OWASP vulnerabilities and unvalidated inputs..."></textarea>
                                    </div>
                                    <div class="form-row" style="margin-top: 6px;">
                                        <div class="form-group" style="flex: 1;">
                                            <label>Input Artifacts / Schemas</label>
                                            <input type="text" id="customRoleInputsInput" placeholder="e.g. Pull request diffs, security policy docs" />
                                        </div>
                                        <div class="form-group" style="flex: 1;">
                                            <label>Handoff Deliverables</label>
                                            <input type="text" id="customRoleHandoffInput" placeholder="e.g. Signed Security Audit Report in markdown" />
                                        </div>
                                    </div>
                                    <div class="form-group" style="margin-top: 6px;">
                                        <label>Processing Steps</label>
                                        <input type="text" id="customRoleProcessingInput" placeholder="e.g. 1. Run SAST audit; 2. Inspect authentication flows; 3. Generate remediation report." />
                                    </div>
                                </div>
                            </div>

                            <!-- Accordion 3: Rules & Verification Gate -->
                            <div class="accordion-item" data-acc="3">
                                <button type="button" class="accordion-head">
                                    <span><i class="fas fa-shield-check"></i> 3. Rules &amp; Verification Gate</span>
                                    <i class="fas fa-chevron-down accordion-icon"></i>
                                </button>
                                <div class="accordion-body">
                                    <div class="form-group">
                                        <label>Operational Rules &amp; Negative Constraints (One per line)</label>
                                        <textarea id="customRoleRulesInput" rows="2" placeholder="Never expose API secrets or hardcoded tokens.&#10;Flag any unencrypted network endpoints immediately."></textarea>
                                    </div>
                                    <div class="form-group" style="margin-top: 6px;">
                                        <label>Verification Gate (Pre-completion check)</label>
                                        <input type="text" id="customRoleVerificationInput" placeholder="e.g. Verify zero high-severity vulnerabilities before greenlighting handoff." />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" type="button" data-stepper-back><i class="fas fa-arrow-left"></i> Back</button>
                            <button class="btn btn-primary" type="button" data-stepper-next>Next: Framework <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 3: Target Framework -->
                    <div class="stepper-pane" data-step="3">
                        <div class="modal-field">
                            <label>Target Agent Framework</label>
                            <span class="field-desc">Select orchestrator format compatibility:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldFramework" value="antigravity" checked />
                                    <span><strong>Antigravity Markdown (.agent.md)</strong> [Default]<br/><span style="font-size: 11px; color: var(--muted);">Directly compatible with Antigravity CLI, IDE Subagents, and AI coding assistants</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldFramework" value="herdr" />
                                    <span><strong>Herdr Framework (YAML &amp; Sequential Pipeline)</strong><br/><span style="font-size: 11px; color: var(--muted);">Includes <code>herdr.yaml</code> orchestration file with handoff stages</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldFramework" value="crewai" />
                                    <span><strong>CrewAI (Python Agents &amp; Sequential Process)</strong><br/><span style="font-size: 11px; color: var(--muted);">Generates runnable <code>crew.py</code> with Agent, Task, and Process definitions</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldFramework" value="generic" />
                                    <span><strong>Generic Custom Agent Loop</strong><br/><span style="font-size: 11px; color: var(--muted);">Standardized markdown specifications for custom autonomous agent loops</span></span>
                                </label>
                            </div>
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" type="button" data-stepper-back><i class="fas fa-arrow-left"></i> Back</button>
                            <button class="btn btn-primary" type="button" data-stepper-next>Next: Tools <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 4: Per-Agent Tools Selection -->
                    <div class="stepper-pane" data-step="4">
                        <div class="modal-field">
                            <div class="tools-step-header">
                                <div>
                                    <label><i class="fas fa-toolbox"></i> Tools &amp; Capabilities Configuration</label>
                                    <span class="field-desc" id="toolsStepSubtitle">Select tools permitted for each agent:</span>
                                </div>
                                <button type="button" class="btn btn-quiet btn-sm" id="resetRoleToolsBtn">
                                    <i class="fas fa-rotate-left"></i> Reset to Recommended
                                </button>
                            </div>

                            <!-- Team Mode Agent Tabs -->
                            <div id="toolsAgentTabBar" class="tool-agent-tabs" hidden>
                                <!-- Injected dynamically: [Planner] [Architect] [Developer] [QA] -->
                            </div>

                            <!-- Granular Categorized Antigravity Tools Checklist -->
                            <div class="tool-groups-container" id="toolGroupsContainer">
                                <!-- File Operations -->
                                <div class="tool-group-card">
                                    <div class="tool-group-title"><i class="fas fa-folder-tree"></i> File Operations</div>
                                    <div class="tool-checkbox-grid">
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="read_file" checked />
                                            <span><code>read_file</code><br/><small>Read file contents</small></span>
                                        </label>
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="write_file" checked />
                                            <span><code>write_file</code><br/><small>Create / overwrite</small></span>
                                        </label>
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="replace_file_content" checked />
                                            <span><code>replace_file_content</code><br/><small>Targeted edit</small></span>
                                        </label>
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="list_dir" checked />
                                            <span><code>list_dir</code><br/><small>List directories</small></span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Search & Discovery -->
                                <div class="tool-group-card">
                                    <div class="tool-group-title"><i class="fas fa-magnifying-glass"></i> Search &amp; Discovery</div>
                                    <div class="tool-checkbox-grid">
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="grep_search" checked />
                                            <span><code>grep_search</code><br/><small>Regex / code search</small></span>
                                        </label>
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="find_by_name" checked />
                                            <span><code>find_by_name</code><br/><small>Find files by pattern</small></span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Execution & Terminal -->
                                <div class="tool-group-card">
                                    <div class="tool-group-title"><i class="fas fa-terminal"></i> Terminal &amp; Execution</div>
                                    <div class="tool-checkbox-grid">
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="run_command" checked />
                                            <span><code>run_command</code><br/><small>Shell, test, build, lint</small></span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Web & Browser -->
                                <div class="tool-group-card">
                                    <div class="tool-group-title"><i class="fas fa-globe"></i> Web &amp; Documentation</div>
                                    <div class="tool-checkbox-grid">
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="search_web" />
                                            <span><code>search_web</code><br/><small>Search live internet</small></span>
                                        </label>
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="read_url_content" />
                                            <span><code>read_url_content</code><br/><small>Fetch online docs</small></span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Subagent Orchestration -->
                                <div class="tool-group-card" id="orchestrationToolGroup" style="opacity: 0.85;">
                                    <div class="tool-group-title"><i class="fas fa-network-wired"></i> Subagent Orchestration <small>(Orchestrators only)</small></div>
                                    <div class="tool-checkbox-grid">
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="invoke_subagent" />
                                            <span><code>invoke_subagent</code><br/><small>Spawn subagents</small></span>
                                        </label>
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="send_message" />
                                            <span><code>send_message</code><br/><small>Inter-agent messaging</small></span>
                                        </label>
                                        <label class="tool-checkbox-item">
                                            <input type="checkbox" data-tool="manage_subagents" />
                                            <span><code>manage_subagents</code><br/><small>Monitor / cancel</small></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Hidden fields to preserve option interface -->
                        <input type="hidden" name="scaffoldToolLevel" value="standard" />
                        <input type="hidden" id="customToolsInput" value="" />

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" type="button" data-stepper-back><i class="fas fa-arrow-left"></i> Back</button>
                            <button class="btn btn-primary" type="button" data-stepper-next>Next: Content Mode <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 5: Content Scaffolding Mode -->
                    <div class="stepper-pane" data-step="5">
                        <div class="modal-field">
                            <label>Content Scaffolding Mode</label>
                            <span class="field-desc">Choose how the files should be populated:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldContentMode" value="fully_populated" checked />
                                    <span><strong>Fully Populated</strong><br/><span style="font-size: 11px; color: var(--muted);">Generate complete, production-ready markdown specs with full system prompts, operational loop, handoff phases, and quality gates.</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldContentMode" value="blank_template" />
                                    <span><strong>Blank Template with Fill Prompts</strong><br/><span style="font-size: 11px; color: var(--muted);">Generate skeletal markdown structures with an embedded, ready-to-execute prompt for an LLM to populate based on project PRD.</span></span>
                                </label>
                            </div>
                        </div>

                        <div class="secrets-notice-box" style="margin-top: 14px;">
                            <h4><i class="fas fa-shield-halved"></i> Non-Destructive Scaffolding</h4>
                            <p style="margin: 0;">Existing files in the destination directory will be safely preserved and merged.</p>
                        </div>

                        <div class="stepper-nav">
                            <button class="btn btn-quiet" type="button" data-stepper-back><i class="fas fa-arrow-left"></i> Back</button>
                            <button class="btn btn-primary" id="scaffoldSubmitBtn" type="button">
                                <i class="fas fa-robot"></i> Generate Agent(s)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

