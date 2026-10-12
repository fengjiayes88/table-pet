const test = require('node:test');
const assert = require('node:assert/strict');
const Pomodoro = require('../src/renderer/pomodoro');

// 注入式计时器：手动驱动 tick，时间可拨
function createFakeClock() {
  const clock = {
    now: 0,
    tickFn: null,
    timerId: 0,
    setIntervalFn(fn) {
      clock.tickFn = fn;
      return ++clock.timerId;
    },
    clearIntervalFn() {},
    nowFn() {
      return clock.now;
    },
    advanceMinutes(minutes) {
      clock.now += minutes * 60 * 1000;
      if (clock.tickFn) clock.tickFn();
    },
  };
  return clock;
}

function createPomodoro(clock, completed) {
  return new Pomodoro({
    onPhaseComplete: (phase) => completed.push(phase),
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    nowFn: clock.nowFn,
  });
}

test('work phase completes and switches to break', () => {
  const clock = createFakeClock();
  const completed = [];
  const p = createPomodoro(clock, completed);

  p.configure({ workMinutes: 1, breakMinutes: 1 });
  p.start();
  clock.advanceMinutes(1);

  assert.deepEqual(completed, ['work']);
  assert.equal(p.phase, 'break');
});

test('break phase completes and returns to work', () => {
  const clock = createFakeClock();
  const completed = [];
  const p = createPomodoro(clock, completed);

  p.configure({ workMinutes: 1, breakMinutes: 1 });
  p.start();
  clock.advanceMinutes(1);
  clock.advanceMinutes(1);

  assert.deepEqual(completed, ['work', 'break']);
  assert.equal(p.phase, 'work');
});

test('configure restarts the current phase with the new duration', () => {
  const clock = createFakeClock();
  const completed = [];
  const p = createPomodoro(clock, completed);

  p.configure({ workMinutes: 1, breakMinutes: 1 });
  p.start();
  clock.advanceMinutes(1); // 进入休息段
  p.configure({ breakMinutes: 2 }); // 当前段立即按新时长重新计时
  clock.advanceMinutes(1);
  assert.equal(completed.length, 1, 'break must not complete at the old 1-minute mark');

  clock.advanceMinutes(1);
  assert.deepEqual(completed, ['work', 'break']);
  assert.equal(p.phase, 'work');
});

test('stop and start are idempotent', () => {
  const clock = createFakeClock();
  const completed = [];
  const p = createPomodoro(clock, completed);

  p.configure({ workMinutes: 1, breakMinutes: 1 });
  p.start();
  clock.advanceMinutes(1); // 进入休息段
  clock.advanceMinutes(0.5);
  p.stop();
  p.stop(); // 幂等：第二次不抛错
  assert.equal(p.phase, null);

  p.start(); // phase 重置为 work，计时从头
  assert.equal(p.phase, 'work');
  clock.advanceMinutes(0.5);
  assert.equal(completed.length, 1, 'restarted work phase must run its full duration');
  clock.advanceMinutes(0.5);
  assert.deepEqual(completed, ['work', 'work']);
});

test('configure toggles running state via enabled', () => {
  const clock = createFakeClock();
  const completed = [];
  const p = createPomodoro(clock, completed);

  p.configure({ workMinutes: 1, breakMinutes: 1 });
  p.configure({ enabled: true }); // 开启 → 从工作段开始
  assert.equal(p.phase, 'work');
  clock.advanceMinutes(1);
  assert.equal(p.phase, 'break');

  p.configure({ enabled: false }); // 关闭 → 停止
  assert.equal(p.phase, null);

  p.configure({ enabled: true }); // 再开 → 重新从工作段计时
  assert.equal(p.phase, 'work');
  clock.advanceMinutes(1);
  assert.deepEqual(completed, ['work', 'work']);
});
