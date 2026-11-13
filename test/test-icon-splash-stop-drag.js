const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getIconSplashViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/iconSplashViewHtml');

console.log('🧪 Testing gradient stop slider drag stability...');

const dom = new JSDOM(`<body>${getIconSplashViewHtml()}</body>`, { runScripts: 'outside-only' });
const { window } = dom;

// Provide a controllable requestAnimationFrame so the test can assert that rapid
// drag `input` ticks coalesce into one live-preview paint per frame (no per-event
// canvas storm), exactly as Chromium's rAF does in the Electron webview.
const pendingFrames = new Map();
let frameId = 1;
window.requestAnimationFrame = callback => {
  const id = frameId++;
  pendingFrames.set(id, callback);
  return id;
};
window.cancelAnimationFrame = id => { pendingFrames.delete(id); };
const flushAnimationFrame = () => {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  callbacks.forEach(callback => callback(typeof performance !== 'undefined' ? performance.now() : Date.now()));
};

window.eval(fs.readFileSync(path.join(__dirname, '..', 'media', 'modules', 'iconSplashModule.js'), 'utf8'));

function mixinModule(targetClass, moduleClass) {
  const proto = moduleClass.prototype || moduleClass;
  for (const prop of Object.getOwnPropertyNames(proto)) {
    if (prop !== 'constructor') targetClass.prototype[prop] = proto[prop];
  }
}
class FakeWebview {}
mixinModule(FakeWebview, window.AirFlutterIconSplashModule);

const moduleInstance = new FakeWebview();
moduleInstance.sendMessage = () => {};
moduleInstance.initIconSplash();

// Reveal the gradient editor.
const gradientMode = window.document.querySelector('input[name="iconBackgroundMode"][value="gradient"]');
gradientMode.checked = true;
gradientMode.dispatchEvent(new window.Event('change'));

const stopList = window.document.getElementById('iconGradientStopList');
assert.ok(stopList, 'stop list must exist');

moduleInstance.addGradientStop(); // three stops so ordering has a middle
const rowsBefore = [...stopList.querySelectorAll('.is-gradient-stop')];
assert.ok(rowsBefore.length >= 3, `expected multiple stop rows, got ${rowsBefore.length}`);

const targetRow = rowsBefore[1];
const slider = targetRow.querySelector('input[data-stop-field="position"]');
assert.ok(slider, 'middle row must have a position slider');

// Snapshot the DOM position of every row so we can detect re-parenting/reordering.
const orderBefore = [...stopList.querySelectorAll('.is-gradient-stop')].map(row => row.dataset.stopId);

// Model a REAL drag: the browser keeps firing `input` on the same node while the
// node stays attached and untouched. Re-parenting the row that owns the live slider
// makes the browser abort the drag, so the user perceives "the slider won't move".
// Watch only the stop list's direct children (row add/remove/re-parent).
let rowReparentedDuringDrag = false;
let detachedDuringDrag = false;
const observer = new window.MutationObserver(records => {
  for (const record of records) {
    if (record.addedNodes.length || record.removedNodes.length) rowReparentedDuringDrag = true;
  }
});
observer.observe(stopList, { childList: true });

slider.addEventListener('input', () => {
  // Runs after the module's own input handler (registered first).
  if (!slider.isConnected) detachedDuringDrag = true;
});

// Model Chromium's drag-abort trigger: assigning `.value` on a range input that is
// actively being dragged cancels the drag session. In a real webview the drag is
// "active" between pointerdown and pointerup. Any programmatic write the MODULE makes
// in that window severs the drag, so the thumb "starts then drops". The test's own
// driver writes are issued through the raw descriptor so they don't pollute the count.
const moduleValueWrites = [];
const valueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
let armed = false;
Object.defineProperty(slider, 'value', {
  configurable: true,
  get() {
    return valueDescriptor.get.call(slider);
  },
  set(next) {
    if (armed) moduleValueWrites.push(next);
    return valueDescriptor.set.call(slider, next);
  }
});
const setRawValue = value => {
  const wasArmed = armed;
  armed = false;
  valueDescriptor.set.call(slider, String(value));
  armed = wasArmed;
};

// Simulate the pointer gesture end-to-end. `pointerdown` arms the module's drag guard;
// `pointerup` releases it. `armed` for the spy spans the whole gesture, so any write
// the module commits during the drag is captured as an abort.
slider.focus();
slider.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true }));
armed = true;
const draggedValues = [];
for (let value = 30; value <= 70; value += 10) {
  setRawValue(value);
  // Force the slider's reported value to diverge from the rounded state the module
  // stores. Without the active-drag guard this is what trips the write-back and, in
  // Chromium, aborts the drag.
  const reported = value + 0.6;
  setRawValue(reported);
  slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  draggedValues.push(value);
}
// The drag is over the moment the pointer lifts; the module is allowed (and expected)
// to re-sync the slider from state then, so disarm before the `pointerup` dispatch.
armed = false;
slider.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true }));

