/**
 * 休息提醒倒计时。气泡由主进程创建独立透明窗口，避免被宠物窗口裁切。
 */
class Reminder {
  constructor({
    type = 'sedentary',
    message = '该休息啦～双击我解除提醒吧！',
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    nowFn = Date.now,
  } = {}) {
    this.type = type;
    this.message = message;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.nowFn = nowFn;
    this.intervalMinutes = 45;
    this.enabled = true;
    this.timerId = null;
    this.startTime = nowFn();
    this.onTrigger = null;
    this.onTick = null;
    this.onDismiss = null;
    this.bubbleVisible = false;
  }

  configure({ enabled, intervalMinutes, message }) {
    if (enabled !== undefined) this.enabled = !!enabled;
    if (intervalMinutes !== undefined) {
      const parsed = Number(intervalMinutes);
      this.intervalMinutes = Number.isFinite(parsed)
        ? Math.min(999, Math.max(1, parsed))
        : 45;
    }
    if (message !== undefined) this.message = String(message);
    this.enabled ? this.start(true) : this.stop();
  }

  start(resetTimer = true) {
    this.stop();
    if (!this.enabled) return;
    if (resetTimer) this.startTime = this.nowFn();

    this.timerId = this.setIntervalFn(() => {
      const elapsedMs = this.nowFn() - this.startTime;
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
    this.clearIntervalFn(this.timerId);
    this.timerId = null;
  }

  reset(fromBubbleWindow = false) {
    this.startTime = this.nowFn();
    this.dismissBubble(!fromBubbleWindow);
    this.onDismiss?.();
  }

  triggerReminder() {
    this.stop();
    this.onTrigger?.();
  }

  showBubble(_canvasElement, message = this.message) {
    if (this.bubbleVisible) return;
    const shown = window.electronAPI?.showReminderBubble?.(message);
    // invoke 返回 Promise，测试替身同步返回布尔，两种来源统一处理
    const onShown = (ok) => {
      if (ok === false) {
        // 气泡被占用：跳过本轮并重启自己的计时，不排队连弹
        this.start(true);
      } else {
        this.bubbleVisible = true;
      }
    };
    if (shown && typeof shown.then === 'function') shown.then(onShown);
    else onShown(shown);
    return shown;
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
