export function getAgentScaffoldModalHtml(): string {
  return `
        <!-- AI Agent Architect & Scaffolding Stepper Modal -->
        <div class="modal-backdrop" id="agentScaffoldModal" hidden>
            <div class="modal-card" style="max-width: 680px;">
                <div class="modal-head">
                    <h2><i class="fas fa-robot"></i> AI Agent Architect &amp; Scaffolding Engine</h2>
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
                        <span class="stepper-title">Role</span>
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
                                Next: Role Archetype <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>

                    <!-- STEP 2: Generation Mode & Role Archetype -->
                    <div class="stepper-pane" data-step="2">
                        <div class="modal-field">
                            <label>Generation Mode</label>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldGenMode" value="single" checked />
                                    <span><strong>Single Sub-Agent</strong><br/><span style="font-size: 11px; color: var(--muted);">Scaffold a single specialized agent file</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldGenMode" value="team" />
                                    <span><strong>Multi-Agent Team Workflow</strong><br/><span style="font-size: 11px; color: var(--muted);">Scaffold full SDLC team + Orchestrator</span></span>
                                </label>
                            </div>
                        </div>

                        <!-- Single Role Picker -->
                        <div id="singleRolePickerContainer" class="modal-field">
                            <label>Agent Role &amp; Archetype</label>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="planner" checked />
                                    <span><strong>Planner / Business Analyst</strong><br/><span style="font-size: 11px; color: var(--muted);">PRDs, scopes, task breakdown</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="architect" />
                                    <span><strong>Architect / System Designer</strong><br/><span style="font-size: 11px; color: var(--muted);">DB schemas, API contracts, seams</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="developer" />
                                    <span><strong>Developer / Implementer</strong><br/><span style="font-size: 11px; color: var(--muted);">Fullstack &amp; core coding</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="qa" />
                                    <span><strong>QA / Tester &amp; Reviewer</strong><br/><span style="font-size: 11px; color: var(--muted);">Tests, diff audits, edge cases</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="flutter_ui" />
                                    <span><strong>Flutter UI / Widget Specialist</strong><br/><span style="font-size: 11px; color: var(--muted);">Responsive widgets &amp; RTL</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldRole" value="flutter_state" />
                                    <span><strong>Flutter Architecture &amp; Bloc</strong><br/><span style="font-size: 11px; color: var(--muted);">Clean Arch, Cubit &amp; state flow</span></span>
                                </label>
                                <label class="modal-option-card" style="grid-column: 1 / -1;">
                                    <input type="radio" name="scaffoldRole" value="custom" />
                                    <span><strong>Custom Role</strong><br/><span style="font-size: 11px; color: var(--muted);">Define custom job title and responsibilities</span></span>
                                </label>
                            </div>

                            <div id="customRoleRow" class="modal-field" style="margin-top: 10px;" hidden>
                                <input type="text" id="customRoleNameInput" placeholder="Agent Job Title (e.g. Security Auditor Agent)" style="margin-bottom: 6px;" />
                                <input type="text" id="customRoleDescInput" placeholder="Short description of core duties..." />
                            </div>
                        </div>

                        <!-- Team Mode Multi-Role Checklist -->
                        <div id="teamRolePickerContainer" class="modal-field" hidden>
                            <label><i class="fas fa-users-gear"></i> Select Team Roles (Choose 2 or more to build your workflow chain)</label>
                            <span class="field-desc">The orchestrator will automatically chain the selected agents in sequence:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px;">
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="planner" checked />
                                    <span><strong>Planner / Business Analyst</strong><br/><span style="font-size: 11px; color: var(--muted);">PRDs &amp; task breakdown</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="architect" checked />
                                    <span><strong>Architect / System Designer</strong><br/><span style="font-size: 11px; color: var(--muted);">Schemas &amp; contracts</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="developer" checked />
                                    <span><strong>Developer / Implementer</strong><br/><span style="font-size: 11px; color: var(--muted);">Source implementation</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="qa" checked />
                                    <span><strong>QA / Tester &amp; Reviewer</strong><br/><span style="font-size: 11px; color: var(--muted);">Tests &amp; diff audit</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="flutter_ui" />
                                    <span><strong>Flutter UI Specialist</strong><br/><span style="font-size: 11px; color: var(--muted);">Widgets, layouts &amp; RTL</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="flutter_state" />
                                    <span><strong>Flutter Architecture &amp; Bloc</strong><br/><span style="font-size: 11px; color: var(--muted);">Clean Arch &amp; Cubit flow</span></span>
                                </label>
                                <label class="modal-option-card" style="grid-column: 1 / -1;">
                                    <input type="checkbox" name="scaffoldTeamRoles" value="custom" id="scaffoldTeamCustomCheckbox" />
                                    <span><strong>Custom Role Member</strong><br/><span style="font-size: 11px; color: var(--muted);">Include a custom-defined role in the workflow</span></span>
                                </label>
                            </div>

                            <div id="customTeamRoleRow" class="modal-field" style="margin-top: 10px;" hidden>
                                <input type="text" id="customTeamRoleNameInput" placeholder="Custom Agent Job Title (e.g. Security Auditor)" style="margin-bottom: 6px;" />
                                <input type="text" id="customTeamRoleDescInput" placeholder="Core duties of this custom agent..." />
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
                            <button class="btn btn-primary" type="button" data-stepper-next>Next: Tool Permissions <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <!-- STEP 4: Toolset & Access Permissions -->
                    <div class="stepper-pane" data-step="4">
                        <div class="modal-field">
                            <label>Toolset &amp; Access Permissions</label>
                            <span class="field-desc">Define what tools the generated agent is permitted to execute:</span>
                            <div class="modal-options-grid" style="grid-template-columns: 1fr; gap: 8px; margin-top: 8px;">
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldToolLevel" value="read_only" />
                                    <span><strong>Read-Only / Analysis</strong><br/><span style="font-size: 11px; color: var(--muted);"><code>read_file</code>, <code>list_dir</code>, <code>web_search</code> (Zero file write permissions)</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldToolLevel" value="standard" checked />
                                    <span><strong>Standard Engineering</strong><br/><span style="font-size: 11px; color: var(--muted);"><code>read_file</code>, <code>write_file</code>, <code>replace_file_content</code>, <code>run_tests</code></span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldToolLevel" value="full" />
                                    <span><strong>Full Orchestration &amp; Terminal</strong><br/><span style="font-size: 11px; color: var(--muted);">Full file I/O + Shell command execution (<code>execute_command</code>, <code>git_operations</code>)</span></span>
                                </label>
                                <label class="modal-option-card">
                                    <input type="radio" name="scaffoldToolLevel" value="custom" />
                                    <span><strong>Custom Tool Definition</strong><br/><span style="font-size: 11px; color: var(--muted);">Specify exact comma-separated list of tool names</span></span>
                                </label>
                            </div>
                        </div>

                        <div id="customToolsRow" class="modal-field" style="margin-top: 8px;" hidden>
                            <label>Comma-separated Tool Names</label>
                            <input type="text" id="customToolsInput" placeholder="e.g. read_file, write_file, flutter_analyze, adb_run" />
                        </div>

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

