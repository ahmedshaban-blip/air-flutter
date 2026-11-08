const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 1. Verify theme.css rules
const themeCss = fs.readFileSync(path.join(__dirname, '..', 'media', 'css', 'theme.css'), 'utf8');

const hasHtmlDarkMode = /html\.dark-mode/i.test(themeCss);
assert.strictEqual(
  hasHtmlDarkMode,
  true,
  'media/css/theme.css must support html.dark-mode so variables apply at document root before body renders'
);

const hasBodyDarkMode = /body\.dark-mode\s*\{[^}]*color-scheme:\s*dark/i.test(themeCss);
assert.strictEqual(
  hasBodyDarkMode,
  true,
  'media/css/theme.css must maintain body.dark-mode with color-scheme: dark'
);

const hasHtmlPaperBg = /html\s*\{[^}]*background:\s*var\(--paper\)/i.test(themeCss);
assert.strictEqual(
  hasHtmlPaperBg,
  true,
  'media/css/theme.css must set background: var(--paper) on html to prevent light canvas flash'
);

// 2. Verify panelHtml.ts has inline pre-render script in <head>
const panelHtmlPath = path.join(__dirname, '..', 'src', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.ts');
const panelHtmlContent = fs.readFileSync(panelHtmlPath, 'utf8');

const headPreRenderCheck = /<head>[\s\S]*?<script>[\s\S]*?localStorage\.getItem\(['"]airFlutterDarkMode['"]\)[\s\S]*?document\.documentElement\.classList\.add\(['"]dark-mode['"]\)[\s\S]*?<\/script>/i.test(panelHtmlContent);
assert.strictEqual(
  headPreRenderCheck,
  true,
  'panelHtml.ts must include an inline script in <head> that applies dark-mode to documentElement before body paint'
);

// 3. Verify troubleshootingHtml.ts has inline pre-render script in <head>
const troubleHtmlPath = path.join(__dirname, '..', 'src', 'controllers', 'flutter-panel-controller', 'views', 'troubleshootingHtml.ts');
const troubleHtmlContent = fs.readFileSync(troubleHtmlPath, 'utf8');

const troublePreRenderCheck = /<head>[\s\S]*?<script>[\s\S]*?localStorage\.getItem\(['"]airFlutterDarkMode['"]\)[\s\S]*?document\.documentElement\.classList\.add\(['"]dark-mode['"]\)[\s\S]*?<\/script>/i.test(troubleHtmlContent);
assert.strictEqual(
  troublePreRenderCheck,
  true,
  'troubleshootingHtml.ts must include an inline script in <head> that applies dark-mode to documentElement before body paint'
);

// 4. JSDOM Behavioral Test: verify no-FOUC initialization and toggle sync
const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <script>
        (function () {
            try {
                if (localStorage.getItem('airFlutterDarkMode') === 'true') {
                    document.documentElement.classList.add('dark-mode');
                }
            } catch (e) {}
        })();
    </script>
</head>
<body>
    <button id="darkModeToggle" type="button"><i class="fas fa-moon"></i> Dark</button>
    <script>
        window.addEventListener('DOMContentLoaded', () => {
            const darkModeToggle = document.getElementById('darkModeToggle');
            const isDarkMode = localStorage.getItem('airFlutterDarkMode') === 'true';
            if (isDarkMode) {
                document.documentElement.classList.add('dark-mode');
                document.body.classList.add('dark-mode');
                if (darkModeToggle) {
                    darkModeToggle.innerHTML = '<i class="fas fa-sun"></i> Light';
                }
            }

            if (darkModeToggle) {
                darkModeToggle.addEventListener('click', function () {
                    document.documentElement.classList.toggle('dark-mode');
                    document.body.classList.toggle('dark-mode');
                    const isDark = document.documentElement.classList.contains('dark-mode');
                    localStorage.setItem('airFlutterDarkMode', isDark);
                    this.innerHTML = isDark
                        ? '<i class="fas fa-sun"></i> Light'
                        : '<i class="fas fa-moon"></i> Dark';
                });
            }
        });
    </script>
</body>
</html>`;

const dom = new JSDOM(testHtml, {
  runScripts: 'dangerously',
  url: 'https://localhost/'
});

// Case A: With airFlutterDarkMode = 'true'
dom.window.localStorage.setItem('airFlutterDarkMode', 'true');

// Re-run the inline head script to simulate pre-DOMContentLoaded execution
const headScript = dom.window.document.querySelector('head script').textContent;
dom.window.eval(headScript);

// Crucial: documentElement MUST have 'dark-mode' BEFORE DOMContentLoaded
assert.strictEqual(
  dom.window.document.documentElement.classList.contains('dark-mode'),
  true,
  'documentElement must have dark-mode immediately after <head> script runs (pre-render phase, zero FOUC)'
);

// Dispatch DOMContentLoaded on window
dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

assert.strictEqual(
  dom.window.document.body.classList.contains('dark-mode'),
  true,
  'body must also have dark-mode after DOMContentLoaded'
);

const toggleBtn = dom.window.document.getElementById('darkModeToggle');
assert.ok(toggleBtn.innerHTML.includes('Light'), 'Toggle button should indicate Light theme switch option');

// Click toggle to switch to Light mode
toggleBtn.click();
assert.strictEqual(
  dom.window.document.documentElement.classList.contains('dark-mode'),
  false,
  'documentElement should not have dark-mode after toggling off'
);
assert.strictEqual(
  dom.window.document.body.classList.contains('dark-mode'),
  false,
  'body should not have dark-mode after toggling off'
);
assert.strictEqual(
  dom.window.localStorage.getItem('airFlutterDarkMode'),
  'false',
  'localStorage should store "false"'
);
assert.ok(toggleBtn.innerHTML.includes('Dark'), 'Toggle button should indicate Dark theme switch option');

// Click toggle again to switch back to Dark mode
toggleBtn.click();
assert.strictEqual(
  dom.window.document.documentElement.classList.contains('dark-mode'),
  true,
  'documentElement should have dark-mode after toggling back on'
);
assert.strictEqual(
  dom.window.document.body.classList.contains('dark-mode'),
  true,
  'body should have dark-mode after toggling back on'
);
assert.strictEqual(
  dom.window.localStorage.getItem('airFlutterDarkMode'),
  'true',
  'localStorage should store "true"'
);

console.log('All theme FOUC and synchronization tests passed!');
