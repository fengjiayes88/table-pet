const test = require('node:test');
const assert = require('node:assert/strict');
const PetController = require('../src/renderer/pet-controller');

function makeController(alphaAt) {
  const controller = Object.create(PetController.prototype);
  controller.canvas = {
    width: 200,
    height: 100,
    getBoundingClientRect: () => ({ left: 10, top: 20, right: 110, bottom: 70, width: 100, height: 50 }),
  };
  controller.ctx = {
    getImageData: (x, y) => ({ data: [0, 0, 0, alphaAt(x, y)] }),
  };
  controller.dpr = 2;
  controller.isDragging = false;
  controller._mouseInsideWindow = true;
  controller.mouseClientX = 60;
  controller.mouseClientY = 45;
  controller._ignoringMouse = false;
  return controller;
}

test('opacity hit testing maps CSS coordinates to high-DPI canvas pixels', () => {
  const controller = makeController((x, y) => x === 100 && y === 50 ? 255 : 0);
  assert.equal(controller._isOpaqueAt(60, 45), true);
  assert.equal(controller._isOpaqueAt(20, 25), false);
  assert.equal(controller._isOpaqueAt(110, 45), false);
});

test('pointer passthrough toggles only when crossing the visible sprite', () => {
  const calls = [];
  global.window = {
    electronAPI: {
      setIgnoreMouseEvents: (...args) => calls.push(args),
    },
  };

  const controller = makeController(() => 0);
  controller._updatePointerPassthrough();
  assert.deepEqual(calls, [[true, { forward: true }]]);

  controller.ctx.getImageData = () => ({ data: [0, 0, 0, 255] });
  controller._updatePointerPassthrough();
  assert.deepEqual(calls.at(-1), [false, undefined]);

  delete global.window;
});
