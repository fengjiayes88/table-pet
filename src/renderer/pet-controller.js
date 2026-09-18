/**
 * 宠物行为控制器
 * 动画状态机、交互处理、窗口移动和节流渲染。
 */
class PetController {
  constructor(canvas, petDrawer, reminder) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    this.drawer = petDrawer;
    this.reminder = reminder;

    this.STATES = Object.freeze({
      IDLE: 'idle',
      WALK: 'walk',
      JUMP: 'jump',
      HEAD_TILT: 'headTilt',
      PAW_REACH: 'pawReach',
      ROLL: 'roll',
      DRAGGED: 'dragged',
      REMINDER: 'reminder',
      SLEEP: 'sleep',
    });

    this.state = this.STATES.IDLE;
    this.stateStartTime = 0;
    this.stateDuration = Infinity;
    this.frameIndex = 0;
    this.totalFrames = 1;
    this.frameMs = 200;
    this.animationLoops = true;

    const now = performance.now();
    this.idleTime = 0;
    this.lastUserActivityTime = now;
    this.nextWalkTime = now + this._randomWalkDelay();
    this.nextJumpTime = now + this._randomJumpDelay();
    this.sleepAfterMs = 120000;

    this.walkDuration = 3000;
    this._walkStartScreenX = 0;
    this._walkTargetScreenX = 0;
    this._windowX = 0;
    this._windowY = 0;
    this._workArea = null;
    this._walkPreparationPending = false;

    this.isDragging = false;
    this._lastDragScreenX = null;
    this._lastDragScreenY = null;
    this._moveRequestPending = false;
    this._queuedMove = { x: 0, y: 0 };

    this.mouseScreenX = 0;
    this.mouseScreenY = 0;
    this.mouseClientX = 0;
    this.mouseClientY = 0;
    this._mouseInsideWindow = false;
    this._ignoringMouse = false;

    this.clickActions = [this.STATES.JUMP, this.STATES.HEAD_TILT, this.STATES.PAW_REACH];
    this.isReminding = false;

    this.animFrameId = null;
    this.loopTimerId = null;
    this.destroyed = false;
    this._lastRenderedState = null;
    this._lastRenderedFrame = -1;
    this._needsRender = true;
    this._stateRevision = 0;

