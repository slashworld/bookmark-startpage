/**
 * contextmenu.js — Context menus for tabs, folders, bookmarks + modal editor
 */

const TAB_COLORS = [
  { name: 'Без цвета', value: null },
  { name: 'Красный', value: '#f38ba8' },
  { name: 'Оранжевый', value: '#fab387' },
  { name: 'Жёлтый', value: '#f9e2af' },
  { name: 'Зелёный', value: '#a6e3a1' },
  { name: 'Голубой', value: '#89dceb' },
  { name: 'Синий', value: '#89b4fa' },
  { name: 'Фиолетовый', value: '#cba6f7' },
  { name: 'Розовый', value: '#f5c2e7' },
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
      <button class="ctx-menu__item" data-action="add-bookmark">➕ Добавить закладку</button>
      <button class="ctx-menu__item" data-action="add-folder">📁 Добавить папку</button>
      <div class="ctx-menu__separator"></div>
      <button class="ctx-menu__item" data-action="edit-folder">✏️ Переименовать папку</button>
      <button class="ctx-menu__item ctx-menu__item--danger" data-action="delete-folder">🗑️ Удалить папку</button>
      <div class="ctx-menu__separator"></div>
      <button class="ctx-menu__item" data-action="create-tab">📑 Создать таб из папки</button>
    `;
    ContextMenu.show(event.clientX, event.clientY);
  },

  showForBookmark(event, bookmarkNode) {
    event.preventDefault();
    event.stopPropagation();
    ContextMenu.currentTarget = bookmarkNode;
    ContextMenu.currentType = 'bookmark';

    ContextMenu.menu.innerHTML = `
      <button class="ctx-menu__item" data-action="edit-bookmark">✏️ Редактировать</button>
      <button class="ctx-menu__item ctx-menu__item--danger" data-action="delete-bookmark">🗑️ Удалить закладку</button>
    `;
    ContextMenu.show(event.clientX, event.clientY);
  },

  showForTab(event, tab) {
    event.preventDefault();
    event.stopPropagation();
    ContextMenu.currentTarget = tab;
    ContextMenu.currentType = 'tab';

    const pinLabel = tab.pinned ? '📌 Открепить таб' : '📌 Закрепить таб';
    let html = `<button class="ctx-menu__item" data-action="toggle-pin">${pinLabel}</button>`;
    if (!tab.pinned) {
      html += `<button class="ctx-menu__item" data-action="close-tab">✕ Закрыть таб</button>`;
    }
    html += `<div class="ctx-menu__separator"></div>`;
    html += `<div class="ctx-menu__label">Цвет таба:</div>`;
    html += `<div class="ctx-menu__colors">`;
    for (const c of TAB_COLORS) {
      const isActive = (tab.color || null) === c.value;
      if (c.value) {
        html += `<span class="ctx-menu__color-dot${isActive ? ' active' : ''}" 
                       data-action="set-color" data-color="${c.value}" 
                       style="background:${c.value}" title="${c.name}"></span>`;
      } else {
        html += `<span class="ctx-menu__color-dot ctx-menu__color-none${isActive ? ' active' : ''}" 
                       data-action="set-color" data-color="" title="${c.name}">✕</span>`;
      }
    }
    html += `</div>`;
    ContextMenu.menu.innerHTML = html;
    ContextMenu.show(event.clientX, event.clientY);
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
            title: 'Переименовать папку',
            fields: [{ id: 'title', label: 'Название', value: target.title }],
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
          let msg = `Удалить папку «${target.title}»?`;
          if (childCount > 0) msg += `\n\nВ ней ${childCount} элемент(ов). Всё содержимое будет удалено.`;
          if (confirm(msg)) {
            try {
              await Bookmarks.removeTree(target.id);
              await Render.renderAll();
            } catch (e) {
              alert('Ошибка удаления: ' + e.message);
            }
          }
        }
        break;

      case 'add-bookmark':
        if (target) {
          Modal.open({
            title: 'Добавить закладку',
            fields: [
              { id: 'title', label: 'Название', value: '' },
              { id: 'url', label: 'URL', value: 'https://', type: 'url' }
            ],
            onSave: async (vals) => {
              if (!vals.title.trim() || !vals.url.trim()) return;
              await Bookmarks.create({ parentId: target.id, title: vals.title.trim(), url: vals.url.trim() });
              await Render.renderAll();
            }
          });
        }
        break;

      case 'add-folder':
        if (target) {
          Modal.open({
            title: 'Добавить папку',
            fields: [{ id: 'title', label: 'Название', value: '' }],
            onSave: async (vals) => {
              if (!vals.title.trim()) return;
              await Bookmarks.create({ parentId: target.id, title: vals.title.trim() });
              await Render.renderAll();
            }
          });
        }
        break;

      // --- Bookmark actions ---
      case 'edit-bookmark':
        if (target) {
          Modal.open({
            title: 'Редактировать закладку',
            fields: [
              { id: 'title', label: 'Название', value: target.title || '' },
              { id: 'url', label: 'URL', value: target.url || '', type: 'url' }
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
          if (confirm(`Удалить закладку «${target.title || target.url}»?`)) {
            try {
              await Bookmarks.remove(target.id);
              await Render.renderAll();
            } catch (e) {
              alert('Ошибка удаления: ' + e.message);
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
    // Close on overlay click
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') Modal.close();
    });
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
        alert('Ошибка: ' + e.message);
      }
    }
    Modal.close();
  },

  close() {
    document.getElementById('modalOverlay').hidden = true;
    Modal._onSave = null;
  }
};
