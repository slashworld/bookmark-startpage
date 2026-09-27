/**
 * theme.js — Theme management (Catppuccin Mocha / Latte / Auto)
 */

const Theme = {
  KEY: 'bsp_theme',
  currentTheme: 'auto',

  async init() {
    const saved = await Theme.getTheme();
    Theme.apply(saved);
    Theme.setupButtons();
    Theme.listenSystemChanges();
    Theme.listenStorageChanges();
  },

  async getTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.get(Theme.KEY, (res) => {
        resolve(res[Theme.KEY] || 'auto');
      });
    });
  },

  async setTheme(theme) {
    Theme.currentTheme = theme;
    Theme.apply(theme);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [Theme.KEY]: theme }, resolve);
    });
  },

  apply(theme) {
    Theme.currentTheme = theme;
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    Theme.updateUI(theme);
  },

  updateUI(theme) {
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themeVal === theme);
    });
  },

  setupButtons() {
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const val = btn.dataset.themeVal;
        if (val) {
          Theme.setTheme(val);
        }
      });
    });
    Theme.updateUI(Theme.currentTheme);
  },

  listenSystemChanges() {
    try {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', () => {
        if (Theme.currentTheme === 'auto') {
          Theme.apply('auto');
        }
      });
    } catch (e) {
      console.warn('Failed to listen to system theme changes:', e);
    }
  },

  listenStorageChanges() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[Theme.KEY]) {
        const newVal = changes[Theme.KEY].newValue || 'auto';
        Theme.apply(newVal);
      }
    });
  },

  getFolderIconHtml(className = '') {
    const cls = className ? ` ${className}` : '';
    return `<span class="folder-icon${cls}"><svg class="folder-svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path class="folder-svg__back" d="M2 4.75C2 3.78 2.78 3 3.75 3h3.41c.47 0 .91.19 1.24.52L9.82 4.93c.16.16.39.26.62.26h5.81c.97 0 1.75.78 1.75 1.75V8.5H2V4.75z"/><path class="folder-svg__front" d="M2 7.5h16v7.75c0 .97-.78 1.75-1.75 1.75H3.75C2.78 17 2 16.22 2 15.25V7.5z"/></svg></span>`;
  },

  createFolderIcon(className = '') {
    const span = document.createElement('span');
    span.className = 'folder-icon' + (className ? ' ' + className : '');
    span.innerHTML = `<svg class="folder-svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path class="folder-svg__back" d="M2 4.75C2 3.78 2.78 3 3.75 3h3.41c.47 0 .91.19 1.24.52L9.82 4.93c.16.16.39.26.62.26h5.81c.97 0 1.75.78 1.75 1.75V8.5H2V4.75z"/><path class="folder-svg__front" d="M2 7.5h16v7.75c0 .97-.78 1.75-1.75 1.75H3.75C2.78 17 2 16.22 2 15.25V7.5z"/></svg>`;
    return span;
  }
};

