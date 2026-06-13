/**
 * 七七宠物绘制引擎
 * 使用 Canvas 2D 绘制卡通花猫（西伯利亚森林猫 + 白手套）
 * 在美术精灵图到位前作为占位素材
 */

class PetDrawer {
  constructor(scale = 1) {
    this.scale = scale;
    this.lookX = 0;   // 视线方向 (-1 左, 0 中, 1 右)
    this.lookY = 0;   // 视线方向 (-1 上, 0 中, 1 下)
    this.direction = 1; // 1 = 朝右, -1 = 朝左
  }

  // ── 颜色配置 ──
  get colors() {
    return {
      bodyMain:    '#FAF5EF', // 主体奶油白
      patchOrange: '#E8923F', // 橘色斑块
      patchDark:   '#5D4E37', // 深色斑块
      pawWhite:    '#FDFDFD', // 白手套
      nose:        '#FFB3BA', // 粉鼻子
      earInner:    '#F5C6CB', // 耳朵内侧
      eyeGold:     '#F5C842', // 金色眼瞳
      eyePupil:    '#2C1810', // 深色瞳孔
      outline:     '#4A3728', // 轮廓线
      mouthLine:   '#8B6F5E', // 嘴线
    };
  }

  // ── 工具方法 ──
  s(v) { return v * this.scale; }

