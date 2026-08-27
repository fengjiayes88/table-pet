const test = require('node:test');
const assert = require('node:assert/strict');
const { frameAtElapsed, durationMs } = require('../src/renderer/animation-logic');

test('looping animations wrap without producing an out-of-range frame', () => {
  const animation = { totalFrames: 4, frameMs: 100, loop: true };
  assert.deepEqual(
    [0, 99, 100, 399, 400, 899].map((elapsed) => frameAtElapsed(animation, elapsed)),
    [0, 0, 1, 3, 0, 0],
  );
  assert.equal(durationMs(animation), Infinity);
});

test('finite animations hold their final frame through the completion boundary', () => {
  const animation = { totalFrames: 4, frameMs: 150, loop: false };
  assert.deepEqual(
    [0, 149, 150, 449, 450, 599, 600, 1000].map((elapsed) => frameAtElapsed(animation, elapsed)),
    [0, 0, 1, 2, 3, 3, 3, 3],
  );
  assert.equal(durationMs(animation), 600);
});

test('invalid animation metadata falls back to one safe frame', () => {
  assert.equal(frameAtElapsed({ totalFrames: 0, frameMs: 0, loop: false }, -1), 0);
  assert.equal(durationMs({ totalFrames: 0, frameMs: 0, loop: false }), 200);
});
