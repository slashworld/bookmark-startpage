/**
 * storage.js — Config persistence (chrome.storage.local)
 *
 * Export format v2 stores { fullPath, relativePath, topFolderIndex }
 * for each folder, allowing cross-locale import.
 */

const Storage = {
  EXPORT_VERSION: 2,

  DEFAULT_CONFIG: {
    rootFolderId: null,
    tabs: [],
    settings: {
      openInNewTab: true,
      showLinksInTree: true,
      fontSizeTabs: 13,
      fontSizeNav: 13,
      fontSizeContent: 13,
      language: null, // null = auto-detect on first run, 'en' or 'ru' for specific
      iconSize: 48,
      labelPosition: 'right', // 'right' | 'bottom' | 'left' | 'top'
      showTitle: true,
      showUrl: true
    }
  },

  async load() {
    return new Promise(resolve => {
      chrome.storage.local.get('bsp_config', (result) => {
        if (!result.bsp_config) {
          resolve({
            ...Storage.DEFAULT_CONFIG,
            tabs: [],
            settings: { ...Storage.DEFAULT_CONFIG.settings }
          });
          return;
        }
        const cfg = result.bsp_config;
        cfg.settings = { ...Storage.DEFAULT_CONFIG.settings, ...(cfg.settings || {}) };
        resolve(cfg);
      });
    });
  },

  async save(config) {
    return new Promise(resolve => {
      chrome.storage.local.set({ bsp_config: config }, resolve);
    });
  },

  async getSiteIcons() {
    return new Promise(resolve => {
      chrome.storage.local.get('bsp_site_icons', (result) => {
        resolve(result.bsp_site_icons || {});
      });
    });
  },

  async saveSiteIcon(url, iconUrl) {
    const icons = await Storage.getSiteIcons();
    icons[url] = iconUrl;
    return new Promise(resolve => {
      chrome.storage.local.set({ bsp_site_icons: icons }, resolve);
    });
  },

  async deleteSiteIcon(url) {
    const icons = await Storage.getSiteIcons();
    delete icons[url];
    return new Promise(resolve => {
      chrome.storage.local.set({ bsp_site_icons: icons }, resolve);
    });
  },

  async getTreeState() {
    return new Promise(resolve => {
      chrome.storage.local.get('bsp_tree_state', (result) => {
        resolve(result.bsp_tree_state || null);
      });
    });
  },

  async saveTreeState(treeState) {
    return new Promise(resolve => {
      chrome.storage.local.set({ bsp_tree_state: treeState }, resolve);
    });
  },

  /**
   * Serialize config to a structured JavaScript object.
   * Uses structured path info (fullPath + relativePath + topFolderIndex)
   * so import can handle different locale top-folder names.
   */
  async exportData() {
    const config = await Storage.load();
    let rootPathInfo = null;

    if (config.rootFolderId) {
      rootPathInfo = await Bookmarks.getFolderPathInfo(config.rootFolderId);
    }

    const tabsExport = [];
    for (const tab of (config.tabs || [])) {
      const pathInfo = await Bookmarks.getFolderPathInfo(tab.bookmarkFolderId);
      tabsExport.push({
        title: tab.title,
        pathInfo: pathInfo,
        // Legacy: keep folderPath for backward compat
        folderPath: pathInfo.fullPath,
        pinned: tab.pinned,
        order: tab.order,
        color: tab.color || null,
        viewMode: tab.viewMode || 'explorer'
      });
    }

    return {
      version: Storage.EXPORT_VERSION,
      rootPathInfo: rootPathInfo,
      // Legacy
      rootPath: rootPathInfo ? rootPathInfo.fullPath : null,
      tabs: tabsExport,
      settings: config.settings || Storage.DEFAULT_CONFIG.settings
    };
  },

  /**
   * Serialize config to portable base64 string.
   */
  async exportToString() {
    const exportData = await Storage.exportData();
    const json = JSON.stringify(exportData);
    return btoa(unescape(encodeURIComponent(json)));
  },

  /**
   * Parse config from base64 string
   */
  parseConfigString(str) {
    if (!str || !str.trim()) return null;
    try {
      const clean = str.trim();
      const json = decodeURIComponent(escape(atob(clean)));
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to parse config string:', e);
      return null;
    }
  },

  generateTabId() {
    return 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }
};
