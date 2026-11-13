const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getIconSplashViewHtml } = require('../out/controllers/flutter-panel-controller/views/tabs/iconSplashViewHtml');

console.log('🧪 Testing Icon & Splash preview proximity (DOM)...');

const dom = new JSDOM(`<body>${getIconSplashViewHtml()}</body>`, { runScripts: 'outside-only' });
const { window } = dom;

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
const sentMessages = [];
moduleInstance.sendMessage = (command, payload) => sentMessages.push({ command, payload });
moduleInstance.initIconSplash();

const byId = id => window.document.getElementById(id);

// Phase 1 — mini live preview lives inside the adjustment card.
const adjustment = byId('iconAdjustmentSection');
assert.ok(adjustment, 'adjustment section must exist');
const miniPreview = byId('iconMiniPreview');
assert.ok(miniPreview, 'mini preview container must exist');
assert.ok(adjustment.contains(miniPreview), 'mini preview must sit inside Position & safe area card');

const miniCanvas = byId('iconMiniPreviewCanvas');
assert.ok(miniCanvas, 'mini canvas must exist');
assert.strictEqual(miniCanvas.dataset.iconPreview, 'inspection', 'mini canvas must reuse the inspection renderer');
assert.strictEqual(miniCanvas.width, 224, 'mini canvas keeps a 2x backing store');
assert.ok(miniCanvas.getAttribute('aria-label'), 'mini canvas needs an accessible label');

const miniOverlay = byId('iconMiniSafeZoneOverlay');
assert.ok(miniOverlay.classList.contains('is-safe-zone-overlay'));
assert.strictEqual(miniOverlay.dataset.safeZoneOverlay, '', 'mini overlay joins the shared safe-zone selector');

// Renderer loop must pick up the extra canvas without new JavaScript.
const previewCanvases = window.document.querySelectorAll('canvas[data-icon-preview]');
assert.strictEqual(previewCanvases.length, 9, '8 launcher cards + inspection + mini preview');

// Phase 1 — progressive disclosure keeps advanced inputs in the DOM.
const advanced = byId('iconAdvancedControls');
assert.ok(advanced, 'advanced details element must exist');
assert.strictEqual(advanced.tagName, 'DETAILS');
assert.strictEqual(advanced.open, false, 'advanced controls start collapsed');
assert.ok(advanced.querySelector('.is-advanced-body'), 'advanced body wrapper must exist');
['iconBgColorInput', 'iconBgColorText', 'iconBackgroundFileInput', 'iconBackgroundScaleInput',
  'iconBackgroundOffsetXInput', 'iconBackgroundOffsetYInput', 'iconBackgroundFitSelect',
  'iconMonochromeFileInput', 'clearIconMonochromeBtn'].forEach(id => {
  const element = byId(id);
  assert.ok(element, `${id} must remain queryable while collapsed`);
  assert.ok(advanced.contains(element), `${id} must live inside the advanced block`);
});
// Core transform controls stay outside the collapsed block.
['iconScaleInput', 'iconOffsetXInput', 'iconOffsetYInput', 'fitIconSafeZoneBtn', 'resetIconTransformBtn']
  .forEach(id => {
    assert.ok(byId(id), `${id} must exist`);
    assert.strictEqual(advanced.contains(byId(id)), false, `${id} must stay outside advanced details`);
  });

// Empty state — controls start disabled and the studio renders debug info request.
assert.strictEqual(adjustment.getAttribute('aria-disabled'), 'true');
['iconScaleInput', 'iconOffsetXInput', 'iconOffsetYInput'].forEach(id => {
  assert.strictEqual(byId(id).disabled, true, `${id} disabled before a source image exists`);
});
assert.strictEqual(byId('fitIconSafeZoneBtn').disabled, true);
assert.strictEqual(byId('resetIconTransformBtn').disabled, true);
assert.strictEqual(sentMessages[0].command, 'getIconStudioProjectInfo');

// Safe-zone toggle must drive every overlay (crop inspection + mini preview).
const safeZoneCheckbox = byId('showIconSafeZoneCheckbox');
const cropOverlay = byId('iconSafeZoneOverlay');
assert.strictEqual(safeZoneCheckbox.checked, true);
assert.strictEqual(miniOverlay.hidden, false);
assert.strictEqual(cropOverlay.hidden, false);

