# 七七桌面宠物 - AI 生成美术资源指南

## 使用说明

### 推荐工具
| 工具 | 入口 | 适合场景 |
|------|------|----------|
| **Midjourney** | Discord | 风格质量最高，角色一致性用 `--cref` 参数 |
| **DALL·E 3**（ChatGPT 内置） | chat.openai.com | 交互式调整，方便迭代 |
| **即梦**（字节） | jimeng.jianying.com | 国内免费，支持图生图、风格转绘 |
| **Stable Diffusion + WebUI** | 本地部署 | 批量生成，完全可控 |

### 核心流程
```
步骤1: 提供七七照片 → 生成「角色设定图」（站立四视图）
步骤2: 用角色设定图作为参考 → 生成各动画状态的「关键帧」
步骤3: 将关键帧拼接成精灵图（用 TexturePacker 或手动 PS）
```

### Midjourney 关键技巧
- **上传七七照片**到 Discord，获取图片链接
- 在 prompt 开头用 `[图片链接]` 作为图生图参考
- 加 `--cref [角色设定图链接]` 保持角色一致性
- 加 `--iw 1.5` 提高参考图权重

---

## 一、角色设定图（先做这个！）

> 这是所有后续动画的基础，需要生成一只"卡通版七七"的完整形象展示。
> 建议先用七七照片 + 图生图方式生成。

### Prompt 1：基础角色设定

```
A cute cartoon calico Siberian forest cat with white mittens on all four paws, chibi kawaii style, 
standing on four legs facing right side view, fluffy long fur, tufted ears,
big round sparkling eyes, small pink nose, white chest and belly, fluffy thick tail pointing up, 
clean simple design with soft cel shading, game character sprite style,
white background, character reference sheet style, front view + side view,
2D game art, Studio Ghibli inspired soft colors, --ar 16:9 --style cute
```

### Prompt 2：表情和姿态变体

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style, 
multiple poses: sitting, lying down, walking, jumping, playing,
same character design consistent style, sprite sheet layout,
white background, 2D game animation reference, --cref [角色设定图链接] --ar 16:9
```

---

## 二、精灵图提示词（按动画状态逐一生成）

### 状态 1：待机动画（Idle）- 呼吸 + 眨眼 + 摇尾巴

> 目标：生成约 6 帧的待机循环

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style, sitting pose, 
breathing animation, slight body rise and fall, fluffy tail gently swaying left and right,
4 frames animation sequence spritesheet, side view,
same character as reference, white background, clean lines, cel shading,
game sprite sheet, evenly spaced frames on a single row, --cref [角色设定图链接] --ar 16:4
```

### 状态 2：走动动画（Walk）- 向左/向右

> 目标：生成 8 帧行走循环

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style, 
walking animation cycle right direction, 8 frames sprite sheet,
four white-mittened paws stepping in sequence, fluffy tail swinging naturally behind,
side view full body, consistent character design,
white background, clean cel shading, game sprite sheet,
frames evenly spaced in a single row, --cref [角色设定图链接] --ar 16:3
```

### 状态 3：点击反馈 - 跳起（Click Jump）

> 目标：点击后猫咪跳起

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style, 
surprised jump up animation, cat bouncing upward with white-mittened paws up,
exaggerated squash and stretch, excited expression, big eyes,
4 frame animation sprite sheet, side view, white background,
game sprite style, clean cel shading, --cref [角色设定图链接] --ar 16:4
```

### 状态 4：点击反馈 - 歪头（Head Tilt）

> 目标：猫咪歪头卖萌

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style sitting pose,
head tilting to the side curiously, tufted ears perked,
4 frame animation sprite sheet, front view looking at viewer,
questioning cute expression, white background, game sprite style, --cref [角色设定图链接] --ar 16:4
```

### 状态 5：点击反馈 - 伸爪（Paw Reach）

> 目标：猫咪伸爪子抓空气

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style sitting pose,
reaching out one white-mittened front paw playfully, pawing at the air,
4 frame animation sprite sheet, side view, playful expression,
white background, game sprite style, --cref [角色设定图链接] --ar 16:4
```

### 状态 6：撒娇 - 打滚（Double Click / Roll）

