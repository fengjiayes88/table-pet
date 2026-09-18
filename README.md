# 七七桌面宠物 🐱

一款基于 Electron 的 Windows 桌面宠物应用，以猫咪「七七」为原型，在你的办公桌面上安静陪伴，并定时提醒你休息。

## 功能特性

- **精灵帧动画**：待机呼吸、眨眼、随机走动、跳跃、歪头、伸爪、打滚、睡觉等多套动作，全部基于自绘 Sprite Sheet 渲染
- **交互反馈**：点击宠物随机触发反应动画；双击触发撒娇打滚；按住可拖拽到桌面任意位置；视线跟随鼠标移动
- **点击穿透**：宠物窗口不遮挡其他窗口的鼠标操作，只有点在宠物身上才有交互
- **久坐提醒**：可自定义提醒间隔（默认 45 分钟），到点后七七做出提醒动作并弹出"该休息啦~"气泡，双击宠物即可解除
- **系统托盘**：最小化到托盘，右键菜单支持显示/隐藏宠物、开机自启、设置、退出
- **莫兰迪风格设置页**：置顶模式、提醒开关与间隔、开机自启等选项集中管理，设置自动持久化

## 快速开始

```bash
# 安装依赖
npm install

# 启动
npm start
```

Windows 下也可以直接双击 `启动七七.bat`（或 `启动七七.vbs`）静默启动。

## 打包发布

```bash
# 打包为 Windows 安装包（NSIS）
npm run build

# 仅打包目录（免安装）
npm run build:dir
```

## 开发与校验

```bash
# 运行单元测试（node:test）
npm test

# 完整校验：语法检查 + 测试 + 精灵图清单校验
npm run check

# 运行时冒烟测试
npm run smoke
```

## 项目结构

```
├── src/
│   ├── main.js               # 主进程：窗口、托盘、开机自启、提醒调度
│   ├── preload.js            # 渲染进程安全桥接
│   ├── shared/app-logic.js   # 跨进程共享的纯逻辑
│   └── renderer/             # 渲染层
│       ├── pet-controller.js # 宠物状态机与交互
│       ├── pet-drawer.js     # 精灵图绘制
│       ├── sprite-manifest.js# 动作帧清单
│       ├── reminder.js       # 久坐提醒气泡
│       └── settings.*        # 设置页
├── assets/sprites/           # 各动作 Sprite Sheet
├── scripts/                  # 精灵图处理脚本、冒烟测试
├── test/                     # 单元测试
├── qa/                       # 美术资源 QA 产物
└── PRD.md                    # 产品需求文档
```

## 技术栈

- Electron 43（无任何运行时依赖，渲染层为原生 JS/CSS）
- electron-builder（Windows NSIS 安装包）
- node:test 单元测试

## License

[MIT](LICENSE)
