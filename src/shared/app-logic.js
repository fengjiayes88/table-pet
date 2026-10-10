const DEFAULT_SETTINGS = Object.freeze({
  x: null,
  y: null,
  size: 1,
  opacity: 0.95,
  alwaysOnTop: true,
  autoLaunch: true,
  reminderEnabled: true,
  reminderInterval: 45,
  pomodoroEnabled: false,
  pomodoroWork: 25,
  pomodoroBreak: 5,
  drinkReminderEnabled: false,
  drinkReminderInterval: 60,
  eyeReminderEnabled: false,
  eyeReminderInterval: 45,
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSettings(input = {}, base = DEFAULT_SETTINGS) {
  const next = { ...base };
  next.x = input.x == null ? null : Math.round(finiteNumber(input.x, base.x ?? 0));
  next.y = input.y == null ? null : Math.round(finiteNumber(input.y, base.y ?? 0));
  next.size = clamp(finiteNumber(input.size, base.size), 0.5, 2);
  next.opacity = clamp(finiteNumber(input.opacity, base.opacity), 0.2, 1);
  next.alwaysOnTop = typeof input.alwaysOnTop === 'boolean' ? input.alwaysOnTop : base.alwaysOnTop;
  next.autoLaunch = typeof input.autoLaunch === 'boolean' ? input.autoLaunch : base.autoLaunch;
  next.reminderEnabled = typeof input.reminderEnabled === 'boolean'
    ? input.reminderEnabled
    : base.reminderEnabled;
  next.reminderInterval = Math.round(clamp(
    finiteNumber(input.reminderInterval, base.reminderInterval),
    1,
    999,
  ));
  next.pomodoroEnabled = typeof input.pomodoroEnabled === 'boolean'
    ? input.pomodoroEnabled
    : base.pomodoroEnabled;
  next.pomodoroWork = Math.round(clamp(
    finiteNumber(input.pomodoroWork, base.pomodoroWork),
    5,
    120,
  ));
  next.pomodoroBreak = Math.round(clamp(
    finiteNumber(input.pomodoroBreak, base.pomodoroBreak),
    1,
    60,
  ));
  next.drinkReminderEnabled = typeof input.drinkReminderEnabled === 'boolean'
    ? input.drinkReminderEnabled
    : base.drinkReminderEnabled;
  next.drinkReminderInterval = Math.round(clamp(
    finiteNumber(input.drinkReminderInterval, base.drinkReminderInterval),
    5,
    999,
  ));
  next.eyeReminderEnabled = typeof input.eyeReminderEnabled === 'boolean'
    ? input.eyeReminderEnabled
    : base.eyeReminderEnabled;
  next.eyeReminderInterval = Math.round(clamp(
    finiteNumber(input.eyeReminderInterval, base.eyeReminderInterval),
    5,
    999,
  ));
  return next;
}

function clampToWorkArea(x, y, width, height, workArea) {
  return {
    x: Math.round(clamp(x, workArea.x, workArea.x + Math.max(0, workArea.width - width))),
    y: Math.round(clamp(y, workArea.y, workArea.y + Math.max(0, workArea.height - height))),
  };
}

const STAT_TYPES = Object.freeze(['standup', 'pomodoro', 'drink', 'eye']);

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function recordStat(stats, type, date = new Date()) {
  if (!STAT_TYPES.includes(type)) return stats;
  const key = todayKey(date);
  const today = { standup: 0, pomodoro: 0, drink: 0, eye: 0, ...(stats?.[key] || {}) };
  today[type] += 1;
  const cutoff = new Date(date);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffKey = todayKey(cutoff);
  const next = {};
  for (const [k, v] of Object.entries(stats || {})) {
    if (k >= cutoffKey && k !== key) next[k] = v;
  }
  next[key] = today;
  return next;
}

function getDailyStats(stats, date = new Date()) {
  const day = stats?.[todayKey(date)];
  return {
    standup: day?.standup ?? 0,
    pomodoro: day?.pomodoro ?? 0,
    drink: day?.drink ?? 0,
    eye: day?.eye ?? 0,
  };
}

module.exports = { DEFAULT_SETTINGS, clamp, finiteNumber, normalizeSettings, clampToWorkArea, STAT_TYPES, todayKey, recordStat, getDailyStats };
