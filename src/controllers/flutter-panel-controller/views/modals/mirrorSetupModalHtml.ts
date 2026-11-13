export function getMirrorSetupModalHtml(): string {
  return `
        <!-- Mirroring Setup Modal -->
        <div class="modal-backdrop" id="mirrorSetupModal" hidden>
            <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mirrorSetupModalTitle">
                <div class="modal-head">
                    <h2><i class="fas fa-display"></i> <span id="mirrorSetupModalTitle">Start Mirroring</span></h2>
                    <button class="modal-close" id="closeMirrorSetupModalBtn" type="button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="mirror-setup-target">Device: <strong id="mirrorSetupDeviceName"></strong></p>

                    <fieldset class="mirror-setup-group">
                        <legend>Audio route</legend>
                        <label class="mirror-setup-option">
                            <input type="radio" name="panelMirrorAudio" value="computer" checked>
                            <span><strong>Computer only</strong><small>Forwards device audio here and mutes the phone speaker (Android 11+).</small></span>
                        </label>
                        <label class="mirror-setup-option">
                            <input type="radio" name="panelMirrorAudio" value="phone">
                            <span><strong>Phone only</strong><small>No audio forwarding — the phone keeps playing.</small></span>
                        </label>
                    </fieldset>

                    <fieldset class="mirror-setup-group">
                        <legend>Performance</legend>
                        <label class="mirror-setup-option">
                            <input type="radio" name="panelMirrorProfile" value="speed">
                            <span><strong>Fast</strong><small>120 FPS · 1024 px cap · 8 Mbps</small></span>
                        </label>
                        <label class="mirror-setup-option">
                            <input type="radio" name="panelMirrorProfile" value="balanced" checked>
                            <span><strong>Balanced</strong><small>60 FPS · 1600 px cap · 8 Mbps</small></span>
                        </label>
                        <label class="mirror-setup-option">
                            <input type="radio" name="panelMirrorProfile" value="ultra">
                            <span><strong>Ultra</strong><small>Native size · 16 Mbps · up to 120 FPS*</small></span>
                        </label>
                    </fieldset>

                    <p class="mirror-setup-note">*FPS is a cap, not a guarantee — the device encoder, screen refresh rate and Wi&#8209;Fi decide what actually arrives.</p>
                </div>
                <div class="modal-foot">
                    <button class="btn btn-quiet" id="cancelMirrorSetupBtn" type="button">Cancel</button>
                    <button class="btn btn-primary" id="startMirrorSessionBtn" type="button"><i class="fas fa-play"></i> Start Mirroring</button>
                </div>
            </div>
        </div>`;
}
