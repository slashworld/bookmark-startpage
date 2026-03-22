/**
 * newtab.js — Main entry point
 */

// ==================== Config Import Handler ====================

let _importPending = false;

async function handleConfigImport(fromUserAction = false) {
  if (!location.hash.startsWith('#config=')) return;
  
  // Only proceed with confirm() if from user action (hashchange) or page is visible
  if (!fromUserAction && document.hidden) {
    // Page not visible, wait for visibility
    _importPending = true;
    return;
  }
  
  _importPending = false;
  const encodedBase64 = location.hash.slice('#config='.length);
  const base64 = decodeURIComponent(encodedBase64);
  const data = Storage.parseConfigString(base64);
  
  if (!data) {
    console.error('Failed to parse config from URL');
    return;
  }
  
  const currentConfig = await Storage.load();
  const hasExisting = currentConfig.tabs && currentConfig.tabs.length > 0;
  const doImport = !hasExisting || confirm(I18n.t('export.confirmReplace', {count: currentConfig.tabs.length}));
  
  if (doImport) {
    try {
      await applyUrlImport(data);
      // Clear hash and reload page to show imported config
      history.replaceState(null, '', location.pathname);
      location.reload();
      return;
    } catch (e) {
      console.error('URL import failed:', e);
      alert('Import failed: ' + e.message);
    }
  }
  
  // Clear hash to prevent re-import on refresh (if user cancelled)
  history.replaceState(null, '', location.pathname);
}

// Handle visibility change to process pending import
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && _importPending && location.hash.startsWith('#config=')) {
    handleConfigImport(true);
  }
});

// ==================== Main Init ====================

(async function init() {
  // Initialize i18n first
  await I18n.init();
  I18n.setupSync(); // Enable language sync across tabs
  
  // Handle config import from URL hash (initial load)
  // Delay slightly to allow page to become active
  setTimeout(() => handleConfigImport(false), 100);
  
  // Listen for hash changes (when user pastes URL with hash)
  window.addEventListener('hashchange', () => handleConfigImport(true));

  await Tabs.init();
  ContextMenu.init();
  Modal.init();
  Filter.init();
  await initGlobalSettings();
  await Render.renderAll();

  // Filter clear button
  const filterInput = document.getElementById('filterInput');
  const filterClear = document.getElementById('filterClear');
  filterInput.addEventListener('input', () => {
    filterClear.hidden = !filterInput.value;
  });
  filterClear.addEventListener('click', () => {
    filterInput.value = '';
    filterClear.hidden = true;
    Filter.apply('');
  });

  // Empty-state settings button
  document.getElementById('openSettings')?.addEventListener('click', openOptionsPage);
  // Gear button
  document.getElementById('gearBtn').addEventListener('click', openOptionsPage);

  // Open-in-new-tab toggle
  document.getElementById('openInNewTab').addEventListener('change', async (e) => {
    const cfg = await Storage.load();
    if (!cfg.settings) cfg.settings = { ...Storage.DEFAULT_CONFIG.settings };
    cfg.settings.openInNewTab = e.target.checked;
    await Storage.save(cfg);
    await Render.renderContent();
  });

  // Only react to storage changes from the OPTIONS PAGE.
  // We detect this by checking if the change was NOT from this page
  // (i.e. tabs structure changed, rootFolderId changed, or settings changed).
  // We do NOT re-init on lastActiveTabId changes or viewMode changes.
  let lastKnownRootId = (await Storage.load()).rootFolderId;
  let lastKnownSettingsJson = JSON.stringify((await Storage.load()).settings || {});

  chrome.storage.onChanged.addListener(async (changes) => {
    if (!changes.bsp_config) return;
    const newConfig = changes.bsp_config.newValue || {};
    const newRootId = newConfig.rootFolderId;
    const newSettingsJson = JSON.stringify(newConfig.settings || {});

    // Only re-init if root folder or settings changed (likely from options page)
    if (newRootId !== lastKnownRootId || newSettingsJson !== lastKnownSettingsJson) {
      lastKnownRootId = newRootId;
      lastKnownSettingsJson = newSettingsJson;
      await Tabs.init();
      await initGlobalSettings();
      await Render.renderAll();
    }
  });
})();

function openOptionsPage() {
  window.location.href = chrome.runtime.getURL('options.html');
}

async function initGlobalSettings() {
  const config = await Storage.load();
  const s = config.settings || Storage.DEFAULT_CONFIG.settings;
  document.getElementById('openInNewTab').checked = s.openInNewTab !== false;
}

async function applyUrlImport(data) {
  const config = await Storage.load();
  
  // Import settings if present
  if (data.settings) {
    config.settings = { ...Storage.DEFAULT_CONFIG.settings, ...data.settings };
  }
  
  if (data.rootPathInfo || data.rootPath) {
    const folder = await Bookmarks.findFolderByPath(data.rootPathInfo || data.rootPath);
    if (folder) config.rootFolderId = folder.id;
  }
  if (data.tabs && data.tabs.length > 0) {
    config.tabs = [];
    for (const td of data.tabs) {
      const folder = await Bookmarks.findFolderByPath(td.pathInfo || td.folderPath);
      if (folder) {
        config.tabs.push({
          id: Storage.generateTabId(), title: td.title,
          bookmarkFolderId: folder.id, pinned: td.pinned || false,
          order: td.order || config.tabs.length,
          color: td.color || null, viewMode: td.viewMode || 'explorer'
        });
      }
    }
  }
  await Storage.save(config);
}