// Flush the observer synchronously — no timers needed.
rowReparentedDuringDrag = rowReparentedDuringDrag || observer.takeRecords().some(r => r.addedNodes.length || r.removedNodes.length);
observer.disconnect();

const state = moduleInstance.iconStudioState.gradientStops;
const middleStop = state.find(stop => stop.id === targetRow.dataset.stopId);

let failed = false;
try {
  assert.strictEqual(detachedDuringDrag, false, 'dragged slider must not be detached from the DOM mid-drag');
  assert.strictEqual(rowReparentedDuringDrag, false, 'stop rows must not be added/removed/re-parented mid-drag');
  // The value the user dragged to must have landed in state (rounded to the step).
  assert.strictEqual(
    middleStop.position,
    Math.round(draggedValues[draggedValues.length - 1] + 0.6),
    'the final dragged slider value must persist in state'
  );
} catch (error) {
  failed = true;
  console.error(`  ✗ ${error.message}`);
}

// Verify the slider node identity survives the whole drag (same element, never replaced).
try {
  const sliderAfter = stopList.querySelector(`.is-gradient-stop[data-stop-id="${targetRow.dataset.stopId}"] input[data-stop-field="position"]`);
  assert.strictEqual(sliderAfter, slider, 'the exact slider element must survive the drag');
} catch (error) {
  failed = true;
  console.error(`  ✗ ${error.message}`);
}

// The dragged slider is the user's active element for the whole gesture. Any write to
// its `.value` during that window is a programmatic overwrite, which Chromium/Electron
// treats as a drag abort — the slider visibly "jumps" once and then dies.
try {
  assert.deepStrictEqual(
    moduleValueWrites,
    [],
    `the module must not write .value onto the actively-dragged slider mid-drag (saw ${JSON.stringify(moduleValueWrites)})`
  );
} catch (error) {
  failed = true;
  console.error(`  ✗ ${error.message}`);
}

// A continuous 0% -> 100% drag in one gesture must reach the far end without the
// module aborting it, and every intermediate tick must persist to state.
try {
  const fullSlider = stopList.querySelector(`.is-gradient-stop[data-stop-id="${targetRow.dataset.stopId}"] input[data-stop-field="position"]`);
  moduleInstance.beginGradientStopDrag(fullSlider);
  const ticks = [];
  for (let value = 0; value <= 100; value += 1) {
    fullSlider.value = String(value);
    fullSlider.dispatchEvent(new window.Event('input', { bubbles: true }));
    ticks.push(value);
  }
  moduleInstance.endGradientStopDrag(fullSlider);
  const draggedStop = state.find(stop => stop.id === targetRow.dataset.stopId);
  assert.strictEqual(draggedStop.position, 100, 'a single 0->100 drag must reach 100% without dropping');
  assert.strictEqual(ticks.length, 101, 'the drag must have delivered every tick from 0 to 100');
} catch (error) {
  failed = true;
  console.error(`  ✗ ${error.message}`);
}

// Live preview must update on every tick but be coalesced to one paint per animation
// frame, so a fast drag never queues a full canvas re-render per pointer event.
try {
  let renders = 0;
  const originalRender = moduleInstance.renderIconStudio.bind(moduleInstance);
  moduleInstance.renderIconStudio = () => { renders++; originalRender(); };
  const burstSlider = stopList.querySelector(`.is-gradient-stop[data-stop-id="${targetRow.dataset.stopId}"] input[data-stop-field="position"]`);
  moduleInstance.beginGradientStopDrag(burstSlider);
  const burst = 40;
  for (let i = 0; i < burst; i += 1) {
    burstSlider.value = String(20 + i);
    burstSlider.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  const beforeFlush = renders;
  flushAnimationFrame();
  const afterFlush = renders;
  moduleInstance.renderIconStudio = originalRender;
  moduleInstance.endGradientStopDrag(burstSlider);
  assert.ok(beforeFlush <= 1, `a rapid drag burst must not render synchronously per event (saw ${beforeFlush} synchronous renders)`);
  assert.ok(afterFlush - beforeFlush <= 1, `a rapid drag burst must coalesce to one paint per frame (saw ${afterFlush - beforeFlush})`);
} catch (error) {
  failed = true;
  console.error(`  ✗ ${error.message}`);
}

if (failed) {
  console.error('\n❌ gradient stop slider drag test FAILED');
  process.exit(1);
}
console.log('✅ gradient stop slider drag test passed');
