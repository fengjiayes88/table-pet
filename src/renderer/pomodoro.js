/**
 * 番茄钟：工作/休息交替倒计时，阶段结束自动进入下一阶段并触发回调。
 * 计时函数可注入，测试秒级完成（结构照抄 reminder.js 的计时模式）。
 */
class Pomodoro {
  constructor({
    onPhaseComplete = null,
    onTick = null,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    nowFn = Date.now,
  } = {}) {
    this.onPhaseComplete = onPhaseComplete;
    this.onTick = onTick;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.nowFn = nowFn;
    this.workMinutes = 25;
    this.breakMinutes = 5;
    this.phase = null; // 'work' | 'break' | null（未运行）
    this.timerId = null;
    this.startTime = nowFn();
  }

  configure({ enabled, workMinutes, breakMinutes }) {
    let durationChanged = false;
    if (workMinutes !== undefined) {
      const n = Number(workMinutes);
      if (Number.isFinite(n) && n !== this.workMinutes) {
        this.workMinutes = n;
        durationChanged = true;
      }
    }
    if (breakMinutes !== undefined) {
      const n = Number(breakMinutes);
      if (Number.isFinite(n) && n !== this.breakMinutes) {
        this.breakMinutes = n;
        durationChanged = true;
      }
    }
    if (enabled === false) {
      this.stop();
      return;
    }
    if (durationChanged && this.phase) {
      this._startPhase(this.phase); // 时长变化 → 立即用新时长重启当前阶段
      return;
    }
    if (enabled === true && this.phase === null) this.start();
  }

  start() {
    this._startPhase('work');
  }

  stop() {
    if (!this.timerId) return;
    this.clearIntervalFn(this.timerId);
    this.timerId = null;
    this.phase = null;
  }

  _startPhase(phase) {
    this.stop();
    this.phase = phase;
    this.startTime = this.nowFn();
    const totalMs = (phase === 'work' ? this.workMinutes : this.breakMinutes) * 60 * 1000;
    this.timerId = this.setIntervalFn(() => {
      const elapsedMs = this.nowFn() - this.startTime;
      const remaining = totalMs - elapsedMs;
      this.onTick?.({
        phase,
        remainingMs: Math.max(0, remaining),
        remainingMinutes: Math.max(0, Math.ceil(remaining / 60000)),
      });
      if (remaining <= 0) this._completePhase();
    }, 1000);
  }

  _completePhase() {
    const finished = this.phase;
    this._startPhase(finished === 'work' ? 'break' : 'work');
    this.onPhaseComplete?.(finished);
  }
}

if (typeof module !== 'undefined') module.exports = Pomodoro;
