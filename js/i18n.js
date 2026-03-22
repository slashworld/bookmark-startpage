/**
 * i18n.js — Localization module
 *
 * Supports hierarchical keys (e.g., 'tabs.colors.red')
 * and variable substitution (e.g., 'Close tab «{title}»?')
 */

const I18n = {
  _translations: {},
  _currentLang: 'en',
  _availableLangs: ['en', 'ru'],
  _fallbackLang: 'en',

  /**
   * Initialize i18n module
   * Detects language from settings or browser, loads translations
   */
  async init() {
    const config = await Storage.load();
    
    // Determine language
    let lang = config.settings?.language;
    
    if (!lang || lang === 'auto') {
      // Try to detect from browser
      const browserLang = this._detectBrowserLanguage();
      lang = this._availableLangs.includes(browserLang) ? browserLang : this._fallbackLang;
      
      // Save detected language to settings on first run
      if (!config.settings?.language) {
        if (!config.settings) config.settings = { ...Storage.DEFAULT_CONFIG.settings };
        config.settings.language = lang;
        await Storage.save(config);
      }
    }
    
    await this.setLanguage(lang, false);
  },

  /**
   * Detect browser language
   */
  _detectBrowserLanguage() {
    // Try Chrome API first
    if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
      return chrome.i18n.getUILanguage().split('-')[0];
    }
    // Fallback to navigator
    return (navigator.language || navigator.userLanguage || 'en').split('-')[0];
  },

  /**
   * Set active language and load translations
   * @param {string} lang - Language code (e.g., 'en', 'ru')
   * @param {boolean} saveToStorage - Whether to save to storage (default: true)
   */
  async setLanguage(lang, saveToStorage = true) {
    if (!this._availableLangs.includes(lang)) {
      lang = this._fallbackLang;
    }
    
    this._currentLang = lang;
    
    // Load translations
    try {
      const url = chrome.runtime?.getURL 
        ? chrome.runtime.getURL(`locales/${lang}.json`)
        : `locales/${lang}.json`;
      console.log('[I18n] Loading translations from:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      try {
        this._translations = JSON.parse(text);
        console.log('[I18n] Loaded translations for', lang, '- keys:', Object.keys(this._translations).join(', '));
      } catch (parseError) {
        console.error('[I18n] Failed to parse JSON:', parseError);
        throw parseError;
      }
    } catch (e) {
      console.error(`[I18n] Failed to load translations for ${lang}:`, e);
      // Fallback to English
      if (lang !== this._fallbackLang) {
        try {
          const url = chrome.runtime?.getURL 
            ? chrome.runtime.getURL(`locales/${this._fallbackLang}.json`)
            : `locales/${this._fallbackLang}.json`;
          const response = await fetch(url);
          const text = await response.text();
          this._translations = JSON.parse(text);
        } catch (e2) {
          console.error('[I18n] Failed to load fallback translations:', e2);
          this._translations = {};
        }
      }
    }
    
    // Save to storage if requested
    if (saveToStorage) {
      const config = await Storage.load();
      if (!config.settings) config.settings = { ...Storage.DEFAULT_CONFIG.settings };
      config.settings.language = lang;
      await Storage.save(config);
    }
    
    // Update DOM
    this.updateDOM();
    
    return lang;
  },

  /**
   * Get translation by key
   * Supports dot notation: 'tabs.colors.red'
   * Supports variable substitution: {varName}
   * 
   * @param {string} key - Translation key
   * @param {Object} vars - Variables to substitute (e.g., {title: 'My Tab'})
   * @returns {string} Translated string
   */
  t(key, vars = {}) {
    // Navigate through nested keys
    const parts = key.split('.');
    let value = this._translations;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        // Key not found, return the key itself as fallback
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation key is not a string: ${key}`);
      return key;
    }
    
    // Substitute variables
    return value.replace(/\{([^}]+)\}/g, (match, varName) => {
      return vars[varName] !== undefined ? vars[varName] : match;
    });
  },

  /**
   * Get current language
   */
  getCurrentLanguage() {
    return this._currentLang;
  },

  /**
   * Get list of available languages
   */
  getAvailableLanguages() {
    return [...this._availableLangs];
  },

  /**
   * Get language display name
   */
  getLanguageDisplayName(lang) {
    const names = {
      'en': 'English',
      'ru': 'Русский'
    };
    return names[lang] || lang;
  },

  /**
   * Update all DOM elements with data-i18n attributes
   */
  updateDOM() {
    // Update elements with data-i18n attribute (text content)
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // Update elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (key) {
        el.placeholder = this.t(key);
      }
    });

    // Update elements with data-i18n-title attribute (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      if (key) {
        el.title = this.t(key);
      }
    });

    // Update elements with data-i18n-html attribute (inner HTML)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.dataset.i18nHtml;
      if (key) {
        el.innerHTML = this.t(key);
      }
    });
  },

  /**
   * Setup storage change listener to sync language across tabs
   * Call this after init() to enable sync
   */
  setupSync() {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(async (changes) => {
        if (!changes.bsp_config) return;
        
        const newConfig = changes.bsp_config.newValue || {};
        const newLang = newConfig.settings?.language;
        
        // Only react to language changes (and not from this page's own save)
        if (newLang && newLang !== this._currentLang && newLang !== 'auto') {
          await this.setLanguage(newLang, false);
        }
      });
    }
  }
};
