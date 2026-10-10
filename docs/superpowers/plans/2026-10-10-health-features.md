# V1.3 健康关怀版 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 subagent-driven-development（推荐）或 executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为七七桌面宠物新增多类型提醒（喝水/眼操）、番茄钟模式与按日健康统计，统计在设置页与托盘气泡双入口展示。

**架构：** 沿用现有分层——渲染进程持计时器（Reminder 多实例 + 新 Pomodoro 类），主进程持窗口/托盘/持久化（stats.json），纯逻辑沉 shared/app-logic.js。气泡全互斥，被占用的新提醒跳过本轮。番茄钟开启期间久坐提醒暂停。

**技术栈：** Electron 43、node:test、无新依赖、无新美术资源。

**规格：** `docs/superpowers/specs/2026-10-10-health-features-design.md`（执行者必读；本计划的论证依据来自规格）

## 全局约束

- 不新增 npm 依赖，不新增美术资源；提醒动画一律复用现有 REMINDER 状态
- 新设置字段全部有默认值且新开关默认关闭，旧 settings.json 升级后行为与 V1.2 一致
- 气泡文案与规格 3.1/3.2 逐字一致（中文，含全角标点）
- 设置校验 clamp 边界：pomodoroWork 5–120、pomodoroBreak 1–60、drink/eye interval 5–999（整数）
- 统计事件类型固定四种：`standup` / `pomodoro` / `drink` / `eye`；stats.json 仅保留最近 30 天
- 每个任务完成后 `npm test` 必须全绿；收尾任务跑 `npm run check`
- 计时器类（Reminder/Pomodoro）必须支持注入 `setIntervalFn/clearIntervalFn/nowFn`，测试秒级完成

## 审查重点（Review Focus）

1. **喝水与久坐同时到点**：气泡已被占用时，后触发的提醒跳过本轮并重启自己的计时，不排队连弹 → 任务 4 测试钉住
2. **stats.json 损坏/缺失**：读取返回全零当日统计，进程不崩，下次写入自愈 → 任务 2/3 测试钉住
3. **跨午夜打卡**：23:59 弹提醒、00:01 双击打卡，事件记到打卡当天 → 任务 2 测试钉住
4. **设置值越界**：`pomodoroWork: 200 → 120`、`drinkReminderInterval: 1 → 5`、非数字走默认 → 任务 1 测试钉住
5. **番茄钟开关快速切换**：久坐提醒启停幂等，无残留计时器、不会立刻触发提醒（恢复时重置计时）→ 任务 5 测试 + 任务 6 接线约定钉住

---

### 任务 1：设置 schema 扩展

**文件：**
- 修改：`src/shared/app-logic.js`（DEFAULT_SETTINGS + normalizeSettings）
- 测试：`test/app-logic.test.js`（扩展）

- [ ] **步骤 1：编写失败的测试**（追加到 test/app-logic.test.js）

测试名与断言：
- `normalizeSettings 新增健康字段默认值`：空输入 → `pomodoroEnabled:false, pomodoroWork:25, pomodoroBreak:5, drinkReminderEnabled:false, drinkReminderInterval:60, eyeReminderEnabled:false, eyeReminderInterval:45`
- `normalizeSettings 健康字段越界 clamp`：输入 `{pomodoroWork:200, pomodoroBreak:0, drinkReminderInterval:1, eyeReminderInterval:1000}` → `{120, 1, 5, 999}`；输入 `{pomodoroWork:'abc'}` → `25`（走默认）
- `normalizeSettings 布尔类型校验`：`{pomodoroEnabled: 'yes'}` → `false`

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test` ｜ 预期：新断言 FAIL（字段不存在）

- [ ] **步骤 3：实现**（沿用现有 clamp/finiteNumber/布尔三态的既有写法，逐字段照抄既有模式）

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test` ｜ 预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/shared/app-logic.js test/app-logic.test.js
git commit -m "feat: 设置 schema 新增健康关怀字段"
```

---

### 任务 2：统计纯函数

**文件：**
- 修改：`src/shared/app-logic.js`（新增三个导出函数）
- 测试：`test/app-logic.test.js`（扩展）

- [ ] **步骤 1：编写失败的测试**

- `todayKey 使用本地日期`：`todayKey(new Date(2026, 9, 10, 0, 5))` → `'2026-10-10'`（本地时区，非 UTC）
- `recordStat 累加与初始化`：`recordStat({}, 'drink', '2026-10-10')` → `{ '2026-10-10': { standup:0, pomodoro:0, drink:1, eye:0 } }`；再记一次 drink → drink:2
- `recordStat 只保留30天`：构造含 31 天前 key 的输入，记录今天事件 → 31 天前的 key 被删除，今天保留
- `recordStat 打卡时刻决定日期`：与 todayKey 组合，传入当天日期 key
- `getDailyStats 缺失返回零值`：`getDailyStats({}, '2026-10-10')` → 全零对象（四种计数都为 0）

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test` ｜ 预期：FAIL（函数未导出）

