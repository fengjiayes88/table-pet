const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// ── 设置持久化 ──────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS = {
  x: null,
  y: null,
  size: 1.0,           // 0.5 - 2.0
  opacity: 0.95,        // 0.1 - 1.0
  alwaysOnTop: true,
  autoLaunch: true,
  reminderEnabled: true,
  reminderInterval: 45  // 分钟
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) };
    }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) { /* ignore */ }
}

let settings = loadSettings();

// ── 窗口引用 ────────────────────────────────────────────
let mainWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;

// ── 创建宠物窗口 ────────────────────────────────────────
function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const petSize = Math.round(180 * settings.size);
  const winWidth = petSize;
  const winHeight = petSize;

  // 确定初始位置：上次位置 或 屏幕右下角
  let winX = settings.x;
  let winY = settings.y;
  if (winX == null || winY == null) {
    winX = screenWidth - winWidth - 40;
    winY = screenHeight - winHeight - 60;
  }

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: winX,
    y: winY,
    frame: false,
    transparent: true,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setOpacity(settings.opacity);
  mainWindow.setIgnoreMouseEvents(false);
  // 锁定窗口尺寸，防止移动时被系统/DWM 拉伸
  mainWindow.setMinimumSize(winWidth, winHeight);
  mainWindow.setMaximumSize(winWidth, winHeight);
  mainWindow.setResizable(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 调试：取消注释下行可打开 DevTools
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  // 防御：如检测到尺寸变化，立即恢复
  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow._expanded) return;
    const [w, h] = mainWindow.getSize();
    if (w !== winWidth || h !== winHeight) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setBounds({ x, y, width: winWidth, height: winHeight });
    }
  });

  // 保存位置
  mainWindow.on('moved', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      settings.x = x;
      settings.y = y;
      saveSettings(settings);
    }
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 发送初始设置给渲染进程
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('settings-changed', settings);
    mainWindow.webContents.send('window-size', { width: winWidth, height: winHeight, scale: settings.size });
  });
}

// ── 系统托盘 ────────────────────────────────────────────
function createTray() {
  // 创建简易托盘图标（32x32 橙色猫脸占位图）
  // 后续可替换为 assets/tray-icon.png
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = size / 2, cy = size / 2;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 简单猫脸：圆形头部 + 两个三角耳朵
      const inHead = dist < 12;
      const inEarL = (x > 3 && x < 11 && y > 1 && y < 12 && (y < 12 - (x - 3) * 1.5 || y < 5));
      const inEarR = (x > 21 && x < 29 && y > 1 && y < 12 && (y < 12 - (29 - x) * 1.5 || y < 5));
      const inEyeL = (x > 9 && x < 14 && y > 13 && y < 17);
      const inEyeR = (x > 18 && x < 23 && y > 13 && y < 17);
      const inNose = (x > 14 && x < 18 && y > 17 && y < 20);

      if (inHead || inEarL || inEarR) {
        buf[i] = 63;     // B
        buf[i + 1] = 146; // G
        buf[i + 2] = 232; // R (橙色)
        buf[i + 3] = 255; // A
      } else if (inEyeL || inEyeR) {
        buf[i] = 24; buf[i + 1] = 28; buf[i + 2] = 44; buf[i + 3] = 255;
      } else if (inNose) {
        buf[i] = 186; buf[i + 1] = 179; buf[i + 2] = 255; buf[i + 3] = 255;
      } else {
        buf[i] = buf[i + 1] = buf[i + 2] = 0; buf[i + 3] = 0; // 透明
      }
    }
  }
  const trayIcon = nativeImage.createFromBuffer(buf, { width: size, height: size });

  tray = new Tray(trayIcon);
  tray.setToolTip('七七桌面宠物');

  updateTrayMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      updateTrayMenu();
    }
  });
}

function updateTrayMenu() {
  const visible = mainWindow && mainWindow.isVisible();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: visible ? '隐藏宠物' : '显示宠物',
      click: () => {
        if (mainWindow) {
          visible ? mainWindow.hide() : mainWindow.show();
          updateTrayMenu();
        }
      },
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        createSettingsWindow();
      },
    },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: settings.autoLaunch,
      click: (menuItem) => {
        settings.autoLaunch = menuItem.checked;
        app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });
        saveSettings(settings);
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

// ── IPC 处理 ────────────────────────────────────────────
ipcMain.handle('get-settings', () => settings);

ipcMain.handle('save-settings', (event, newSettings) => {
  settings = { ...settings, ...newSettings };
  saveSettings(settings);

  // 立即应用设置
  if (mainWindow) {
    if (newSettings.alwaysOnTop !== undefined) {
      mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
    }
    if (newSettings.opacity !== undefined) {
      mainWindow.setOpacity(settings.opacity);
    }
    if (newSettings.size !== undefined) {
      const petSize = Math.round(180 * settings.size);
      // 重新解锁、设置尺寸、再锁定，避免冲突
      mainWindow.setMinimumSize(1, 1);
      mainWindow.setMaximumSize(0, 0);
      mainWindow.setSize(petSize, petSize);
      mainWindow.setMinimumSize(petSize, petSize);
      mainWindow.setMaximumSize(petSize, petSize);
      mainWindow.webContents.send('window-size', {
        width: petSize,
        height: petSize,
        scale: settings.size,
      });
    }
    if (newSettings.autoLaunch !== undefined) {
      app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });
    }
    mainWindow.webContents.send('settings-changed', settings);
  }

  updateTrayMenu();
  return settings;
});

ipcMain.handle('get-window-position', () => {
  if (mainWindow) {
    return mainWindow.getPosition();
  }
  return [0, 0];
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    // 使用初始固定尺寸，避免读取已被系统污染的当前尺寸
    const petSize = Math.round(180 * settings.size);
    // 屏幕工作区，限制窗口不超出可见范围
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    let nx = x + deltaX;
    let ny = y + deltaY;
    nx = Math.max(0, Math.min(nx, sw - petSize));
    ny = Math.max(0, Math.min(ny, sh - petSize));
    // 用 setBounds 同时锁定尺寸，防止 Windows 下高频移动导致窗口被拉伸
    mainWindow.setBounds({ x: nx, y: ny, width: petSize, height: petSize });
  }
});

// 创建独立的设置窗口
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 340;
  const winH = 410;

  settingsWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: Math.round((sw - winW) / 2),
    y: Math.round((sh - winH) / 2),
    frame: true,
    title: '七七 · 设置',
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// 打开设置窗口（替换原 expand-window 逻辑）
ipcMain.on('open-settings-window', () => {
  createSettingsWindow();
});

// ── 应用生命周期 ────────────────────────────────────────
app.whenReady().then(() => {
  // 开机自启
  app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });

  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // 不退出，保持在托盘
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
