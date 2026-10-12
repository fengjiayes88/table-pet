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
    ROLL: 'roll',
    NUZZLE: 'nuzzle',
    KNEAD: 'knead',
    STRETCH: 'stretch',
    REMINDER: 'reminder',
    DRINK_REMINDER: 'drinkReminder',
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
  controller.isReminding = false;
  controller.reminderState = 'reminder';
  controller.doubleClickActions = ['roll', 'nuzzle', 'knead', 'stretch'];
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
  controller.reminderState = 'drinkReminder';
  controller._lastDragScreenX = 1;
  controller._lastDragScreenY = 1;
  controller._switchState = (state, force) => states.push([state, force]);
  controller._updatePointerPassthrough = () => {};

  await controller._endDrag();

  assert.deepEqual(states, [['drinkReminder', true]]);
  assert.equal(controller.isDragging, false);
  delete global.window;
});

test('drink reminders select the dedicated sprite state', () => {
  global.window = { AnimationLogic };
  const states = [];
  const controller = makeStateController({});
  controller._switchState = (state) => states.push(state);

  controller.onReminderTriggered('drink');

  assert.equal(controller.isReminding, true);
  assert.equal(controller.reminderState, 'drinkReminder');
  assert.deepEqual(states, ['drinkReminder']);
  delete global.window;
});

test('double-clicking the drink animation checks in the active reminder', () => {
  const checkIns = [];
  const controller = makeStateController({});
  controller.state = 'drinkReminder';
  controller.isReminding = true;
  controller.activeReminder = {
    reset: (...args) => checkIns.push(args),
  };
  controller._markUserActivity = () => {};
  controller._switchState = () => assert.fail('check-in should not start a pet action');

  controller._onDoubleClick();

  assert.deepEqual(checkIns, [[false, true]]);
});

test('double-clicking outside a reminder chooses from the four affection actions', () => {
  const states = [];
  const controller = makeStateController({});
  controller._markUserActivity = () => {};
  controller._switchState = (state) => states.push(state);
  const originalRandom = Math.random;
  Math.random = () => 0.62;
  try {
    controller._onDoubleClick();
  } finally {
    Math.random = originalRandom;
  }

  assert.deepEqual(controller.doubleClickActions, ['roll', 'nuzzle', 'knead', 'stretch']);
  assert.deepEqual(states, ['knead']);
});
