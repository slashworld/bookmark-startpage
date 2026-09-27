/**
 * options.js — Settings page logic
 */

let selectedFolderId = null;

(async function init() {
  // Initialize i18n and theme first
  await I18n.init();
  if (typeof Theme !== 'undefined') {
    await Theme.init();
  }

  setupBackLink();

  try {
    await ConfigStore.autoRestoreIfEmpty();
    const config = await Storage.load();
    selectedFolderId = config.rootFolderId;

    // Set language selector value
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
      const currentLang = config.settings?.language || 'auto';
      langSelect.value = currentLang;

      // Handle language change
      langSelect.addEventListener('change', async (e) => {
        const newLang = e.target.value;
        await I18n.setLanguage(newLang);
      });
    }

    const tree = await Bookmarks.getTree();
    const picker = document.getElementById('treePicker');
    picker.innerHTML = '';

    let folderCount = 0;
    const root = tree[0];

    if (root.children) {
      for (const topFolder of root.children) {
        if (!topFolder.url) {
          folderCount += renderNode(picker, topFolder, 0);
        }
      }
    }

    document.getElementById('folderCount').textContent = I18n.t('folder.count', { count: folderCount });
    updateSelectionDisplay();
    renderTabsList(config.tabs || []);

    const s = config.settings || Storage.DEFAULT_CONFIG.settings;
    document.getElementById('openInNewTab').checked = s.openInNewTab !== false;
    document.getElementById('showLinksInTree').checked = s.showLinksInTree !== false;
    document.getElementById('fontSizeTabs').value = s.fontSizeTabs || 13;
    document.getElementById('fontSizeNav').value = s.fontSizeNav || 13;
    document.getElementById('fontSizeContent').value = s.fontSizeContent || 13;
    updateFontLabels();

  } catch (err) {
    console.error('Init error:', err);
    document.getElementById('treePicker').innerHTML =
      '<p style="color:var(--danger);padding:12px;">' + I18n.t('common.error') + ': ' + err.message + '</p>';
  }
})();

// === Back Link ===

function setupBackLink() {
  document.getElementById('backLink').addEventListener('click', function (e) {
    e.preventDefault();
    window.location.href = chrome.runtime.getURL('newtab.html');
  });
}

// === Tree Picker ===

function renderNode(container, node, depth) {
  let count = 1;
  const subFolders = (node.children || []).filter(c => !c.url);
  const totalLinks = countAllLinks(node);

  const wrapper = document.createElement('div');
  wrapper.className = 'fp-node';
  wrapper.dataset.depth = depth;

  const row = document.createElement('div');
  row.className = 'fp-row';
  if (node.id === selectedFolderId) row.classList.add('selected');

  const arrow = document.createElement('span');
  arrow.className = 'fp-arrow' + (subFolders.length === 0 ? ' empty' : '');
  arrow.textContent = '▶';
  if (depth === 0) arrow.classList.add('expanded');
  row.appendChild(arrow);

  const icon = Theme.createFolderIcon('fp-icon');
  row.appendChild(icon);

  const title = document.createElement('span');
  title.className = 'fp-title';
  title.textContent = node.title || I18n.t('bookmarks.title');
  row.appendChild(title);

  if (totalLinks > 0) {
    const badge = document.createElement('span');
    badge.className = 'fp-count';
    badge.textContent = totalLinks;
    badge.title = totalLinks + ' ' + I18n.t('bookmarks.title').toLowerCase();
    row.appendChild(badge);
  }

  row.addEventListener('click', function (e) {
    e.stopPropagation();
    document.querySelectorAll('.fp-row.selected').forEach(function (r) { r.classList.remove('selected'); });
    row.classList.add('selected');
    selectedFolderId = node.id;
    document.getElementById('saveBtn').disabled = false;
    updateSelectionDisplay();

    if (subFolders.length > 0) {
      arrow.classList.toggle('expanded');
      var ch = wrapper.querySelector(':scope > .fp-children');
      if (ch) ch.classList.toggle('open');
    }
  });

  wrapper.appendChild(row);

  if (subFolders.length > 0) {
    const childrenEl = document.createElement('div');
    childrenEl.className = 'fp-children' + (depth === 0 ? ' open' : '');
    for (const child of subFolders) {
      count += renderNode(childrenEl, child, depth + 1);
    }
    wrapper.appendChild(childrenEl);
  }

  container.appendChild(wrapper);
  return count;
}

