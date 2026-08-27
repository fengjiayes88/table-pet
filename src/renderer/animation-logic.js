(function exposeAnimationLogic(root, factory) {
  const logic = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = logic;
  if (root) root.AnimationLogic = logic;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  function normalizePositiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  function frameAtElapsed(animation, elapsedMs) {
    const totalFrames = normalizePositiveInteger(animation?.totalFrames, 1);
    const frameMs = Number.isFinite(animation?.frameMs) && animation.frameMs > 0
      ? animation.frameMs
      : 200;
    const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    const rawFrame = Math.floor(elapsed / frameMs);
    return animation?.loop
      ? rawFrame % totalFrames
      : Math.min(rawFrame, totalFrames - 1);
  }

  function durationMs(animation) {
    if (animation?.loop) return Infinity;
    const totalFrames = normalizePositiveInteger(animation?.totalFrames, 1);
    const frameMs = Number.isFinite(animation?.frameMs) && animation.frameMs > 0
      ? animation.frameMs
      : 200;
    return totalFrames * frameMs;
  }

  return Object.freeze({ frameAtElapsed, durationMs });
}));