- [ ] **步骤 3：实现签名**

```js
function todayKey(date = new Date())            // → 'YYYY-MM-DD'（本地时区）
function recordStat(stats, type, date = new Date())  // → 新 stats 对象（含30天裁剪）
function getDailyStats(stats, date = new Date())     // → { standup, pomodoro, drink, eye }
```

裁剪实现：写入时遍历 key，删除 `todayKey - 30天` 之前的日期。`type` 仅接受四种合法值，非法值原样返回（防御）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test` ｜ 预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/shared/app-logic.js test/app-logic.test.js
git commit -m "feat: 按日健康统计纯函数"
```

---

### 任务 3：主进程 stats 存储 + IPC + preload

**文件：**
- 修改：`src/main.js`（stats 读写、两个 ipcMain.handle、stats-updated 广播）
- 修改：`src/preload.js`（statsEvent / statsQuery / onStatsUpdated）
- 验证：`npm run check:syntax`

- [ ] **步骤 1：实现主进程 stats 模块（main.js 顶部区域，挨着 settings 存储）**

```js
// loadStats()  — 读 userData/stats.json，JSON.parse 失败/文件缺失 → {} 不抛错
// saveStats(stats) — 同步 writeFileSync（事件频率低）
// handleStatsEvent(type) — recordStat + saveStats + 向设置窗口广播 'stats-updated'
// getTodayStats() — getDailyStats(loadStats(), new Date())
```

- [ ] **步骤 2：注册 IPC**

- `ipcMain.handle('stats:event', (e, type) => handleStatsEvent(type))`：type 不在四种合法值时忽略
- `ipcMain.handle('stats:query', () => getTodayStats())`
- 广播目标：设置窗口存活时 `settingsWindow.webContents.send('stats-updated')`（沿用现有 settingsWindow 引用方式）

- [ ] **步骤 3：preload 暴露**（沿用现有 contextBridge 模式）

```js
statsEvent: (type) => ipcRenderer.invoke('stats:event', type),
statsQuery: () => ipcRenderer.invoke('stats:query'),
onStatsUpdated: (cb) => ipcRenderer.on('stats-updated', cb)
```

- [ ] **步骤 4：验证**

运行：`npm run check:syntax` ｜ 预期：无报错
运行：`npm test` ｜ 预期：全部 PASS（纯函数已由任务 2 覆盖）

- [ ] **步骤 5：Commit**

```bash
git add src/main.js src/preload.js
git commit -m "feat: 主进程健康统计存储与 IPC"
```

---

### 任务 4：Reminder 多实例参数化

**文件：**
- 修改：`src/renderer/reminder.js`
- 测试：`test/reminder-multi.test.js`（新建）

- [ ] **步骤 1：编写失败的测试**