    this.settings = {};
    this.canvasW = 180;
    this.canvasH = 180;
    this.dpr = 1;
    this._eventDisposers = [];
  }

  async init() {
    this.settings = await this._loadSettings();
    this.reminder.configure({
      enabled: this.settings.reminderEnabled,
      intervalMinutes: this.settings.reminderInterval,
    });
    this.reminder.onTrigger = () => this._onReminderTrigger();

    this._resizeCanvas();
    this._bindEvents();
    await this.drawer.ready;
    // 提醒可能在应用长时间失焦后触发，提前加载避免首次提醒停在占位帧。
    await this.drawer.ensureState(this.STATES.REMINDER);
    await this._refreshWindowMetrics();

    this._switchState(this.STATES.IDLE, true);
    this._renderLoop();

    if (window.electronAPI) {
      window.electronAPI.onSettingsChanged((nextSettings) => {
        const previous = this.settings;
        this.settings = nextSettings;

        const reminderChanged =
          previous.reminderEnabled !== nextSettings.reminderEnabled ||
          previous.reminderInterval !== nextSettings.reminderInterval;
        if (reminderChanged) {
          this.reminder.configure({
            enabled: nextSettings.reminderEnabled,
            intervalMinutes: nextSettings.reminderInterval,
          });
          if (!nextSettings.reminderEnabled && this.isReminding) this.reminder.reset();
        }

        this.drawer.scale = nextSettings.size;
        this._resizeCanvas();
      });

      window.electronAPI.onWindowSizeChanged((data) => {
        this._setCanvasSize(data.width, data.height);
        this.drawer.scale = data.scale;
      });

      window.electronAPI.onReminderDismissed(() => {
        if (this.isReminding) this.reminder.reset(true);
      });
    }
  }

  async _loadSettings() {
    try {
      return await window.electronAPI.getSettings();
    } catch (error) {
      console.error('[SETTINGS] 读取失败，使用默认值', error);
      return {
        size: 1,
        opacity: 0.95,
        alwaysOnTop: true,
        autoLaunch: true,
        reminderEnabled: true,
        reminderInterval: 45,
      };
    }
  }

  _resizeCanvas() {
    const size = Number.isFinite(this.settings.size) ? this.settings.size : 1;
    const cssSize = Math.round(180 * size);
    this._setCanvasSize(cssSize, cssSize);
    this.drawer.scale = size;
  }

  _setCanvasSize(cssWidth, cssHeight) {
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.canvasW = cssWidth;
    this.canvasH = cssHeight;
    this._needsRender = true;
  }

  _listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this._eventDisposers.push(() => target.removeEventListener(type, listener, options));
  }

  _bindEvents() {
    this._listen(document, 'mousemove', (event) => {
      this._markUserActivity();
      this.mouseScreenX = event.screenX;
      this.mouseScreenY = event.screenY;
      this.mouseClientX = event.clientX;
      this.mouseClientY = event.clientY;
      this._mouseInsideWindow = true;
      if (this.state === this.STATES.SLEEP) this._switchState(this.STATES.IDLE);
      this._updateLookDirection(event.clientX, event.clientY);
      this._updatePointerPassthrough();

      if (this.isDragging && this._lastDragScreenX !== null) {
        const deltaX = event.screenX - this._lastDragScreenX;
        const deltaY = event.screenY - this._lastDragScreenY;
        this._lastDragScreenX = event.screenX;
        this._lastDragScreenY = event.screenY;
        this._queueWindowMove(deltaX, deltaY);
      }
    });

    this._listen(document, 'mouseleave', () => {
      this._mouseInsideWindow = false;
      if (!this.isDragging) this._setMouseIgnored(true);
    });

    let clickCount = 0;
    let clickTimer = null;
    let mouseMoved = false;
    let mouseDownX = 0;
    let mouseDownY = 0;
    let isMouseDown = false;

    this._listen(this.canvas, 'mousedown', (event) => {
      if (event.button !== 0 || !this._isOpaqueAt(event.clientX, event.clientY)) return;
      this._markUserActivity();
      isMouseDown = true;
      mouseDownX = event.screenX;
      mouseDownY = event.screenY;
      this._lastDragScreenX = event.screenX;
      this._lastDragScreenY = event.screenY;
      mouseMoved = false;
    });

    this._listen(this.canvas, 'mousemove', (event) => {
      if (!this.isDragging && !mouseMoved && isMouseDown) {
        const deltaX = event.screenX - mouseDownX;
        const deltaY = event.screenY - mouseDownY;
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
          mouseMoved = true;
          this._startDrag();
        }
      }
    });

    this._listen(this.canvas, 'mouseup', (event) => {
      if (event.button !== 0) return;
      isMouseDown = false;
      if (this.isDragging) {
        this._endDrag();
      } else if (!mouseMoved) {
        clickCount += 1;
        if (clickCount === 1) {
          clickTimer = setTimeout(() => {
            clickCount = 0;
            this._onSingleClick();
          }, 300);
        } else {
          clearTimeout(clickTimer);
          clickCount = 0;
          this._onDoubleClick();
        }
      }
      mouseMoved = false;
    });

    this._listen(document, 'mouseup', () => {
      isMouseDown = false;
      if (this.isDragging) this._endDrag();
    });

    this._listen(this.canvas, 'pointercancel', () => {
      isMouseDown = false;
      mouseMoved = false;
      if (this.isDragging) this._endDrag();
    });

    const openSettings = (event) => {
      if (!this._isOpaqueAt(event.clientX, event.clientY)) return;
      event.preventDefault();
      event.stopPropagation();
      window.electronAPI?.openSettingsWindow();
    };
    this._listen(this.canvas, 'contextmenu', openSettings);
  }

  _updateLookDirection(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const deltaX = clientX - (rect.left + rect.width / 2);
    const deltaY = clientY - (rect.top + rect.height / 2);
    this.drawer.lookX = Math.max(-1, Math.min(1, deltaX / (rect.width * 0.8)));
    this.drawer.lookY = Math.max(-1, Math.min(1, deltaY / (rect.height * 0.8)));

    if (!this.isDragging && this.state === this.STATES.IDLE) {
      const previousDirection = this.drawer.direction;
      if (deltaX < -30) this.drawer.direction = -1;
      if (deltaX > 30) this.drawer.direction = 1;
      if (previousDirection !== this.drawer.direction) this._needsRender = true;
    }

    if (!this.drawer.getAnimationInfo(this.state).usesSprite) this._needsRender = true;
  }

  _isOpaqueAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) {
      return false;
    }
    try {
      const x = Math.min(this.canvas.width - 1, Math.max(0, Math.floor((clientX - rect.left) * this.dpr)));
      const y = Math.min(this.canvas.height - 1, Math.max(0, Math.floor((clientY - rect.top) * this.dpr)));
      return this.ctx.getImageData(x, y, 1, 1).data[3] > 24;
    } catch (error) {
      return true;
    }
  }

  _updatePointerPassthrough() {
    if (this.isDragging) {
      this._setMouseIgnored(false);
      return;
    }
    const overPet = this._mouseInsideWindow && this._isOpaqueAt(this.mouseClientX, this.mouseClientY);
    this._setMouseIgnored(!overPet);
  }

  _setMouseIgnored(ignore) {
    if (this._ignoringMouse === ignore) return;
    this._ignoringMouse = ignore;
    window.electronAPI?.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined);
  }

  _onSingleClick() {
    this._markUserActivity();
    if (this.state === this.STATES.SLEEP) {
      this._switchState(this.STATES.IDLE);
      return;
    }
    if (this.state !== this.STATES.IDLE) return;
    const action = this.clickActions[Math.floor(Math.random() * this.clickActions.length)];
    this._switchState(action);
  }

  _onDoubleClick() {
    this._markUserActivity();
    if (this.state === this.STATES.REMINDER) {
      this.reminder.reset();
      return;
    }
    this._switchState(this.STATES.ROLL);
  }

  _startDrag() {
    this._markUserActivity();
    this.isDragging = true;
    this._setMouseIgnored(false);
    this._switchState(this.STATES.DRAGGED);
  }

  async _endDrag() {
    this.isDragging = false;
    this._lastDragScreenX = null;
    this._lastDragScreenY = null;
    await window.electronAPI?.persistWindowPosition?.();
    this._switchState(this.isReminding ? this.STATES.REMINDER : this.STATES.IDLE, true);
    this._updatePointerPassthrough();
  }

  _onReminderTrigger() {
    if (this.isReminding) return;
    this.isReminding = true;
    this._switchState(this.STATES.REMINDER);
    this.reminder.showBubble(this.canvas);
  }

  onReminderDismissed() {
    this._markUserActivity();
    this.isReminding = false;
    this._switchState(this.STATES.IDLE);
    this.reminder.start(true);
  }

  _switchState(newState, force = false) {
    if (!force && this.state === newState && newState !== this.STATES.WALK) return;

    this.state = newState;
    this.stateStartTime = performance.now();
    this.frameIndex = 0;
    const revision = ++this._stateRevision;

    const animation = this.drawer.getAnimationInfo(newState);
    this._applyAnimationInfo(newState, animation);

    this.drawer.ensureState(newState).then((loaded) => {
      if (!loaded || this.destroyed || this.state !== newState || this._stateRevision !== revision) return;

      const loadedAnimation = this.drawer.getAnimationInfo(newState);
      const metadataChanged =
        loadedAnimation.totalFrames !== this.totalFrames ||
        loadedAnimation.frameMs !== this.frameMs ||
        loadedAnimation.loop !== this.animationLoops;

      this._applyAnimationInfo(newState, loadedAnimation);
      if (metadataChanged) {
        // Lazy states initially expose one fallback frame. Start the real strip
        // from frame zero once loaded so the first action is never truncated or frozen.
        this.stateStartTime = performance.now();
        this.frameIndex = 0;
        this._lastRenderedState = null;
        this._lastRenderedFrame = -1;
      }
      this._needsRender = true;
    }).catch((error) => {
      console.error(`[SPRITE] ${newState} 状态准备失败`, error);
    });

    this._lastRenderedState = null;
    this._lastRenderedFrame = -1;
    this._needsRender = true;
  }

  _applyAnimationInfo(state, animation) {
    this.totalFrames = animation.totalFrames;
    this.frameMs = animation.frameMs;
    this.animationLoops = animation.loop;
    this.stateDuration = window.AnimationLogic.durationMs(animation);

    if (state === this.STATES.IDLE) {
      this.idleTime = 0;
    } else if (state === this.STATES.WALK) {
      this.stateDuration = this.walkDuration;
    }
  }

  _markUserActivity(now = performance.now()) {
    this.lastUserActivityTime = now;
    this.idleTime = 0;
    this.nextWalkTime = now + this._randomWalkDelay();
    this.nextJumpTime = now + this._randomJumpDelay();
  }

  _randomWalkDelay() {
    return 8000 + Math.random() * 15000;
  }

  _randomJumpDelay() {
    return 12000 + Math.random() * 18000;
  }

  _nextIdleEvent(now) {
    if (now - this.lastUserActivityTime >= this.sleepAfterMs) return this.STATES.SLEEP;
    if (now >= this.nextJumpTime) return this.STATES.JUMP;
    if (now >= this.nextWalkTime) return this.STATES.WALK;
    return null;
  }

  async _prepareWalk() {
    if (this._walkPreparationPending || this.state !== this.STATES.IDLE) return;
    this._walkPreparationPending = true;
    try {
      await this._refreshWindowMetrics();
      if (this.state !== this.STATES.IDLE) return;

      const workArea = this._workArea || { x: 0, width: window.screen.availWidth };
      const windowWidth = this.canvasW;
      const margin = 20;
      const minX = workArea.x + margin;
      const maxX = workArea.x + workArea.width - windowWidth - margin;
      this._walkStartScreenX = this._windowX;
      this._walkTargetScreenX = minX + Math.random() * Math.max(1, maxX - minX);
      this.walkDuration = 2000 + Math.random() * 4000;
      this.drawer.direction = this._walkTargetScreenX >= this._walkStartScreenX ? 1 : -1;
      this._switchState(this.STATES.WALK);
    } finally {
      this._walkPreparationPending = false;
    }
  }

  async _refreshWindowMetrics() {
    try {
      const metrics = await window.electronAPI?.getWindowMetrics?.();
      if (!metrics) return;
      this._windowX = metrics.x;
      this._windowY = metrics.y;
      this._workArea = metrics.workArea;
    } catch (error) {
      console.error('[WINDOW] 读取位置失败', error);
    }
  }

  _queueWindowMove(deltaX, deltaY) {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    this._queuedMove.x += deltaX;
    this._queuedMove.y += deltaY;
    if (this._moveRequestPending) return;

    this._moveRequestPending = true;
    const flush = async () => {
      const move = this._queuedMove;
      this._queuedMove = { x: 0, y: 0 };
      try {
        const metrics = await window.electronAPI?.moveWindow?.(move.x, move.y);
        if (metrics) {
          this._windowX = metrics.x;
          this._windowY = metrics.y;
          this._workArea = metrics.workArea;
        }
      } finally {
        this._moveRequestPending = false;
        if (this._queuedMove.x || this._queuedMove.y) this._queueWindowMove(0, 0);
      }
    };
    flush();
  }

  _scheduleNextFrame(delayMs) {
    if (this.destroyed) return;
    clearTimeout(this.loopTimerId);
    this.loopTimerId = setTimeout(() => {
      this.animFrameId = requestAnimationFrame(() => this._renderLoop());
    }, delayMs);
  }

  _renderLoop() {
    if (this.destroyed) return;

    try {
      const now = performance.now();
      const elapsed = now - this.stateStartTime;
      const nextFrame = window.AnimationLogic.frameAtElapsed({
        totalFrames: this.totalFrames,
        frameMs: this.frameMs,
        loop: this.animationLoops,
      }, elapsed);

      if (nextFrame !== this.frameIndex) {
        this.frameIndex = nextFrame;
        this._needsRender = true;
      }

      if (this.state === this.STATES.IDLE) {
        this.idleTime = Math.max(0, now - this.lastUserActivityTime);
        const idleEvent = this._nextIdleEvent(now);
        if (idleEvent === this.STATES.SLEEP) {
          this._switchState(this.STATES.SLEEP);
        } else if (idleEvent === this.STATES.JUMP) {
          this.nextJumpTime = now + this._randomJumpDelay();
          this._switchState(this.STATES.JUMP);
        } else if (idleEvent === this.STATES.WALK) {
          this.nextWalkTime = now + this._randomWalkDelay();
          this._prepareWalk();
        }
      } else if (this.state === this.STATES.WALK) {
        const progress = Math.min(elapsed / this.stateDuration, 1);
        const desiredX = this._walkStartScreenX +
          (this._walkTargetScreenX - this._walkStartScreenX) * progress;
        const deltaX = Math.round(desiredX - this._windowX);
        if (Math.abs(deltaX) >= 1 && Math.abs(deltaX) < 500) this._queueWindowMove(deltaX, 0);
        if (progress >= 1) {
          window.electronAPI?.persistWindowPosition?.();
          this._switchState(this.STATES.IDLE);
        }
      } else if (Number.isFinite(this.stateDuration) && elapsed >= this.stateDuration) {
        this._switchState(this.STATES.IDLE);
      }

      if (
        this._needsRender ||
        this._lastRenderedState !== this.state ||
        this._lastRenderedFrame !== this.frameIndex
      ) {
        this.drawer.drawFrame(
          this.ctx,
          this.canvasW,
          this.canvasH,
          this.state,
          this.frameIndex,
          this.totalFrames,
        );
        this._lastRenderedState = this.state;
        this._lastRenderedFrame = this.frameIndex;
        this._needsRender = false;
        this._updatePointerPassthrough();
      }

      const delay = this.state === this.STATES.WALK ? 16 : Math.min(100, this.frameMs);
      this._scheduleNextFrame(delay);
    } catch (error) {
      console.error('[RENDER] 渲染循环异常', error);
      this._switchState(this.isReminding ? this.STATES.REMINDER : this.STATES.IDLE, true);
      this._scheduleNextFrame(100);
    }
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.loopTimerId);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    for (const dispose of this._eventDisposers.splice(0)) dispose();
    this.reminder.destroy();
  }
}

if (typeof module !== 'undefined') module.exports = PetController;
