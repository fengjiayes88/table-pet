const test = require('node:test');
const assert = require('node:assert/strict');
const Reminder = require('../src/renderer/reminder');

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

test('multiple reminders with different intervals trigger independently', () => {
  const clockA = createFakeClock();
  const clockB = createFakeClock();
  const a = new Reminder({ setIntervalFn: clockA.setIntervalFn, clearIntervalFn: clockA.clearIntervalFn, nowFn: clockA.nowFn });
  const b = new Reminder({ type: 'drink', setIntervalFn: clockB.setIntervalFn, clearIntervalFn: clockB.clearIntervalFn, nowFn: clockB.nowFn });

  const fired = { sedentary: 0, drink: 0 };
  a.onTrigger = () => { fired.sedentary += 1; };
  b.onTrigger = () => { fired.drink += 1; };

  a.configure({ enabled: true, intervalMinutes: 1 });
  b.configure({ enabled: true, intervalMinutes: 2 });

  clockA.advanceMinutes(1);
  assert.equal(fired.sedentary, 1);
  assert.equal(fired.drink, 0);

  clockB.advanceMinutes(2); // B elapsed 2min total，到自己的间隔才触发
  assert.equal(fired.drink, 1);
  assert.equal(fired.sedentary, 1);
});

test('reminder restarts its cycle when the bubble is refused', () => {
  const clock = createFakeClock();
  const bubbleMessages = [];
  global.window = {
    electronAPI: {
      showReminderBubble: (message) => {
        bubbleMessages.push(message);
        return false; // 气泡已被占用
      },
    },
  };

  const reminder = new Reminder({
    type: 'drink',
    message: '该喝水啦～双击七七打卡！',
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    nowFn: clock.nowFn,
  });
  let triggers = 0;
  reminder.onTrigger = () => { triggers += 1; };
  reminder.configure({ enabled: true, intervalMinutes: 1 });

  clock.advanceMinutes(1);
  assert.equal(triggers, 1);

  // 被拒后应重启本轮计时，而不是永久停摆
  reminder.showBubble(null);
  assert.equal(bubbleMessages.length, 1);
  assert.equal(bubbleMessages[0], '该喝水啦～双击七七打卡！');

  clock.advanceMinutes(1);
  assert.equal(triggers, 2, 'reminder should trigger again after a full new cycle');

  delete global.window;
});

test('showBubble forwards the configured message', () => {
  const clock = createFakeClock();
  let shown = null;
  global.window = {
    electronAPI: {
      showReminderBubble: (message) => {
        shown = message;
        return true;
      },
    },
  };

  const reminder = new Reminder({
    type: 'eye',
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    nowFn: clock.nowFn,
  });
  reminder.showBubble(null);
  assert.equal(shown, '该休息啦～双击我解除提醒吧！');

  reminder.configure({ message: '眼睛也需要休息，做个眼保健操吧～双击七七打卡！' });
  reminder.bubbleVisible = false; // 允许再次弹气泡
  reminder.showBubble(null);
  assert.equal(shown, '眼睛也需要休息，做个眼保健操吧～双击七七打卡！');

  delete global.window;
});