> 目标：双击后猫咪打滚露肚皮

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style,
rolling on the ground animation, from sitting to lying on back showing belly,
8 frame animation sprite sheet, side view,
happy relaxed expression, white-mittened paws curled up, white background,
game sprite style, --cref [角色设定图链接] --ar 16:3
```

### 状态 7：拖拽 - 被拎起（Dragged / Picked Up）

> 目标：拖拽时猫咪被拎起的样子

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style,
being picked up by the scruff, body dangling, white-mittened paws hanging down,
slightly surprised but calm expression, 2 frame sprite sheet,
side view, white background, game sprite style, --cref [角色设定图链接] --ar 16:2
```

### 状态 8：提醒动画（Reminder）

> 目标：猫咪站起来拍屏幕提醒休息

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style,
standing on hind legs, white-mittened front paws tapping on an invisible glass screen,
reminder gesture, friendly concerned expression,
6 frame animation sprite sheet, front-facing view,
white background, game sprite style, --cref [角色设定图链接] --ar 16:4
```

### 状态 9：睡觉（可选，后续版本）

```
[上传角色设定图链接] cute cartoon calico Siberian forest cat with white mittens chibi style,
sleeping pose curled up in a circle, fluffy tail wrapped around body,
gentle breathing, occasionally tufted ear twitch,
4 frame animation sprite sheet, top-down or side view,
white background, game sprite style, peaceful expression, --cref [角色设定图链接] --ar 16:4
```

---

## 三、UI 和图标素材

### 托盘图标 Prompt

```
Cute calico Siberian forest cat face icon with white chin, chibi kawaii style, 
round minimalist design, big eyes, pink nose,
app icon style, flat design with soft shadows, 
transparent background, 48x48 pixel icon, --ar 1:1
```

### 休息提醒气泡 Prompt

```
Speech bubble UI element, rounded rectangle, 
soft warm color #FFF8E7, subtle shadow,
clean minimal style, suitable for text display,
transparent background, game UI element, --ar 4:1
```

---

## 四、精灵图拼合指南

生成各动画的关键帧后，推荐以下工具拼成精灵图（Sprite Sheet）：

| 工具 | 链接 | 免费 |
|------|------|------|
| **TexturePacker** | codeandweb.com/texturepacker | ❌ 收费 |
| **Free Texture Packer** | free-tex-packer.com | ✅ |
| **Shoebox** | renderhjs.net/shoebox | ✅ |
| **Leshy SpriteSheet Tool** | leshy-labs.itch.io | ✅ |
| **手动 Photoshop** | - | ✅ |

### 精灵图规格建议
- 单帧尺寸：128x128 或 256x256 px
- 帧间距：0px（紧密排列）
- 格式：PNG（透明背景）
- 命名规范：`qixi_idle.png`、`qixi_walk.png`、`qixi_jump.png` 等

---

## 五、建议操作顺序

1. **先选一张七七最清晰的正面/侧面照片**作为参考
2. **用 Prompt 1** 生成角色设定图
3. **挑最满意的角色设定图**，记下图片链接
4. **替换所有 `[上传角色设定图链接]`** 为你的角色图链接
5. **逐个生成动画状态**的精灵图
6. **拼合精灵图**，放到项目的 `assets/sprites/` 目录

---

## 六、如果 AI 生成的猫不像七七怎么办？

1. **用即梦/Stable Diffusion 的图生图**：上传七七照片，选择「风格转绘」→「卡通」，效果最好
2. **人工修图**：选最接近的生成图，用 PS 调整毛色花纹使其更像七七
3. **多次迭代**：每次生成 4 张，挑最像的继续作为下一次的参考图

---

> 💡 提示：所有 prompt 已按七七形象设置 —— **西伯利亚森林猫（Siberian forest cat）+ 花猫（calico）+ 白手套（white mittens）**。
> 七七是西伯利亚森林猫品种，特征为：长毛蓬松、耳朵带簇毛（tufted ears）、大骨架、厚实的尾巴。
> 白手套指四只爪子为白色，calico 指身体有白/橘/黑三色斑块花纹。
> 如果你觉得生成效果不够像七七，可以在 prompt 中补充更具体的毛色分布描述。

---

*最后更新：2026-06-11*