function countAllLinks(node) {
  let count = 0;
  if (!node.children) return 0;
  for (const c of node.children) {
    if (c.url) count++;
    else count += countAllLinks(c);
  }
  return count;
}

async function updateSelectionDisplay() {
  const pathEl = document.getElementById('selectedPath');
  if (selectedFolderId) {
    const path = await Bookmarks.getFolderPath(selectedFolderId);
    pathEl.textContent = path || I18n.t('folder.notSelected');
  } else {
    pathEl.textContent = '— ' + I18n.t('folder.notSelected') + ' —';
  }
}

// === Save Root Folder ===

document.getElementById('saveBtn').addEventListener('click', async function () {
  if (!selectedFolderId) return;
  const config = await Storage.load();
  config.rootFolderId = selectedFolderId;

  const node = await Bookmarks.getNode(selectedFolderId);
  if (config.tabs.length > 0) {
    config.tabs[0].bookmarkFolderId = selectedFolderId;
    config.tabs[0].title = node.title || I18n.t('tabs.main');
  } else {
    config.tabs.push({
      id: Storage.generateTabId(),
      title: node.title || I18n.t('tabs.main'),
      bookmarkFolderId: selectedFolderId,
      pinned: true,
      order: 0,
      color: null
    });
  }

  await Storage.save(config);
  showStatus('saveStatus', '✓ ' + I18n.t('status.saved'), 'success');
  renderTabsList(config.tabs);
});

// === Tabs List ===

function renderTabsList(tabs) {
  const list = document.getElementById('tabsList');
  list.innerHTML = '';
  if (tabs.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">' + I18n.t('tabs.noTabs') + '</p>';
    return;
  }
  for (const tab of tabs) {
    const item = document.createElement('div');
    item.className = 'tabs-list-item';

    const iconEl = Theme.createFolderIcon('tabs-list-item__icon');
    item.appendChild(iconEl);

    if (tab.color) {
      const dot = document.createElement('span');
      dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:' + tab.color;
      item.appendChild(dot);
    }

    const titleEl = document.createElement('span');
    titleEl.className = 'tabs-list-item__title';
    titleEl.textContent = tab.title;
    item.appendChild(titleEl);

    if (tab.pinned) {
      const badge = document.createElement('span');
      badge.className = 'tabs-list-item__badge';
      badge.textContent = '📌';
      item.appendChild(badge);
    } else {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'tabs-list-item__remove';
      removeBtn.textContent = '✕';
      removeBtn.title = I18n.t('tabs.close');
      removeBtn.addEventListener('click', async function () {
        const cfg = await Storage.load();
        cfg.tabs = cfg.tabs.filter(function (t) { return t.id !== tab.id; });
        await Storage.save(cfg);
        renderTabsList(cfg.tabs);
      });
      item.appendChild(removeBtn);
    }

    list.appendChild(item);
  }
}

// === Global Settings ===

document.getElementById('saveSettingsBtn').addEventListener('click', async function () {
  const config = await Storage.load();
  if (!config.settings) config.settings = {};

  config.settings.openInNewTab = document.getElementById('openInNewTab').checked;
  config.settings.showLinksInTree = document.getElementById('showLinksInTree').checked;
  config.settings.fontSizeTabs = parseInt(document.getElementById('fontSizeTabs').value) || 13;
  config.settings.fontSizeNav = parseInt(document.getElementById('fontSizeNav').value) || 13;
  config.settings.fontSizeContent = parseInt(document.getElementById('fontSizeContent').value) || 13;

  // Save language setting
  const langSelect = document.getElementById('languageSelect');
  if (langSelect) {
    config.settings.language = langSelect.value;
  }

  await Storage.save(config);
  showStatus('settingsStatus', '✓ ' + I18n.t('status.settingsSaved'), 'success');
});

