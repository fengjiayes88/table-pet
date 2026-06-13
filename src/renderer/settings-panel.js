/**
 * 设置面板 UI
 * 管理设置界面的显示、交互和保存
 */

class SettingsPanel {
  constructor() {
    this.panel = null;
    this.overlay = null;
    this.visible = false;
    this.onChange = null; // 设置变更回调（通知控制器）
  }

  /**
   * 初始化设置面板 DOM
   */
  init(container) {
    // 遮罩层
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // 面板
    this.panel = document.createElement('div');
    this.panel.className = 'settings-panel';
    this.panel.innerHTML = `
      <div class="settings-header">
        <h2>七七 · 设置</h2>
        <button class="settings-close" title="关闭">&times;</button>
      </div>
      <div class="settings-body">
        <div class="setting-item">
          <label>宠物大小</label>
          <div class="setting-slider">
            <input type="range" id="setting-size" min="0.5" max="2.0" step="0.1" value="1.0">
            <span class="slider-value" id="setting-size-val">100%</span>
          </div>
        </div>
        <div class="setting-item">
          <label>透明度</label>
          <div class="setting-slider">
            <input type="range" id="setting-opacity" min="0.2" max="1.0" step="0.05" value="0.95">
            <span class="slider-value" id="setting-opacity-val">95%</span>
          </div>
        </div>
        <div class="setting-item">
          <label>始终置顶</label>
          <label class="setting-switch">
            <input type="checkbox" id="setting-ontop" checked>
            <span class="switch-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <label>休息提醒</label>
          <label class="setting-switch">
            <input type="checkbox" id="setting-reminder-enabled" checked>
            <span class="switch-slider"></span>
          </label>
        </div>
        <div class="setting-item" id="reminder-interval-group">
          <label>提醒间隔</label>
          <div class="interval-input">
            <input type="number" id="setting-reminder-interval" min="1" max="999" step="1" value="45">
            <span class="unit">分钟</span>
          </div>
        </div>
        <div class="setting-item">
          <label>开机自启</label>
          <label class="setting-switch">
            <input type="checkbox" id="setting-autolaunch" checked>
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>
    `;

    container.appendChild(this.overlay);
    container.appendChild(this.panel);

    this._bindEvents();
  }

  /**
   * 绑定面板事件
   */
  _bindEvents() {
    // 关闭按钮
    this.panel.querySelector('.settings-close').addEventListener('click', () => this.hide());

    // 大小滑块
    const sizeSlider = this.panel.querySelector('#setting-size');
    const sizeVal = this.panel.querySelector('#setting-size-val');
    sizeSlider.addEventListener('input', () => {
      sizeVal.textContent = Math.round(sizeSlider.value * 100) + '%';
    });
    sizeSlider.addEventListener('change', () => {
      this._applySetting('size', parseFloat(sizeSlider.value));
    });

    // 透明度滑块
    const opacitySlider = this.panel.querySelector('#setting-opacity');
    const opacityVal = this.panel.querySelector('#setting-opacity-val');
    opacitySlider.addEventListener('input', () => {
      opacityVal.textContent = Math.round(opacitySlider.value * 100) + '%';
    });
    opacitySlider.addEventListener('change', () => {
      this._applySetting('opacity', parseFloat(opacitySlider.value));
    });

    // 置顶开关
    this.panel.querySelector('#setting-ontop').addEventListener('change', (e) => {
      this._applySetting('alwaysOnTop', e.target.checked);
    });

    // 提醒开关
    this.panel.querySelector('#setting-reminder-enabled').addEventListener('change', (e) => {
      const enabled = e.target.checked;
      document.getElementById('reminder-interval-group').style.opacity = enabled ? '1' : '0.5';
      document.getElementById('setting-reminder-interval').disabled = !enabled;
      this._applySetting('reminderEnabled', enabled);
    });

    // 提醒间隔
    this.panel.querySelector('#setting-reminder-interval').addEventListener('change', (e) => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      if (v > 999) v = 999;
      e.target.value = v;
      this._applySetting('reminderInterval', v);
    });

    // 开机自启
    this.panel.querySelector('#setting-autolaunch').addEventListener('change', (e) => {
      this._applySetting('autoLaunch', e.target.checked);
    });
  }

  /**
   * 应用设置
   */
  async _applySetting(key, value) {
    const settings = {};
    settings[key] = value;

    try {
      const result = await window.electronAPI.saveSettings(settings);
      if (this.onChange) this.onChange(result);
    } catch (err) {
      console.error('保存设置失败:', err);
    }
  }

  /**
   * 根据设置对象更新 UI 控件
   */
  updateUI(settings) {
    const sizeSlider = this.panel.querySelector('#setting-size');
    const opacitySlider = this.panel.querySelector('#setting-opacity');
    const sizeVal = this.panel.querySelector('#setting-size-val');
    const opacityVal = this.panel.querySelector('#setting-opacity-val');

    if (settings.size !== undefined) {
      sizeSlider.value = settings.size;
      sizeVal.textContent = Math.round(settings.size * 100) + '%';
    }
    if (settings.opacity !== undefined) {
      opacitySlider.value = settings.opacity;
      opacityVal.textContent = Math.round(settings.opacity * 100) + '%';
    }
    if (settings.alwaysOnTop !== undefined) {
      this.panel.querySelector('#setting-ontop').checked = settings.alwaysOnTop;
    }
    if (settings.reminderEnabled !== undefined) {
      this.panel.querySelector('#setting-reminder-enabled').checked = settings.reminderEnabled;
      document.getElementById('reminder-interval-group').style.opacity = settings.reminderEnabled ? '1' : '0.5';
      document.getElementById('setting-reminder-interval').disabled = !settings.reminderEnabled;
    }
    if (settings.reminderInterval !== undefined) {
      this.panel.querySelector('#setting-reminder-interval').value = settings.reminderInterval;
    }
    if (settings.autoLaunch !== undefined) {
      this.panel.querySelector('#setting-autolaunch').checked = settings.autoLaunch;
    }
  }

  /**
   * 显示设置面板
   */
  async show() {
    if (this.visible) return;
    try {
      const settings = await window.electronAPI.getSettings();
      this.updateUI(settings);
    } catch (err) { /* ignore */ }
    // 通知主进程放大窗口以容纳设置面板
    if (window.electronAPI && window.electronAPI.expandWindow) {
      window.electronAPI.expandWindow(true);
    }
    this.panel.classList.add('settings-visible');
    this.overlay.classList.add('settings-overlay-visible');
    this.visible = true;
  }

  /**
   * 隐藏设置面板
   */
  hide() {
    if (!this.visible) return;
    this.panel.classList.remove('settings-visible');
    this.overlay.classList.remove('settings-overlay-visible');
    this.visible = false;
    // 恢复窗口为宠物尺寸
    if (window.electronAPI && window.electronAPI.expandWindow) {
      window.electronAPI.expandWindow(false);
    }
  }

  /**
   * 切换显示/隐藏
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
}

if (typeof module !== 'undefined') module.exports = SettingsPanel;
