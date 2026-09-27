/**
 * contextmenu.js — Context menus for tabs, folders, bookmarks + modal editor
 */

const TAB_COLORS = [
  { nameKey: 'tabs.colors.none', value: null },
  { nameKey: 'tabs.colors.red', value: '#f38ba8' },
  { nameKey: 'tabs.colors.orange', value: '#fab387' },
  { nameKey: 'tabs.colors.yellow', value: '#f9e2af' },
  { nameKey: 'tabs.colors.green', value: '#a6e3a1' },
  { nameKey: 'tabs.colors.cyan', value: '#89dceb' },
  { nameKey: 'tabs.colors.blue', value: '#89b4fa' },
  { nameKey: 'tabs.colors.purple', value: '#cba6f7' },
  { nameKey: 'tabs.colors.pink', value: '#f5c2e7' },
];

const ContextMenu = {
  menu: null,
  currentTarget: null,
  currentType: null, // 'folder' | 'tab' | 'bookmark'

  init() {
    ContextMenu.menu = document.getElementById('ctxMenu');

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ctx-menu')) ContextMenu.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { ContextMenu.hide(); Modal.close(); }
    });
    ContextMenu.menu.addEventListener('contextmenu', (e) => e.preventDefault());
    ContextMenu.menu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-action]');
      if (item) ContextMenu.handleAction(item.dataset.action, item.dataset);
    });
  },

  // ==================== Show menus ====================

  showForFolder(event, folderNode) {
    event.preventDefault();
    event.stopPropagation();
    ContextMenu.currentTarget = folderNode;
    ContextMenu.currentType = 'folder';

    ContextMenu.menu.innerHTML = `
      <button class="ctx-menu__item" data-action="add-bookmark">➕ ${I18n.t('bookmarks.add')}</button>
      <button class="ctx-menu__item" data-action="add-folder">${Theme.getFolderIconHtml('ctx-menu__icon')} ${I18n.t('bookmarks.addFolder')}</button>
      <div class="ctx-menu__separator"></div>
      <button class="ctx-menu__item" data-action="edit-folder">✏️ ${I18n.t('bookmarks.renameFolder')}</button>
      <button class="ctx-menu__item ctx-menu__item--danger" data-action="delete-folder">🗑️ ${I18n.t('bookmarks.deleteFolder')}</button>
      <div class="ctx-menu__separator"></div>
      <button class="ctx-menu__item" data-action="create-tab">📑 ${I18n.t('tabs.create')}</button>
    `;
    ContextMenu.show(event.clientX, event.clientY);
  },

  showForBookmark(event, bookmarkNode) {
    event.preventDefault();
    event.stopPropagation();
    ContextMenu.currentTarget = bookmarkNode;
    ContextMenu.currentType = 'bookmark';

    ContextMenu.menu.innerHTML = `
      <button class="ctx-menu__item" data-action="edit-bookmark">✏️ ${I18n.t('bookmarks.edit')}</button>
      <button class="ctx-menu__item ctx-menu__item--danger" data-action="delete-bookmark">🗑️ ${I18n.t('bookmarks.delete')}</button>
    `;
    ContextMenu.show(event.clientX, event.clientY);
  },

  showForTab(event, tab) {
    event.preventDefault();
    event.stopPropagation();
    ContextMenu.currentTarget = tab;
    ContextMenu.currentType = 'tab';

    const pinLabel = tab.pinned ? '📌 ' + I18n.t('tabs.unpin') : '📌 ' + I18n.t('tabs.pin');
    let html = `
      <button class="ctx-menu__item" data-action="tab-add-bookmark">➕ ${I18n.t('bookmarks.add')}</button>
      <button class="ctx-menu__item" data-action="tab-add-folder">${Theme.getFolderIconHtml('ctx-menu__icon')} ${I18n.t('bookmarks.addFolder')}</button>
      <div class="ctx-menu__separator"></div>
      <button class="ctx-menu__item" data-action="toggle-pin">${pinLabel}</button>
    `;
    if (!tab.pinned) {
      html += `<button class="ctx-menu__item" data-action="close-tab">✕ ${I18n.t('tabs.close')}</button>`;
    }
    html += `<div class="ctx-menu__separator"></div>`;
    html += `<div class="ctx-menu__label">${I18n.t('tabs.color')}:</div>`;
    html += `<div class="ctx-menu__colors">`;
    for (const c of TAB_COLORS) {
      const isActive = (tab.color || null) === c.value;
      const colorName = I18n.t(c.nameKey);
      if (c.value) {
        html += `<span class="ctx-menu__color-dot${isActive ? ' active' : ''}" 
                       data-action="set-color" data-color="${c.value}" 
                       style="background:${c.value}" title="${colorName}"></span>`;
      } else {
        html += `<span class="ctx-menu__color-dot ctx-menu__color-none${isActive ? ' active' : ''}" 
                       data-action="set-color" data-color="" title="${colorName}">✕</span>`;
      }
    }
    html += `</div>`;
    ContextMenu.menu.innerHTML = html;
    ContextMenu.show(event.clientX, event.clientY);
  },

  openAddBookmarkModal(folderOrId) {
    const parentId = (folderOrId && typeof folderOrId === 'object') ? folderOrId.id : folderOrId;
    if (!parentId) return;
    Modal.open({
      title: I18n.t('bookmarks.add'),
      fields: [
        { id: 'title', label: I18n.t('bookmarks.title'), value: '' },
        { id: 'url', label: I18n.t('bookmarks.url'), value: 'https://', type: 'url' }
      ],
      onSave: async (vals) => {
        if (!vals.title.trim() || !vals.url.trim()) return;
        await Bookmarks.create({ parentId, title: vals.title.trim(), url: vals.url.trim() });
        await Render.renderAll();
      }
    });
  },

  openAddFolderModal(folderOrId) {
    const parentId = (folderOrId && typeof folderOrId === 'object') ? folderOrId.id : folderOrId;
    if (!parentId) return;
    Modal.open({
      title: I18n.t('bookmarks.addFolder'),
      fields: [{ id: 'title', label: I18n.t('bookmarks.title'), value: '' }],
      onSave: async (vals) => {
        if (!vals.title.trim()) return;
        await Bookmarks.create({ parentId, title: vals.title.trim() });
        await Render.renderAll();
      }
    });
  },

  show(x, y) {
    const m = ContextMenu.menu;
    m.hidden = false;
    // Position, then clamp to viewport
    m.style.left = '0px'; m.style.top = '0px';
    const rect = m.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    m.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    m.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  },

  hide() {
    if (ContextMenu.menu) ContextMenu.menu.hidden = true;
  },

  // ==================== Actions ====================

  async handleAction(action, dataset) {
    ContextMenu.hide();
    const target = ContextMenu.currentTarget;

    switch (action) {
      // --- Tab actions ---
      case 'tab-add-bookmark':
        if (target && target.bookmarkFolderId) {
          ContextMenu.openAddBookmarkModal(target.bookmarkFolderId);
        }
        break;
      case 'tab-add-folder':
        if (target && target.bookmarkFolderId) {
          ContextMenu.openAddFolderModal(target.bookmarkFolderId);
        }
        break;
      case 'create-tab':
        if (target && ContextMenu.currentType === 'folder') {
          await Tabs.addTab(target.id, target.title);
          await Render.renderAll();
        }
        break;
      case 'toggle-pin':
        if (target) { await Tabs.togglePin(target.id); await Render.renderAll(); }
        break;
      case 'close-tab':
        if (target) await Render.closeTab(target.id);
        break;
      case 'set-color':
        if (target) { await Tabs.setColor(target.id, dataset.color || null); await Render.renderAll(); }
        break;

      // --- Folder actions ---
      case 'edit-folder':
        if (target) {
          Modal.open({
            title: I18n.t('bookmarks.renameFolder'),
            fields: [{ id: 'title', label: I18n.t('bookmarks.title'), value: target.title }],
            onSave: async (vals) => {
              if (!vals.title.trim()) return;
              await Bookmarks.update(target.id, { title: vals.title.trim() });
              await Render.renderAll();
            }
          });
        }
        break;

      case 'delete-folder':
        if (target) {
          const childCount = (target.children || []).length;
          let msg = I18n.t('bookmarks.deleteFolderConfirm', {title: target.title});
          if (childCount > 0) msg += '\n\n' + I18n.t('bookmarks.deleteFolderWithChildren', {count: childCount});
          if (confirm(msg)) {
            try {
              await Bookmarks.removeTree(target.id);
              await Render.renderAll();
            } catch (e) {
              alert(I18n.t('common.error') + ': ' + e.message);
            }
          }
        }
        break;

      case 'add-bookmark':
        if (target) {
          ContextMenu.openAddBookmarkModal(target);
        }
        break;

      case 'add-folder':
        if (target) {
          ContextMenu.openAddFolderModal(target);
        }
        break;

      // --- Bookmark actions ---
      case 'edit-bookmark':
        if (target) {
          Modal.open({
            title: I18n.t('bookmarks.edit'),
            fields: [
              { id: 'title', label: I18n.t('bookmarks.title'), value: target.title || '' },
              { id: 'url', label: I18n.t('bookmarks.url'), value: target.url || '', type: 'url' }
            ],
            onSave: async (vals) => {
              const changes = {};
              if (vals.title.trim()) changes.title = vals.title.trim();
              if (vals.url.trim()) changes.url = vals.url.trim();
              if (Object.keys(changes).length > 0) {
                await Bookmarks.update(target.id, changes);
                await Render.renderAll();
              }
            }
          });
        }
        break;

      case 'delete-bookmark':
        if (target) {
          if (confirm(I18n.t('bookmarks.deleteConfirm', {title: target.title || target.url}))) {
            try {
              await Bookmarks.remove(target.id);
              await Render.renderAll();
            } catch (e) {
              alert(I18n.t('common.error') + ': ' + e.message);
            }
          }
        }
        break;
    }
  }
};