构造注入式计时器（手动 tick 的 setInterval 替身 + 可拨的 nowFn）：
- `多实例互不干扰`：实例 A（type 'sedentary'）、B（type 'drink'）不同间隔，各自到点只触发自己的 onTrigger
- `气泡被拒后重启本轮`：mock `window.electronAPI.showReminderBubble` 返回 false → Reminder 收到 false 后自动 `start(true)`，下轮到点再次尝试触发
- `configure 可更新 message`：`configure({ message: '该喝水啦～双击七七打卡！' })` 后 showBubble 使用新文案

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test` ｜ 预期：FAIL

- [ ] **步骤 3：实现改动**（保持现有 API 兼容，默认值不变）

- 构造函数新增 options：`{ type = 'sedentary', message = '该休息啦～双击我解除提醒吧！', setIntervalFn = setInterval, clearIntervalFn = clearInterval, nowFn = Date.now }`
- `showBubble` 改为返回 `window.electronAPI?.showReminderBubble?.(message)` 的结果（true/false）；返回 false 时调用 `this.start(true)` 跳过本轮
- 计时改用注入的函数（现有逻辑不变，只换调用来源）

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test` ｜ 预期：全部 PASS（含原有 6 组测试不回归）

- [ ] **步骤 5：Commit**

```bash
git add src/renderer/reminder.js test/reminder-multi.test.js
git commit -m "feat: Reminder 支持多实例与气泡互斥重启"
```

---

### 任务 5：Pomodoro 类

**文件：**
- 创建：`src/renderer/pomodoro.js`
- 测试：`test/pomodoro.test.js`（新建）

- [ ] **步骤 1：编写失败的测试**