  /**
   * 绘制完整一帧
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasW 画布宽度
   * @param {number} canvasH 画布高度
   * @param {string} state 状态名
   * @param {number} frameIndex 帧序号 (0-based)
   * @param {number} totalFrames 总帧数
   */
  drawFrame(ctx, canvasW, canvasH, state, frameIndex, totalFrames) {
    ctx.clearRect(0, 0, canvasW, canvasH);
    const cx = canvasW / 2;
    const cy = canvasH * 0.52;

    ctx.save();
    ctx.scale(this.direction, 1);
    if (this.direction === -1) {
      ctx.translate(-canvasW, 0);
    }

    const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;

    switch (state) {
      case 'idle':     this._drawIdle(ctx, cx, cy, progress); break;
      case 'walk':     this._drawWalk(ctx, cx, cy, progress); break;
      case 'jump':     this._drawJump(ctx, cx, cy, progress); break;
      case 'headTilt': this._drawHeadTilt(ctx, cx, cy, progress); break;
      case 'pawReach': this._drawPawReach(ctx, cx, cy, progress); break;
      case 'roll':     this._drawRoll(ctx, cx, cy, progress); break;
      case 'dragged':  this._drawDragged(ctx, cx, cy, progress); break;
      case 'reminder': this._drawReminder(ctx, cx, cy, progress); break;
      case 'sleep':    this._drawSleep(ctx, cx, cy, progress); break;
      default:         this._drawIdle(ctx, cx, cy, progress);
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════
  //  状态帧绘制
  // ═══════════════════════════════════════════════════════

  // ── 待机：呼吸起伏 + 眨眼 + 摇尾巴 ──
  _drawIdle(ctx, cx, cy, progress) {
    const breathe = Math.sin(progress * Math.PI * 2) * this.s(3);
    const blinkPhase = (progress * 8) % 1;
    const blinking = blinkPhase > 0.92;
    const tailSway = Math.sin(progress * Math.PI * 4) * this.s(6);

    // 身体
    this._drawBody(ctx, cx, cy + this.s(15) + breathe, 0);
    // 尾巴（摆动）
    this._drawTail(ctx, cx - this.s(22), cy + this.s(8), this.s(10) + tailSway, this.s(20) + tailSway * 0.5);
    // 后腿
    this._drawBackLegs(ctx, cx, cy + this.s(18), 0);
    // 前腿
    this._drawFrontLegs(ctx, cx, cy + this.s(16), 0);
    // 头部
    this._drawHead(ctx, cx, cy - this.s(10) + breathe, 0, 0, blinking);
  }

  // ── 走动 ──
  _drawWalk(ctx, cx, cy, progress) {
    const stepCycle = progress * Math.PI * 2;
    const bodyBob = Math.abs(Math.sin(stepCycle)) * this.s(4);
    const legPhase = stepCycle;
    const tailWave = Math.sin(stepCycle * 1.5) * this.s(8);

    // 身体微微上下
    this._drawBody(ctx, cx, cy + this.s(15) + bodyBob, 0);
    this._drawTail(ctx, cx - this.s(22), cy + this.s(8) - bodyBob, this.s(12) + tailWave, this.s(18) + tailWave);

    // 交替迈腿
    this._drawBackLegs(ctx, cx, cy + this.s(18) + bodyBob, legPhase);
    this._drawFrontLegs(ctx, cx, cy + this.s(16) + bodyBob, legPhase + Math.PI);

    this._drawHead(ctx, cx, cy - this.s(8) + bodyBob, 0, 0, false);
  }

  // ── 跳起 ──
  _drawJump(ctx, cx, cy, progress) {
    // squash and stretch
    let bodyScaleY, bodyOffsetY, squashAmount;
    if (progress < 0.3) {
      // 预备下蹲 (squash)
      const t = progress / 0.3;
      squashAmount = 1 + t * 0.3;
      bodyScaleY = 1 / squashAmount;
      bodyOffsetY = this.s(8) * t;
    } else if (progress < 0.6) {
      // 弹起 (stretch)
      const t = (progress - 0.3) / 0.3;
      squashAmount = 1.3 - t * 0.6;
      bodyScaleY = 1 / squashAmount;
      bodyOffsetY = -this.s(25) * t;
    } else {
      // 回落
      const t = (progress - 0.6) / 0.4;
      bodyOffsetY = -this.s(25) + t * this.s(25);
      squashAmount = 0.7 + t * 0.3;
      bodyScaleY = 1;
    }

    ctx.save();
    ctx.translate(cx, cy - bodyOffsetY);
    ctx.scale(1, bodyScaleY);

    this._drawBody(ctx, 0, this.s(15), 0);
    this._drawTail(ctx, -this.s(22), this.s(8), this.s(14), this.s(16));
    this._drawBackLegs(ctx, 0, this.s(18), 0);
    this._drawFrontLegs(ctx, 0, this.s(16), Math.PI * 0.3);
    this._drawHead(ctx, 0, -this.s(10), 0, 0, false);

    ctx.restore();
  }

  // ── 歪头 ──
  _drawHeadTilt(ctx, cx, cy, progress) {
    // head tilt animation: tilt right, return, tilt more
    const tiltAngle = Math.sin(progress * Math.PI) * 0.4;

    this._drawBody(ctx, cx, cy + this.s(15), 0);
    this._drawTail(ctx, cx - this.s(22), cy + this.s(8), this.s(10), this.s(20));
    this._drawBackLegs(ctx, cx, cy + this.s(18), 0);
    this._drawFrontLegs(ctx, cx, cy + this.s(16), 0);
    this._drawHead(ctx, cx, cy - this.s(10), tiltAngle, 0, false);
  }

  // ── 伸爪 ──
  _drawPawReach(ctx, cx, cy, progress) {
    const reachX = Math.sin(progress * Math.PI) * this.s(18);

    this._drawBody(ctx, cx, cy + this.s(15), 0);
    this._drawTail(ctx, cx - this.s(22), cy + this.s(8), this.s(12), this.s(18));
    this._drawBackLegs(ctx, cx, cy + this.s(18), 0);
    this._drawHead(ctx, cx, cy - this.s(10), 0, 0, false);

    // 伸出的前爪
    this._drawSingleFrontPaw(ctx, cx + this.s(8) + reachX, cy + this.s(12), 20);
  }

  // ── 打滚 ──
  _drawRoll(ctx, cx, cy, progress) {
    const t = progress;
    let angle, bodyY, headX, headY;

    if (t < 0.3) {
      angle = t / 0.3 * Math.PI * 0.5;
      bodyY = cy + this.s(8);
      headX = -this.s(5) * (t / 0.3);
      headY = this.s(5);
    } else if (t < 0.6) {
      const p = (t - 0.3) / 0.3;
      angle = Math.PI * 0.5 + p * Math.PI * 0.5;
      bodyY = cy + this.s(8) - p * this.s(5);
      headX = -this.s(5) + p * this.s(5);
      headY = this.s(5) + p * this.s(3);
    } else {
      const p = (t - 0.6) / 0.4;
      angle = Math.PI + p * Math.PI * 0.2;
      bodyY = cy + this.s(3);
      headX = 0;
      headY = this.s(8);
    }

    ctx.save();
    ctx.translate(cx, bodyY);
    ctx.rotate(angle);
    this._drawBody(ctx, 0, this.s(10), 0);
    this._drawHead(ctx, headX, -this.s(10) + headY, 0, 0, true);
    this._drawTail(ctx, -this.s(18), this.s(12), this.s(10), this.s(15));

    // 爪子蜷缩
    this.smallPaw(ctx, this.s(6), this.s(8));
    this.smallPaw(ctx, -this.s(6), this.s(8));
    this.smallPaw(ctx, this.s(4), this.s(16));
    this.smallPaw(ctx, -this.s(4), this.s(16));

    ctx.restore();
  }

  // ── 拖拽（被拎起） ──
  _drawDragged(ctx, cx, cy, progress) {
    this._drawHead(ctx, cx, cy - this.s(15), 0.05, 0, false);
    // 下垂身体
    ctx.save();
    ctx.translate(cx, cy + this.s(5));
    this._drawBody(ctx, 0, this.s(8), 0);
    // 下垂四肢
    this._drawDanglingLeg(ctx, this.s(8), this.s(15));
    this._drawDanglingLeg(ctx, -this.s(8), this.s(15));
    this._drawDanglingLeg(ctx, this.s(18), this.s(20));
    this._drawDanglingLeg(ctx, -this.s(18), this.s(20));
    this._drawTail(ctx, -this.s(22), this.s(10), this.s(6), this.s(12));
    ctx.restore();
  }

  // ── 提醒站立 ──
  _drawReminder(ctx, cx, cy, progress) {
    const wave = Math.sin(progress * Math.PI * 4) * this.s(5);
    const bodyStretch = 1.1 + Math.sin(progress * Math.PI * 2) * 0.05;

    ctx.save();
    ctx.translate(cx, cy + this.s(5));
    ctx.scale(1, bodyStretch);

    // 站立身体（拉长）
    this._drawBodyStanding(ctx, 0, this.s(5));
    // 站立后腿
    this._drawStandBackLegs(ctx, 0, this.s(20));
    // 挥舞前爪
    this._drawWaivingPaw(ctx, this.s(5), -this.s(10) + wave, 0.1);
    this._drawWaivingPaw(ctx, -this.s(5), -this.s(10) - wave, -0.1);
    // 尾巴
    this._drawTail(ctx, -this.s(22), this.s(15), this.s(14), this.s(16));
    this._drawHead(ctx, 0, -this.s(25), 0, 0, false);

    ctx.restore();
  }

  // ── 睡觉 ──
  _drawSleep(ctx, cx, cy, progress) {
    const breathe = Math.sin(progress * Math.PI * 2) * this.s(2);
    ctx.save();
    ctx.translate(cx, cy);
    // 蜷缩身体
    const bodyRx = this.s(28);
    const bodyRy = this.s(16);
    this._drawRoundedRect(ctx, -bodyRx, -bodyRy + breathe, bodyRx * 2, bodyRy * 2, bodyRy);

    // calico 斑块
    const bC = this.colors;
    ctx.fillStyle = bC.patchDark;
    ctx.beginPath();
    ctx.ellipse(this.s(5), -this.s(5) + breathe, this.s(8), this.s(10), 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bC.patchOrange;
    ctx.beginPath();
    ctx.ellipse(-this.s(8), this.s(3) + breathe, this.s(7), this.s(8), -0.2, 0, Math.PI * 2);
    ctx.fill();

    // 头靠在身体上
    this._drawHead(ctx, -this.s(15), -this.s(5) + breathe, 0.15, 0, true);
    // 尾巴环绕
    ctx.strokeStyle = bC.bodyMain;
    ctx.lineWidth = this.s(8);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, this.s(4), this.s(22), -0.3, Math.PI * 0.8);
    ctx.stroke();
    ctx.strokeStyle = bC.outline;
    ctx.lineWidth = this.s(2);
    ctx.stroke();
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════
  //  绘制组件
  // ═══════════════════════════════════════════════════════

  /** 绘制头部 */
  _drawHead(ctx, x, y, tilt, rotation, eyesClosed) {
    const c = this.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);

    const r = this.s(18); // 头半径

    // 耳朵
    this._drawEar(ctx, -this.s(8), -this.s(14), -0.3);
    this._drawEar(ctx, this.s(8), -this.s(14), 0.3);

    // 脸部轮廓
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = c.bodyMain;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(2);
    ctx.stroke();

    // 脸部 calico 斑块（额头的深色花纹）
    ctx.fillStyle = c.patchDark;
    ctx.beginPath();
    ctx.ellipse(-this.s(4), -this.s(6), this.s(6), this.s(5), -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.patchOrange;
    ctx.beginPath();
    ctx.ellipse(this.s(5), -this.s(3), this.s(5), this.s(4), 0.15, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    const eyeOffsetX = this.lookX * this.s(3);
    const eyeOffsetY = this.lookY * this.s(2);
    this._drawEye(ctx, -this.s(6) + eyeOffsetX, this.s(1) + eyeOffsetY, eyesClosed);
    this._drawEye(ctx, this.s(6) + eyeOffsetX, this.s(1) + eyeOffsetY, eyesClosed);

    // 鼻子
    ctx.fillStyle = c.nose;
    ctx.beginPath();
    ctx.moveTo(0, -this.s(1));
    ctx.lineTo(-this.s(3), this.s(5));
    ctx.lineTo(this.s(3), this.s(5));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(1);
    ctx.stroke();

    // 嘴巴
    ctx.strokeStyle = c.mouthLine;
    ctx.lineWidth = this.s(1.2);
    ctx.beginPath();
    ctx.moveTo(0, this.s(5));
    ctx.quadraticCurveTo(-this.s(5), this.s(12), -this.s(8), this.s(9));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, this.s(5));
    ctx.quadraticCurveTo(this.s(5), this.s(12), this.s(8), this.s(9));
    ctx.stroke();

    // 胡须
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(1);
    for (const side of [-1, 1]) {
      const sx = side * this.s(6);
      const sy = this.s(3);
      this._whisker(ctx, sx, sy, side * this.s(16), -this.s(5));
      this._whisker(ctx, sx, sy + this.s(2), side * this.s(16), this.s(0));
      this._whisker(ctx, sx, sy + this.s(4), side * this.s(14), this.s(4));
    }

    ctx.restore();
  }

  /** 绘制耳朵 */
  _drawEar(ctx, baseX, baseY, angle) {
    const c = this.colors;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(angle);

    // 外耳
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-this.s(8), -this.s(14));
    ctx.lineTo(this.s(8), -this.s(5));
    ctx.closePath();
    ctx.fillStyle = c.bodyMain;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(2);
    ctx.stroke();

    // 耳朵簇毛 (tuft)
    ctx.strokeStyle = c.bodyMain;
    ctx.lineWidth = this.s(2);
    ctx.beginPath();
    ctx.moveTo(-this.s(2), -this.s(14));
    ctx.lineTo(-this.s(3), -this.s(17));
    ctx.moveTo(this.s(0), -this.s(13));
    ctx.lineTo(this.s(1), -this.s(16));
    ctx.stroke();

    // 内耳
    ctx.beginPath();
    ctx.moveTo(this.s(1), -this.s(2));
    ctx.lineTo(-this.s(5), -this.s(10));
    ctx.lineTo(this.s(5), -this.s(3));
    ctx.closePath();
    ctx.fillStyle = c.earInner;
    ctx.fill();

    ctx.restore();
  }

  /** 绘制眼睛 */
  _drawEye(ctx, x, y, closed) {
    const c = this.colors;
    if (closed) {
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = this.s(2);
      ctx.beginPath();
      ctx.moveTo(x - this.s(5), y);
      ctx.lineTo(x + this.s(5), y);
      ctx.stroke();
      return;
    }

    // 眼白
    ctx.beginPath();
    ctx.ellipse(x, y, this.s(6), this.s(7), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(1.5);
    ctx.stroke();

    // 虹膜
    ctx.beginPath();
    ctx.ellipse(x + this.s(1), y, this.s(4), this.s(5.5), 0, 0, Math.PI * 2);
    ctx.fillStyle = c.eyeGold;
    ctx.fill();

    // 瞳孔
    ctx.beginPath();
    ctx.ellipse(x + this.s(1.5), y, this.s(2.5), this.s(4), 0, 0, Math.PI * 2);
    ctx.fillStyle = c.eyePupil;
    ctx.fill();

    // 高光
    ctx.beginPath();
    ctx.arc(x - this.s(0), y - this.s(2.5), this.s(1.5), 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }

  /** 绘制胡须 */
  _whisker(ctx, x, y, dx, dy) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  }

  /** 绘制身体（坐姿/趴姿） */
  _drawBody(ctx, x, y, rotation) {
    const c = this.colors;
    ctx.save();
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation);

    const bw = this.s(28);
    const bh = this.s(18);

    // 身体椭圆
    ctx.beginPath();
    ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.bodyMain;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(2);
    ctx.stroke();

    // calico 斑块
    ctx.fillStyle = c.patchOrange;
    ctx.beginPath();
    ctx.ellipse(-this.s(8), -this.s(2), this.s(8), this.s(6), -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.patchDark;
    ctx.beginPath();
    ctx.ellipse(this.s(10), this.s(1), this.s(7), this.s(7), 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 绘制身体（站立姿态） */
  _drawBodyStanding(ctx, x, y) {
    const c = this.colors;
    const bw = this.s(22);
    const bh = this.s(28);

    ctx.beginPath();
    ctx.ellipse(x, y, bw, bh, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.bodyMain;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(2);
    ctx.stroke();

    // 斑块
    ctx.fillStyle = c.patchOrange;
    ctx.beginPath();
    ctx.ellipse(x - this.s(5), y - this.s(5), this.s(6), this.s(7), -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.patchDark;
    ctx.beginPath();
    ctx.ellipse(x + this.s(6), y + this.s(2), this.s(5), this.s(6), 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 绘制尾巴 */
  _drawTail(ctx, x, y, amplitude, length) {
    const c = this.colors;
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(amplitude * 0.5, -length * 0.5, amplitude, -length);
    ctx.strokeStyle = c.bodyMain;
    ctx.lineWidth = this.s(9);
    ctx.lineCap = 'round';
    ctx.stroke();

    // 尾巴上的斑纹
    ctx.strokeStyle = c.patchDark;
    ctx.lineWidth = this.s(3);
    ctx.setLineDash([this.s(5), this.s(8)]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 轮廓
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(amplitude * 0.5, -length * 0.5, amplitude, -length);
    ctx.stroke();

    ctx.restore();
  }

  /** 绘制后腿 */
  _drawBackLegs(ctx, bodyX, bodyY, phase) {
    const c = this.colors;

    for (const [side, offset] of [[-1, -this.s(14)], [1, this.s(14)]]) {
      const kick = Math.sin(phase + (side === 1 ? 0 : Math.PI)) * this.s(5);
      const legX = bodyX + offset;
      const legY = bodyY + this.s(5);

      ctx.beginPath();
      ctx.ellipse(legX, legY + kick * 0.5, this.s(6), this.s(8), -0.15 * side, 0, Math.PI * 2);
      ctx.fillStyle = c.bodyMain;
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = this.s(2);
      ctx.stroke();

      // 白手套脚
      ctx.beginPath();
      ctx.ellipse(legX, legY + this.s(8) + kick * 0.5, this.s(4), this.s(3), 0, 0, Math.PI * 2);
      ctx.fillStyle = c.pawWhite;
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = this.s(1.5);
      ctx.stroke();
    }
  }

  /** 绘制前腿 */
  _drawFrontLegs(ctx, bodyX, bodyY, phase) {
    const c = this.colors;

    for (const [side, offset] of [[-1, -this.s(8)], [1, this.s(8)]]) {
      const kick = Math.sin(phase + (side === 1 ? 0 : Math.PI)) * this.s(4);
      const legX = bodyX + offset;
      const legY = bodyY + this.s(5);

      // 腿
      ctx.beginPath();
      ctx.roundRect(legX - this.s(4), legY, this.s(8), this.s(12) + kick * 0.5, this.s(4));
      ctx.fillStyle = c.bodyMain;
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = this.s(2);
      ctx.stroke();

      // 白手套
      ctx.beginPath();
      ctx.ellipse(legX, legY + this.s(14) + kick * 0.5, this.s(5), this.s(4), 0, 0, Math.PI * 2);
      ctx.fillStyle = c.pawWhite;
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = this.s(1.5);
      ctx.stroke();
    }
  }

  /** 绘制单只伸出前爪 */
  _drawSingleFrontPaw(ctx, x, y, angle) {
    const c = this.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);

    ctx.beginPath();
    ctx.roundRect(-this.s(3), 0, this.s(6), this.s(10), this.s(3));
    ctx.fillStyle = c.bodyMain;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(2);
    ctx.stroke();

    // 白手套
    ctx.beginPath();
    ctx.ellipse(0, this.s(12), this.s(4.5), this.s(3.5), 0, 0, Math.PI * 2);
    ctx.fillStyle = c.pawWhite;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(1.5);
    ctx.stroke();

    ctx.restore();
  }

  /** 下垂的腿（拖拽状态） */
  _drawDanglingLeg(ctx, x, y) {
    const c = this.colors;
    ctx.beginPath();
    ctx.roundRect(x - this.s(3), y, this.s(6), this.s(10), this.s(3));
    ctx.fillStyle = c.bodyMain;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(1.5);
    ctx.stroke();

    // 白手套
    ctx.beginPath();
    ctx.ellipse(x, y + this.s(12), this.s(4), this.s(3), 0, 0, Math.PI * 2);
    ctx.fillStyle = c.pawWhite;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(1.5);
    ctx.stroke();
  }

  /** 站立后腿 */
  _drawStandBackLegs(ctx, bodyX, bodyY) {
    const c = this.colors;
    for (const offset of [-this.s(10), this.s(10)]) {
      ctx.beginPath();
      ctx.roundRect(bodyX + offset - this.s(5), bodyY, this.s(10), this.s(8), this.s(4));
      ctx.fillStyle = c.bodyMain;
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = this.s(2);
      ctx.stroke();

      // 白手套
      ctx.beginPath();
      ctx.ellipse(bodyX + offset, bodyY + this.s(10), this.s(4.5), this.s(3.5), 0, 0, Math.PI * 2);
      ctx.fillStyle = c.pawWhite;
      ctx.fill();
      ctx.stroke();
    }
  }

  /** 挥舞的前爪（提醒状态） */
  _drawWaivingPaw(ctx, x, y, angle) {
    const c = this.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.roundRect(-this.s(3.5), -this.s(6), this.s(7), this.s(12), this.s(4));
    ctx.fillStyle = c.bodyMain;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(2);
    ctx.stroke();

    // 白手套
    ctx.beginPath();
    ctx.ellipse(0, -this.s(8), this.s(4.5), this.s(3.5), 0, 0, Math.PI * 2);
    ctx.fillStyle = c.pawWhite;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /** 小爪子（打滚状态） */
  smallPaw(ctx, x, y) {
    const c = this.colors;
    ctx.beginPath();
    ctx.ellipse(x, y, this.s(3.5), this.s(3), 0, 0, Math.PI * 2);
    ctx.fillStyle = c.pawWhite;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = this.s(1.5);
    ctx.stroke();
  }

  /** 圆角矩形辅助 */
  _drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = this.colors.bodyMain;
    ctx.fill();
    ctx.strokeStyle = this.colors.outline;
    ctx.lineWidth = this.s(2);
    ctx.stroke();
  }
}

// 导出
if (typeof module !== 'undefined') module.exports = PetDrawer;
