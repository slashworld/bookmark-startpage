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
  // Initialize i18n and theme first
  await I18n.init();
  I18n.setupSync(); // Enable language sync across tabs
  if (typeof Theme !== 'undefined') {
    await Theme.init();
  }

  // Auto-restore saved config from bookmarks on fresh install / empty state
  try {
    await ConfigStore.autoRestoreIfEmpty();
  } catch (e) {
    console.warn('[newtab] Auto-restore check failed:', e);
  }

  // Handle config import from URL hash (initial load)
  // Delay slightly to allow page to become active
  setTimeout(() => handleConfigImport(false), 100);
  
  // Listen for hash changes (when user pastes URL with hash)
  window.addEventListener('hashchange', () => handleConfigImport(true));

  await Tabs.init();
  ContextMenu.init();
  Modal.init();
  Filter.init();
  Selection.init();
  initViewSettings();
  await initGlobalSettings();
  await Bookmarks.initDirectIcons();
  await Render.renderAll();

  // If still empty (e.g. bookmarks are still syncing in the background after fresh sign-in),
  // listen for incoming bookmarks and auto-restore once config bookmark arrives
  setupSyncListener();

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
    lastKnownSettingsJson = JSON.stringify(cfg.settings);
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

  // Expose updater for storage sync
  window._updateViewSettingsUI = syncViewSettingsUI;
})();

function syncViewSettingsUI(s) {
  const slider = document.getElementById('popoverIconSize');
  const sizeVal = document.getElementById('popoverIconSizeVal');
  const presets = document.getElementById('popoverPresets');
  const posGroup = document.getElementById('popoverPosGroup');
  const showTitleCb = document.getElementById('popoverShowTitle');
  const showUrlCb = document.getElementById('popoverShowUrl');

  if (!slider || !presets || !posGroup) return;

  const size = s.iconSize || 48;
  slider.value = size;
  if (sizeVal) sizeVal.textContent = `${size}×${size}`;

  presets.querySelectorAll('.view-popover__preset-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.size) === size);
  });

  const pos = s.labelPosition || 'right';
  posGroup.querySelectorAll('.view-popover__pos-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pos === pos);
  });

  if (showTitleCb) showTitleCb.checked = s.showTitle !== false;
  if (showUrlCb) showUrlCb.checked = s.showUrl !== false;
}

function initViewSettings() {
  const btn = document.getElementById('viewSettingsBtn');
  const popover = document.getElementById('viewSettingsPopover');
  const slider = document.getElementById('popoverIconSize');
  const sizeVal = document.getElementById('popoverIconSizeVal');
  const presets = document.getElementById('popoverPresets');
  const posGroup = document.getElementById('popoverPosGroup');
  const showTitleCb = document.getElementById('popoverShowTitle');
  const showUrlCb = document.getElementById('popoverShowUrl');

  if (!btn || !popover) return;

  // Toggle popover
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = popover.hidden;
    popover.hidden = !isHidden;
    btn.classList.toggle('active', !popover.hidden);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!popover.hidden && !popover.contains(e.target) && !btn.contains(e.target)) {
      popover.hidden = true;
      btn.classList.remove('active');
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !popover.hidden) {
      popover.hidden = true;
      btn.classList.remove('active');
    }
  });

  // Helper to save settings and update content
  const saveAndRender = async (updates) => {
    const currentCfg = await Storage.load();
    if (!currentCfg.settings) currentCfg.settings = { ...Storage.DEFAULT_CONFIG.settings };
    Object.assign(currentCfg.settings, updates);
    await Storage.save(currentCfg);
    await Render.renderContent();
  };

  const STANDARD_ICON_SIZES = [16, 32, 48, 64, 128, 256];
  const snapToStandardIconSize = (val) => {
    const num = parseInt(val, 10);
    return STANDARD_ICON_SIZES.reduce((prev, curr) =>
      Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
    );
  };

  // Slider change
  slider.addEventListener('input', () => {
    const size = snapToStandardIconSize(slider.value);
    slider.value = size;
    sizeVal.textContent = `${size}×${size}`;
    presets.querySelectorAll('.view-popover__preset-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.size) === size);
    });
    document.documentElement.style.setProperty('--bookmark-icon-size', size + 'px');
  });

  slider.addEventListener('change', async () => {
    const size = snapToStandardIconSize(slider.value);
    slider.value = size;
    await saveAndRender({ iconSize: size });
  });

  // Preset buttons
  presets.addEventListener('click', async (e) => {
    const pBtn = e.target.closest('.view-popover__preset-btn');
    if (!pBtn) return;
    const size = parseInt(pBtn.dataset.size);
    slider.value = size;
    sizeVal.textContent = `${size}×${size}`;
    presets.querySelectorAll('.view-popover__preset-btn').forEach(b => {
      b.classList.toggle('active', b === pBtn);
    });
    document.documentElement.style.setProperty('--bookmark-icon-size', size + 'px');
    await saveAndRender({ iconSize: size });
  });

  // Label position buttons
  posGroup.addEventListener('click', async (e) => {
    const posBtn = e.target.closest('.view-popover__pos-btn');
    if (!posBtn) return;
    const pos = posBtn.dataset.pos;
    posGroup.querySelectorAll('.view-popover__pos-btn').forEach(b => {
      b.classList.toggle('active', b === posBtn);
    });
    await saveAndRender({ labelPosition: pos });
  });

  // Checkboxes
  showTitleCb.addEventListener('change', async () => {
    await saveAndRender({ showTitle: showTitleCb.checked });
  });

  showUrlCb.addEventListener('change', async () => {
    await saveAndRender({ showUrl: showUrlCb.checked });
  });
}

let _syncListenerAttached = false;
function setupSyncListener() {
  if (_syncListenerAttached || typeof chrome === 'undefined' || !chrome.bookmarks?.onCreated) return;
  _syncListenerAttached = true;

  const onBookmarkCreated = async (id, node) => {
    const cfg = await Storage.load();
    if ((cfg.tabs && cfg.tabs.length > 0) || cfg.rootFolderId) {
      chrome.bookmarks.onCreated.removeListener(onBookmarkCreated);
      return;
    }

    const title = node?.title || '';
    if (title.startsWith(CONFIG_PREFIX) || title === CONFIG_FOLDER_NAME) {
      const restored = await ConfigStore.autoRestoreIfEmpty();
      if (restored) {
        chrome.bookmarks.onCreated.removeListener(onBookmarkCreated);
        await Tabs.init();
        await initGlobalSettings();
        await Render.renderAll();
      }
    }
  };

  chrome.bookmarks.onCreated.addListener(onBookmarkCreated);
}

function openOptionsPage() {
  window.location.href = chrome.runtime.getURL('options.html');
}

async function initGlobalSettings() {
  const config = await Storage.load();
  const s = config.settings || Storage.DEFAULT_CONFIG.settings;
  document.getElementById('openInNewTab').checked = s.openInNewTab !== false;
  syncViewSettingsUI(s);
}

async function applyUrlImport(data) {
  await ConfigStore.applyConfig(data);
}