safeZoneCheckbox.checked = false;
safeZoneCheckbox.dispatchEvent(new window.Event('change'));
assert.strictEqual(miniOverlay.hidden, true, 'mini overlay hides with the toggle');
assert.strictEqual(cropOverlay.hidden, true, 'crop overlay hides with the toggle');

safeZoneCheckbox.checked = true;
safeZoneCheckbox.dispatchEvent(new window.Event('change'));
assert.strictEqual(miniOverlay.hidden, false);
assert.strictEqual(cropOverlay.hidden, false);

// No canvas work leaks into jsdom.
assert.strictEqual(moduleInstance.iconStudioState.foreground, null);

// Phase 2 — feedback signals.
const liveBadge = byId('iconPreviewLiveBadge');
const previewSection = window.document.querySelector('.is-preview-section');
assert.ok(liveBadge, 'live badge must exist');
assert.strictEqual(liveBadge.hidden, true, 'badge stays hidden before the first edit');
assert.ok(byId('jumpToPreviewBtn'), 'jump-to-preview control must exist');
assert.strictEqual(moduleInstance.iconStudioState.previewSignalSent, false);

moduleInstance.iconStudioState.foreground = {
  fileName: 'icon.png',
  displayName: 'icon.png',
  image: null,
  analysis: { hasTransparency: true, bounds: { left: 0.25, top: 0.25, right: 0.75, bottom: 0.75 } }
};

byId('iconScaleInput').value = '120';
byId('iconScaleInput').dispatchEvent(new window.Event('input'));

assert.strictEqual(moduleInstance.iconStudioState.scale, 120, 'slider still drives the shared transform');
assert.strictEqual(liveBadge.hidden, false, 'first edit reveals the live badge');
assert.ok(previewSection.classList.contains('is-pulsing'), 'first edit pulses the preview section');
assert.strictEqual(moduleInstance.iconStudioState.previewSignalSent, true);
assert.strictEqual(moduleInstance.iconStudioState.previewRevealDone, true, 'auto-reveal fires at most once');

byId('iconScaleInput').value = '130';
byId('iconScaleInput').dispatchEvent(new window.Event('input'));
assert.strictEqual(moduleInstance.iconStudioState.previewSignalSent, true, 'signals are one-shot per session');

// Jump control must not throw when scrollIntoView is unavailable (jsdom).
byId('jumpToPreviewBtn').click();

// Transforms coming from any path keep a single source of truth.
assert.deepStrictEqual(
  { scale: moduleInstance.iconStudioState.scale, offsetX: moduleInstance.iconStudioState.offsetX, offsetY: moduleInstance.iconStudioState.offsetY },
  { scale: 130, offsetX: 0, offsetY: 0 }
);

// Phase 3 — direct manipulation helpers (pure logic, no canvas dependency).
assert.strictEqual(moduleInstance.clampIconScale(200), 160);
assert.strictEqual(moduleInstance.clampIconScale(10), 40);
assert.strictEqual(moduleInstance.clampIconScale(100.6), 101);
assert.strictEqual(moduleInstance.clampIconOffset(80), 40);
assert.strictEqual(moduleInstance.clampIconOffset(-80), -40);

moduleInstance.iconStudioState.backgroundOffsetX = 5;
moduleInstance.applyIconTransform({ offsetX: 12, offsetY: -7 });
assert.deepStrictEqual(
  { x: moduleInstance.iconStudioState.offsetX, y: moduleInstance.iconStudioState.offsetY },
  { x: 12, y: -7 }
);
assert.strictEqual(byId('iconOffsetXInput').value, '12', 'transform writes back to the slider');
assert.strictEqual(byId('iconOffsetYOutput').textContent, '-7%');
assert.strictEqual(moduleInstance.iconStudioState.dirty, true);

moduleInstance.applyIconTransform({ scale: 999 });
assert.strictEqual(moduleInstance.iconStudioState.scale, 160, 'scale clamps to the slider ceiling');
assert.strictEqual(moduleInstance.iconStudioState.backgroundOffsetX, 5, 'drag never mutates the background layer');

// Keyboard nudge path.
const arrowEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
arrowEvent.preventDefault = () => { arrowEvent.defaultPrevented = true; };
moduleInstance.handleIconInspectionKeydown(arrowEvent);
assert.strictEqual(moduleInstance.iconStudioState.offsetX, 13, 'arrow key nudges by 1%');
moduleInstance.handleIconInspectionKeydown(arrowEvent);
assert.strictEqual(moduleInstance.iconStudioState.offsetX, 14);

