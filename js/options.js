/**
 * options.js — Settings page logic
 */

let selectedFolderId = null;

(async function init() {
  setupBackLink();

  try {
    const config = await Storage.load();
    selectedFolderId = config.rootFolderId;

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

    document.getElementById('folderCount').textContent = folderCount + ' папок';
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
      '<p style="color:var(--danger);padding:12px;">Ошибка: ' + err.message + '</p>';
  }
})();

// === Back Link ===

function setupBackLink() {
  document.getElementById('backLink').addEventListener('click', function(e) {
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

  const icon = document.createElement('span');
  icon.className = 'fp-icon';
  icon.textContent = '📁';
  row.appendChild(icon);

  const title = document.createElement('span');
  title.className = 'fp-title';
  title.textContent = node.title || 'Закладки';
  row.appendChild(title);

  if (totalLinks > 0) {
    const badge = document.createElement('span');
    badge.className = 'fp-count';
    badge.textContent = totalLinks;
    badge.title = totalLinks + ' ссылок всего';
    row.appendChild(badge);
  }

  row.addEventListener('click', function(e) {
    e.stopPropagation();
    document.querySelectorAll('.fp-row.selected').forEach(function(r) { r.classList.remove('selected'); });
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
    pathEl.textContent = path || 'Корень';
  } else {
    pathEl.textContent = '— не выбрана —';
  }
}

// === Save Root Folder ===

document.getElementById('saveBtn').addEventListener('click', async function() {
  if (!selectedFolderId) return;
  const config = await Storage.load();
  config.rootFolderId = selectedFolderId;

  const node = await Bookmarks.getNode(selectedFolderId);
  if (config.tabs.length > 0) {
    config.tabs[0].bookmarkFolderId = selectedFolderId;
    config.tabs[0].title = node.title || 'Главный';
  } else {
    config.tabs.push({
      id: Storage.generateTabId(),
      title: node.title || 'Главный',
      bookmarkFolderId: selectedFolderId,
      pinned: true,
      order: 0,
      color: null
    });
  }

  await Storage.save(config);
  showStatus('saveStatus', '✓ Сохранено!', 'success');
  renderTabsList(config.tabs);
});

// === Tabs List ===

function renderTabsList(tabs) {
  const list = document.getElementById('tabsList');
  list.innerHTML = '';
  if (tabs.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Нет табов.</p>';
    return;
  }
  for (const tab of tabs) {
    const item = document.createElement('div');
    item.className = 'tabs-list-item';

    const iconEl = document.createElement('span');
    iconEl.textContent = '📁';
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
      removeBtn.title = 'Удалить таб';
      removeBtn.addEventListener('click', async function() {
        const cfg = await Storage.load();
        cfg.tabs = cfg.tabs.filter(function(t) { return t.id !== tab.id; });
        await Storage.save(cfg);
        renderTabsList(cfg.tabs);
      });
      item.appendChild(removeBtn);
    }

    list.appendChild(item);
  }
}

// === Global Settings ===

document.getElementById('saveSettingsBtn').addEventListener('click', async function() {
  const config = await Storage.load();
  if (!config.settings) config.settings = {};

  config.settings.openInNewTab = document.getElementById('openInNewTab').checked;
  config.settings.showLinksInTree = document.getElementById('showLinksInTree').checked;
  config.settings.fontSizeTabs = parseInt(document.getElementById('fontSizeTabs').value) || 13;
  config.settings.fontSizeNav = parseInt(document.getElementById('fontSizeNav').value) || 13;
  config.settings.fontSizeContent = parseInt(document.getElementById('fontSizeContent').value) || 13;

  await Storage.save(config);
  showStatus('settingsStatus', '✓ Настройки сохранены!', 'success');
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

document.getElementById('configSaveBtn').addEventListener('click', async function() {
  const btn = this;
  btn.disabled = true;
  btn.textContent = '⏳ Сохранение...';

  try {
    const result = await ConfigStore.save();
    showStatus('configStatus', '✓ Конфиг сохранён: ' + result.title, 'success');
    AutoSave.reset(); // just saved manually, reset timer
  } catch (e) {
    console.error('Config save error:', e);
    showStatus('configStatus', '✕ Ошибка сохранения: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Сохранить конфиг';
  }
});

// === Config Copy URL Button ===

document.getElementById('configCopyUrlBtn').addEventListener('click', async function() {
  const btn = this;
  btn.disabled = true;
  try {
    const configStr = await Storage.exportToString();
    const url = chrome.runtime.getURL('newtab.html') + '#config=' + configStr;
    await navigator.clipboard.writeText(url);
    btn.textContent = '✓ Скопировано!';
    setTimeout(() => { btn.textContent = '🔗 Копировать URL'; btn.disabled = false; }, 2000);
  } catch (e) {
    console.error('Copy URL error:', e);
    showStatus('configStatus', '✕ Ошибка: ' + e.message, 'error');
    btn.disabled = false;
  }
});

// === Config Load Button ===

document.getElementById('configLoadBtn').addEventListener('click', async function() {
  // 4. Confirm if current config is not empty
  const currentConfig = await Storage.load();
  if (currentConfig.tabs && currentConfig.tabs.length > 0) {
    if (!confirm('Текущий конфиг содержит ' + currentConfig.tabs.length + ' табов.\nЗаменить его загруженным?')) {
      return;
    }
  }

  const btn = this;
  btn.disabled = true;
  btn.textContent = '⏳ Загрузка...';

  try {
    const result = await ConfigStore.load();

    if (!result) {
      OptsModal.show('Загрузка конфига',
        '<div class="result-status result-status--warn">!</div>' +
        '<p>Сохранённые конфиги не найдены.</p>' +
        '<p class="result-detail">Папка «Другие закладки / ' + CONFIG_FOLDER_NAME + '» пуста или не существует.</p>'
      );
      return;
    }

    const importResult = await applyImportedConfig(result.data);
    const dateStr = result.timestamp
      ? result.timestamp.toLocaleString('ru-RU')
      : 'неизвестно';

    if (importResult.failed === 0) {
      OptsModal.show('Конфиг загружен',
        '<div class="result-status result-status--ok">✓</div>' +
        '<p>Конфигурация успешно загружена</p>' +
        '<p>Дата конфига: <span class="result-date">' + dateStr + '</span></p>' +
        '<p class="result-detail">Табов: ' + importResult.imported + ', настройки применены</p>',
        function() { location.reload(); }
      );
    } else if (importResult.imported > 0) {
      OptsModal.show('Частичная загрузка',
        '<div class="result-status result-status--warn">!</div>' +
        '<p>Конфиг загружен частично</p>' +
        '<p>Дата конфига: <span class="result-date">' + dateStr + '</span></p>' +
        '<p class="result-detail">Загружено: ' + importResult.imported + ', не найдено: ' + importResult.failed + '</p>' +
        '<p class="result-detail">Убедитесь, что структура закладок совпадает</p>',
        function() { location.reload(); }
      );
    } else {
      OptsModal.show('Ошибка загрузки',
        '<div class="result-status result-status--err">✕</div>' +
        '<p>Ни одна папка из конфига не найдена</p>' +
        '<p>Дата конфига: <span class="result-date">' + dateStr + '</span></p>' +
        '<p class="result-detail">Структура закладок на этом ПК отличается от источника</p>'
      );
    }
  } catch (e) {
    console.error('Config load error:', e);
    OptsModal.show('Ошибка',
      '<div class="result-status result-status--err">✕</div>' +
      '<p class="result-error">' + e.message + '</p>'
    );
  } finally {
    btn.disabled = false;
    btn.textContent = '📂 Загрузить конфиг';
  }
});

/**
 * Apply imported config and return { imported, failed } counts.
 */
async function applyImportedConfig(data) {
  const config = await Storage.load();
  let imported = 0;
  let failed = 0;

  if (data.settings) {
    config.settings = { ...Storage.DEFAULT_CONFIG.settings, ...data.settings };
  }

  if (data.rootPathInfo || data.rootPath) {
    const searchTarget = data.rootPathInfo || data.rootPath;
    const rootFolder = await Bookmarks.findFolderByPath(searchTarget);
    if (rootFolder) {
      config.rootFolderId = rootFolder.id;
    } else {
      failed++;
    }
  }

  if (data.tabs && data.tabs.length > 0) {
    config.tabs = [];
    for (const tabData of data.tabs) {
      const searchTarget = tabData.pathInfo || tabData.folderPath;
      const folder = await Bookmarks.findFolderByPath(searchTarget);
      if (folder) {
        config.tabs.push({
          id: Storage.generateTabId(),
          title: tabData.title,
          bookmarkFolderId: folder.id,
          pinned: tabData.pinned || false,
          order: tabData.order || config.tabs.length,
          color: tabData.color || null,
          viewMode: tabData.viewMode || 'explorer'
        });
        imported++;
      } else {
        failed++;
      }
    }
  }

  await Storage.save(config);
  return { imported, failed };
}

// ==================== Text Export (fallback) ====================

document.getElementById('exportBtn').addEventListener('click', async function() {
  try {
    const str = await Storage.exportToString();
    const textarea = document.getElementById('exportStr');
    textarea.value = str;
    textarea.style.display = 'block';
    document.getElementById('copyBtn').style.display = '';
  } catch (e) {
    console.error('Export error:', e);
    alert('Ошибка экспорта: ' + e.message);
  }
});

document.getElementById('copyBtn').addEventListener('click', function() {
  const textarea = document.getElementById('exportStr');
  textarea.select();
  navigator.clipboard.writeText(textarea.value).then(function() {
    var btn = document.getElementById('copyBtn');
    btn.textContent = '✓ Скопировано!';
    setTimeout(function() { btn.textContent = '📋 Копировать'; }, 2000);
  });
});

// ==================== Text Import (fallback) ====================

document.getElementById('importBtn').addEventListener('click', async function() {
  const str = document.getElementById('importStr').value.trim();
  if (!str) {
    showStatus('importStatus', 'Вставьте строку конфига', 'error');
    return;
  }

  const data = Storage.parseConfigString(str);
  if (!data) {
    showStatus('importStatus', '✕ Неверный формат', 'error');
    return;
  }

  // Confirm if current config is not empty
  const currentConfig = await Storage.load();
  if (currentConfig.tabs && currentConfig.tabs.length > 0) {
    if (!confirm('Текущий конфиг содержит ' + currentConfig.tabs.length + ' табов.\nЗаменить его импортированным?')) {
      return;
    }
  }

  try {
    const result = await applyImportedConfig(data);
    if (result.failed === 0) {
      showStatus('importStatus', '✓ Импортировано: ' + result.imported + ' табов', 'success');
    } else {
      showStatus('importStatus', '⚠ Импорт: ' + result.imported + ' ок, ' + result.failed + ' не найдено', 'warning');
    }
    setTimeout(function() { location.reload(); }, 2000);
  } catch (e) {
    console.error('Import error:', e);
    showStatus('importStatus', '✕ Ошибка: ' + e.message, 'error');
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
    setTimeout(function() { el.className = 'status-msg'; }, 5000);
  }
}