// ==================== Modal Dialog ====================

const Modal = {
  _onSave: null,

  init() {
    document.getElementById('modalCloseBtn').addEventListener('click', () => Modal.close());
    document.getElementById('modalCancelBtn').addEventListener('click', () => Modal.close());
    document.getElementById('modalSaveBtn').addEventListener('click', () => Modal.save());
  },

  open({ title, fields, onSave }) {
    Modal._onSave = onSave;
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    titleEl.textContent = title;
    body.innerHTML = '';

    for (const f of fields) {
      const row = document.createElement('div');
      row.className = 'modal__field';

      const label = document.createElement('label');
      label.className = 'modal__label';
      label.textContent = f.label;
      label.setAttribute('for', 'modal_' + f.id);
      row.appendChild(label);

      const input = document.createElement('input');
      input.className = 'modal__input';
      input.id = 'modal_' + f.id;
      input.dataset.fieldId = f.id;
      input.type = f.type || 'text';
      input.value = f.value || '';
      input.autocomplete = 'off';
      row.appendChild(input);

      body.appendChild(row);
    }

    overlay.hidden = false;

    // Focus first input
    const firstInput = body.querySelector('input');
    if (firstInput) {
      firstInput.focus();
      firstInput.select();
    }

    // Enter to save
    body.onkeydown = (e) => {
      if (e.key === 'Enter') Modal.save();
    };
  },

  async save() {
    const body = document.getElementById('modalBody');
    const inputs = body.querySelectorAll('input[data-field-id]');
    const values = {};
    inputs.forEach(inp => { values[inp.dataset.fieldId] = inp.value; });

    if (Modal._onSave) {
      try {
        await Modal._onSave(values);
      } catch (e) {
        alert(I18n.t('common.error') + ': ' + e.message);
      }
    }
    Modal.close();
  },

  close() {
    document.getElementById('modalOverlay').hidden = true;
    Modal._onSave = null;
  }
};