// Wheel zoom only with explicit intent.
const inspectionCanvas = byId('iconInspectionCanvas');
let wheelPrevented = false;
moduleInstance.handleIconInspectionWheel(
  { ctrlKey: false, metaKey: false, deltaY: -100, preventDefault: () => { wheelPrevented = true; } },
  inspectionCanvas
);
assert.strictEqual(wheelPrevented, false, 'plain wheel must not hijack panel scrolling');
assert.strictEqual(moduleInstance.iconStudioState.scale, 160);

moduleInstance.applyIconTransform({ scale: 100 });
moduleInstance.handleIconInspectionWheel(
  { ctrlKey: true, metaKey: false, deltaY: -100, preventDefault: () => { wheelPrevented = true; } },
  inspectionCanvas
);
assert.strictEqual(wheelPrevented, true);
assert.strictEqual(moduleInstance.iconStudioState.scale, 102, 'Ctrl + wheel zooms in by 2%');

// Drag simulation (jsdom has no pointer capture API, so drive the handlers directly).
const interaction = { pointers: new Map(), drag: null, pinch: null };
const pointerEvent = (x, y, id = 1) => ({
  pointerId: id,
  pointerType: 'mouse',
  button: 0,
  clientX: x,
  clientY: y,
  preventDefault: () => {}
});

moduleInstance.iconStudioState.offsetX = 0;
moduleInstance.iconStudioState.offsetY = 0;
moduleInstance.handleIconInspectionPointerDown(pointerEvent(100, 100), inspectionCanvas, interaction);
assert.ok(inspectionCanvas.classList.contains('is-dragging'));

moduleInstance.handleIconInspectionPointerMove(pointerEvent(132, 116), inspectionCanvas, interaction);
assert.strictEqual(moduleInstance.iconStudioState.offsetX, 10, '32px of a 320px canvas = 10%');
assert.strictEqual(moduleInstance.iconStudioState.offsetY, 5);

moduleInstance.handleIconInspectionPointerMove(pointerEvent(10000, 10000), inspectionCanvas, interaction);
assert.strictEqual(moduleInstance.iconStudioState.offsetX, 40, 'drag clamps at +40%');
assert.strictEqual(moduleInstance.iconStudioState.offsetY, 40);

moduleInstance.endIconInspectionPointer(pointerEvent(10000, 10000), inspectionCanvas, interaction);
assert.strictEqual(interaction.pointers.size, 0);
assert.strictEqual(interaction.drag, null);
assert.strictEqual(inspectionCanvas.classList.contains('is-dragging'), false, 'drag state is released');

// Reset must clear any pending interaction and restore the neutral transform.
byId('resetIconTransformBtn').disabled = false;
byId('resetIconTransformBtn').click();
assert.deepStrictEqual(
  { scale: moduleInstance.iconStudioState.scale, x: moduleInstance.iconStudioState.offsetX, y: moduleInstance.iconStudioState.offsetY },
  { scale: 100, x: 0, y: 0 }
);

// The binding must not attach in environments without pointer capture (jsdom safety).
assert.strictEqual(moduleInstance.iconInspectionInteraction, undefined);

// Advanced disclosure must look and read like an accordion.
const advancedSummary = byId('iconAdvancedSummary');
assert.ok(advancedSummary, 'summary chip must exist');
assert.ok(advancedSummary.classList.contains('is-advanced-summary'));
assert.strictEqual(advancedSummary.textContent, 'Solid #FFFFFF', 'summary reflects the current background');
const chevron = window.document.querySelector('.is-advanced-chevron');
assert.ok(chevron, 'chevron marks the row as clickable');
assert.strictEqual(chevron.getAttribute('aria-hidden'), 'true');

byId('iconBgColorText').value = '#123456';
byId('iconBgColorText').dispatchEvent(new window.Event('input'));
assert.strictEqual(moduleInstance.iconStudioState.backgroundColor, '#123456');
assert.strictEqual(advancedSummary.textContent, 'Solid #123456', 'summary tracks background color edits');

const imageMode = window.document.querySelector('input[name="iconBackgroundMode"][value="image"]');
imageMode.checked = true;
imageMode.dispatchEvent(new window.Event('change'));
assert.strictEqual(advanced.open, true, 'choosing an image background opens the disclosure');
assert.strictEqual(advancedSummary.textContent, 'Image', 'summary falls back to Image before upload');