- `工作段结束触发回调并进入休息段`：work=1 分钟（用注入计时器快进）→ `onPhaseComplete('work')` 收到一次，phase 变 'break'
- `休息段结束回到工作段`：连续快进两个阶段 → 先 'work' 后 'break' 再回 'work'
- `configure 重启当前阶段`：工作中途改 workMinutes → 当前阶段计时重置为新时长
- `stop/start 幂等`：stop 两次不抛错；start 时 phase 重置为 'work' 且计时从头

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test` ｜ 预期：FAIL（模块不存在）

- [ ] **步骤 3：实现签名**

```js
class Pomodoro {
  constructor({ onPhaseComplete, onTick, setIntervalFn, clearIntervalFn, nowFn })
  configure({ enabled, workMinutes, breakMinutes })  // enabled=false → stop；参数变化 → 重启当前阶段
  start()   // 从 'work' 开始
  stop()
  get phase()  // 'work' | 'break' | null(未运行)
}
```

结构照抄 reminder.js 的计时模式（1 秒 tick + 剩余时间判定），文件尾同款 `module.exports`。

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test` ｜ 预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/renderer/pomodoro.js test/pomodoro.test.js
git commit -m "feat: 番茄钟计时器"
```

---

### 任务 6：app.js 接线

**文件：**
- 修改：`src/renderer/app.js`
- 修改：`src/main.js`（`show-reminder-bubble` handle 改为返回 boolean：气泡窗口已可见时返回 false）
- 验证：`npm run check:syntax` + `npm test`

- [ ] **步骤 1：主进程气泡互斥**——`show-reminder-bubble` handle：`reminderWindow` 存活且可见 → 返回 false；成功显示 → 返回 true

- [ ] **步骤 2：接线三提醒实例**（app.js）

- 久坐实例沿用现有行为不变；新增 drink/eye 实例（文案见规格 3.1）
- 每个实例 `onTrigger` → `controller.onReminderTriggered()` + showBubble；同时设置 `activeReminder = 实例`
- `onDismiss`（双击解除路径）→ `statsEvent(实例.type)` + 清空 `activeReminder`
- 双击处理入口处：`activeReminder?.reset(fromBubble)` —— 无活跃提醒时保持现有双击撒娇行为

- [ ] **步骤 3：接线番茄钟**

- `pomodoro.onPhaseComplete('work')` → `statsEvent('pomodoro')` + `controller.onReminderTriggered()` + 气泡 `番茄完成！休息 N 分钟吧～`（N=breakMinutes）
- `onPhaseComplete('break')` → 气泡 `休息结束，继续加油！`
- 协调规则（收敛在此单点）：`pomodoroEnabled` 为 true → `sedentaryReminder.stop()`；变 false → `sedentaryReminder.start(true)`（重启计时，避免恢复瞬间立即触发）
- 设置变更监听处按协调规则启停

- [ ] **步骤 4：验证**

运行：`npm run check:syntax && npm test` ｜ 预期：全绿

- [ ] **步骤 5：Commit**

```bash
git add src/renderer/app.js src/main.js
git commit -m "feat: 多提醒与番茄钟接线"
```

---

### 任务 7：设置页健康区块

**文件：**
- 修改：`src/renderer/settings.html`（「行为」区块后新增「健康」section）
- 修改：`src/renderer/settings.css`（沿用现有 panel/setting-row/sub-setting 样式类）
- 修改：`src/renderer/settings.js`（读写新字段 + 统计展示）

- [ ] **步骤 1：HTML 结构**（完全复用现有 section/panel/setting-row/sub-setting/switch/number-control 模式）

- 番茄钟：开关 + 两个 sub-setting 数字输入（工作/休息 分钟）
- 喝水提醒：开关 + 间隔数字输入
- 眼保健操提醒：开关 + 间隔数字输入
- 今日统计行：`<div id="today-stats">起身 0 次 · 番茄 0 个 · 喝水 0 次 · 眼操 0 次</div>`

- [ ] **步骤 2：settings.js 逻辑**（每个新字段照抄 reminder-enabled/reminder-interval 的既有读写模式）

- 初始化时回填值；变更时走现有 settings 更新通道
- 统计展示：加载时 `statsQuery()` 填充 + `onStatsUpdated(() => statsQuery() 刷新)`；文案格式 `起身 N 次 · 番茄 N 个 · 喝水 N 次 · 眼操 N 次`

- [ ] **步骤 3：验证**

运行：`npm run check:syntax` ｜ 预期：无报错
人工 QA：打开设置页确认区块渲染、开关与数字输入生效（见收尾任务 QA 清单）

- [ ] **步骤 4：Commit**

```bash
git add src/renderer/settings.html src/renderer/settings.css src/renderer/settings.js
git commit -m "feat: 设置页健康关怀区块"
```

---

### 任务 8：托盘今日统计 + 收尾验证

**文件：**
- 修改：`src/main.js`（托盘菜单「今日统计」项）
- 修改：`README.md`（功能特性列表补健康关怀条目）
- 验证：`npm run check` + 冒烟 + QA 清单

- [ ] **步骤 1：托盘菜单**——「设置」项后新增 `{ label: '今日统计', click: showTodayStatsBubble }`；showTodayStatsBubble 组装 `今日健康报告：起身 N 次 · 番茄 N 个 · 喝水 N 次 · 眼操 N 次` 并复用现有气泡显示函数

- [ ] **步骤 2：核对关闭路径无副作用**——确认气泡关闭走 `notifyPet=false` 分支：不发送 `reminder-dismissed`、不触发打卡、activeReminder 不变（读 main.js 现有 dismiss handle，如现有分支已保证则不动代码，仅在 commit message 注明核对结论）

- [ ] **步骤 3：README 更新**——功能特性新增一行健康关怀描述（多类型提醒/番茄钟/统计双入口）

- [ ] **步骤 4：全量验证**

运行：`npm run check` ｜ 预期：syntax + 6+3 组测试 + 精灵校验全绿
运行：`npm run smoke` ｜ 预期：冒烟通过

- [ ] **步骤 5：人工 QA 清单**

- [ ] 喝水提醒开 → 到点弹气泡 + 七七提醒动画 → 双击 → 统计 drink +1 且气泡消失
- [ ] 番茄钟开 → 久坐提醒不再触发；工作段到点气泡文案正确；关番茄钟 → 久坐提醒恢复且不会立刻弹
- [ ] 两个提醒近乎同时到点 → 只弹一个气泡，另一个本轮跳过、下轮正常
- [ ] stats.json 手动改成非法 JSON → 重启应用不崩、统计归零
- [ ] 托盘「今日统计」→ 气泡展示；关闭气泡不产生打卡

- [ ] **步骤 6：Commit**

```bash
git add src/main.js README.md
git commit -m "feat: 托盘今日统计与健康关怀收尾"
```
