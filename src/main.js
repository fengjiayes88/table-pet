const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  screen,
  globalShortcut,
} = require('electron');
const path = require('path');
const fs = require('fs');
const {
  DEFAULT_SETTINGS,
  clamp,
  finiteNumber,
  normalizeSettings,
  clampToWorkArea,
} = require('./shared/app-logic');

const IS_SMOKE_TEST = process.env.QIXI_SMOKE_TEST === '1';
const SETTINGS_PATH = IS_SMOKE_TEST
  ? path.join(app.getPath('temp'), `qixi-pet-smoke-${process.pid}.json`)
  : path.join(app.getPath('userData'), 'settings.json');
const APP_ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.ico');
const PET_BASE_SIZE = 180;

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      return normalizeSettings(parsed);
    }
  } catch (error) {
    console.error('[SETTINGS] 配置损坏，已恢复默认值', error);
  }
  return { ...DEFAULT_SETTINGS };
}

let settings = loadSettings();
let saveTimer = null;

function saveSettingsNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (IS_SMOKE_TEST) return;
  try {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('[SETTINGS] 保存失败', error);
  }
}

function scheduleSettingsSave(delay = 300) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSettingsNow, delay);
}

function applyAutoLaunch(openAtLogin) {
  if (!app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin,
      path: process.execPath,
      args: [app.getAppPath()],
    });
    return;
  }
  app.setLoginItemSettings({ openAtLogin });
}

let mainWindow = null;
let settingsWindow = null;
let reminderWindow = null;
let tray = null;
let isQuitting = false;

function petSize() {
  return Math.round(PET_BASE_SIZE * settings.size);
}

function displayForPoint(x, y) {
  return screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
}

function clampPosition(x, y, width, height) {
  const display = displayForPoint(x + width / 2, y + height / 2);
  const workArea = display.workArea;
  const position = clampToWorkArea(x, y, width, height, workArea);
  return {
    ...position,
    display,
  };
}

function initialPetBounds() {
  const size = petSize();
  if (settings.x != null && settings.y != null) {
    const position = clampPosition(settings.x, settings.y, size, size);
    return { x: position.x, y: position.y, width: size, height: size };
  }

  const workArea = screen.getPrimaryDisplay().workArea;
  return {
    x: workArea.x + workArea.width - size - 40,
    y: workArea.y + workArea.height - size - 60,
    width: size,
    height: size,
  };
}

function getWindowMetrics() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  return {
    ...bounds,
    displayId: display.id,
    workArea: { ...display.workArea },
  };
}

function updateReminderBubblePosition() {
  if (!reminderWindow || reminderWindow.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) return;
  const petBounds = mainWindow.getBounds();
  const bubbleBounds = reminderWindow.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const workArea = display.workArea;

  let x = Math.round(petBounds.x + petBounds.width / 2 - bubbleBounds.width / 2);
  let y = petBounds.y - bubbleBounds.height - 8;
  x = clamp(x, workArea.x, workArea.x + workArea.width - bubbleBounds.width);
  if (y < workArea.y) y = petBounds.y + petBounds.height + 8;
  y = clamp(y, workArea.y, workArea.y + workArea.height - bubbleBounds.height);
  reminderWindow.setPosition(Math.round(x), Math.round(y), false);
}

