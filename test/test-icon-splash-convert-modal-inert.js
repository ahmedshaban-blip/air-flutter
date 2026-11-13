const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('🧪 convert modal vs shell-inert');

// Reproduce the REAL panel structure: the convert backdrop lives INSIDE a
// [data-panel-view] section, which is a direct child of .ff-shell — NOT a
// direct child of .ff-shell like .modal-backdrop is.
//
// Bug: markShellInert() inerted every shell child that was not itself a
// dialog, so opening the convert modal inerted its own ancestor section and
// swallowed every click inside the modal (Cancel/Confirm went dead).
const html = `
<div class="ff-shell">
  <header class="ff-masthead">Air Flutter</header>
  <nav class="ff-nav">nav</nav>
  <div data-panel-view="workspace"><button id="workspaceBtn">Workspace</button></div>
  <section data-panel-view="icon-splash">
    <div class="is-layout">
      <button id="browseLike">Browse</button>
      <div class="is-convert-backdrop" id="iconConvertModal" hidden>
        <div class="is-convert-dialog" role="dialog" aria-modal="true" aria-labelledby="iconConvertTitle">
          <h2 id="iconConvertTitle">Prepare source image</h2>
          <button id="cancelIconConvertBtn" type="button">Cancel</button>
          <button id="confirmIconConvertBtn" type="button">Convert &amp; Continue</button>
        </div>
      </div>
    </div>
  </section>
</div>`;

const dom = new JSDOM(`<body>${html}</body>`, { runScripts: 'outside-only' });
const { window } = dom;
const doc = window.document;

window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'modalControllerModule.js'), 'utf8'));
const controller = new window.AirFlutterModalController();
controller.initModalController();

const backdrop = doc.getElementById('iconConvertModal');
const section = doc.querySelector('[data-panel-view="icon-splash"]');
const workspace = doc.querySelector('[data-panel-view="workspace"]');
const masthead = doc.querySelector('.ff-masthead');

const inertAncestors = node => {
  const found = [];
  while (node && node !== doc.body) {
    if (node.hasAttribute && node.hasAttribute('inert')) found.push(node.className || node.tagName);
    node = node.parentElement;
  }
  return found;
};

let failed = false;
const check = (fn, message) => { try { fn(); } catch (error) { failed = true; console.error(`  ✗ ${message}: ${error.message}`); } };

// --- 1) Open the nested convert modal. ---
backdrop.hidden = false;

setTimeout(() => {
  check(() => assert.deepStrictEqual(inertAncestors(backdrop), [], 'open convert modal must not have an inert ancestor (clicks would be swallowed)'), 'open nested modal interactive');
  check(() => assert.strictEqual(section.hasAttribute('inert'), false, 'the section holding the OPEN modal must stay interactive'), 'open section not inert');
  check(() => assert.strictEqual(section.getAttribute('aria-hidden'), null, 'the section holding the OPEN modal must not be aria-hidden'), 'open section not aria-hidden');
  // Background shell content must still be inerted.
  check(() => assert.strictEqual(masthead.hasAttribute('inert'), true, 'background masthead must still be inerted'), 'background inerted');
  check(() => assert.strictEqual(workspace.hasAttribute('inert'), true, 'sibling tab views must still be inerted'), 'sibling inerted');

  // --- 2) Close the modal: the whole shell must be restored. ---
  backdrop.hidden = true;
  setTimeout(() => {
    check(() => assert.strictEqual(section.hasAttribute('inert'), false, 'after the only modal closes the shell must be fully restored'), 'closed section restored');
    check(() => assert.strictEqual(masthead.hasAttribute('inert'), false, 'after close the background must be restored'), 'background restored');

    if (failed) {
      console.error('\n❌ convert modal inert test FAILED');
      process.exit(1);
    }
    console.log('✅ convert modal inert test passed');
  }, 10);
}, 10);
