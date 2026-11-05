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

                    <div class="modal-field workflow-layout-field" id="workflowLayoutField" hidden>
                        <div class="workflow-layout-heading">
                            <label>Workflow File Layout</label>
                            <span class="workflow-layout-badge">Both selected</span>
                        </div>
                        <span class="field-desc">Choose how APK and AAB builds are organized in GitHub Actions.</span>
                        <div class="workflow-layout-options" role="radiogroup" aria-label="Workflow file layout">
                            <label class="workflow-layout-option">
                                <input type="radio" name="workflowLayout" value="single" checked />
                                <span class="workflow-layout-copy">
                                    <strong>One coordinated workflow</strong>
                                    <small>Builds APK and AAB together in one run.</small>
                                    <code>build_android.yml</code>
                                </span>
                                <span class="workflow-layout-recommended">Recommended</span>
                            </label>
                            <label class="workflow-layout-option">
                                <input type="radio" name="workflowLayout" value="separate" />
                                <span class="workflow-layout-copy">
                                    <strong>Separate workflows</strong>
                                    <small>Run and retry APK or AAB independently.</small>
                                    <span class="workflow-file-list"><code>build_apk.yml</code><code>build_android.yml</code></span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <!-- Build Limits -->
                    <div class="modal-options-grid">
                        <div class="modal-field">
                            <label for="workflowRetentionDays">Artifact Retention (Days)</label>
                            <input type="number" id="workflowRetentionDays" value="14" min="1" step="1" />
                            <span class="field-desc">Enter any positive number of days</span>
                        </div>
                        <div class="modal-field">
                            <label for="workflowTimeoutMinutes">Job Timeout (Minutes)</label>
                            <input type="number" id="workflowTimeoutMinutes" value="60" min="1" max="360" step="1" />
                            <span class="field-desc">Cancel the build after 1–360 minutes</span>
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

                    <details class="workflow-troubleshooting" id="workflowTroubleshootingSection">
                        <summary>
                            <span><i class="fas fa-screwdriver-wrench"></i> Build Troubleshooting &amp; Resource Controls</span>
                            <span class="workflow-active-badge" id="workflowTroubleshootingBadge">3 active</span>
                        </summary>
                        <div class="workflow-troubleshooting-body">
                            <p class="workflow-troubleshooting-intro">Optional fixes for NDK/CMake errors, runner memory kills, and slow dependency downloads.</p>

                            <div class="workflow-troubleshooting-card">
                                <label class="modal-option-card">
                                    <input type="checkbox" id="workflowUsePreinstalledNdk" checked />
                                    <strong>Use preinstalled Android NDK</strong>
                                </label>
                                <p class="workflow-option-help"><strong>Use when:</strong> GitHub reports <code>requires Android NDK ...</code> and that version already exists on Ubuntu 24.04.</p>
                                <div class="modal-field" id="workflowNdkVersionField">
                                    <label for="workflowPreinstalledNdkVersion">Preinstalled NDK Version</label>
                                    <input type="text" id="workflowPreinstalledNdkVersion" value="27.3.13750724" list="workflowPreinstalledNdkVersions" />
                                    <datalist id="workflowPreinstalledNdkVersions">
                                        <option value="27.3.13750724"></option>
                                        <option value="29.0.14206865"></option>
                                        <option value="30.0.16248370"></option>
                                    </datalist>
                                    <span class="field-desc">Copy the numeric value shown after “requires Android NDK”. On failure, CI lists every NDK installed on the runner.</span>
                                </div>
                            </div>

                            <div class="workflow-troubleshooting-card">
                                <label class="modal-option-card">
                                    <input type="checkbox" id="workflowInstallAndroidTools" />
                                    <strong>Install NDK and CMake before building</strong>
                                </label>
                                <p class="workflow-option-help"><strong>Use when:</strong> the required NDK or <code>CMake 'x.y.z'</code> is not found on the runner.</p>
                                <div class="modal-options-grid" id="workflowAndroidToolsInstallFields" hidden>
                                    <div class="modal-field">
                                        <label for="workflowInstalledNdkVersion">NDK Version</label>
                                        <input type="text" id="workflowInstalledNdkVersion" value="28.2.13676358" placeholder="e.g. 28.2.13676358" />
                                        <span class="field-desc">Copy the required version from the NDK mismatch error.</span>
                                    </div>
                                    <div class="modal-field">
                                        <label for="workflowCmakeVersion">CMake Version</label>
                                        <input type="text" id="workflowCmakeVersion" value="3.22.1" placeholder="e.g. 3.22.1" />
                                        <span class="field-desc">Copy the version quoted by the CMake not-found error.</span>
                                    </div>
                                </div>
                            </div>

                            <div class="workflow-troubleshooting-card">
                                <label class="modal-option-card">
                                    <input type="checkbox" id="workflowLimitGradleMemory" />
                                    <strong>Limit Gradle memory usage</strong>
                                </label>
                                <p class="workflow-option-help"><strong>Use when:</strong> logs show <code>Killed</code>, <code>exit code 137</code>, <code>OutOfMemoryError</code>, Java heap, or Metaspace errors.</p>
                                <div id="workflowGradleMemoryFields" hidden>
                                    <div class="modal-options-grid">
                                        <div class="modal-field">
                                            <label for="workflowGradleHeapMb">Maximum Heap (MB)</label>
                                            <input type="number" id="workflowGradleHeapMb" value="2048" min="512" max="6144" step="128" />
                                            <span class="field-desc">From 512 to 6144 MB</span>
                                        </div>
                                        <div class="modal-field">
                                            <label for="workflowGradleMetaspaceMb">Maximum Metaspace (MB)</label>
                                            <input type="number" id="workflowGradleMetaspaceMb" value="512" min="256" max="2048" step="128" />
                                            <span class="field-desc">From 256 to 2048 MB</span>
                                        </div>
                                        <div class="modal-field">
                                            <label for="workflowGradleWorkers">Maximum Workers</label>
                                            <input type="number" id="workflowGradleWorkers" value="2" min="1" max="4" step="1" />
                                            <span class="field-desc">From 1 to 4 workers</span>
                                        </div>
                                    </div>
                                    <div class="modal-options-grid">
                                        <label class="modal-option-card"><input type="checkbox" id="workflowDisableGradleParallel" checked /><span>Disable parallel execution</span></label>
                                        <label class="modal-option-card"><input type="checkbox" id="workflowDisableGradleDaemon" checked /><span>Disable Gradle daemon</span></label>
                                    </div>
                                </div>
                            </div>

                            <div class="workflow-troubleshooting-card">
                                <strong class="workflow-card-title">Dependency Caching</strong>
                                <label class="modal-option-card">
                                    <input type="checkbox" id="workflowFlutterCache" checked />
                                    <span>Flutter SDK &amp; Pub Cache</span>
                                </label>
                                <div class="modal-field">
                                    <label>Gradle Cache Provider</label>
                                    <label class="modal-option-card"><input type="radio" name="workflowGradleCacheProvider" value="setup-gradle" checked /><span>Gradle Setup Cache — Recommended</span></label>
                                    <label class="modal-option-card"><input type="radio" name="workflowGradleCacheProvider" value="setup-java" /><span>Java Setup Cache</span></label>
                                    <label class="modal-option-card"><input type="radio" name="workflowGradleCacheProvider" value="none" /><span>No Gradle Cache</span></label>
                                </div>
                                <span class="field-desc">Only one Gradle cache provider is generated, preventing cache conflicts.</span>
                            </div>
                        </div>
                    </details>

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

                    <div class="modal-field">
                        <label class="modal-option-card">
                            <input type="checkbox" id="workflowPublishToReleases" />
                            <span>Publish builds to GitHub Releases with a unique tag</span>
                        </label>
                        <span class="field-desc">Attaches the APK/AAB files to a tagged release after a successful build.</span>
                    </div>

                    <div class="workflow-release-settings" id="workflowReleaseSettings" hidden>
                        <div class="workflow-layout-heading">
                            <label>Release Naming</label>
                            <span class="workflow-layout-badge">Unique tags enforced</span>
                        </div>
                        <span class="field-desc">Choose where the release name and version come from, then select or customize each template.</span>

                        <div class="modal-options-grid">
                            <div class="modal-field">
                                <label for="workflowReleaseNameSource">App Name Source</label>
                                <select id="workflowReleaseNameSource">
                                    <option value="repository" selected>Repository Name (automatic)</option>
                                    <option value="custom">Custom Name</option>
                                    <option value="manual">Manual Run Input</option>
                                </select>
                            </div>
                            <div class="modal-field" id="workflowReleaseCustomNameField" hidden>
                                <label for="workflowReleaseCustomName">Custom App Name</label>
                                <input type="text" id="workflowReleaseCustomName" placeholder="e.g. My App" />
                            </div>
                            <div class="modal-field">
                                <label for="workflowReleaseVersionSource">Version Source</label>
                                <select id="workflowReleaseVersionSource">
                                    <option value="pubspec" selected>pubspec.yaml</option>
                                    <option value="run_number">GitHub Run Number</option>
                                    <option value="custom">Fixed Version</option>
                                    <option value="manual">Manual Run Input</option>
                                </select>
                            </div>
                            <div class="modal-field" id="workflowReleaseCustomVersionField" hidden>
                                <label for="workflowReleaseCustomVersion">Fixed Version</label>
                                <input type="text" id="workflowReleaseCustomVersion" placeholder="e.g. 1.2.0+15" />
                            </div>
                        </div>

                        <div class="modal-field">
                            <label for="workflowReleaseNameTemplate">Release Name Template</label>
                            <select id="workflowReleaseNameTemplate">
                                <option value="{app} v{version} (Build {run})" selected>{app} v{version} (Build {run})</option>
                                <option value="{app} - {version}">{app} - {version}</option>
                                <option value="{app} v{version}">{app} v{version}</option>
                                <option value="{app} - Build {run}">{app} - Build {run}</option>
                                <option value="{app} - {target} - {version}">{app} - {target} - {version}</option>
                                <option value="custom">Custom Template</option>
                            </select>
                            <input type="text" id="workflowReleaseNameCustomTemplate" value="{app} v{version} (Build {run})" hidden />
                        </div>

                        <div class="modal-field">
                            <label for="workflowReleaseTagTemplate">Tag Template</label>
                            <select id="workflowReleaseTagTemplate">
                                <option value="{slug}-v{version}-build-{run}-attempt-{attempt}" selected>{slug}-v{version}-build-{run}-attempt-{attempt}</option>
                                <option value="{slug}-v{version}">{slug}-v{version}</option>
                                <option value="{slug}-build-{run}">{slug}-build-{run}</option>
                                <option value="v{version}">v{version}</option>
                                <option value="custom">Custom Template</option>
                            </select>
                            <input type="text" id="workflowReleaseTagCustomTemplate" value="{slug}-v{version}-build-{run}-attempt-{attempt}" hidden />
                            <span class="field-desc">Missing {run} and {attempt} values are appended automatically to prevent duplicate tags.</span>
                        </div>

                        <div class="modal-field">
                            <label for="workflowArtifactNameTemplate">Artifact Name Template</label>
                            <select id="workflowArtifactNameTemplate">
                                <option value="{slug}-{target}-v{version}-build-{run}" selected>{slug}-{target}-v{version}-build-{run}</option>
                                <option value="{slug}-{target}-{version}">{slug}-{target}-{version}</option>
                                <option value="{slug}-{mode}-{target}-build-{run}">{slug}-{mode}-{target}-build-{run}</option>
                                <option value="custom">Custom Template</option>
                            </select>
                            <input type="text" id="workflowArtifactNameCustomTemplate" value="{slug}-{target}-v{version}-build-{run}" hidden />
                        </div>

                        <div class="workflow-release-preview" aria-live="polite">
                            <strong>Preview</strong>
                            <span>Release: <code id="workflowReleaseNamePreview"></code></span>
                            <span>Tag: <code id="workflowReleaseTagPreview"></code></span>
                            <span>Artifact: <code id="workflowArtifactNamePreview"></code></span>
                        </div>
                        <span class="field-desc">Variables: {app}, {slug}, {version}, {build}, {fullVersion}, {run}, {attempt}, {target}, {mode}, {branch}</span>
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
