const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 设置管理
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // 窗口控制
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },

  // 监听主进程事件
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings-changed', (event, settings) => callback(settings));
  },
  onWindowSizeChanged: (callback) => {
    ipcRenderer.on('window-size', (event, data) => callback(data));
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },

  // 窗口拖动
  moveWindow: (deltaX, deltaY) => {
    ipcRenderer.send('move-window', { deltaX, deltaY });
  },

  // 窗口展开/收起（用于设置面板）
  expandWindow: (expanded) => {
    ipcRenderer.send('expand-window', expanded);
  },

  // 打开独立设置窗口
  openSettingsWindow: () => {
    ipcRenderer.send('open-settings-window');
  },

  // 退出应用
  quitApp: () => {
    ipcRenderer.send('quit-app');
  },

  // 移除监听
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
