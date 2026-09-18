const test = require('node:test');
const assert = require('node:assert/strict');
const PetController = require('../src/renderer/pet-controller');
const AnimationLogic = require('../src/renderer/animation-logic');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function makeStateController(drawer) {
  const controller = Object.create(PetController.prototype);
  controller.STATES = Object.freeze({
    IDLE: 'idle',
    WALK: 'walk',
    JUMP: 'jump',
    REMINDER: 'reminder',
    SLEEP: 'sleep',
  });
  controller.state = 'idle';
  controller.drawer = drawer;
  controller.destroyed = false;
  controller.walkDuration = 3000;
  controller._stateRevision = 0;
  controller._lastRenderedState = null;
  controller._lastRenderedFrame = -1;
  controller._needsRender = false;
  controller._randomWalkDelay = () => 10000;
  controller._randomJumpDelay = () => 20000;
  return controller;
}

test('idle scheduling triggers jump independently from automatic walking', () => {
  const controller = makeStateController({});
  controller.lastUserActivityTime = 0;
  controller.sleepAfterMs = 120000;
  controller.nextWalkTime = 10000;
  controller.nextJumpTime = 20000;

  assert.equal(controller._nextIdleEvent(10000), 'walk');
  controller.nextWalkTime = 25000;
  assert.equal(controller._nextIdleEvent(20000), 'jump');
});

test('sleep uses total user inactivity and takes priority over overdue idle actions', () => {
  const controller = makeStateController({});
  controller.lastUserActivityTime = 5000;
  controller.sleepAfterMs = 120000;
  controller.nextWalkTime = 10000;
  controller.nextJumpTime = 20000;

  assert.equal(controller._nextIdleEvent(125000), 'sleep');
});

test('user activity postpones walk and jump deadlines together', () => {
  const controller = makeStateController({});
  controller._markUserActivity(5000);

  assert.equal(controller.lastUserActivityTime, 5000);
  assert.equal(controller.nextWalkTime, 15000);
  assert.equal(controller.nextJumpTime, 25000);
});

test('a lazily loaded looping state adopts its real frames instead of staying still', async () => {
  global.window = { AnimationLogic };
  const loading = deferred();
  let loaded = false;
  const controller = makeStateController({
    ensureState: () => loading.promise,
    getAnimationInfo: () => loaded
      ? { totalFrames: 8, frameMs: 180, loop: true }
      : { totalFrames: 1, frameMs: 200, loop: true },
  });

  controller._switchState('reminder');
  assert.equal(controller.totalFrames, 1);

  loaded = true;
  loading.resolve(true);
  await loading.promise;
  await Promise.resolve();

  assert.equal(controller.totalFrames, 8);
  assert.equal(controller.frameMs, 180);
  assert.equal(controller.stateDuration, Infinity);
  assert.equal(controller.frameIndex, 0);
  assert.equal(controller._needsRender, true);
  delete global.window;
});

test('ending a drag resumes an active reminder animation', async () => {
  global.window = {
    AnimationLogic,
    electronAPI: { persistWindowPosition: async () => {} },
  };
  const states = [];
  const controller = makeStateController({
    ensureState: async () => true,
    getAnimationInfo: () => ({ totalFrames: 8, frameMs: 180, loop: true }),
  });
  controller.isDragging = true;
  controller.isReminding = true;
  controller._lastDragScreenX = 1;
  controller._lastDragScreenY = 1;
  controller._switchState = (state, force) => states.push([state, force]);
  controller._updatePointerPassthrough = () => {};

  await controller._endDrag();

  assert.deepEqual(states, [['reminder', true]]);
  assert.equal(controller.isDragging, false);
  delete global.window;
});
