/**
 * selection.js — Multi-selection and Drag & Drop management for bookmarks and folders
 */

const Selection = {
  // Whether move / selection mode is active
  isMoveMode: false,
  // Set of selected bookmark/folder IDs
  selectedIds: new Set(),
  // Map of id -> { id, type: 'bookmark' | 'folder', title, parentId, url }
  selectedItems: new Map(),
  // Last clicked item ID for Shift-range selection
  _lastClickedId: null,
  // Currently dragged items array
  _currentDraggedItems: null,
  // Bar DOM element
  _barEl: null,

  init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (Selection.count() > 0 || Selection.isMoveMode)) {
        Selection.toggleMoveMode(false);
      }
    });

    window.addEventListener('dragend', () => {
      Selection._currentDraggedItems = null;
      document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
      document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    });
  },

  toggleMoveMode(enable) {
    Selection.isMoveMode = typeof enable === 'boolean' ? enable : !Selection.isMoveMode;
    document.body.classList.toggle('select-mode', Selection.isMoveMode);
    if (!Selection.isMoveMode) {
      Selection.clear();
    }
    const moveBtn = document.querySelector('.view-toggle__btn--move');
    if (moveBtn) {
      moveBtn.classList.toggle('active', Selection.isMoveMode);
    }
  },

  has(id) {
    return Selection.selectedIds.has(id);
  },

  count() {
    return Selection.selectedIds.size;
  },

  getItems() {
    return Array.from(Selection.selectedItems.values());
  },

  toggle(id, item, isChecked) {
    if (isChecked) {
      Selection.selectedIds.add(id);
      Selection.selectedItems.set(id, item);
    } else {
      Selection.selectedIds.delete(id);
      Selection.selectedItems.delete(id);
    }
    Selection.updateUI();
  },

  clear() {
    Selection._lastClickedId = null;
    Selection.selectedIds.clear();
    Selection.selectedItems.clear();
    Selection.updateUI();
  },

  handleItemClick(e, item, cb) {
    if (!Selection.isMoveMode && (e.shiftKey || Selection.count() > 0)) {
      Selection.toggleMoveMode(true);
    }

    const isChecked = cb.checked;
    const container = cb.closest('.explorer__content, .explorer__tree, .grouped-list, .bookmarks-list') || document.body;
    const siblings = Array.from(container.querySelectorAll('.item-checkbox')).filter(el => {
      return !el.closest('.tree-node__children:not(.open)');
    });

    if (e.shiftKey && Selection._lastClickedId) {
      const lastIdx = siblings.findIndex(el => el.dataset.id === Selection._lastClickedId);
      const currIdx = siblings.findIndex(el => el.dataset.id === item.id);

      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        for (let i = start; i <= end; i++) {
          const targetCb = siblings[i];
          targetCb.checked = isChecked;
          const targetItem = {
            id: targetCb.dataset.id,
            type: targetCb.dataset.type,
            title: targetCb.dataset.title,
            parentId: targetCb.dataset.parentId
          };
          if (isChecked) {
            Selection.selectedIds.add(targetItem.id);
            Selection.selectedItems.set(targetItem.id, targetItem);
          } else {
            Selection.selectedIds.delete(targetItem.id);
            Selection.selectedItems.delete(targetItem.id);
          }
        }
        Selection._lastClickedId = item.id;
        Selection.updateUI();
        return;
      }
    }

    Selection._lastClickedId = item.id;
    Selection.toggle(item.id, item, isChecked);
  },

  selectNextLevel() {
    const allCheckboxes = Array.from(document.querySelectorAll('.item-checkbox')).filter(cb => {
      return !cb.closest('.tree-node__children:not(.open)');
    });

    if (allCheckboxes.length === 0) return;

    // Collect all levels present
    const levelsMap = new Map(); // level (number) -> Array of { cb, item }
    for (const cb of allCheckboxes) {
      const level = parseInt(cb.dataset.level || '0', 10);
      if (!levelsMap.has(level)) {
        levelsMap.set(level, []);
      }
      const item = {
        id: cb.dataset.id,
        type: cb.dataset.type,
        title: cb.dataset.title,
        parentId: cb.dataset.parentId,
        level
      };
      levelsMap.get(level).push({ cb, item });
    }

    // Sort distinct levels descending: e.g. [3, 2, 1, 0]
    const sortedLevels = Array.from(levelsMap.keys()).sort((a, b) => b - a);

    // Find deepest level with unselected items
    let targetLevel = null;
    for (const lvl of sortedLevels) {
      const entries = levelsMap.get(lvl);
      const hasUnselected = entries.some(e => !Selection.has(e.item.id));
      if (hasUnselected) {
        targetLevel = lvl;
        break;
      }
    }

    // If all items on all levels are already selected, do nothing
    if (targetLevel === null) {
      return;
    }

    // Select all items on targetLevel
    const entriesToSelect = levelsMap.get(targetLevel);
    for (const { cb, item } of entriesToSelect) {
      Selection.selectedIds.add(item.id);
      Selection.selectedItems.set(item.id, item);
      cb.checked = true;
    }

    Selection.updateUI();
  },

  selectAllVisible() {
    Selection.selectNextLevel();
  },

  updateUI() {
    const count = Selection.count();
    document.body.classList.toggle('has-selection', count > 0);
    document.body.classList.toggle('select-mode', Selection.isMoveMode || count > 0);

    // Sync all checkboxes and item card classes on page
    document.querySelectorAll('.item-checkbox').forEach(cb => {
      const isSel = Selection.has(cb.dataset.id);
      cb.checked = isSel;
      const card = cb.closest('.bookmark-item, .folder-item, .tree-node__label');
      if (card) {
        card.classList.toggle('is-selected', isSel);
      }
    });

    const moveBtn = document.querySelector('.view-toggle__btn--move');
    if (moveBtn) {
      moveBtn.classList.toggle('active', Selection.isMoveMode);
    }

    Selection.renderBar();
  },

  createCheckbox(item) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'item-checkbox';
    cb.dataset.id = item.id;
    cb.dataset.type = item.type;
    cb.dataset.title = item.title || '';
    if (item.parentId) cb.dataset.parentId = item.parentId;

    const level = item.level !== undefined
      ? item.level
      : (typeof Render !== 'undefined' && Render.getNodeDepth ? Render.getNodeDepth(item.id) : 0);
    cb.dataset.level = level;
    item.level = level;

    cb.checked = Selection.has(item.id);
    cb.title = typeof I18n !== 'undefined' ? I18n.t('selection.selected', { count: 1 }) : 'Select';

    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      Selection.handleItemClick(e, item, cb);
    });
    cb.addEventListener('mousedown', (e) => e.stopPropagation());
    return cb;
  },

  renderBar() {
    const count = Selection.count();
    if (count === 0) {
      if (Selection._barEl) {
        Selection._barEl.remove();
        Selection._barEl = null;
      }
      return;
    }

    if (!Selection._barEl) {
      Selection._barEl = document.createElement('div');
      Selection._barEl.className = 'selection-bar';
      document.body.appendChild(Selection._barEl);
    }

    const tSelected = typeof I18n !== 'undefined' ? I18n.t('selection.selected', { count }) : `Selected: ${count}`;
    const tSelectLevel = typeof I18n !== 'undefined' ? (I18n.t('selection.selectLevel') || I18n.t('selection.selectAll')) : 'Select level';
    const tDeselect = typeof I18n !== 'undefined' ? I18n.t('selection.deselect') : 'Deselect';
    const tDelete = typeof I18n !== 'undefined' ? I18n.t('selection.delete') : 'Delete';
    const tDragHint = typeof I18n !== 'undefined' ? I18n.t('selection.dragHint') : 'Drag to folder';

    Selection._barEl.innerHTML = `
      <div class="selection-bar__info" draggable="true" title="${tDragHint}">
        <span class="selection-bar__grab">⠿</span>
        <span class="selection-bar__count">${tSelected}</span>
      </div>
      <div class="selection-bar__actions">
        <button class="selection-bar__btn" id="selSelectAll">${tSelectLevel}</button>
        <button class="selection-bar__btn" id="selDeselect">${tDeselect}</button>
        <button class="selection-bar__btn selection-bar__btn--danger" id="selDelete">🗑️ ${tDelete}</button>
      </div>
    `;

    const info = Selection._barEl.querySelector('.selection-bar__info');
    info.addEventListener('dragstart', (e) => {
      Selection.handleDragStart(e, Selection.getItems()[0]);
    });

    Selection._barEl.querySelector('#selSelectAll').addEventListener('click', () => Selection.selectNextLevel());
    Selection._barEl.querySelector('#selDeselect').addEventListener('click', () => Selection.clear());
    Selection._barEl.querySelector('#selDelete').addEventListener('click', () => Selection.deleteSelected());
  },

  handleDragStart(event, singleItem) {
    event.stopPropagation();
    let itemsToDrag = [];

    // If the dragged item is already in selection, drag all selected items
    if (Selection.has(singleItem.id)) {
      itemsToDrag = Selection.getItems();
    } else {
      // If dragging an unselected item, drag only this item
      itemsToDrag = [singleItem];
    }

    Selection._currentDraggedItems = itemsToDrag;

    const payload = {
      type: singleItem.type === 'folder' && itemsToDrag.length === 1 ? 'folder' : 'bsp-items',
      folderId: singleItem.type === 'folder' ? singleItem.id : null,
      title: singleItem.title,
      items: itemsToDrag
    };

    event.dataTransfer.effectAllowed = 'move';
    const jsonStr = JSON.stringify(payload);
    event.dataTransfer.setData('text/plain', jsonStr);
    try {
      event.dataTransfer.setData('application/json', jsonStr);
    } catch {}

    if (itemsToDrag.length > 1) {
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = `📦 ${typeof I18n !== 'undefined' ? I18n.t('selection.movingItems', { count: itemsToDrag.length }) : itemsToDrag.length + ' items'}`;
      document.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, 15, 15);
      setTimeout(() => ghost.remove(), 0);
    }
  },

  isValidDropTarget(targetFolderId) {
    if (!Selection._currentDraggedItems || Selection._currentDraggedItems.length === 0) return true;
    return !Selection._currentDraggedItems.some(item => item.id === targetFolderId);
  },

  makeDropTarget(element, targetFolderId) {
    element.addEventListener('dragover', (e) => {
      if (!Selection.isValidDropTarget(targetFolderId)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      element.classList.add('drop-target');
    });

    element.addEventListener('dragleave', (e) => {
      if (!element.contains(e.relatedTarget)) {
        element.classList.remove('drop-target');
      }
    });

    element.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.remove('drop-target');
      await Selection.handleDrop(e, targetFolderId);
    });
  },

  async handleDrop(event, targetFolderId) {
    let items = Selection._currentDraggedItems;
    if (!items || items.length === 0) {
      try {
        const raw = (event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain') || '').trim();
        const d = JSON.parse(raw);
        if (d.items && Array.isArray(d.items)) {
          items = d.items;
        } else if (d.folderId) {
          items = [{ id: d.folderId, type: 'folder', title: d.title }];
        } else if (d.bookmarkId) {
          items = [{ id: d.bookmarkId, type: 'bookmark', title: d.title }];
        }
      } catch {
        return;
      }
    }

    if (!items || items.length === 0) return;

    await Selection.moveItems(items, targetFolderId);
  },

  async moveItems(items, targetFolderId) {
    let movedCount = 0;
    const sourceFolderIds = new Set();

    for (const item of items) {
      if (item.id === targetFolderId) continue;

      if (item.type === 'folder') {
        const isDescendant = await Bookmarks.isDescendantOf(targetFolderId, item.id);
        if (isDescendant) {
          const msg = typeof I18n !== 'undefined'
            ? I18n.t('selection.cannotMoveIntoDescendant', { title: item.title })
            : `Cannot move folder «${item.title}» into its own subfolder`;
          alert(msg);
          continue;
        }
      }

      try {
        const node = await Bookmarks.getNode(item.id);
        if (node && node.parentId === targetFolderId) continue;
        const sourceId = (node && node.parentId) ? node.parentId : item.parentId;
        if (sourceId) {
          sourceFolderIds.add(String(sourceId));
        }
        await Bookmarks.move(item.id, { parentId: targetFolderId });
        movedCount++;
      } catch (err) {
        console.error('Failed to move item:', item, err);
      }
    }

    Selection._currentDraggedItems = null;
    Selection.clear();
    if (movedCount > 0) {
      if (typeof Render !== 'undefined' && Render.expandFolderAndAncestors) {
        await Render.expandFolderAndAncestors(targetFolderId);
        for (const sId of sourceFolderIds) {
          await Render.expandFolderAndAncestors(sId);
        }
      }
      await Render.renderAll();
    }
  },

  async deleteSelected() {
    const items = Selection.getItems();
    if (items.length === 0) return;

    const msg = typeof I18n !== 'undefined'
      ? I18n.t('selection.deleteConfirm', { count: items.length })
      : `Delete ${items.length} selected items?`;
    if (!confirm(msg)) return;

    for (const item of items) {
      try {
        if (item.type === 'folder') {
          await Bookmarks.removeTree(item.id);
        } else {
          await Bookmarks.remove(item.id);
        }
      } catch (err) {
        console.error('Failed to delete item:', item, err);
      }
    }
    Selection.clear();
    await Render.renderAll();
  }
};
