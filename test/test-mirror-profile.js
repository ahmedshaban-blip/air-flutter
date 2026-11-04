const assert = require('assert');
const {
  buildMirrorAudioArguments,
  buildMirrorTuningArguments,
  isMirrorAudioRoute,
  isMirrorPerformanceProfile
} = require('../out/domain/mirror-profile');

assert.deepStrictEqual(buildMirrorAudioArguments('computer'), ['--audio-source=output']);
assert.deepStrictEqual(buildMirrorAudioArguments('phone'), ['--no-audio']);

assert.deepStrictEqual(buildMirrorTuningArguments('speed'), [
  '--max-size=1024', '--max-fps=120', '--video-bit-rate=8M', '--video-buffer=0', '--no-mipmaps'
]);
assert.deepStrictEqual(buildMirrorTuningArguments('balanced'), [
  '--max-size=1600', '--max-fps=60', '--video-bit-rate=8M', '--video-buffer=0'
]);
assert.deepStrictEqual(buildMirrorTuningArguments('ultra'), [
  '--max-fps=120', '--video-bit-rate=16M', '--video-buffer=0'
], 'ultra must request native resolution, the highest bitrate and the highest FPS cap');

assert.strictEqual(isMirrorAudioRoute('computer'), true);
assert.strictEqual(isMirrorAudioRoute('both'), false);
assert.strictEqual(isMirrorPerformanceProfile('ultra'), true);
assert.strictEqual(isMirrorPerformanceProfile('quality'), true, 'legacy saved profiles must stay valid');
assert.strictEqual(isMirrorPerformanceProfile('fastest'), false);

console.log('✅ Mirroring audio and performance profiles verified');
