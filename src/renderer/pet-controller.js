/**
 * 宠物行为控制器
 * 动画状态机、交互处理、渲染循环
 */

class PetController {
  constructor(canvas, petDrawer, reminder) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.drawer = petDrawer;
    this.reminder = reminder;

    // 状态机
    this.STATES = {
      IDLE:     'idle',
      WALK:     'walk',
      JUMP:     'jump',
      HEAD_TILT:'headTilt',
      PAW_REACH:'pawReach',
      ROLL:     'roll',
      DRAGGED:  'dragged',
      REMINDER: 'reminder',
      SLEEP:    'sleep',
    };

    this.state = this.STATES.IDLE;
    this.stateStartTime = 0;
    this.stateDuration = 0;       // 当前状态持续 ms
    this.frameIndex = 0;
    this.totalFrames = 4;

    // 走动相关
    this.walkDuration = 3000;     // 走动持续 ms
    this._walkStartScreenX = 0;
    this._walkTargetScreenX = 0;
    this._windowX = 0;            // 自追踪窗口 X 坐标

    // 空闲计时（用于随机走动）
    this.idleTime = 0;
    this.nextWalkTime = 8000 + Math.random() * 15000; // 8-23 秒后走动

    // 拖拽
    this.isDragging = false;
    this._lastDragScreenX = null;
    this._lastDragScreenY = null;

    // 鼠标位置（用于视线跟随）
    this.mouseScreenX = 0;
    this.mouseScreenY = 0;

    // 点击反馈动作池
    this.clickActions = [this.STATES.JUMP, this.STATES.HEAD_TILT, this.STATES.PAW_REACH];

    // 提醒中标志
    this.isReminding = false;

    // 动画帧 ID
    this.animFrameId = null;

