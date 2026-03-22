/**
 * configstore.js — Bookmark-based config persistence + autosave
 * Shared between newtab.js and options.js
 */

const CONFIG_FOLDER_NAME = 'BookmarksStartpage';
const CONFIG_PREFIX = 'SavedConfigBMSP';
const MAX_CONFIGS = 20;

const ConfigStore = {
  async getConfigFolder() {
    const tree = (await Bookmarks.getTree())[0];
    let otherBookmarks = null;
    if (tree.children && tree.children.length >= 2) {
      otherBookmarks = tree.children[1];
    }
    if (!otherBookmarks) {
      throw new Error('Unable to find "Other Bookmarks" folder');
    }

    const otherFull = await Bookmarks.getSubTree(otherBookmarks.id);
    let configFolder = (otherFull.children || []).find(
      c => !c.url && c.title === CONFIG_FOLDER_NAME
    );

    if (!configFolder) {
      configFolder = await Bookmarks.create({
        parentId: otherBookmarks.id,
        title: CONFIG_FOLDER_NAME
      });
    }
    return configFolder;
  },

  async save() {
    const configStr = await Storage.exportToString();
    // Save full extension URL with config hash instead of data URL
    // EncodeURIComponent needed for base64 special chars (+, /, =)
    const url = chrome.runtime.getURL('newtab.html') + '#config=' + encodeURIComponent(configStr);

    const now = new Date();
    const ts = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + 'T'
      + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0');

    const title = CONFIG_PREFIX + ts;
    const folder = await ConfigStore.getConfigFolder();

    await Bookmarks.create({
      parentId: folder.id,
      title: title,
      url: url
    });

    await ConfigStore._cleanup(folder.id);
    return { title, timestamp: now };
  },

  async load() {
    let folder;
    try {
      folder = await ConfigStore.getConfigFolder();
    } catch {
      return null;
    }

    const fullFolder = await Bookmarks.getSubTree(folder.id);
    const configs = (fullFolder.children || [])
      .filter(c => c.url && c.title.startsWith(CONFIG_PREFIX))
      .sort((a, b) => b.title.localeCompare(a.title));

    if (configs.length === 0) return null;

    const newest = configs[0];
    let base64 = '';
    
    // Support both new URL format (newtab.html#config=<base64>) and old data URL format
    if (newest.url.includes('#config=')) {
      // New format: chrome-extension://<id>/newtab.html#config=<base64>
      const hashPart = newest.url.split('#config=')[1];
      base64 = decodeURIComponent(hashPart);
    } else if (newest.url.includes('data:application/x-bsp-config;base64,')) {
      // Old format: data:application/x-bsp-config;base64,<base64>
      base64 = newest.url.replace('data:application/x-bsp-config;base64,', '');
    }
    
    const data = Storage.parseConfigString(base64);
    if (!data) return null;

    const tsStr = newest.title.replace(CONFIG_PREFIX, '');
    const timestamp = ConfigStore._parseTimestamp(tsStr);

    return { data, title: newest.title, timestamp };
  },

  async _cleanup(folderId) {
    const fullFolder = await Bookmarks.getSubTree(folderId);
    const configs = (fullFolder.children || [])
      .filter(c => c.url && c.title.startsWith(CONFIG_PREFIX))
      .sort((a, b) => b.title.localeCompare(a.title));

    if (configs.length > MAX_CONFIGS) {
      for (const bm of configs.slice(MAX_CONFIGS)) {
        await Bookmarks.remove(bm.id);
      }
    }
  },

  _parseTimestamp(ts) {
    if (!ts || ts.length < 15) return null;
    try {
      const y = ts.slice(0, 4), m = ts.slice(4, 6), d = ts.slice(6, 8);
      const h = ts.slice(9, 11), min = ts.slice(11, 13), s = ts.slice(13, 15);
      return new Date(+y, +m - 1, +d, +h, +min, +s);
    } catch { return null; }
  }
};

// ==================== AutoSave ====================

const AutoSave = {
  _timer: null,
  DELAY: 2 * 60 * 1000, // 2 minutes

  schedule() {
    AutoSave.reset();
    AutoSave._timer = setTimeout(async () => {
      AutoSave._timer = null;
      try {
        await ConfigStore.save();
        console.log('[BSP] AutoSave: config saved to bookmarks');
      } catch (e) {
        console.error('[BSP] AutoSave error:', e);
      }
    }, AutoSave.DELAY);
  },

  reset() {
    if (AutoSave._timer) {
      clearTimeout(AutoSave._timer);
      AutoSave._timer = null;
    }
  }
};

// Listen for any config changes and schedule autosave
chrome.storage.onChanged.addListener((changes) => {
  if (changes.bsp_config) {
    AutoSave.schedule();
  }
});