moduleInstance.iconStudioState.monochrome = { image: null, displayName: 'mono.png' };
moduleInstance.renderIconStudio();
assert.strictEqual(advancedSummary.textContent, 'Image · monochrome');

// Phase 4 — gradient adaptive background (CSS-equivalent angle math, stop editor).
assert.strictEqual(byId('iconGradientControls').hidden, true, 'gradient editor starts hidden in solid mode');
const gradientMode = window.document.querySelector('input[name="iconBackgroundMode"][value="gradient"]');
gradientMode.checked = true;
gradientMode.dispatchEvent(new window.Event('change'));
assert.strictEqual(byId('iconGradientControls').hidden, false, 'gradient editor reveals with the radio');
assert.strictEqual(byId('iconBackgroundImageControls').hidden, true, 'image controls hide in gradient mode');

// Pure geometry — the jsdom harness never reaches canvas drawing, so assert the math directly.
// `+0` normalizes IEEE -0 so strict equality comparisons stay meaningful.
const num = value => Math.round(value) + 0;
const ends180 = moduleInstance.computeGradientEndpoints(180, 100);
assert.strictEqual(num(ends180.x0), 50);
assert.strictEqual(num(ends180.y0), 0, '180deg runs top -> bottom');
assert.strictEqual(num(ends180.x1), 50);
assert.strictEqual(num(ends180.y1), 100);
const ends0 = moduleInstance.computeGradientEndpoints(0, 100);
assert.strictEqual(num(ends0.y0), 100, '0deg runs bottom -> top');
assert.strictEqual(num(ends0.y1), 0);
const ends90 = moduleInstance.computeGradientEndpoints(90, 100);
assert.strictEqual(num(ends90.x0), 0, '90deg runs left -> right');
assert.strictEqual(num(ends90.x1), 100);
assert.strictEqual(num(ends90.y0), 50);

// Angle wraps rather than escaping the 0-359 range.
assert.strictEqual(moduleInstance.clampGradientAngle(360), 0);
assert.strictEqual(moduleInstance.clampGradientAngle(-90), 270);
assert.strictEqual(moduleInstance.clampGradientAngle('abc'), 0);
assert.strictEqual(moduleInstance.clampGradientPosition(150), 100);
assert.strictEqual(moduleInstance.clampGradientPosition(-20), 0);

// Default state ships two stops and the documented 180deg angle.
assert.strictEqual(moduleInstance.iconStudioState.gradientStops.length, 2);
assert.strictEqual(moduleInstance.iconStudioState.gradientAngle, 180);
assert.strictEqual(byId('iconGradientAngleOutput').textContent, '180°');

// Angle controls write back through both the slider and the text field.
byId('iconGradientAngleInput').value = '135';
byId('iconGradientAngleInput').dispatchEvent(new window.Event('input'));
assert.strictEqual(moduleInstance.iconStudioState.gradientAngle, 135);
assert.strictEqual(byId('iconGradientAngleText').value, '135', 'slider syncs the text field');
assert.strictEqual(byId('iconGradientAngleOutput').textContent, '135°');
byId('iconGradientAngleText').value = '405';
byId('iconGradientAngleText').dispatchEvent(new window.Event('input'));
assert.strictEqual(moduleInstance.iconStudioState.gradientAngle, 45, 'text field wraps out-of-range angles');

// Stop rows reconcile by id.
const stopList = byId('iconGradientStopList');
assert.strictEqual(stopList.querySelectorAll('.is-gradient-stop').length, 2, 'two stop rows render');
moduleInstance.addGradientStop();
moduleInstance.addGradientStop();
assert.strictEqual(moduleInstance.iconStudioState.gradientStops.length, 4);
assert.strictEqual(stopList.querySelectorAll('.is-gradient-stop').length, 4, 'rows appear without a rebuild');
assert.strictEqual(
  stopList.querySelectorAll('.is-gradient-stop')[0].dataset.stopId,
  'stop-1',
  'insertion order is preserved'
);

