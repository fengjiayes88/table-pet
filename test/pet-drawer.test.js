const test = require('node:test');
const assert = require('node:assert/strict');
const PetDrawer = require('../src/renderer/pet-drawer');

test('an unloaded interaction keeps showing Qixi instead of the procedural placeholder', () => {
  const drawer = Object.create(PetDrawer.prototype);
  const attemptedStates = [];
  drawer._drawSprite = (_ctx, _width, _height, state) => {
    attemptedStates.push(state);
    return state === 'idle';
  };
  drawer._drawJump = () => assert.fail('procedural placeholder should not be rendered');

  const ctx = {
    clearRect() {},
    save() {},
    scale() {},
    translate() {},
    restore() {},
  };

  drawer.drawFrame(ctx, 180, 180, 'jump', 0, 1);

  assert.deepEqual(attemptedStates, ['jump', 'idle']);
});

test('a failed sprite load can retry instead of remaining a static fallback forever', async () => {
  const previousWindow = global.window;
  const previousConsoleError = console.error;
  console.error = () => {};
  global.window = {
    PET_SPRITES: {
      reminder: {
        files: [{ name: 'reminder.png', frames: 1 }],
        frameMs: 180,
        loop: true,
      },
    },
  };
  const drawer = Object.create(PetDrawer.prototype);
  drawer.sprites = {
    reminder: {
      images: [], totalFrames: 1, loaded: false, loadPromise: null, frameMs: 180, loop: true,
    },
  };
  let calls = 0;
  drawer._loadImage = async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary load error');
    return { naturalWidth: 512, naturalHeight: 512 };
  };

  try {
    assert.equal(await drawer.ensureState('reminder'), false);
    assert.equal(drawer.sprites.reminder.loadPromise, null);
    assert.equal(await drawer.ensureState('reminder'), true);
    assert.equal(drawer.sprites.reminder.totalFrames, 1);
  } finally {
    global.window = previousWindow;
    console.error = previousConsoleError;
  }
});
