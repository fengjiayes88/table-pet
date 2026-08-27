const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const PORT = 9333;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(description, read, predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  let lastError;
  while (Date.now() < deadline) {
    try {
      lastValue = await read();
      if (predicate(lastValue)) return lastValue;
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  const detail = lastError?.message || JSON.stringify(lastValue);
  throw new Error(`Timed out waiting for ${description}: ${detail}`);
}

async function listTargets() {
  const response = await fetch(`${BASE_URL}/json/list`);
  assert.equal(response.ok, true, `DevTools target request failed: ${response.status}`);
  return response.json();
}

async function evaluate(target, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Runtime.evaluate timed out for ${target.title}`));
    }, 5000);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }));
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.error) {
        reject(new Error(message.error.message));
        return;
      }
      const result = message.result?.result;
      if (message.result?.exceptionDetails || result?.subtype === 'error') {
        reject(new Error(result?.description || 'Renderer evaluation failed'));
        return;
      }
      resolve(result?.value);
    });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket failed for ${target.title}`));
    });
  });
}

async function main() {
  const output = [];
  const errors = [];
  const child = spawn(ELECTRON, [`--remote-debugging-port=${PORT}`, '.'], {
    cwd: ROOT,
    env: { ...process.env, QIXI_SMOKE_TEST: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => errors.push(String(chunk)));

  let petTarget;
  let report;
  let shouldVerifyPersistence = false;
  const smokeSettingsPath = path.join(os.tmpdir(), `qixi-pet-smoke-${child.pid}.json`);
  try {
    const initialTargets = await waitFor(
      'the pet renderer',
      listTargets,
      (targets) => targets.some((target) => target.title === '七七桌面宠物'),
    );
    petTarget = initialTargets.find((target) => target.title === '七七桌面宠物');

    const petState = await waitFor(
      'a rendered pet canvas',
      () => evaluate(petTarget, `(() => {
        const canvas = document.getElementById('pet-canvas');
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return null;
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let visibleSamples = 0;
        for (let index = 3; index < pixels.length; index += 64) {
          if (pixels[index] > 24) visibleSamples += 1;
        }
        return {
          readyState: document.readyState,
          fatal: Boolean(document.querySelector('.fatal-error')),
          cssWidth: canvas.clientWidth,
          backingWidth: canvas.width,
          dpr: window.devicePixelRatio,
          visibleSamples,
          loadedStates: window.__qixiSmoke?.drawer.getLoadedStates() || [],
        };
      })()`),
      (state) => state?.readyState === 'complete' && state.visibleSamples > 0,
    );
    assert.equal(petState.fatal, false);
    assert.equal(petState.backingWidth, Math.round(petState.cssWidth * petState.dpr));
    assert.deepEqual(petState.loadedStates, ['idle']);

    const idleDrawsPerSecond = await evaluate(petTarget, `(async () => {
      const drawer = window.__qixiSmoke.drawer;
      const originalDrawFrame = drawer.drawFrame;
      let drawCount = 0;
      drawer.drawFrame = function countedDrawFrame(...args) {
        drawCount += 1;
        return originalDrawFrame.apply(this, args);
      };
      await new Promise((resolve) => setTimeout(resolve, 1100));
      drawer.drawFrame = originalDrawFrame;
      return drawCount;
    })()`);
    assert.ok(idleDrawsPerSecond >= 2 && idleDrawsPerSecond <= 6);

    await evaluate(petTarget, `(() => {
      const canvas = document.getElementById('pet-canvas');
      const rect = canvas.getBoundingClientRect();
      const options = {
        bubbles: true,
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        screenX: 400,
        screenY: 400,
      };
      canvas.dispatchEvent(new MouseEvent('mousedown', options));
      canvas.dispatchEvent(new MouseEvent('mouseup', options));
      return true;
    })()`);
    const lazyLoadedStates = await waitFor(
      'an interaction sprite to load lazily',
      () => evaluate(petTarget, 'window.__qixiSmoke.drawer.getLoadedStates()'),
      (states) => states.length === 2,
    );
    assert.ok(lazyLoadedStates.some((state) => ['jump', 'headTilt', 'pawReach'].includes(state)));

    await evaluate(petTarget, 'window.electronAPI.openSettingsWindow(); true');
    const settingsTargets = await waitFor(
      'the settings renderer',
      listTargets,
      (targets) => targets.some((target) => target.url.endsWith('/settings.html')),
    );
    const settingsTarget = settingsTargets.find((target) => target.url.endsWith('/settings.html'));
    const settingsState = await waitFor(
      'settings controls to load',
      () => evaluate(settingsTarget, `({
        readyState: document.readyState,
        controls: document.querySelectorAll('input, button').length,
        hasSize: Boolean(document.getElementById('size')),
        hasReminder: Boolean(document.getElementById('reminder-enabled')),
      })`),
      (state) => state?.readyState === 'complete' && state.hasSize && state.hasReminder,
    );
    assert.equal(settingsState.readyState, 'complete');
    assert.equal(settingsState.hasSize, true);
    assert.equal(settingsState.hasReminder, true);
    assert.ok(settingsState.controls >= 4);

    await evaluate(settingsTarget, `window.electronAPI.saveSettings({
      size: 1.2,
      opacity: 0.8,
      reminderEnabled: true,
      reminderInterval: 1,
    })`);
    const appliedSettings = await waitFor(
      'settings to apply to the pet window',
      () => evaluate(petTarget, `(async () => {
        const canvas = document.getElementById('pet-canvas');
        return {
          settings: await window.electronAPI.getSettings(),
          metrics: await window.electronAPI.getWindowMetrics(),
          cssWidth: canvas.clientWidth,
          backingWidth: canvas.width,
          dpr: window.devicePixelRatio,
        };
      })()`),
      (state) => state?.settings?.size === 1.2 && state.metrics?.width === 216,
    );
    assert.equal(appliedSettings.settings.opacity, 0.8);
    assert.equal(appliedSettings.settings.reminderInterval, 1);
    assert.equal(appliedSettings.cssWidth, 216);
    assert.equal(appliedSettings.backingWidth, Math.round(216 * appliedSettings.dpr));
    shouldVerifyPersistence = true;

    await evaluate(petTarget, `window.electronAPI.showReminderBubble('自动化运行时检查'); true`);
    const reminderTargets = await waitFor(
      'the reminder renderer',
      listTargets,
      (targets) => targets.some((target) => target.url.endsWith('/reminder-bubble.html')),
    );
    const reminderTarget = reminderTargets.find((target) => target.url.endsWith('/reminder-bubble.html'));
    const reminderState = await waitFor(
      'reminder content to load',
      () => evaluate(reminderTarget, `({
        readyState: document.readyState,
        message: document.getElementById('message')?.textContent,
        closeButton: Boolean(document.getElementById('dismiss')),
      })`),
      (state) => state?.readyState === 'complete' && state.closeButton && Boolean(state.message),
    );
    assert.equal(reminderState.readyState, 'complete');
    assert.equal(reminderState.message, '自动化运行时检查');
    assert.equal(reminderState.closeButton, true);
    await evaluate(reminderTarget, 'window.electronAPI.dismissReminderBubble(true); true');

    const stderr = errors.join('');
    assert.doesNotMatch(stderr, /\[(FATAL|RENDER|SPRITE|SETTINGS|SHORTCUT)\]/);
    report = {
      ok: true,
      pet: { ...petState, idleDrawsPerSecond, lazyLoadedStates },
      settings: settingsState,
      appliedSettings,
      reminder: reminderState,
    };
  } finally {
    if (petTarget) {
      try {
        await evaluate(petTarget, 'window.electronAPI.quitApp(); true');
      } catch (_) {
        child.kill();
      }
    } else {
      child.kill();
    }
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      delay(3000).then(() => child.kill()),
    ]);
    if (shouldVerifyPersistence) {
      const persistedSettings = JSON.parse(fs.readFileSync(smokeSettingsPath, 'utf8'));
      assert.equal(persistedSettings.size, 1.2);
      assert.equal(persistedSettings.opacity, 0.8);
      assert.equal(persistedSettings.reminderInterval, 1);
      report.persistedSettings = persistedSettings;
    }
    if (fs.existsSync(smokeSettingsPath)) fs.rmSync(smokeSettingsPath);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
