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
  },

  AVATAR_GRADIENTS: [
    'linear-gradient(135deg, #89b4fa, #74c7ec)', // Blue
    'linear-gradient(135deg, #a6e3a1, #94e2d5)', // Green-Teal
    'linear-gradient(135deg, #fab387, #f9e2af)', // Peach-Yellow
    'linear-gradient(135deg, #cba6f7, #f5c2e7)', // Mauve-Pink
    'linear-gradient(135deg, #f38ba8, #eba0ac)', // Red-Flamingo
    'linear-gradient(135deg, #b4befe, #89b4fa)', // Lavender-Blue
    'linear-gradient(135deg, #1abc9c, #16a085)', // Teal
    'linear-gradient(135deg, #e67e22, #d35400)'  // Orange
  ],

  getAvatarGradient(str) {
    let hash = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % Theme.AVATAR_GRADIENTS.length;
    return Theme.AVATAR_GRADIENTS[idx];
  }
};

