const DEFAULT_SETTINGS = Object.freeze({
  x: null,
  y: null,
  size: 1,
  opacity: 0.95,
  alwaysOnTop: true,
  autoLaunch: true,
  reminderEnabled: true,
  reminderInterval: 45,
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
  return next;
}

function clampToWorkArea(x, y, width, height, workArea) {
  return {
    x: Math.round(clamp(x, workArea.x, workArea.x + Math.max(0, workArea.width - width))),
    y: Math.round(clamp(y, workArea.y, workArea.y + Math.max(0, workArea.height - height))),
  };
}

module.exports = { DEFAULT_SETTINGS, clamp, finiteNumber, normalizeSettings, clampToWorkArea };
