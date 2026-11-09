const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const panelHtmlPath = path.join(repoRoot, 'src', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.ts');
const panelHtmlSource = fs.readFileSync(panelHtmlPath, 'utf8');
const themeCssSource = fs.readFileSync(path.join(repoRoot, 'media', 'css', 'theme.css'), 'utf8');

console.log('--- Phase 1: Diagnosing Panel Initial FOUC / Unstyled Shell Flash ---');

// Probe 1: panelHtml <head> <style> must hide .ff-shell or body to prevent unstyled paint
const hasHeadFoucHiding = /<style>[\s\S]*?(\.ff-shell|body)[\s\S]*?(visibility:\s*hidden|opacity:\s*0)[\s\S]*?<\/style>/i.test(panelHtmlSource);
console.log(`Probe 1 - Head anti-FOUC hiding present: ${hasHeadFoucHiding}`);

// Probe 2: theme.css or components.css must declare visibility: visible and opacity: 1 on .ff-shell / body to unhide once CSS applies
const hasStylesheetUnhiding = /(\.ff-shell|body)[\s\S]*?visibility:\s*visible[\s\S]*?opacity:\s*1/i.test(themeCssSource) ||
  /(\.ff-shell|body)[\s\S]*?opacity:\s*1[\s\S]*?visibility:\s*visible/i.test(themeCssSource);
console.log(`Probe 2 - Stylesheet reveal rule present: ${hasStylesheetUnhiding}`);

// Probe 3: JSDOM simulation of pre-CSS paint
// When HTML is parsed without external stylesheets yet loaded, .ff-shell must not be visible
const dom = new JSDOM(
  `<!DOCTYPE html><html><head><style>/* extracted from panelHtml */${
    (panelHtmlSource.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1]
  }</style></head><body><div class="ff-shell"><button class="ff-tab">Workspace</button></div></body></html>`
);

const shellEl = dom.window.document.querySelector('.ff-shell');
const bodyEl = dom.window.document.body;
const computedBodyHidden = bodyEl.style.visibility === 'hidden' || /opacity:\s*0/i.test(panelHtmlSource);
const computedShellHidden = shellEl.style.visibility === 'hidden' || hasHeadFoucHiding;

console.log(`Probe 3 - Shell concealed in pre-CSS DOM: ${computedShellHidden}`);

assert.strictEqual(
  hasHeadFoucHiding,
  true,
  'FAIL: panelHtml.ts does not hide .ff-shell / body in head <style>, allowing Chromium to paint unstyled buttons before 19 IPC stylesheets resolve.'
);

assert.strictEqual(
  hasStylesheetUnhiding,
  true,
  'FAIL: theme.css does not declare rule to reveal .ff-shell / body once stylesheets are loaded.'
);

console.log('PASS: All Panel FOUC checks passed.');