['fontSizeTabs', 'fontSizeNav', 'fontSizeContent'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateFontLabels);
});

function updateFontLabels() {
  document.getElementById('fontSizeTabsVal').textContent = document.getElementById('fontSizeTabs').value + 'px';
  document.getElementById('fontSizeNavVal').textContent = document.getElementById('fontSizeNav').value + 'px';
  document.getElementById('fontSizeContentVal').textContent = document.getElementById('fontSizeContent').value + 'px';
}

// === Config Save Button ===

document.getElementById('configSaveBtn').addEventListener('click', async function () {
  const btn = this;
  btn.disabled = true;
  btn.textContent = '⏳ ' + I18n.t('status.saving');

  try {
    const result = await ConfigStore.save();
    showStatus('configStatus', '✓ ' + I18n.t('status.configSaved', { title: result.title }), 'success');
    AutoSave.reset(); // just saved manually, reset timer
  } catch (e) {
    console.error('Config save error:', e);
    showStatus('configStatus', '✕ ' + I18n.t('common.error') + ': ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 ' + I18n.t('export.save');
  }
});

// === Config Copy URL Button ===

document.getElementById('configCopyUrlBtn').addEventListener('click', async function () {
  const btn = this;
  btn.disabled = true;
  try {
    const configStr = await Storage.exportToString();
    const url = chrome.runtime.getURL('newtab.html') + '#config=' + configStr;
    await navigator.clipboard.writeText(url);
    btn.textContent = '✓ ' + I18n.t('common.copied');
    setTimeout(() => { btn.textContent = '🔗 ' + I18n.t('export.copyUrl'); btn.disabled = false; }, 2000);
  } catch (e) {
    console.error('Copy URL error:', e);
    showStatus('configStatus', '✕ ' + I18n.t('common.error') + ': ' + e.message, 'error');
    btn.disabled = false;
  }
});

// === Config Load Button ===

document.getElementById('configLoadBtn').addEventListener('click', async function () {
  // 4. Confirm if current config is not empty
  const currentConfig = await Storage.load();
  if (currentConfig.tabs && currentConfig.tabs.length > 0) {
    if (!confirm(I18n.t('export.confirmReplace', { count: currentConfig.tabs.length }))) {
      return;
    }
  }

  const btn = this;
  btn.disabled = true;
  btn.textContent = '⏳ ' + I18n.t('status.loading');

  try {
    const result = await ConfigStore.load();

    if (!result) {
      OptsModal.show(I18n.t('export.load'),
        '<div class="result-status result-status--warn">!</div>' +
        '<p>' + I18n.t('export.configNotFound') + '</p>' +
        '<p class="result-detail">' + I18n.t('export.configFolder') + '</p>'
      );
      return;
    }

    const importResult = await applyImportedConfig(result.data);
    const dateStr = result.timestamp
      ? result.timestamp.toLocaleString()
      : I18n.t('common.none');

    if (importResult.failed === 0) {
      OptsModal.show(I18n.t('export.loaded'),
        '<div class="result-status result-status--ok">✓</div>' +
        '<p>' + I18n.t('export.loaded') + '</p>' +
        '<p>' + I18n.t('export.date') + ': <span class="result-date">' + dateStr + '</span></p>' +
        '<p class="result-detail">' + I18n.t('export.tabsCount', { imported: importResult.imported }) + '</p>',
        function () { location.reload(); }
      );
    } else if (importResult.imported > 0) {
      OptsModal.show(I18n.t('export.partialLoad'),
        '<div class="result-status result-status--warn">!</div>' +
        '<p>' + I18n.t('export.partialLoad') + '</p>' +
        '<p>' + I18n.t('export.date') + ': <span class="result-date">' + dateStr + '</span></p>' +
        '<p class="result-detail">' + I18n.t('export.loadedPartial', { imported: importResult.imported, failed: importResult.failed }) + '</p>' +
        '<p class="result-detail">' + I18n.t('export.structureDiffers') + '</p>',
        function () { location.reload(); }
      );
    } else {
      OptsModal.show(I18n.t('export.loadError'),
        '<div class="result-status result-status--err">✕</div>' +
        '<p>' + I18n.t('export.noneLoaded') + '</p>' +
        '<p>' + I18n.t('export.date') + ': <span class="result-date">' + dateStr + '</span></p>' +
        '<p class="result-detail">' + I18n.t('export.structureDiffers') + '</p>'
      );
    }
  } catch (e) {
    console.error('Config load error:', e);
    OptsModal.show(I18n.t('common.error'),
      '<div class="result-status result-status--err">✕</div>' +
      '<p class="result-error">' + e.message + '</p>'
    );
  } finally {
    btn.disabled = false;
    btn.textContent = '📂 ' + I18n.t('export.load');
  }
});

// === Config Export to File Button ===

document.getElementById('configFileExportBtn').addEventListener('click', async function() {
  const btn = this;
  btn.disabled = true;
  btn.textContent = '⏳ ' + I18n.t('status.saving');

  try {
    const data = await Storage.exportData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `bookmark-startpage-config-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('configStatus', '✓ ' + I18n.t('export.fileExported'), 'success');
  } catch (e) {
    console.error('File export error:', e);
    showStatus('configStatus', '✕ ' + I18n.t('common.error') + ': ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 ' + I18n.t('export.saveFile');
  }
});

// === Config Import from File Button ===

const fileInput = document.getElementById('importFileInput');

document.getElementById('configFileImportBtn').addEventListener('click', async function() {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: '*.json',
          accept: {
            'application/json': ['.json']
          }
        }],
        multiple: false
      });
      const file = await fileHandle.getFile();
      await processConfigFile(file);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('showOpenFilePicker failed, falling back to input:', err);
    }
  }

  fileInput.value = '';
  fileInput.click();
});

fileInput.addEventListener('change', async function(e) {
  const file = e.target.files && e.target.files[0];
  if (file) await processConfigFile(file);
});

async function processConfigFile(file) {
  try {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = Storage.parseConfigString(text);
    }

    if (!data || typeof data !== 'object') {
      OptsModal.show(I18n.t('common.error'),
        '<div class="result-status result-status--err">✕</div>' +
        '<p class="result-error">' + I18n.t('status.invalidFormat') + '</p>'
      );
      return;
    }

    const currentConfig = await Storage.load();
    if (currentConfig.tabs && currentConfig.tabs.length > 0) {
      if (!confirm(I18n.t('export.confirmReplace', { count: currentConfig.tabs.length }))) {
        return;
      }
    }

    const importResult = await applyImportedConfig(data);
    const dateStr = file.name;

    if (importResult.failed === 0) {
      OptsModal.show(I18n.t('export.loaded'),
        '<div class="result-status result-status--ok">✓</div>' +
        '<p>' + I18n.t('export.loaded') + '</p>' +
        '<p>' + I18n.t('export.date') + ': <span class="result-date">' + dateStr + '</span></p>' +
        '<p class="result-detail">' + I18n.t('export.tabsCount', { imported: importResult.imported }) + '</p>',
        function() { location.reload(); }
      );
    } else if (importResult.imported > 0) {
      OptsModal.show(I18n.t('export.partialLoad'),
        '<div class="result-status result-status--warn">!</div>' +
        '<p>' + I18n.t('export.partialLoad') + '</p>' +
        '<p>' + I18n.t('export.date') + ': <span class="result-date">' + dateStr + '</span></p>' +
        '<p class="result-detail">' + I18n.t('export.loadedPartial', { imported: importResult.imported, failed: importResult.failed }) + '</p>' +
        '<p class="result-detail">' + I18n.t('export.structureDiffers') + '</p>',
        function() { location.reload(); }
      );
    } else {
      OptsModal.show(I18n.t('export.loadError'),
        '<div class="result-status result-status--err">✕</div>' +
        '<p>' + I18n.t('export.noneLoaded') + '</p>' +
        '<p class="result-detail">' + I18n.t('export.structureDiffers') + '</p>'
      );
    }
  } catch (err) {
    console.error('File import error:', err);
    OptsModal.show(I18n.t('common.error'),
      '<div class="result-status result-status--err">✕</div>' +
      '<p class="result-error">' + err.message + '</p>'
    );
  }
}

/**
 * Apply imported config and return { imported, failed } counts.
 */
async function applyImportedConfig(data) {
  return await ConfigStore.applyConfig(data);
}

// ==================== Text Export (fallback) ====================

document.getElementById('exportBtn').addEventListener('click', async function () {
  try {
    const str = await Storage.exportToString();
    const textarea = document.getElementById('exportStr');
    textarea.value = str;
    textarea.style.display = 'block';
    document.getElementById('copyBtn').style.display = '';
  } catch (e) {
    console.error('Export error:', e);
    alert(I18n.t('status.exportError', { message: e.message }));
  }
});

document.getElementById('copyBtn').addEventListener('click', function () {
  const textarea = document.getElementById('exportStr');
  textarea.select();
  navigator.clipboard.writeText(textarea.value).then(function () {
    var btn = document.getElementById('copyBtn');
    btn.textContent = '✓ ' + I18n.t('common.copied');
    setTimeout(function () { btn.textContent = '📋 ' + I18n.t('export.copy'); }, 2000);
  });
});

// ==================== Text Import (fallback) ====================

document.getElementById('importBtn').addEventListener('click', async function () {
  const str = document.getElementById('importStr').value.trim();
  if (!str) {
    showStatus('importStatus', I18n.t('status.pasteConfig'), 'error');
    return;
  }

  const data = Storage.parseConfigString(str);
  if (!data) {
    showStatus('importStatus', '✕ ' + I18n.t('status.invalidFormat'), 'error');
    return;
  }

  // Confirm if current config is not empty
  const currentConfig = await Storage.load();
  if (currentConfig.tabs && currentConfig.tabs.length > 0) {
    if (!confirm(I18n.t('export.confirmReplace', { count: currentConfig.tabs.length }))) {
      return;
    }
  }

  try {
    const result = await applyImportedConfig(data);
    if (result.failed === 0) {
      showStatus('importStatus', '✓ ' + I18n.t('export.imported', { count: result.imported }), 'success');
    } else {
      showStatus('importStatus', '⚠ ' + I18n.t('status.importError', { message: result.imported + ' OK, ' + result.failed + ' not found' }), 'warning');
    }
    setTimeout(function () { location.reload(); }, 2000);
  } catch (e) {
    console.error('Import error:', e);
    showStatus('importStatus', '✕ ' + I18n.t('status.importError', { message: e.message }), 'error');
  }
});

// ==================== Options Page Modal ====================

const OptsModal = {
  _onClose: null,

  init() {
    document.getElementById('optsModalClose').addEventListener('click', () => OptsModal.close());
    document.getElementById('optsModalOk').addEventListener('click', () => OptsModal.close());
    document.getElementById('optsModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'optsModalOverlay') OptsModal.close();
    });
  },

  show(title, bodyHtml, onClose) {
    OptsModal._onClose = onClose || null;
    document.getElementById('optsModalTitle').textContent = title;
    document.getElementById('optsModalBody').innerHTML = bodyHtml;
    document.getElementById('optsModalOverlay').hidden = false;
  },

  close() {
    document.getElementById('optsModalOverlay').hidden = true;
    if (OptsModal._onClose) {
      OptsModal._onClose();
      OptsModal._onClose = null;
    }
  }
};

// Init modal
OptsModal.init();

// ==================== Helpers ====================

function showStatus(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'status-msg ' + type;
  if (type !== 'error') {
    setTimeout(function () { el.className = 'status-msg'; }, 5000);
  }
}
