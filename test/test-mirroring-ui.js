const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const html = fs.readFileSync(
  path.join(projectRoot, 'src', 'controllers', 'sidebar-controller', 'sidebarHtml.ts'),
  'utf8'
);
const script = fs.readFileSync(path.join(projectRoot, 'media', 'sidebar.js'), 'utf8');
const panelScript = fs.readFileSync(path.join(projectRoot, 'media', 'air-flutter.js'), 'utf8');
const controller = fs.readFileSync(
  path.join(projectRoot, 'src', 'controllers', 'flutter-panel-controller', 'FlutterPanelController.ts'),
  'utf8'
);

[
  'id="mirrorSetup"',
  'name="mirrorAudio" value="computer"',
  'name="mirrorAudio" value="phone"',
  'name="mirrorProfile" value="speed"',
  'name="mirrorProfile" value="balanced"',
  'name="mirrorProfile" value="ultra"'
].forEach(contract => assert.ok(html.includes(contract), `Missing mirroring UI contract: ${contract}`));

assert.ok(script.includes("command: 'startMirror'"), 'Mirroring setup must submit to the host');
assert.ok(script.includes("command: 'toggleScreenPower'"), 'Power button must use the dynamic host action');
assert.ok(script.includes('mirroringState.isMirroring && !mirroringState.displayOff'),
  'Power label must react to active mirroring and display state');
assert.ok(panelScript.includes("data-device-action=\"${displayAction}\""),
  'Panel must render a dynamic display-power action for each mirrored device');
assert.ok(panelScript.includes("this.sendMessage('toggleMirrorDisplay', { deviceId })"),
  'Panel dynamic display button must invoke the verified host toggle');
assert.ok(panelScript.includes('this.updateMirroringState(message)'),
  'Panel must consume the complete mirroring state, not only isMirroring');
assert.ok(controller.includes("case 'toggleMirrorDisplay':"),
  'Host must handle panel display toggles');
assert.ok(controller.includes('requestedSerial !== serial'),
  'Host must reject a display toggle for a stale/non-active device row');

console.log('✅ Mirroring setup and dynamic display control UI verified');
