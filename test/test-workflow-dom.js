const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getWorkflowModalHtml } = require('../out/controllers/flutter-panel-controller/views/modals/workflowModalHtml');

const dom = new JSDOM(`<body>${getWorkflowModalHtml()}</body>`, { runScripts: 'outside-only' });
const { window } = dom;
window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'workflowModule.js'), 'utf8'));

const workflow = new window.AirFlutterWorkflowModule();
const messages = [];
const toasts = [];
workflow.sendMessage = (command, payload) => messages.push({ command, payload });
workflow.showToast = (message, type) => toasts.push({ message, type });
workflow.initWorkflowModal();

const byId = id => window.document.getElementById(id);
const change = element => element.dispatchEvent(new window.Event('change', { bubbles: true }));

assert.strictEqual(byId('workflowTroubleshootingSection').open, false);
assert.strictEqual(byId('workflowTroubleshootingBadge').textContent, '3 active');

byId('workflowInstallAndroidTools').checked = true;
change(byId('workflowInstallAndroidTools'));
assert.strictEqual(byId('workflowUsePreinstalledNdk').checked, false);
assert.strictEqual(byId('workflowAndroidToolsInstallFields').hidden, false);
assert.strictEqual(byId('workflowNdkVersionField').hidden, true);

byId('workflowLimitGradleMemory').checked = true;
change(byId('workflowLimitGradleMemory'));
assert.strictEqual(byId('workflowGradleMemoryFields').hidden, false);
assert.strictEqual(byId('workflowTroubleshootingBadge').textContent, '4 active');

byId('workflowProjectPathInput').value = 'C:\\fixture';
byId('workflowGradleHeapMb').value = '7000';
byId('generateWorkflowSubmitBtn').click();
assert.match(toasts.at(-1).message, /512 to 6144/);
assert.strictEqual(messages.some(message => message.command === 'generateWorkflow'), false);

byId('workflowGradleHeapMb').value = '2048';
byId('generateWorkflowSubmitBtn').click();
const request = messages.find(message => message.command === 'generateWorkflow');
assert.ok(request);
assert.strictEqual(request.payload.installAndroidTools, true);
assert.strictEqual(request.payload.usePreinstalledNdk, false);
assert.strictEqual(request.payload.gradleCacheProvider, 'setup-gradle');
assert.strictEqual(request.payload.limitGradleMemory, true);
assert.strictEqual(request.payload.gradleHeapMb, 2048);

console.log('Workflow troubleshooting DOM tests passed.');
