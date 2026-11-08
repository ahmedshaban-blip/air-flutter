const assert = require('assert');
const fs = require('fs');
const path = require('path');

const themeCss = fs.readFileSync(path.join(__dirname, '..', 'media', 'css', 'theme.css'), 'utf8');
const assetCss = fs.readFileSync(path.join(__dirname, '..', 'media', 'css', 'asset-assistant.css'), 'utf8');

// Test 1: theme.css must declare color-scheme: dark on body.dark-mode
// so Chromium renders native select dropdown popups with dark background on Windows/macOS.
const hasDarkColorScheme = /body\.dark-mode\s*\{[^}]*color-scheme:\s*dark/i.test(themeCss);
assert.strictEqual(
  hasDarkColorScheme,
  true,
  'theme.css must declare color-scheme: dark on body.dark-mode to fix light dropdown popups in dark mode'
);

// Test 2: asset-assistant.css must style .asset-sort-select option with explicit background and color
const hasSortOptionStyle = /\.asset-sort-select\s+option\s*\{[^}]*background[^}]*color/i.test(assetCss)
  || /select\s*,\s*option\s*\{[^}]*background[^}]*color/i.test(themeCss);
assert.strictEqual(
  hasSortOptionStyle,
  true,
  'CSS must explicitly set background and color on select options so text is legible'
);

// Test 3: .asset-sort-select should use var(--surface) rather than undefined var(--bg-alt)
const hasUndefinedBgAlt = /\.asset-sort-select\s*\{[^}]*var\(--bg-alt/i.test(assetCss);
assert.strictEqual(
  hasUndefinedBgAlt,
  false,
  '.asset-sort-select should not use undefined --bg-alt token'
);

console.log('All sort dropdown CSS tests passed!');