function createWindow() {
  const bounds = initialPetBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    icon: APP_ICON_PATH,
    frame: false,
    transparent: true,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: IS_SMOKE_TEST ? ['--qixi-smoke-test'] : [],
    },
  });

  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setOpacity(settings.opacity);
  mainWindow.setMinimumSize(bounds.width, bounds.height);
  mainWindow.setMaximumSize(bounds.width, bounds.height);
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isDestroyed() || isQuitting) return;
    const size = petSize();
    const [width, height] = mainWindow.getSize();
    if (width !== size || height !== size) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setBounds({ x, y, width: size, height: size });
    }
  });

  mainWindow.on('moved', () => {
    if (!mainWindow || mainWindow.isDestroyed() || isQuitting) return;
    const [x, y] = mainWindow.getPosition();
    settings.x = x;
    settings.y = y;
    scheduleSettingsSave();
    updateReminderBubblePosition();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    reminderWindow?.hide();
    updateTrayMenu();
  });

  mainWindow.on('show', () => {
    if (reminderWindow && !reminderWindow.isDestroyed()) reminderWindow.showInactive();
    updateTrayMenu();
  });
  mainWindow.on('hide', updateTrayMenu);
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('settings-changed', settings);
    mainWindow.webContents.send('window-size', {
      width: bounds.width,
      height: bounds.height,
      scale: settings.size,
    });
    mainWindow.showInactive();
  });
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray-icon.png'));
  tray = new Tray(trayIcon);
  tray.setToolTip('七七桌面宠物');
  updateTrayMenu();
  tray.on('double-click', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.showInactive();
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const visible = !!mainWindow?.isVisible();
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: visible ? '隐藏宠物' : '显示宠物',
      click: () => {
        if (!mainWindow) return;
        visible ? mainWindow.hide() : mainWindow.showInactive();
      },
    },
    { type: 'separator' },
    { label: '设置', click: createSettingsWindow },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: settings.autoLaunch,
      click: (menuItem) => {
        settings = normalizeSettings({ ...settings, autoLaunch: menuItem.checked }, settings);
        applyAutoLaunch(settings.autoLaunch);
        saveSettingsNow();
        mainWindow?.webContents.send('settings-changed', settings);
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
  ]));
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const display = mainWindow
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const { workArea } = display;
  const width = 360;
  const height = 520;
  settingsWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    icon: APP_ICON_PATH,
    title: '七七 · 设置',
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function showReminderBubble(message) {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.webContents.send('reminder-message', message);
    updateReminderBubblePosition();
    reminderWindow.showInactive();
    return;
  }

  reminderWindow = new BrowserWindow({
    width: 320,
    height: 64,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  reminderWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
  reminderWindow.loadFile(path.join(__dirname, 'renderer', 'reminder-bubble.html'));
  reminderWindow.webContents.on('did-finish-load', () => {
    reminderWindow?.webContents.send('reminder-message', message);
    updateReminderBubblePosition();
    if (mainWindow?.isVisible()) reminderWindow?.showInactive();
  });
  reminderWindow.on('closed', () => { reminderWindow = null; });
}

function dismissReminderBubble(notifyPet = true) {
  if (reminderWindow && !reminderWindow.isDestroyed()) reminderWindow.close();
  reminderWindow = null;
  if (notifyPet && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reminder-dismissed');
  }
}

function isPetSender(event) {
  return !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;
}

function isSettingsSender(event) {
  return !!settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents;
}

ipcMain.handle('get-settings', (event) => {
  if (!isPetSender(event) && !isSettingsSender(event)) return null;
  return { ...settings };
});

ipcMain.handle('save-settings', (event, patch) => {
  if (!isPetSender(event) && !isSettingsSender(event)) return { ...settings };
  const previous = settings;
  settings = normalizeSettings({ ...settings, ...(patch || {}) }, settings);
  saveSettingsNow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (previous.alwaysOnTop !== settings.alwaysOnTop) {
      mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
      reminderWindow?.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
    }
    if (previous.opacity !== settings.opacity) mainWindow.setOpacity(settings.opacity);
    if (previous.autoLaunch !== settings.autoLaunch) applyAutoLaunch(settings.autoLaunch);

    if (previous.size !== settings.size) {
      const size = petSize();
      const current = mainWindow.getBounds();
      const clamped = clampPosition(current.x, current.y, size, size);
      mainWindow.setMinimumSize(1, 1);
      mainWindow.setMaximumSize(10000, 10000);
      mainWindow.setBounds({ x: clamped.x, y: clamped.y, width: size, height: size });
      mainWindow.setMinimumSize(size, size);
      mainWindow.setMaximumSize(size, size);
      mainWindow.webContents.send('window-size', { width: size, height: size, scale: settings.size });
      updateReminderBubblePosition();
    }
    mainWindow.webContents.send('settings-changed', settings);
  }
  updateTrayMenu();
  return { ...settings };
});

ipcMain.handle('get-window-metrics', (event) => isPetSender(event) ? getWindowMetrics() : null);

ipcMain.handle('move-window', (event, payload = {}) => {
  if (!isPetSender(event) || !mainWindow || mainWindow.isDestroyed()) return null;
  const deltaX = clamp(finiteNumber(payload.deltaX, 0), -500, 500);
  const deltaY = clamp(finiteNumber(payload.deltaY, 0), -500, 500);
  const bounds = mainWindow.getBounds();
  const position = clampPosition(
    bounds.x + deltaX,
    bounds.y + deltaY,
    bounds.width,
    bounds.height,
  );
  mainWindow.setBounds({
    x: position.x,
    y: position.y,
    width: bounds.width,
    height: bounds.height,
  });
  return getWindowMetrics();
});

ipcMain.handle('persist-window-position', (event) => {
  if (!isPetSender(event)) return false;
  const metrics = getWindowMetrics();
  if (!metrics) return false;
  settings.x = metrics.x;
  settings.y = metrics.y;
  saveSettingsNow();
  return true;
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  if (!isPetSender(event) || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setIgnoreMouseEvents(!!ignore, ignore ? { forward: !!options?.forward } : undefined);
});

ipcMain.on('open-settings-window', (event) => {
  if (isPetSender(event)) createSettingsWindow();
});

ipcMain.handle('show-reminder-bubble', (event, message) => {
  if (!isPetSender(event)) return false;
  showReminderBubble(typeof message === 'string' ? message.slice(0, 120) : '该休息啦～');
  return true;
});

ipcMain.handle('dismiss-reminder-bubble', (event, notifyPet = false) => {
  const fromPet = isPetSender(event);
  const fromBubble = !!reminderWindow && !reminderWindow.isDestroyed() &&
    event.sender === reminderWindow.webContents;
  if (!fromPet && !fromBubble) return false;
  dismissReminderBubble(fromBubble || !!notifyPet);
  return true;
});

ipcMain.on('quit-app', (event) => {
  if (!isPetSender(event) && !isSettingsSender(event)) return;
  isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  if (!IS_SMOKE_TEST) applyAutoLaunch(settings.autoLaunch);
  createWindow();
  if (!IS_SMOKE_TEST) createTray();
  const shortcutRegistered = globalShortcut.register(
    'CommandOrControl+Shift+S',
    createSettingsWindow,
  );
  if (!shortcutRegistered) {
    console.warn('[SHORTCUT] Ctrl+Shift+S is already in use; use the tray menu instead.');
  }
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  saveSettingsNow();
});
app.on('activate', () => mainWindow?.showInactive());
