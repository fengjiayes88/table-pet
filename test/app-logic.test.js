const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SETTINGS,
  normalizeSettings,
  clampToWorkArea,
} = require('../src/shared/app-logic');

test('normalizeSettings clamps numeric values and rejects invalid booleans', () => {
  const normalized = normalizeSettings({
    size: 99,
    opacity: -3,
    reminderInterval: 0,
    alwaysOnTop: 'yes',
    x: 12.7,
    y: '40',
  });

  assert.equal(normalized.size, 2);
  assert.equal(normalized.opacity, 0.2);
  assert.equal(normalized.reminderInterval, 1);
  assert.equal(normalized.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop);
  assert.equal(normalized.x, 13);
  assert.equal(normalized.y, 40);
});

test('normalizeSettings preserves prior values when a patch is invalid', () => {
  const base = normalizeSettings({ size: 1.4, reminderInterval: 30, autoLaunch: false });
  const normalized = normalizeSettings({ size: Number.NaN, autoLaunch: 'false' }, base);
  assert.equal(normalized.size, 1.4);
  assert.equal(normalized.reminderInterval, 30);
  assert.equal(normalized.autoLaunch, false);
});

test('clampToWorkArea respects non-zero and negative display origins', () => {
  const workArea = { x: -1920, y: 40, width: 1920, height: 1040 };
  assert.deepEqual(
    clampToWorkArea(-2500, -100, 180, 180, workArea),
    { x: -1920, y: 40 },
  );
  assert.deepEqual(
    clampToWorkArea(50, 2000, 180, 180, workArea),
    { x: -180, y: 900 },
  );
});

test('normalizeSettings provides health feature defaults for empty input', () => {
  const normalized = normalizeSettings({});
  assert.equal(normalized.pomodoroEnabled, false);
  assert.equal(normalized.pomodoroWork, 25);
  assert.equal(normalized.pomodoroBreak, 5);
  assert.equal(normalized.drinkReminderEnabled, false);
  assert.equal(normalized.drinkReminderInterval, 60);
});

test('normalizeSettings drops removed eye reminder fields', () => {
  // 眼操提醒已移除：旧 settings.json 里的眼操字段不再生效
  const normalized = normalizeSettings({ eyeReminderEnabled: true, eyeReminderInterval: 99 });
  assert.equal(normalized.eyeReminderEnabled, undefined);
  assert.equal(normalized.eyeReminderInterval, undefined);
});

test('normalizeSettings clamps health fields into valid ranges', () => {
  const normalized = normalizeSettings({
    pomodoroWork: 200,
    pomodoroBreak: 0,
    drinkReminderInterval: 1,
  });
  assert.equal(normalized.pomodoroWork, 120);
  assert.equal(normalized.pomodoroBreak, 1);
  assert.equal(normalized.drinkReminderInterval, 5);
});

test('normalizeSettings falls back to defaults for non-numeric health values', () => {
  const normalized = normalizeSettings({ pomodoroWork: 'abc' });
  assert.equal(normalized.pomodoroWork, 25);
});

test('normalizeSettings rejects non-boolean pomodoro toggle', () => {
  const normalized = normalizeSettings({ pomodoroEnabled: 'yes' });
  assert.equal(normalized.pomodoroEnabled, false);
});

const { todayKey, recordStat, getDailyStats } = require('../src/shared/app-logic');

test('todayKey formats local date as YYYY-MM-DD', () => {
  assert.equal(todayKey(new Date(2026, 9, 10, 0, 5)), '2026-10-10');
  assert.equal(todayKey(new Date(2026, 0, 3, 23, 59)), '2026-01-03');
});

test('recordStat initializes and accumulates counters per day', () => {
  let stats = recordStat({}, 'drink', new Date(2026, 9, 10));
  assert.deepEqual(stats['2026-10-10'], { standup: 0, pomodoro: 0, drink: 1 });
  stats = recordStat(stats, 'drink', new Date(2026, 9, 10));
  stats = recordStat(stats, 'standup', new Date(2026, 9, 10));
  assert.equal(stats['2026-10-10'].drink, 2);
  assert.equal(stats['2026-10-10'].standup, 1);
});

test('recordStat prunes entries older than 30 days', () => {
  const stats = {
    '2026-08-31': { standup: 1, pomodoro: 0, drink: 0 }, // 40 days before 2026-10-10
    '2026-09-11': { standup: 1, pomodoro: 0, drink: 0 }, // 29 days before, keep
  };
  const next = recordStat(stats, 'drink', new Date(2026, 9, 10));
  assert.equal(next['2026-08-31'], undefined);
  assert.equal(next['2026-09-11'].standup, 1);
  assert.equal(next['2026-10-10'].drink, 1);
});

test('recordStat records into the day of the check-in moment, not the reminder', () => {
  // 23:59 fired, checked in at 00:01 next day → counts to check-in day
  const stats = recordStat({}, 'standup', new Date(2026, 9, 11, 0, 1));
  assert.equal(stats['2026-10-11'].standup, 1);
  assert.equal(stats['2026-10-10'], undefined);
});

test('recordStat ignores unknown event types', () => {
  const stats = { '2026-10-10': { standup: 1, pomodoro: 0, drink: 0 } };
  const next = recordStat(stats, 'sneeze', new Date(2026, 9, 10));
  assert.deepEqual(next, stats);
});

test('getDailyStats returns zero counters for missing data', () => {
  assert.deepEqual(
    getDailyStats({}, new Date(2026, 9, 10)),
    { standup: 0, pomodoro: 0, drink: 0 },
  );
  assert.deepEqual(
    getDailyStats({ garbage: true }, new Date(2026, 9, 10)),
    { standup: 0, pomodoro: 0, drink: 0 },
  );
});