    // 设置
    this.settings = {};
    this.canvasW = canvas.width;
    this.canvasH = canvas.height;
  }

  /**
   * 初始化控制器
   */
  async init() {
    // 加载设置
    try {
      this.settings = await window.electronAPI.getSettings();
    } catch (e) {
      this.settings = {
        size: 1.0,
        opacity: 0.95,
        alwaysOnTop: true,
        autoLaunch: true,
        reminderEnabled: true,
        reminderInterval: 45,
      };
    }

    // 配置提醒
    this.reminder.configure({
      enabled: this.settings.reminderEnabled,
      intervalMinutes: this.settings.reminderInterval,
    });
    this.reminder.onTrigger = () => this._onReminderTrigger();
    this.reminder.start();

    // 设置画布大小
    this._resizeCanvas();

    // 绑定事件
    this._bindEvents();

    // 初始化窗口位置追踪
    try {
      const [x] = await window.electronAPI.getWindowPosition();
      this._windowX = x;
    } catch (e) { /* ignore */ }

    // 开始渲染循环
    this.stateStartTime = performance.now();
    this._renderLoop();

    // 监听主进程设置变更
    if (window.electronAPI) {
      window.electronAPI.onSettingsChanged((settings) => {
        this.settings = settings;
        this.reminder.configure({
          enabled: settings.reminderEnabled,
          intervalMinutes: settings.reminderInterval,
        });
        this.drawer.scale = settings.size;
        this._resizeCanvas();
      });

      window.electronAPI.onWindowSizeChanged((data) => {
        this.canvas.width = data.width;
        this.canvas.height = data.height;
        this.canvasW = data.width;
        this.canvasH = data.height;
        this.drawer.scale = data.scale;
      });
    }
  }

  /**
   * 调整画布尺寸
   */
  _resizeCanvas() {
    const size = this.settings.size || 1;
    // 画布内容区域（给宠物留空间）
    const base = 180 * size;
    this.canvas.width = base;
    this.canvas.height = base;
    this.canvasW = base;
    this.canvasH = base;
    this.drawer.scale = size;
  }

  /**
   * 绑定交互事件
   */
  _bindEvents() {
    // ── 鼠标追踪（视线跟随） ──
    document.addEventListener('mousemove', (e) => {
      this.mouseScreenX = e.screenX;
      this.mouseScreenY = e.screenY;
      this._updateLookDirection(e.clientX, e.clientY);

      // 拖拽中：移动窗口
      if (this.isDragging && this._lastDragScreenX !== null) {
        const dx = e.screenX - this._lastDragScreenX;
        const dy = e.screenY - this._lastDragScreenY;
        this._lastDragScreenX = e.screenX;
        this._lastDragScreenY = e.screenY;
        if (window.electronAPI) {
          window.electronAPI.moveWindow(dx, dy);
          this._windowX += dx;
        }
      }
    });

    // ── 点击交互 ──
    let clickCount = 0;
    let clickTimer = null;
    let mouseMoved = false;
    let mouseDownX = 0;
    let mouseDownY = 0;
    let isMouseDown = false;

    this.canvas.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      mouseDownX = e.screenX;
      mouseDownY = e.screenY;
      this._lastDragScreenX = e.screenX;
      this._lastDragScreenY = e.screenY;
      mouseMoved = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging && !mouseMoved && isMouseDown) {
        const dx = e.screenX - mouseDownX;
        const dy = e.screenY - mouseDownY;
        // 移动超过 8px 才触发拖拽
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          mouseMoved = true;
          this._startDrag();
        }
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      isMouseDown = false;
      if (this.isDragging) {
        this._endDrag();
      } else if (!mouseMoved) {
        clickCount++;
        if (clickCount === 1) {
          clickTimer = setTimeout(() => { clickCount = 0; this._onSingleClick(); }, 300);
        } else if (clickCount === 2) {
          clearTimeout(clickTimer);
          clickCount = 0;
          this._onDoubleClick();
        }
      }
      mouseMoved = false;
    });

    // document 级别 mouseup 处理窗口外松手
    document.addEventListener('mouseup', () => {
      isMouseDown = false;
      if (this.isDragging) this._endDrag();
    });

    this.canvas.addEventListener('mouseleave', () => {
      isMouseDown = false;
      if (this.isDragging) this._endDrag();
      mouseMoved = false;
    });

    // 右键打开设置
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (window.electronAPI && window.electronAPI.openSettingsWindow) {
        window.electronAPI.openSettingsWindow();
      }
    });
  }

  /**
   * 更新视线方向
   */
  _updateLookDirection(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    this.drawer.lookX = Math.max(-1, Math.min(1, dx / (rect.width * 0.8)));
    this.drawer.lookY = Math.max(-1, Math.min(1, dy / (rect.height * 0.8)));

    // 跟随鼠标左右翻转身体朝向
    if (!this.isDragging && this.state === this.STATES.IDLE) {
      if (dx < -30) this.drawer.direction = -1;
      else if (dx > 30) this.drawer.direction = 1;
    }
  }

  // ── 交互事件处理 ──

  _onSingleClick() {
    // 提醒状态下单击不响应（仅双击可解除）
    if (this.state === this.STATES.REMINDER) return;
    if (this.state !== this.STATES.IDLE) return;
    const action = this.clickActions[Math.floor(Math.random() * this.clickActions.length)];
    this._switchState(action);
  }

  _onDoubleClick() {
    // 提醒状态：双击解除提醒
    if (this.state === this.STATES.REMINDER) {
      this.reminder.reset();
      return;
    }
    this._switchState(this.STATES.ROLL);
  }

  _startDrag() {
    this.isDragging = true;
    this._switchState(this.STATES.DRAGGED);
  }

  _endDrag() {
    this.isDragging = false;
    this._lastDragScreenX = null;
    this._lastDragScreenY = null;
    this._switchState(this.STATES.IDLE);
  }

  // ── 提醒 ──

  _onReminderTrigger() {
    if (this.isReminding) return;
    this.isReminding = true;
    this._switchState(this.STATES.REMINDER);
    this.reminder.showBubble(this.canvas);
  }

  /** 提醒关闭后的处理 */
  onReminderDismissed() {
    this.isReminding = false;
    this._switchState(this.STATES.IDLE);
    this.reminder.start(true);
  }

  /** 关联设置面板（用于右键打开） */
  setSettingsPanel(panel) {
    this._settingsPanel = panel;
  }

  // ═══════════════════════════════════════════════════════
  //  状态机
  // ═══════════════════════════════════════════════════════

  /**
   * 切换动画状态
   */
  _switchState(newState) {
    if (this.state === newState && newState !== this.STATES.WALK) return;

    this.state = newState;
    this.stateStartTime = performance.now();
    this.frameIndex = 0;

    switch (newState) {
      case this.STATES.IDLE:
        this.stateDuration = Infinity; // 循环
        this.totalFrames = 6;
        this.idleTime = 0;
        this.nextWalkTime = 8000 + Math.random() * 15000;
        break;

      case this.STATES.WALK:
        this.stateDuration = this.walkDuration;
        this.totalFrames = 8;
        this._initWalk();
        break;

      case this.STATES.JUMP:
        this.stateDuration = 600;
        this.totalFrames = 8;
        break;

      case this.STATES.HEAD_TILT:
        this.stateDuration = 1200;
        this.totalFrames = 12;
        break;

      case this.STATES.PAW_REACH:
        this.stateDuration = 1000;
        this.totalFrames = 10;
        break;

      case this.STATES.ROLL:
        this.stateDuration = 1500;
        this.totalFrames = 16;
        break;

      case this.STATES.DRAGGED:
        this.stateDuration = Infinity; // 循环，直到拖拽结束
        this.totalFrames = 4;
        break;

      case this.STATES.REMINDER:
        this.stateDuration = Infinity; // 循环，直到关闭
        this.totalFrames = 8;
        break;

      case this.STATES.SLEEP:
        this.stateDuration = Infinity;
        this.totalFrames = 6;
        break;
    }
  }

  /** 初始化走动参数（同步，使用自追踪的 _windowX） */
  _initWalk() {
    const screenW = window.screen?.width || 1920;
    const winW = this.canvas.width;
    const margin = 20;

    // 目标 = 窗口左上角 x，钳制在屏幕可见范围内
    const minX = margin;
    const maxX = screenW - winW - margin;
    const targetX = minX + Math.random() * Math.max(1, maxX - minX);

    // _walkStartScreenX / _walkTargetScreenX 表示窗口左上角 x（统一坐标系）
    this._walkStartScreenX = this._windowX;
    this._walkTargetScreenX = targetX;

    // 安全检查
    if (isNaN(this._walkStartScreenX) || isNaN(this._walkTargetScreenX)) {
      console.warn('[WALK] 位置计算异常，取消走动');
      this._switchState(this.STATES.IDLE);
      return;
    }

    console.log('[WALK] 走动:', { windowX: this._windowX, start: this._walkStartScreenX, target: this._walkTargetScreenX, screenW });

    this.drawer.direction = this._walkTargetScreenX > this._walkStartScreenX ? 1 : -1;

    this.walkDuration = 2000 + Math.random() * 4000;
    this.stateDuration = this.walkDuration;
  }

  // ═══════════════════════════════════════════════════════
  //  渲染循环
  // ═══════════════════════════════════════════════════════

  _renderLoop() {
    try {
    const now = performance.now();
    const elapsed = now - this.stateStartTime;

    // 计算当前帧
    if (this.state === this.STATES.IDLE) {
      // 空闲：循环动画（300ms / 帧，节奏舒缓）
      this.frameIndex = Math.floor((elapsed / 300) % this.totalFrames);

      // 闲置过久触发随机走动
      this.idleTime = elapsed;
      if (this.idleTime > this.nextWalkTime) {
        this._switchState(this.STATES.WALK);
        this.animFrameId = requestAnimationFrame(() => this._renderLoop());
        return;
      }
    } else if (this.state === this.STATES.REMINDER) {
      // 提醒：循环播放精灵图（150ms / 帧），直到双击解除
      this.frameIndex = Math.floor((elapsed / 150) % this.totalFrames);
    } else if (this.state === this.STATES.DRAGGED) {
      // 拖拽：循环播放
      this.frameIndex = Math.floor((elapsed / 120) % this.totalFrames);
    } else if (this.state === this.STATES.SLEEP) {
      // 睡觉：循环播放
      this.frameIndex = Math.floor((elapsed / 200) % this.totalFrames);
    } else {
      // 有限状态
      const progress = Math.min(elapsed / this.stateDuration, 1);
      this.frameIndex = Math.min(
        Math.floor(progress * this.totalFrames),
        this.totalFrames - 1
      );

      // 走动时的窗口位移
      if (this.state === this.STATES.WALK) {
        const t = Math.min(elapsed / this.stateDuration, 1);
        const desiredX = this._walkStartScreenX + (this._walkTargetScreenX - this._walkStartScreenX) * t;
        const deltaX = Math.round(desiredX - this._windowX);
        // 安全检查：防止异常大位移；限频：累计 ≥ 2px 才移动一次
        if (window.electronAPI && Math.abs(deltaX) >= 2 && Math.abs(deltaX) < 500) {
          window.electronAPI.moveWindow(deltaX, 0);
          this._windowX += deltaX;
        }
      }

      // 状态结束
      if (progress >= 1) {
        if (this.state === this.STATES.REMINDER) {
          // 提醒保持循环
          this.stateStartTime = now;
          this.frameIndex = 0;
        } else if (this.state === this.STATES.DRAGGED) {
          // 拖拽保持
          this.stateStartTime = now;
          this.frameIndex = 0;
        } else {
          this._switchState(this.STATES.IDLE);
          this.animFrameId = requestAnimationFrame(() => this._renderLoop());
          return;
        }
      }
    }

    // 绘制
    this.drawer.drawFrame(this.ctx, this.canvasW, this.canvasH, this.state, this.frameIndex, this.totalFrames);

    this.animFrameId = requestAnimationFrame(() => this._renderLoop());
    } catch(e) {
      console.error('[RENDER] 渲染循环崩溃:', e.message, e.stack);
      // 尝试恢复
      this._switchState(this.STATES.IDLE);
      this.animFrameId = requestAnimationFrame(() => this._renderLoop());
    }
  }

  /** 销毁 */
  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.reminder.destroy();
  }
}

if (typeof module !== 'undefined') module.exports = PetController;
