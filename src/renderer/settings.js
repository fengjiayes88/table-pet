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

  function updateReminderControls(enabled) {
    intervalGroup.style.opacity = enabled ? '1' : '0.5';
    reminderIntervalElement.disabled = !enabled;
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
    updateReminderControls(settings.reminderEnabled);
  } catch (error) {
    console.error('[SETTINGS] 加载失败', error);
  }

  async function apply(key, value) {
    try {
      await window.electronAPI.saveSettings({ [key]: value });
    } catch (error) {
      console.error('[SETTINGS] 保存失败', error);
    }
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
  reminderIntervalElement.addEventListener('change', () => {
    const parsed = Number.parseInt(reminderIntervalElement.value, 10);
    const value = Math.min(999, Math.max(1, Number.isFinite(parsed) ? parsed : 45));
    reminderIntervalElement.value = value;
    apply('reminderInterval', value);
  });
  autoLaunchElement.addEventListener('change', () =>
    apply('autoLaunch', autoLaunchElement.checked));
  get('quit-btn').addEventListener('click', () => {
    if (window.confirm('确定要退出七七桌面宠物吗？')) window.electronAPI.quitApp();
  });
})();
