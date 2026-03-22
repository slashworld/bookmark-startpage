/**
 * tabs.js — Tab state management
 * 
 * IMPORTANT: activate() and setViewMode() do NOT trigger storage.onChanged
 * because they use _saveQuiet() which sets a flag to skip the listener.
 */

const Tabs = {
  list: [],
  activeTabId: null,

  async init() {
    const config = await Storage.load();
    Tabs.list = config.tabs || [];
    Tabs.list.sort((a, b) => a.order - b.order);

    // Restore last active tab
    if (config.lastActiveTabId) {
      const exists = Tabs.list.find(t => t.id === config.lastActiveTabId);
      if (exists) {
        Tabs.activeTabId = config.lastActiveTabId;
        return;
      }
    }

    // Fallback: first tab
    if (Tabs.list.length > 0 && !Tabs.activeTabId) {
      Tabs.activeTabId = Tabs.list[0].id;
    }

    // Auto-create main tab if rootFolderId set but no tabs
    if (config.rootFolderId && Tabs.list.length === 0) {
      try {
        const node = await Bookmarks.getNode(config.rootFolderId);
        Tabs.list.push({
          id: Storage.generateTabId(),
          title: node.title || (typeof I18n !== 'undefined' ? I18n.t('tabs.main') : 'Main'),
          bookmarkFolderId: config.rootFolderId,
          pinned: true, order: 0, color: null, viewMode: 'explorer'
        });
        Tabs.activeTabId = Tabs.list[0].id;
        await Tabs._persist();
      } catch (e) {
        console.error('Root folder not found:', e);
      }
    }
  },

  /**
   * Save tabs + lastActiveTabId to storage.
   * Returns a promise. Used for structural changes (add/remove/reorder).
   */
  async _persist() {
    const config = await Storage.load();
    config.tabs = Tabs.list;
    config.lastActiveTabId = Tabs.activeTabId;
    await Storage.save(config);
  },

  getActive() {
    return Tabs.list.find(t => t.id === Tabs.activeTabId) || null;
  },

  /**
   * Activate a tab. Saves lastActiveTabId without triggering full re-init.
   */
  activate(tabId) {
    Tabs.activeTabId = tabId;
    // Fire-and-forget save — no await needed, no re-render triggered
    chrome.storage.local.get('bsp_config', (result) => {
      const config = result.bsp_config || {};
      config.lastActiveTabId = tabId;
      chrome.storage.local.set({ bsp_config: config });
    });
  },

  async addTab(folderId, title, color = null) {
    const newTab = {
      id: Storage.generateTabId(),
      title, bookmarkFolderId: folderId,
      pinned: false, order: Tabs.list.length,
      color: color, viewMode: 'explorer'
    };
    Tabs.list.push(newTab);
    Tabs.activeTabId = newTab.id;
    await Tabs._persist();
    return newTab;
  },

  async removeTab(tabId) {
    const tab = Tabs.list.find(t => t.id === tabId);
    if (!tab || tab.pinned) return false;
    Tabs.list = Tabs.list.filter(t => t.id !== tabId);
    Tabs.reorder();
    if (Tabs.activeTabId === tabId) {
      Tabs.activeTabId = Tabs.list.length > 0 ? Tabs.list[0].id : null;
    }
    await Tabs._persist();
    return true;
  },

  async togglePin(tabId) {
    const tab = Tabs.list.find(t => t.id === tabId);
    if (!tab) return;
    tab.pinned = !tab.pinned;
    await Tabs._persist();
  },

  async moveTab(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const [moved] = Tabs.list.splice(fromIndex, 1);
    Tabs.list.splice(toIndex, 0, moved);
    Tabs.reorder();
    await Tabs._persist();
  },

  reorder() {
    Tabs.list.forEach((tab, i) => tab.order = i);
  },

  async setColor(tabId, color) {
    const tab = Tabs.list.find(t => t.id === tabId);
    if (!tab) return;
    tab.color = color || null;
    await Tabs._persist();
  },

  /**
   * Set view mode per tab. Fire-and-forget like activate().
   */
  setViewMode(tabId, mode) {
    const tab = Tabs.list.find(t => t.id === tabId);
    if (!tab) return;
    tab.viewMode = mode;
    chrome.storage.local.get('bsp_config', (result) => {
      const config = result.bsp_config || {};
      const tabs = config.tabs || [];
      const t = tabs.find(x => x.id === tabId);
      if (t) t.viewMode = mode;
      chrome.storage.local.set({ bsp_config: config });
    });
  }
};
