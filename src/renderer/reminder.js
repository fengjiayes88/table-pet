/**
 * 休息提醒倒计时。气泡由主进程创建独立透明窗口，避免被宠物窗口裁切。
 */
class Reminder {
  constructor() {
    this.intervalMinutes = 45;
    this.enabled = true;
    this.timerId = null;
    this.startTime = Date.now();
    this.onTrigger = null;
    this.onTick = null;
    this.onDismiss = null;
    this.bubbleVisible = false;
  }

  configure({ enabled, intervalMinutes }) {
    if (enabled !== undefined) this.enabled = !!enabled;
    if (intervalMinutes !== undefined) {
      const parsed = Number(intervalMinutes);
      this.intervalMinutes = Number.isFinite(parsed)
        ? Math.min(999, Math.max(1, parsed))
        : 45;
    }
    this.enabled ? this.start(true) : this.stop();
  }

  start(resetTimer = true) {
    this.stop();
    if (!this.enabled) return;
    if (resetTimer) this.startTime = Date.now();

    this.timerId = setInterval(() => {
      const elapsedMs = Date.now() - this.startTime;
      const totalMs = this.intervalMinutes * 60 * 1000;
      const remaining = totalMs - elapsedMs;
      this.onTick?.({
        elapsedMinutes: Math.floor(elapsedMs / 60000),
        totalMinutes: this.intervalMinutes,
        remainingMs: Math.max(0, remaining),
        remainingMinutes: Math.max(0, Math.ceil(remaining / 60000)),
      });
      if (remaining <= 0) this.triggerReminder();
    }, 1000);
  }

  stop() {
    if (!this.timerId) return;
    clearInterval(this.timerId);
    this.timerId = null;
  }

  reset(fromBubbleWindow = false) {
    this.startTime = Date.now();
    this.dismissBubble(!fromBubbleWindow);
    this.onDismiss?.();
  }

  triggerReminder() {
    this.stop();
    this.onTrigger?.();
  }

  showBubble(_canvasElement, message = '该休息啦～双击我解除提醒吧！') {
    if (this.bubbleVisible) return;
    this.bubbleVisible = true;
    window.electronAPI?.showReminderBubble?.(message);
  }

  dismissBubble(notifyWindow = true) {
    if (notifyWindow) window.electronAPI?.dismissReminderBubble?.(false);
    this.bubbleVisible = false;
  }

  destroy() {
    this.stop();
    this.dismissBubble();
  }
}

if (typeof module !== 'undefined') module.exports = Reminder;
