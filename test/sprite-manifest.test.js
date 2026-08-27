const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../src/renderer/sprite-manifest');

test('sprite manifest declares every controller state', () => {
  assert.deepEqual(
    Object.keys(manifest).sort(),
    ['dragged', 'headTilt', 'idle', 'jump', 'pawReach', 'reminder', 'roll', 'sleep', 'walk'],
  );
});

test('every animation has valid timing and an explicit frame source', () => {
  for (const [state, config] of Object.entries(manifest)) {
    assert.ok(Number.isFinite(config.frameMs) && config.frameMs >= 16, `${state} frameMs`);
    assert.equal(typeof config.loop, 'boolean', `${state} loop`);
    const fileFrames = config.files.reduce((sum, file) => sum + file.frames, 0);
    assert.ok(fileFrames > 0 || config.fallbackFrames > 0, `${state} frame count`);
    for (const file of config.files) {
      assert.match(file.name, /^[a-z0-9-]+@\d+\.png$/i);
      assert.ok(Number.isInteger(file.frames) && file.frames > 0);
    }
  }
});
