const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const sidebarHtmlSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'controllers', 'sidebar-controller', 'sidebarHtml.ts'),
  'utf8'
);
const panelHtmlSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.ts'),
  'utf8'
);

console.log('--- Phase 1: Diagnosing CSS FOUC / Delayed Activation ---');

// Check 1: In sidebarHtml, local styleUri must precede any remote external stylesheet link
const sidebarRemoteFontsMatch = sidebarHtmlSource.match(/<link[^>]*fonts\.googleapis\.com/);
const sidebarRemoteFontsPos = sidebarRemoteFontsMatch ? sidebarRemoteFontsMatch.index : -1;
const sidebarLocalStylePos = sidebarHtmlSource.indexOf('${styleUri}');

console.log(`Sidebar: remote fonts link pos = ${sidebarRemoteFontsPos}, local style pos = ${sidebarLocalStylePos}`);
const isSidebarLocalBeforeRemote = sidebarLocalStylePos < sidebarRemoteFontsPos;

// Check 2: In panelHtml, local themeUri/componentsUri must precede remote fonts/cdnjs links
const panelRemoteFontsMatch = panelHtmlSource.match(/<link[^>]*fonts\.googleapis\.com/);
const panelRemoteFontsPos = panelRemoteFontsMatch ? panelRemoteFontsMatch.index : -1;
const panelRemoteCdnjsMatch = panelHtmlSource.match(/<link[^>]*cdnjs\.cloudflare\.com/);
const panelRemoteCdnjsPos = panelRemoteCdnjsMatch ? panelRemoteCdnjsMatch.index : -1;
const panelLocalThemePos = panelHtmlSource.indexOf('${themeUri}');

console.log(`Panel: remote fonts link pos = ${panelRemoteFontsPos}, remote cdnjs pos = ${panelRemoteCdnjsPos}, local theme pos = ${panelLocalThemePos}`);
const isPanelLocalBeforeRemote = panelLocalThemePos < panelRemoteFontsPos && panelLocalThemePos < panelRemoteCdnjsPos;

// Check 3: Sidebar has anti-FOUC inline critical styling in <head>
const hasSidebarFoucGuard = /<style[^>]*>[\s\S]*?Anti-FOUC[\s\S]*?html\s*\{[\s\S]*?background:[\s\S]*?<\/style>/i.test(sidebarHtmlSource);

console.log(`Sidebar FOUC guard present: ${hasSidebarFoucGuard}`);
console.log(`Sidebar local before remote: ${isSidebarLocalBeforeRemote}`);
console.log(`Panel local before remote: ${isPanelLocalBeforeRemote}`);

// Assertion for red-capable test:
assert.ok(
  isSidebarLocalBeforeRemote,
  'FAIL: sidebarHtml.ts places remote network fonts ahead of local ${styleUri}, causing browser parser to block local styles on network latency.'
);

assert.ok(
  isPanelLocalBeforeRemote,
  'FAIL: panelHtml.ts places remote network fonts & CDNJS ahead of local stylesheets, delaying initial styling.'
);

assert.ok(
  hasSidebarFoucGuard,
  'FAIL: sidebarHtml.ts lacks anti-FOUC mechanism (inline critical style or visibility guard).'
);

console.log('PASS: All FOUC checks satisfied.');
