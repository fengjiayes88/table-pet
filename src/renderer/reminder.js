/**
 * 休息提醒模块
 * 管理定时提醒倒计时，到期后触发提醒动画
 */

class Reminder {
  constructor() {
    this.intervalMinutes = 45;
    this.enabled = true;
    this.timerId = null;
    this.startTime = Date.now();
    this.onTrigger = null;       // 触发提醒回调
    this.onTick = null;          // 每秒 tick 回调（用于 UI 显示倒计时）
    this.onDismiss = null;       // 提醒被关闭回调

    // 气泡 UI 相关
    this.bubbleVisible = false;
    this.bubbleTimer = null;
    this.bubbleElement = null;
  }

  /**
   * 配置提醒参数
   */
  configure({ enabled, intervalMinutes }) {
    if (enabled !== undefined) this.enabled = enabled;
    if (intervalMinutes !== undefined) this.intervalMinutes = intervalMinutes;

    if (this.enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  /**
   * 启动提醒计时器
   */
  start(resetTimer = true) {
    this.stop();
    if (!this.enabled) return;

    if (resetTimer) {
      this.startTime = Date.now();
    }

    this.timerId = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000 / 60;
      const totalMs = this.intervalMinutes * 60 * 1000;
      const remaining = totalMs - (Date.now() - this.startTime);

      // 每秒通知倒计时
      if (this.onTick) {
        this.onTick({
          elapsedMinutes: Math.floor(elapsed),
          totalMinutes: this.intervalMinutes,
          remainingMs: Math.max(0, remaining),
          remainingMinutes: Math.max(0, Math.ceil(remaining / 60000)),
        });
      }

      // 时间到了，触发提醒
      if (remaining <= 0) {
        this.triggerReminder();
      }
    }, 1000);
  }

  /**
   * 停止计时器
   */
  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * 重置计时器（手动关闭提醒后重新计时）
   */
  reset() {
    this.startTime = Date.now();
    this.dismissBubble();
    if (this.onDismiss) this.onDismiss();
  }

  /**
   * 触发提醒
   */
  triggerReminder() {
    this.stop();
    if (this.onTrigger) {
      this.onTrigger();
    }
  }

  /**
   * 显示提醒气泡
   */
  showBubble(canvasElement, message = '该休息啦～起来活动一下吧！') {
    if (this.bubbleVisible) return;

    // 创建气泡元素
    this.bubbleElement = document.createElement('div');
    this.bubbleElement.className = 'reminder-bubble';
    this.bubbleElement.innerHTML = `
      <div class="bubble-content">
        <span class="bubble-icon">&#9889;</span>
        <span class="bubble-text">${message}</span>
        <button class="bubble-dismiss" title="知道了">&#10005;</button>
      </div>
    `;

    // 定位到宠物上方
    const canvas = canvasElement;
    const rect = canvas.getBoundingClientRect();
    this.bubbleElement.style.left = rect.left + rect.width / 2 + 'px';
    this.bubbleElement.style.top = rect.top - 60 + 'px';

    document.body.appendChild(this.bubbleElement);
    this.bubbleVisible = true;

    // 关闭按钮
    this.bubbleElement.querySelector('.bubble-dismiss').addEventListener('click', () => {
      this.reset();
    });

    // 点击气泡任何位置也可关闭
    this.bubbleElement.addEventListener('click', (e) => {
      if (!e.target.classList.contains('bubble-dismiss')) {
        this.reset();
      }
    });

    // 8 秒后自动消失
    this.bubbleTimer = setTimeout(() => {
      this.dismissBubble();
    }, 8000);
  }

  /**
   * 隐藏提醒气泡
   */
  dismissBubble() {
    if (this.bubbleTimer) {
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = null;
    }
    if (this.bubbleElement) {
      this.bubbleElement.classList.add('bubble-fadeout');
      setTimeout(() => {
        if (this.bubbleElement) {
          this.bubbleElement.remove();
          this.bubbleElement = null;
        }
      }, 400);
    }
    this.bubbleVisible = false;
  }

  /**
   * 销毁
   */
  destroy() {
    this.stop();
    this.dismissBubble();
  }
}

if (typeof module !== 'undefined') module.exports = Reminder;
