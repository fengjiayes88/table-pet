(async () => {
  try {
    const canvas = document.getElementById('pet-canvas');
    const drawer = new PetDrawer(1);
    const reminder = new Reminder();
    const controller = new PetController(canvas, drawer, reminder);

    reminder.onDismiss = () => controller.onReminderDismissed();
    await controller.init();
    if (window.electronAPI.isSmokeTest) {
      window.__qixiSmoke = Object.freeze({ controller, drawer, reminder });
    }

    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        window.electronAPI.openSettingsWindow();
      }
    });

    window.addEventListener('beforeunload', () => controller.destroy(), { once: true });
  } catch (error) {
    console.error('[FATAL] 初始化失败', error);
    const message = document.createElement('div');
    message.className = 'fatal-error';
    message.textContent = `初始化失败：${error.message}`;
    document.body.replaceChildren(message);
  }
})();
