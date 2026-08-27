/**
 * 七七精灵图清单。
 *
 * 帧数、播放速度和循环语义只在这里维护；控制器和绘制器都读取同一份数据，
 * 避免素材是 4 帧、状态机却按 6/8/10 帧播放的问题。
 */
const PET_SPRITES = Object.freeze({
  idle: {
    files: [{ name: 'idle@4.png', frames: 4 }],
    frameMs: 300,
    loop: true,
  },
  walk: {
    files: [
      { name: 'walk@4.png', frames: 4 },
      { name: 'walk2@4.png', frames: 4 },
    ],
    frameMs: 140,
    loop: true,
  },
  jump: {
    files: [{ name: 'jump@4.png', frames: 4 }],
    frameMs: 150,
    loop: false,
  },
  headTilt: {
    files: [{ name: 'head-tilt@4.png', frames: 4 }],
    frameMs: 300,
    loop: false,
  },
  pawReach: {
    files: [{ name: 'paw-reach@4.png', frames: 4 }],
    frameMs: 250,
    loop: false,
  },
  roll: {
    files: [
      { name: 'roll1@4.png', frames: 4 },
      { name: 'roll2@4.png', frames: 4 },
    ],
    frameMs: 190,
    loop: false,
  },
  dragged: {
    files: [{ name: 'dragged@4.png', frames: 4 }],
    frameMs: 160,
    loop: true,
  },
  reminder: {
    files: [
      { name: 'reminder@4.png', frames: 4 },
      { name: 'reminder2@4.png', frames: 4 },
    ],
    frameMs: 180,
    loop: true,
  },
  sleep: {
    files: [{ name: 'sleep@4.png', frames: 4 }],
    frameMs: 350,
    loop: true,
  },
});

if (typeof window !== 'undefined') window.PET_SPRITES = PET_SPRITES;
if (typeof module !== 'undefined') module.exports = PET_SPRITES;
