(async () => {
  try {
    const canvas = document.getElementById('pet-canvas');
    const drawer = new PetDrawer(1);
    // 久坐沿用默认实例与行为；喝水为新增多类型提醒（文案见 V1.3 规格 3.1）
    const sedentaryReminder = new Reminder();
    const drinkReminder = new Reminder({ type: 'drink', message: '该喝水啦～双击七七打卡！' });
    const controller = new PetController(canvas, drawer, sedentaryReminder);

    let currentSettings = null;

    const requestBubble = (message) =>
      Promise.resolve(window.electronAPI?.showReminderBubble?.(message))
        .then((ok) => ok !== false)
        .catch(() => false);

    // 先请求气泡，成功才进提醒动画并认领 activeReminder；被拒则实例已自行重启计时，本轮跳过
    const showInstanceBubble = (instance) => {
      Promise.resolve(instance.showBubble(canvas)).then((ok) => {
        if (ok === false) return;
        controller.activeReminder = instance;
        controller.onReminderTriggered();
      });
    };

    for (const instance of [sedentaryReminder, drinkReminder]) {
      instance.onTrigger = () => showInstanceBubble(instance);
      instance.onDismiss = (checkIn) => {
        if (checkIn) window.electronAPI?.statsEvent?.(instance.type); // 仅双击打卡，气泡 X 关闭不计数
        controller.activeReminder = null;
        controller.onReminderDismissed();
        // 解除后开启下一轮；久坐实例在番茄钟期间保持让位
        const suppressed = instance === sedentaryReminder && currentSettings?.pomodoroEnabled;
        if (instance.enabled && !suppressed) instance.start(true);
      };
    }

    const pomodoro = new Pomodoro({
      onPhaseComplete: (phase) => {
        if (phase !== 'work') {
          requestBubble('休息结束，继续加油！').then((shown) => {
            if (shown) controller.onReminderTriggered();
          });
          return;
        }
        window.electronAPI?.statsEvent?.('pomodoro');
        requestBubble(`番茄完成！休息 ${pomodoro.breakMinutes} 分钟吧～`).then((shown) => {
          if (shown) controller.onReminderTriggered();
        });
      },
    });

    await controller.init();
    currentSettings = controller.settings;
    drinkReminder.configure({
      enabled: currentSettings.drinkReminderEnabled ?? false,
      intervalMinutes: currentSettings.drinkReminderInterval,
    });
    pomodoro.configure({
      enabled: currentSettings.pomodoroEnabled ?? false,
      workMinutes: currentSettings.pomodoroWork,
      breakMinutes: currentSettings.pomodoroBreak,
    });
    if (currentSettings.pomodoroEnabled) sedentaryReminder.stop();

    window.electronAPI.onSettingsChanged((next) => {
      const previous = currentSettings;
      currentSettings = next;
      drinkReminder.configure({
        enabled: next.drinkReminderEnabled ?? false,
        intervalMinutes: next.drinkReminderInterval,
      });
      pomodoro.configure({
        enabled: next.pomodoroEnabled ?? false,
        workMinutes: next.pomodoroWork,
        breakMinutes: next.pomodoroBreak,
      });
      // 协调规则（收敛在此单点）：番茄钟期间久坐提醒始终让位（幂等）；关闭后恢复并重置计时
      if (next.pomodoroEnabled) {
        sedentaryReminder.stop();
      } else if (previous?.pomodoroEnabled && next.reminderEnabled) {
        sedentaryReminder.start(true);
      }
    });

    if (window.electronAPI.isSmokeTest) {
      window.__qixiSmoke = Object.freeze({ controller, drawer, reminder: sedentaryReminder });
    }

    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        window.electronAPI.openSettingsWindow();
      }
    });

    window.addEventListener('beforeunload', () => {
      controller.destroy();
      drinkReminder.destroy();
      pomodoro.stop();
    }, { once: true });
  } catch (error) {
    console.error('[FATAL] 初始化失败', error);
    const message = document.createElement('div');
    message.className = 'fatal-error';
    message.textContent = `初始化失败：${error.message}`;
    document.body.replaceChildren(message);
  }
})();
