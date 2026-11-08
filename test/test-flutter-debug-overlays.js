const assert = require('assert');
const { FlutterDebugOverlaysService, OVERLAY_HOTKEYS } = require('../out/domain/flutter-debug-overlays');

(async () => {
  console.log('🧪 Testing FlutterDebugOverlaysService...');

  const keystrokes = [];
  const service = new FlutterDebugOverlaysService(async (char) => {
    keystrokes.push(char);
    return true;
  });

  // Initial state all false
  const initial = service.getState();
  assert.strictEqual(initial.debugPaint, false);
  assert.strictEqual(initial.performanceOverlay, false);
  assert.strictEqual(initial.slowAnimations, false);
  assert.strictEqual(initial.repaintRainbow, false);
  assert.strictEqual(initial.paintBaselines, false);

  // Toggle debugPaint
  const res1 = await service.toggleOverlay('debugPaint');
  assert.strictEqual(res1.enabled, true);
  assert.strictEqual(res1.hotkey, 'p');
  assert.strictEqual(service.getState().debugPaint, true);
  assert.deepStrictEqual(keystrokes, ['p']);

  // Toggle slowAnimations
  const res2 = await service.toggleOverlay('slowAnimations');
  assert.strictEqual(res2.enabled, true);
  assert.strictEqual(res2.hotkey, 'S');
  assert.deepStrictEqual(keystrokes, ['p', 'S']);

  // Toggle debugPaint off
  const res3 = await service.toggleOverlay('debugPaint');
  assert.strictEqual(res3.enabled, false);
  assert.strictEqual(service.getState().debugPaint, false);

  // Reset all
  const resetState = service.resetAll();
  assert.strictEqual(resetState.debugPaint, false);
  assert.strictEqual(resetState.slowAnimations, false);

  console.log('✅ FlutterDebugOverlaysService tests passed!');
})();

