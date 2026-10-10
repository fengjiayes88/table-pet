(async () => {
  const get = (id) => document.getElementById(id);
  const sizeElement = get('size');
  const sizeValue = get('size-val');
  const opacityElement = get('opacity');
  const opacityValue = get('opacity-val');
  const alwaysOnTopElement = get('ontop');
  const reminderEnabledElement = get('reminder-enabled');
  const reminderIntervalElement = get('reminder-interval');
  const intervalGroup = get('interval-group');
  const autoLaunchElement = get('autolaunch');
  const pomodoroEnabledElement = get('pomodoro-enabled');
  const pomodoroWorkElement = get('pomodoro-work');
  const pomodoroBreakElement = get('pomodoro-break');
  const pomodoroWorkGroup = get('pomodoro-work-group');
  const pomodoroBreakGroup = get('pomodoro-break-group');
  const drinkEnabledElement = get('drink-enabled');
  const drinkIntervalElement = get('drink-interval');
  const drinkIntervalGroup = get('drink-interval-group');
  const eyeEnabledElement = get('eye-enabled');
  const eyeIntervalElement = get('eye-interval');
  const eyeIntervalGroup = get('eye-interval-group');
  const todayStats = get('today-stats');
  const saveStatus = get('save-status');
  const saveStatusText = get('save-status-text');
  let statusTimer = null;

  function setSaveStatus(state, text) {
    clearTimeout(statusTimer);
    saveStatus.classList.remove('is-ready', 'is-saving', 'is-error');
    saveStatus.classList.add(`is-${state}`);
    saveStatusText.textContent = text;
    if (state === 'ready') return;
    statusTimer = setTimeout(() => setSaveStatus('ready', '设置已同步'), 1500);
  }

  function updateReminderControls(enabled) {
    intervalGroup.classList.toggle('is-disabled', !enabled);
    reminderIntervalElement.disabled = !enabled;
  }

  function updateNumberGroup(group, input, enabled) {
    group.classList.toggle('is-disabled', !enabled);
    input.disabled = !enabled;
  }

  try {
    const settings = await window.electronAPI.getSettings();
    sizeElement.value = settings.size;
    sizeValue.textContent = `${Math.round(settings.size * 100)}%`;
    opacityElement.value = settings.opacity;
    opacityValue.textContent = `${Math.round(settings.opacity * 100)}%`;
    alwaysOnTopElement.checked = settings.alwaysOnTop;
    reminderEnabledElement.checked = settings.reminderEnabled;
    reminderIntervalElement.value = settings.reminderInterval;
    autoLaunchElement.checked = settings.autoLaunch;
    pomodoroEnabledElement.checked = settings.pomodoroEnabled;
    pomodoroWorkElement.value = settings.pomodoroWork;
    pomodoroBreakElement.value = settings.pomodoroBreak;
    drinkEnabledElement.checked = settings.drinkReminderEnabled;
    drinkIntervalElement.value = settings.drinkReminderInterval;
    eyeEnabledElement.checked = settings.eyeReminderEnabled;
    eyeIntervalElement.value = settings.eyeReminderInterval;
    updateReminderControls(settings.reminderEnabled);
    updateNumberGroup(pomodoroWorkGroup, pomodoroWorkElement, settings.pomodoroEnabled);
    updateNumberGroup(pomodoroBreakGroup, pomodoroBreakElement, settings.pomodoroEnabled);
    updateNumberGroup(drinkIntervalGroup, drinkIntervalElement, settings.drinkReminderEnabled);
    updateNumberGroup(eyeIntervalGroup, eyeIntervalElement, settings.eyeReminderEnabled);
  } catch (error) {
    console.error('[SETTINGS] 加载失败', error);
    setSaveStatus('error', '设置加载失败');
  }

  async function apply(key, value) {
    setSaveStatus('saving', '正在保存…');
    try {
      await window.electronAPI.saveSettings({ [key]: value });
      setSaveStatus('ready', '设置已同步');
    } catch (error) {
      console.error('[SETTINGS] 保存失败', error);
      setSaveStatus('error', '保存失败，请重试');
    }
  }

  function bindNumberInput(element, key, fallback, min, max) {
    element.addEventListener('change', () => {
      const parsed = Number.parseInt(element.value, 10);
      const value = Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
      element.value = value;
      apply(key, value);
    });
  }

  sizeElement.addEventListener('input', () => {
    sizeValue.textContent = `${Math.round(Number(sizeElement.value) * 100)}%`;
  });
  sizeElement.addEventListener('change', () => apply('size', Number(sizeElement.value)));

  opacityElement.addEventListener('input', () => {
    opacityValue.textContent = `${Math.round(Number(opacityElement.value) * 100)}%`;
  });
  opacityElement.addEventListener('change', () => apply('opacity', Number(opacityElement.value)));

  alwaysOnTopElement.addEventListener('change', () =>
    apply('alwaysOnTop', alwaysOnTopElement.checked));

  reminderEnabledElement.addEventListener('change', () => {
    updateReminderControls(reminderEnabledElement.checked);
    apply('reminderEnabled', reminderEnabledElement.checked);
  });

  bindNumberInput(reminderIntervalElement, 'reminderInterval', 45, 1, 999);

  bindNumberInput(pomodoroWorkElement, 'pomodoroWork', 25, 5, 120);
  bindNumberInput(pomodoroBreakElement, 'pomodoroBreak', 5, 1, 60);
  bindNumberInput(drinkIntervalElement, 'drinkReminderInterval', 60, 5, 999);
  bindNumberInput(eyeIntervalElement, 'eyeReminderInterval', 45, 5, 999);

  pomodoroEnabledElement.addEventListener('change', () => {
    updateNumberGroup(pomodoroWorkGroup, pomodoroWorkElement, pomodoroEnabledElement.checked);
    updateNumberGroup(pomodoroBreakGroup, pomodoroBreakElement, pomodoroEnabledElement.checked);
    apply('pomodoroEnabled', pomodoroEnabledElement.checked);
  });

  drinkEnabledElement.addEventListener('change', () => {
    updateNumberGroup(drinkIntervalGroup, drinkIntervalElement, drinkEnabledElement.checked);
    apply('drinkReminderEnabled', drinkEnabledElement.checked);
  });

  eyeEnabledElement.addEventListener('change', () => {
    updateNumberGroup(eyeIntervalGroup, eyeIntervalElement, eyeEnabledElement.checked);
    apply('eyeReminderEnabled', eyeEnabledElement.checked);
  });

  function renderTodayStats(stats) {
    todayStats.textContent =
      `起身 ${stats.standup} 次 · 番茄 ${stats.pomodoro} 个 · 喝水 ${stats.drink} 次 · 眼操 ${stats.eye} 次`;
  }

  async function refreshTodayStats() {
    try {
      renderTodayStats(await window.electronAPI.statsQuery());
    } catch (error) {
      console.error('[STATS] 读取失败', error);
    }
  }
  refreshTodayStats();
  window.electronAPI.onStatsUpdated(refreshTodayStats);

  autoLaunchElement.addEventListener('change', () =>
    apply('autoLaunch', autoLaunchElement.checked));

  get('quit-btn').addEventListener('click', () => {
    if (window.confirm('确定要退出七七桌面宠物吗？')) window.electronAPI.quitApp();
  });
})();
