export function getWorkflowModalHtml(): string {
  return `
        <!-- GitHub Actions Workflow Builder Modal -->
        <div class="modal-backdrop" id="workflowModal" hidden>
            <div class="modal-card">
                <div class="modal-head">
                    <h2><i class="fab fa-github"></i> GitHub Actions Workflow Builder</h2>
                    <button class="modal-close" id="closeWorkflowModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Project Path -->
                    <div class="modal-field">
                        <label>Target Flutter Project</label>
                        <div class="path-picker-row">
                            <input type="text" id="workflowProjectPathInput" placeholder="Select Flutter project folder..." />
                            <button class="btn btn-quiet" id="browseWorkflowProjectBtn" type="button">
                                <i class="fas fa-folder-open"></i> Browse
                            </button>
                        </div>
                        <span class="field-desc">Must contain a pubspec.yaml file</span>
                    </div>

                    <!-- Target Branch & Triggers -->
                    <div class="modal-field">
                        <label>Target Branch</label>
                        <input type="text" id="workflowBranchInput" value="main" placeholder="e.g. main, master, release/*" />
                    </div>

                    <div class="modal-field">
                        <label>Triggers</label>
                        <div class="modal-options-grid">
                            <label class="modal-option-card">
                                <input type="checkbox" id="workflowTriggerPush" checked />
                                <span>Push to branch</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="checkbox" id="workflowTriggerPr" />
                                <span>Pull Request</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="checkbox" id="workflowTriggerManual" checked />
                                <span>Manual Run (dispatch)</span>
                            </label>
                        </div>
                    </div>

                    <!-- Build Target -->
                    <div class="modal-field">
                        <label>Build Target</label>
                        <div class="modal-options-grid">
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildTarget" value="universal_apk" checked />
                                <span>Universal APK</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildTarget" value="split_apk" />
                                <span>Split-per-ABI APKs</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildTarget" value="appbundle" />
                                <span>App Bundle (AAB)</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildTarget" value="both" />
                                <span>Both (APK + AAB)</span>
                            </label>
                        </div>
                    </div>

                    <!-- Build Mode -->
                    <div class="modal-field">
                        <label>Build Mode</label>
                        <div class="modal-options-grid">
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildMode" value="release" checked />
                                <span>Release (Production)</span>
                            </label>
                            <label class="modal-option-card">
                                <input type="radio" name="workflowBuildMode" value="debug" />
                                <span>Debug (Testing)</span>
                            </label>
                        </div>
                    </div>

                    <!-- App Signing (Keystore) -->
                    <div class="modal-field">
                        <label class="modal-option-card" style="margin-top: 4px;">
                            <input type="checkbox" id="workflowEnableSigning" checked />
                            <strong>Configure App Signing (using GitHub Secrets)</strong>
                        </label>
                    </div>

                    <!-- Secrets Instructions Notice Box (shown when signing is enabled) -->
                    <div class="secrets-notice-box" id="workflowSecretsBox">
                        <h4><i class="fas fa-key"></i> Required GitHub Secrets for Signing:</h4>
                        <p style="margin: 0;">Add these 4 secrets in your GitHub Repo: <strong>Settings &gt; Secrets and variables &gt; Actions</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li><code>KEYSTORE_BASE64</code>: Base64 string of your <code>.jks</code> keystore.</li>
                            <li><code>KEYSTORE_PASSWORD</code>: Master keystore password.</li>
                            <li><code>KEY_ALIAS</code>: Key alias name (e.g. <code>upload</code>).</li>
                            <li><code>KEY_PASSWORD</code>: Private key password.</li>
                        </ul>
                        <div style="font-weight: 600; margin-top: 4px;">Convert Keystore to Base64 (Windows PowerShell):</div>
                        <div class="secrets-code-snippet">[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\\\\to\\\\your-key.jks")) | Set-Clipboard</div>
                        <span style="font-size: 11px; color: var(--muted);">A complete guide (<code>SECRETS_SETUP.md</code>) will be generated inside your <code>.github</code> folder automatically.</span>
                    </div>

                    <!-- Performance / Cache -->
                    <div class="modal-field">
                        <label class="modal-option-card">
                            <input type="checkbox" id="workflowEnableCache" checked />
                            <span>Enable Dependency Caching (Gradle &amp; Flutter Pub)</span>
                        </label>
                    </div>
                </div>
                <div class="modal-foot">
                    <button class="btn btn-quiet" id="cancelWorkflowModalBtn" type="button">Cancel</button>
                    <button class="btn btn-primary" id="generateWorkflowSubmitBtn" type="button">
                        <i class="fas fa-magic"></i> Generate Workflow
                    </button>
                </div>
            </div>
        </div>`;
}

