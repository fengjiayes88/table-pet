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
  assert.equal(normalized.eyeReminderEnabled, false);
  assert.equal(normalized.eyeReminderInterval, 45);
});

test('normalizeSettings clamps health fields into valid ranges', () => {
  const normalized = normalizeSettings({
    pomodoroWork: 200,
    pomodoroBreak: 0,
    drinkReminderInterval: 1,
    eyeReminderInterval: 1000,
  });
  assert.equal(normalized.pomodoroWork, 120);
  assert.equal(normalized.pomodoroBreak, 1);
  assert.equal(normalized.drinkReminderInterval, 5);
  assert.equal(normalized.eyeReminderInterval, 999);
});

test('normalizeSettings falls back to defaults for non-numeric health values', () => {
  const normalized = normalizeSettings({ pomodoroWork: 'abc' });
  assert.equal(normalized.pomodoroWork, 25);
});

test('normalizeSettings rejects non-boolean pomodoro toggle', () => {
  const normalized = normalizeSettings({ pomodoroEnabled: 'yes' });
  assert.equal(normalized.pomodoroEnabled, false);
});