// Reordering is expressed by list order, and the ends cannot move further.
moduleInstance.moveGradientStop('stop-4', -1);
// JSDOM arrays come from another realm, so compare a plain string rather than deepStrictEqual.
assert.strictEqual(
  moduleInstance.iconStudioState.gradientStops.map(stop => stop.id).join(','),
  'stop-1,stop-2,stop-4,stop-3'
);
const rows = stopList.querySelectorAll('.is-gradient-stop');
assert.strictEqual(rows[0].querySelector('.is-gradient-stop-up').disabled, true, 'first row cannot move up');
assert.strictEqual(
  stopList.querySelectorAll('.is-gradient-stop')[3].querySelector('.is-gradient-stop-down').disabled,
  true,
  'last row cannot move down'
);

// A malformed hex is rejected while the last valid color survives (Q24).
moduleInstance.updateGradientStopColor('stop-1', '#00FF00');
assert.strictEqual(moduleInstance.iconStudioState.gradientStops[0].color, '#00FF00');
moduleInstance.updateGradientStopColor('stop-1', 'nope');
assert.strictEqual(moduleInstance.iconStudioState.gradientStops[0].color, '#00FF00', 'invalid hex never lands in state');
moduleInstance.updateGradientStopPosition('stop-1', 999);
assert.strictEqual(moduleInstance.iconStudioState.gradientStops[0].position, 100);

// CSS preview string mirrors the exported geometry.
assert.strictEqual(
  moduleInstance.gradientCssPreview([{ id: 'a', color: '#000000', position: 0 }, { id: 'b', color: '#ffffff', position: 100 }], 90),
  'linear-gradient(90deg, #000000 0%, #FFFFFF 100%)'
);

// Removing stops floors at two.
moduleInstance.removeGradientStop('stop-2');
moduleInstance.removeGradientStop('stop-3');
moduleInstance.removeGradientStop('stop-4');
assert.strictEqual(moduleInstance.iconStudioState.gradientStops.length, 2, 'removal floors at two stops');

// Stop count ceiling.
for (let i = 0; i < 12; i += 1) moduleInstance.addGradientStop();
assert.strictEqual(moduleInstance.iconStudioState.gradientStops.length, 8, 'addition caps at eight stops');
assert.strictEqual(byId('addGradientStopBtn').disabled, true, 'add button disables at the cap');

// Summary, review copy, and flat fallback disclosure (Q20/Q25/Q26).
moduleInstance.iconStudioState.monochrome = null;
moduleInstance.renderIconStudio();
assert.strictEqual(advancedSummary.textContent, 'Gradient 8 stops · 45°');
assert.strictEqual(
  byId('iconGradientFallbackStatus').textContent,
  `Flat fallback color: ${moduleInstance.iconStudioState.gradientStops[0].color} (first stop).`
);
moduleInstance.iconStudioState.foreground = { image: null, analysis: { hasTransparency: true, bounds: { left: 0, top: 0, right: 1, bottom: 1 } } };
moduleInstance.renderIconStudio();
// jsdom has no scrollIntoView; the review panel itself is not under test here.
byId('iconReviewPanel').scrollIntoView = () => {};
moduleInstance.openIconReview();
assert.ok(
  byId('iconReviewList').textContent.includes('Adaptive background: 8-stop gradient @ 45deg'),
  'review panel reports the gradient decision'
);
moduleInstance.closeIconReview();

// Gradient mode never gates the deploy button (Q24 is structural, not validity-blocked).
assert.strictEqual(
  moduleInstance.updateIconApplyAvailability(),
  undefined
);
assert.strictEqual(byId('deployNativeIconsBtn').disabled, false, 'gradient mode stays deployable');

// Switching modes preserves the gradient configuration (Q19).
byId('iconBgColorText').value = '#ABCDEF';
byId('iconBgColorText').dispatchEvent(new window.Event('input'));
const solidMode = window.document.querySelector('input[name="iconBackgroundMode"][value="color"]');
solidMode.checked = true;
solidMode.dispatchEvent(new window.Event('change'));
assert.strictEqual(byId('iconGradientControls').hidden, true, 'gradient editor hides in solid mode');
assert.strictEqual(moduleInstance.iconStudioState.gradientAngle, 45, 'angle survives the mode switch');
assert.strictEqual(moduleInstance.iconStudioState.gradientStops.length, 8, 'stops survive the mode switch');
assert.strictEqual(advancedSummary.textContent, 'Solid #ABCDEF', 'solid summary returns after switching back');

console.log('✅ Icon & Splash preview proximity (DOM) tests passed!');
