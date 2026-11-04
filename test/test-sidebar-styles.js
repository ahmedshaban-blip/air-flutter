const assert = require('assert');
const fs = require('fs');
const path = require('path');

const bundledCss = fs.readFileSync(path.join(__dirname, '..', 'media', 'sidebar.css'), 'utf8');
const requiredBridgeSelectors = [
  '.sf-bridge-presets {',
  '.sf-bridge-custom {',
  '.sf-bridge-active-head {',
  '.sf-bridge-rule {'
];

const requiredMirroringSelectors = [
  '.sf-mirror-setup {',
  '.sf-mirror-choice {',
  '.sf-mirror-profiles {',
  '.sf-mirror-launch {'
];

requiredBridgeSelectors.forEach(selector => {
  assert.ok(bundledCss.includes(selector), `Bundled sidebar CSS is missing ${selector}`);
});

requiredMirroringSelectors.forEach(selector => {
  assert.ok(bundledCss.includes(selector), `Bundled sidebar CSS is missing ${selector}`);
});

console.log('Sidebar style bundle tests passed.');
