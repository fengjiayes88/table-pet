const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  isSmokeTest: process.argv.includes('--qixi-smoke-test'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  getWindowMetrics: () => ipcRenderer.invoke('get-window-metrics'),
  moveWindow: (deltaX, deltaY) => ipcRenderer.invoke('move-window', { deltaX, deltaY }),
  persistWindowPosition: () => ipcRenderer.invoke('persist-window-position'),
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },

  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  quitApp: () => ipcRenderer.send('quit-app'),

  showReminderBubble: (message) => ipcRenderer.invoke('show-reminder-bubble', message),
  dismissReminderBubble: (notifyPet = false) =>
    ipcRenderer.invoke('dismiss-reminder-bubble', notifyPet),

  onSettingsChanged: (callback) => subscribe('settings-changed', callback),
  onWindowSizeChanged: (callback) => subscribe('window-size', callback),
  onReminderMessage: (callback) => subscribe('reminder-message', callback),
  onReminderDismissed: (callback) => subscribe('reminder-dismissed', callback),
});
