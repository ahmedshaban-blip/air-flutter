export function getSigningKeyModalHtml(): string {
  return `
        <div class="modal-backdrop" id="signingKeyModal" hidden>
            <div class="modal-card signing-key-modal-card" role="dialog" aria-modal="true" aria-labelledby="signingKeyModalTitle">
                <div class="modal-head signing-key-head">
                    <div>
                        <h2 id="signingKeyModalTitle"><i class="fas fa-key"></i> Android Signing Key Studio</h2>
                        <p>Create the upload key only after every required value is ready.</p>
                    </div>
                    <button class="modal-close" id="closeSigningKeyModalBtn" type="button" aria-label="Close">&times;</button>
                </div>

                <div class="modal-body signing-key-body">
                    <div id="signingKeyFormView">
                        <div class="signing-key-intro">
                            <i class="fas fa-shield-halved" aria-hidden="true"></i>
                            <div>
                                <strong>Your passwords stay local.</strong>
                                <span>They are sent directly to Java keytool through temporary environment variables and are never written to the activity log.</span>
                            </div>
                        </div>

                        <div class="signing-key-mode" role="group" aria-label="Configuration level">
                            <button class="signing-key-mode-btn is-active" type="button" data-signing-mode="basic">
                                <i class="fas fa-bolt"></i>
                                <span><strong>Basic</strong><small>Safe defaults, fewer fields</small></span>
                            </button>
                            <button class="signing-key-mode-btn" type="button" data-signing-mode="advanced">
                                <i class="fas fa-sliders"></i>
                                <span><strong>Advanced</strong><small>Identity and cryptography controls</small></span>
                            </button>
                        </div>

                        <section class="signing-key-section" aria-labelledby="signingProjectHeading">
                            <div class="signing-key-section-head">
                                <h3 id="signingProjectHeading">Project &amp; key identity</h3>
                                <span>Saved to android/app</span>
                            </div>
                            <div class="modal-field">
                                <label for="signingKeyProjectPath">Flutter Project</label>
                                <div class="path-picker-row">
                                    <input type="text" id="signingKeyProjectPath" placeholder="Select a Flutter project…" />
                                    <button class="btn btn-quiet" id="browseSigningKeyProjectBtn" type="button"><i class="fas fa-folder-open"></i> Browse</button>
                                </div>
                            </div>
                            <div class="signing-key-grid">
                                <div class="modal-field">
                                    <label for="signingKeyFileName">Key File Name</label>
                                    <input type="text" id="signingKeyFileName" value="upload-keystore.jks" autocomplete="off" />
                                    <span class="field-desc">The .jks extension is added automatically</span>
                                </div>
                                <div class="modal-field">
                                    <label for="signingKeyAlias">Key Alias</label>
                                    <input type="text" id="signingKeyAlias" value="upload" autocomplete="off" />
                                    <span class="field-desc">Used by Gradle and GitHub Secrets</span>
                                </div>
                                <div class="modal-field signing-key-grid-wide">
                                    <label for="signingKeyFullName">Certificate Owner Name</label>
                                    <input type="text" id="signingKeyFullName" placeholder="Your name or app owner" autocomplete="name" />
                                </div>
                            </div>
                        </section>

                        <section class="signing-key-section" aria-labelledby="signingPasswordsHeading">
                            <div class="signing-key-section-head">
                                <h3 id="signingPasswordsHeading">Passwords</h3>
                                <button class="signing-key-text-action" id="toggleSigningPasswordsBtn" type="button"><i class="fas fa-eye"></i> Show</button>
                            </div>
                            <div class="signing-key-grid">
                                <div class="modal-field">
                                    <label for="signingStorePassword">Keystore Password</label>
                                    <input type="password" id="signingStorePassword" minlength="6" autocomplete="new-password" />
                                </div>
                                <div class="modal-field">
                                    <label for="signingStorePasswordConfirm">Confirm Keystore Password</label>
                                    <input type="password" id="signingStorePasswordConfirm" minlength="6" autocomplete="new-password" />
                                </div>
                            </div>
                            <label class="signing-key-check">
                                <input type="checkbox" id="signingUseSamePassword" checked />
                                <span>Use the keystore password for the key alias too</span>
                            </label>
                            <div class="signing-key-grid" id="signingKeyPasswordFields" hidden>
                                <div class="modal-field">
                                    <label for="signingAliasPassword">Key Password</label>
                                    <input type="password" id="signingAliasPassword" minlength="6" autocomplete="new-password" />
                                </div>
                                <div class="modal-field">
                                    <label for="signingAliasPasswordConfirm">Confirm Key Password</label>
                                    <input type="password" id="signingAliasPasswordConfirm" minlength="6" autocomplete="new-password" />
                                </div>
                            </div>
                        </section>

                        <section class="signing-key-section signing-key-advanced" id="signingKeyAdvancedFields" hidden aria-labelledby="signingAdvancedHeading">
                            <div class="signing-key-section-head">
                                <h3 id="signingAdvancedHeading">Certificate details</h3>
                                <span>Optional identity fields</span>
                            </div>
                            <div class="signing-key-grid">
                                <div class="modal-field"><label for="signingOrganization">Organization</label><input type="text" id="signingOrganization" autocomplete="organization" /></div>
                                <div class="modal-field"><label for="signingOrgUnit">Organizational Unit</label><input type="text" id="signingOrgUnit" placeholder="Mobile, Engineering…" /></div>
                                <div class="modal-field"><label for="signingCity">City / Locality</label><input type="text" id="signingCity" autocomplete="address-level2" /></div>
                                <div class="modal-field"><label for="signingState">State / Province</label><input type="text" id="signingState" autocomplete="address-level1" /></div>
                                <div class="modal-field"><label for="signingCountry">Country Code</label><input type="text" id="signingCountry" maxlength="2" placeholder="EG" autocomplete="country" /></div>
                                <div class="modal-field"><label for="signingValidityDays">Validity (Days)</label><input type="number" id="signingValidityDays" value="10000" min="1" step="1" /></div>
                                <div class="modal-field signing-key-grid-wide">
                                    <label for="signingKeySize">RSA Key Size</label>
                                    <select id="signingKeySize"><option value="2048" selected>2048-bit — recommended</option><option value="4096">4096-bit — stronger, slower</option></select>
                                </div>
                            </div>
                        </section>

                        <div class="signing-key-final-check">
                            <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
                            <span>The key cannot be recovered if it is lost. Back it up securely and never commit the file or passwords to Git.</span>
                        </div>
                    </div>

                    <div id="signingKeyResultView" class="signing-key-result" hidden>
                        <div class="signing-key-success-mark"><i class="fas fa-check"></i></div>
                        <div class="signing-key-result-title"><h3>Signing key created</h3><p id="signingKeyResultPath"></p></div>
                        <div class="signing-key-result-actions">
                            <button class="btn btn-primary" id="copySigningGuideBtn" type="button"><i class="fas fa-copy"></i> Copy complete guide</button>
                            <button class="btn btn-quiet" id="createAnotherSigningKeyBtn" type="button">Create another</button>
                        </div>
                        <ol class="signing-key-steps" id="signingKeyResultSteps"></ol>
                    </div>
                </div>

                <div class="modal-foot" id="signingKeyModalFoot">
                    <button class="btn btn-quiet" id="cancelSigningKeyBtn" type="button">Cancel</button>
                    <button class="btn btn-primary" id="createSigningKeyBtn" type="button"><i class="fas fa-key"></i> Create Signing Key</button>
                </div>
            </div>
        </div>`
}
