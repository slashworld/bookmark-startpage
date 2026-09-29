/**
 * render.js — UI rendering
 */

const Render = {
  _settings: null,
  activeFolderId: null,
  currentExplorerNode: null,
  expandedFolderIds: new Set(),

  async renderAll() {
    await Render.loadSettings();
    Render.renderTabsStrip();
    await Render.renderContent();
    if (typeof Selection !== 'undefined') {
      Selection.updateUI();
    }
  },

  async loadSettings() {
    const config = await Storage.load();
    Render._settings = config.settings || Storage.DEFAULT_CONFIG.settings;
  },

  s() { return Render._settings || Storage.DEFAULT_CONFIG.settings; },

  async closeTab(tabId) {
    const tab = Tabs.list.find(t => t.id === tabId);
    if (!tab || tab.pinned) return;
    if (!confirm(I18n.t('tabs.closeConfirm', {title: tab.title}))) return;
    await Tabs.removeTab(tabId);
    await Render.renderAll();
  },

  linkTarget() { return Render.s().openInNewTab !== false ? '_blank' : '_self'; },

  /**
   * Convert hex color to rgba string
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  _nodeDepths: null,

  buildNodeDepths(root) {
    Render._nodeDepths = new Map();
    function walk(n, depth) {
      Render._nodeDepths.set(n.id, depth);
      if (n.children) {
        for (const child of n.children) {
          walk(child, depth + 1);
        }
      }
    }
    if (root) walk(root, 0);
  },

  getNodeDepth(id) {
    if (!Render._nodeDepths) return 0;
    return Render._nodeDepths.has(id) ? Render._nodeDepths.get(id) : 0;
  },

  // ==================== Tabs Strip ====================

  renderTabsStrip() {
    const strip = document.getElementById('tabsStrip');
    strip.innerHTML = '';

    Tabs.list.forEach((tab, index) => {
      const btn = document.createElement('button');
      const isActive = tab.id === Tabs.activeTabId;
      btn.className = 'tab-btn' + (isActive ? ' active' : '');
      btn.dataset.tabId = tab.id;

      // Tab color — full fill
      if (tab.color) {
        if (isActive) {
          btn.style.background = tab.color;
          btn.style.color = '#1e1e2e';
          btn.style.borderColor = tab.color;
          btn.style.borderBottomColor = tab.color;
        } else {
          btn.style.background = Render.hexToRgba(tab.color, 0.15);
          btn.style.color = tab.color;
          btn.style.borderColor = Render.hexToRgba(tab.color, 0.35);
          btn.style.borderBottomColor = 'transparent';
        }
      }

      if (tab.pinned) {
        const pin = document.createElement('span');
        pin.className = 'tab-btn__pin';
        pin.textContent = '📌';
        btn.appendChild(pin);
      }

      const title = document.createElement('span');
      title.className = 'tab-btn__title';
      title.textContent = tab.title;
      btn.appendChild(title);

      if (!tab.pinned) {
        const close = document.createElement('span');
        close.className = 'tab-btn__close';
        close.textContent = '✕';
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          Render.closeTab(tab.id);
        });
        btn.appendChild(close);
      }

      // Left click — activate (synchronous, no storage event loop)
      btn.addEventListener('click', async () => {
        if (Tabs.activeTabId !== tab.id) {
          Render.activeFolderId = null;
          if (Render.expandedFolderIds) {
            Render.expandedFolderIds.clear();
          }
        }
        Tabs.activate(tab.id);  // synchronous set + fire-and-forget save
        await Render.renderAll();
      });

      // Middle click — close
      btn.addEventListener('auxclick', (e) => {
        if (e.button === 1 && !tab.pinned) { e.preventDefault(); Render.closeTab(tab.id); }
      });

      btn.addEventListener('contextmenu', (e) => ContextMenu.showForTab(e, tab));

      // Drag reorder
      if (!tab.pinned) {
        btn.draggable = true;
        btn.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'tab-reorder', index }));
          btn.classList.add('dragging');
        });
        btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
      }

      btn.addEventListener('dragover', (e) => {
        if (tab.bookmarkFolderId && typeof Selection !== 'undefined') {
          if (!Selection.isValidDropTarget(tab.bookmarkFolderId)) return;
        }
        e.preventDefault();
        btn.classList.add('drag-over');
      });
      btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
      btn.addEventListener('drop', async (e) => {
        e.preventDefault();
        btn.classList.remove('drag-over');
        try {
          const raw = (e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain') || '').trim();
          const d = JSON.parse(raw);
          if (d.type === 'tab-reorder') {
            await Tabs.moveTab(d.index, index);
            await Render.renderAll();
          } else if (tab.bookmarkFolderId && typeof Selection !== 'undefined') {
            await Selection.handleDrop(e, tab.bookmarkFolderId);
          }
        } catch {}
      });

      strip.appendChild(btn);
    });

    // Drop zone
    const dz = document.createElement('div');
    dz.className = 'tab-drop-zone';
    dz.textContent = '+';
    dz.title = I18n.t('view.dropHere');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('active'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('active'));
    dz.addEventListener('drop', async (e) => {
      e.preventDefault(); dz.classList.remove('active');
      try {
        const raw = (e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain') || '').trim();
        const d = JSON.parse(raw);
        const folderId = d.folderId || (d.items && d.items[0] && d.items[0].type === 'folder' ? d.items[0].id : null);
        const folderTitle = d.title || (d.items && d.items[0] ? d.items[0].title : '');
        if (folderId) {
          await Tabs.addTab(folderId, folderTitle);
          await Render.renderAll();
        }
      } catch {}
    });
    strip.appendChild(dz);
  },

  // ==================== Content ====================

  async renderContent() {
    await Render.loadSettings();
    const area = document.getElementById('contentArea');
    const activeTab = Tabs.getActive();

    if (!activeTab) {
      area.innerHTML = `
        <div class="content__empty" id="emptyState">
          <p>${I18n.t('view.folderNotSelected')}</p>
          <button id="openSettings">${I18n.t('view.openSettings')}</button>
        </div>`;
      return;
    }

    try {
      const folderNode = await Bookmarks.getSubTree(activeTab.bookmarkFolderId);
      Render.buildNodeDepths(folderNode);
      const viewMode = activeTab.viewMode || 'explorer';

      const viewWrap = Render._viewSettingsWrap || document.getElementById('viewSettingsWrap');
      if (viewWrap) {
        Render._viewSettingsWrap = viewWrap;
        if (viewWrap.parentElement) {
          viewWrap.remove();
        }
      }

      area.innerHTML = '';

      // Apply font sizes and icon size
      const st = Render.s();
      document.documentElement.style.setProperty('--font-size-tabs', st.fontSizeTabs + 'px');
      document.documentElement.style.setProperty('--font-size-nav', st.fontSizeNav + 'px');
      document.documentElement.style.setProperty('--font-size-content', st.fontSizeContent + 'px');
      document.documentElement.style.setProperty('--bookmark-icon-size', (st.iconSize || 48) + 'px');

      // Always show view toggle & action toolbar for any folder
      area.appendChild(Render.createViewToggle(viewMode, activeTab.id, folderNode));

      if (viewMode === 'flat') {
        area.appendChild(Render.createGroupedBookmarksList(folderNode));
      } else {
        area.appendChild(Render.createExplorerView(folderNode));
      }
    } catch (e) {
      area.innerHTML = '<div class="content__empty"><p>' + I18n.t('view.folderNotFound') + '</p></div>';
      console.error(e);
    }
  },

  createViewToggle(currentMode, tabId, folderNode) {
    const div = document.createElement('div');
    div.className = 'view-toggle';

    const modes = document.createElement('div');
    modes.className = 'view-toggle__modes';

    ['explorer', 'flat'].forEach(mode => {
      const btn = document.createElement('button');
      btn.className = 'view-toggle__btn' + (currentMode === mode ? ' active' : '');
      if (mode === 'explorer') {
        btn.appendChild(Theme.createFolderIcon());
        btn.appendChild(document.createTextNode(' ' + I18n.t('view.explorer')));
      } else {
        btn.textContent = '📋 ' + I18n.t('view.allLinks');
      }
      btn.addEventListener('click', async () => {
        Tabs.setViewMode(tabId, mode);  // synchronous + fire-and-forget save
        const tab = Tabs.list.find(t => t.id === tabId);
        if (tab) tab.viewMode = mode;
        await Render.renderContent();
      });
      modes.appendChild(btn);
    });

    // Move mode toggle button — placed right after All links
    const moveBtn = document.createElement('button');
    const isMove = typeof Selection !== 'undefined' && Selection.isMoveMode;
    moveBtn.className = 'view-toggle__btn view-toggle__btn--move' + (isMove ? ' active' : '');
    moveBtn.textContent = '⇄ ' + (typeof I18n !== 'undefined' ? I18n.t('selection.moveMode') : 'Move');
    moveBtn.title = typeof I18n !== 'undefined' ? I18n.t('selection.moveModeHint') : 'Move mode';
    moveBtn.addEventListener('click', () => {
      if (typeof Selection !== 'undefined') {
        Selection.toggleMoveMode();
      }
    });
    modes.appendChild(moveBtn);

    div.appendChild(modes);

    const actions = document.createElement('div');
    actions.className = 'view-toggle__actions';

    const addBmBtn = document.createElement('button');
    addBmBtn.className = 'view-toggle__action-btn';
    addBmBtn.textContent = '➕ ' + I18n.t('bookmarks.add');
    addBmBtn.title = I18n.t('bookmarks.add');
    addBmBtn.addEventListener('click', () => {
      const target = Render.currentExplorerNode || folderNode;
      ContextMenu.openAddBookmarkModal(target);
    });
    actions.appendChild(addBmBtn);

    const addFolderBtn = document.createElement('button');
    addFolderBtn.className = 'view-toggle__action-btn';
    addFolderBtn.appendChild(Theme.createFolderIcon());
    addFolderBtn.appendChild(document.createTextNode(' ' + I18n.t('bookmarks.addFolder')));
    addFolderBtn.title = I18n.t('bookmarks.addFolder');
    addFolderBtn.addEventListener('click', () => {
      const target = Render.currentExplorerNode || folderNode;
      ContextMenu.openAddFolderModal(target);
    });
    actions.appendChild(addFolderBtn);

    div.appendChild(actions);

    return div;
  },

  createEmptyFolderState(node) {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';

    const text = document.createElement('p');
    text.className = 'empty-state__text';
    text.textContent = I18n.t('view.emptyFolder');
    wrap.appendChild(text);

    const btns = document.createElement('div');
    btns.className = 'empty-state__buttons';

    const addBm = document.createElement('button');
    addBm.className = 'empty-state__btn';
    addBm.textContent = '➕ ' + I18n.t('bookmarks.add');
    addBm.addEventListener('click', () => ContextMenu.openAddBookmarkModal(node));
    btns.appendChild(addBm);

    const addFold = document.createElement('button');
    addFold.className = 'empty-state__btn';
    addFold.appendChild(Theme.createFolderIcon());
    addFold.appendChild(document.createTextNode(' ' + I18n.t('bookmarks.addFolder')));
    addFold.addEventListener('click', () => ContextMenu.openAddFolderModal(node));
    btns.appendChild(addFold);

    if (typeof Selection !== 'undefined') {
      Selection.makeDropTarget(wrap, node.id);
    }
    wrap.appendChild(btns);
    return wrap;
  },

  // ==================== Grouped Flat List ====================

  createGroupedBookmarksList(rootNode) {
    Render.currentExplorerNode = rootNode;
    const wrap = document.createElement('div');
    wrap.className = 'grouped-list-wrap';

    const c = document.createElement('div');
    c.className = 'grouped-list';
    const t = Render.linkTarget();

    if (typeof Selection !== 'undefined') {
      Selection.makeDropTarget(c, rootNode.id);
    }

    // Right-click on empty background of flat list
    c.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.bookmark-item, .group-header, .empty-state__btn')) return;
      ContextMenu.showForFolder(e, rootNode);
    });

    const rootLinks = (rootNode.children || []).filter(x => x.url);
    if (rootLinks.length > 0) c.appendChild(Render._grid(rootLinks, t));

    Render._groups(c, rootNode, t, 0);

    if (c.children.length === 0) {
      c.appendChild(Render.createEmptyFolderState(rootNode));
    }
    wrap.appendChild(c);

    const viewWrap = Render._viewSettingsWrap || document.getElementById('viewSettingsWrap');
    if (viewWrap) {
      wrap.appendChild(viewWrap);
    }

    return wrap;
  },

  _groups(container, node, target, depth) {
    for (const folder of (node.children || []).filter(x => !x.url)) {
      const links = (folder.children || []).filter(x => x.url);
      const subs = (folder.children || []).filter(x => !x.url);
      const h = document.createElement('div');
      h.className = 'group-header';
      h.style.paddingLeft = (depth * 16) + 'px';
      h.appendChild(Theme.createFolderIcon('group-header__icon'));
      const hTitle = document.createElement('span');
      hTitle.textContent = folder.title;
      h.appendChild(hTitle);
      h.title = folder.title;
      h.addEventListener('contextmenu', (e) => ContextMenu.showForFolder(e, folder));
      if (typeof Selection !== 'undefined') {
        Selection.makeDropTarget(h, folder.id);
      }
      container.appendChild(h);

      if (links.length > 0) {
        const g = Render._grid(links, target);
        g.style.marginLeft = (depth * 16) + 'px';
        container.appendChild(g);
      } else if (subs.length === 0) {
        const emptyP = document.createElement('div');
        emptyP.className = 'group-empty';
        emptyP.style.marginLeft = (depth * 16 + 12) + 'px';
        emptyP.textContent = I18n.t('view.emptyFolder');
        emptyP.addEventListener('contextmenu', (e) => ContextMenu.showForFolder(e, folder));
        if (typeof Selection !== 'undefined') {
          Selection.makeDropTarget(emptyP, folder.id);
        }
        container.appendChild(emptyP);
      }
      Render._groups(container, folder, target, depth + 1);
    }
  },

  _grid(bookmarks, target) {
    const st = Render.s();
    const pos = st.labelPosition || 'right';
    const noLabel = (st.showTitle === false && st.showUrl === false);
    const g = document.createElement('div');
    g.className = `bookmarks-list label-pos-${pos}` + (noLabel ? ' no-label' : '');
    for (const bm of bookmarks) g.appendChild(Render._link(bm, target));
    return g;
  },

  _link(bm, target, showPath = false) {
    const st = Render.s();
    const iconSize = st.iconSize || 48;
    const pos = st.labelPosition || 'right';
    const showTitle = st.showTitle !== false;
    const showUrl = st.showUrl !== false;
    const noLabel = !showTitle && !showUrl;

    const a = document.createElement('a');
    a.className = `bookmark-item label-pos-${pos}` + (noLabel ? ' no-label' : '');
    a.href = bm.url; a.target = target; a.title = bm.title ? `${bm.title} (${bm.url})` : bm.url;
    a.draggable = true;

    a.addEventListener('dragstart', (e) => {
      if (typeof Selection !== 'undefined') {
        Selection.handleDragStart(e, {
          id: bm.id,
          type: 'bookmark',
          title: bm.title || bm.url,
          parentId: bm.parentId,
          url: bm.url
        });
      }
      a.classList.add('is-dragging');
    });
    a.addEventListener('dragend', () => {
      a.classList.remove('is-dragging');
    });

    if (typeof Selection !== 'undefined') {
      const cb = Selection.createCheckbox({
        id: bm.id,
        type: 'bookmark',
        title: bm.title || bm.url,
        parentId: bm.parentId,
        url: bm.url
      });
      a.appendChild(cb);
    }

    a.addEventListener('click', (e) => {
      if (typeof Selection !== 'undefined' && (Selection.isMoveMode || e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        const cb = a.querySelector('.item-checkbox');
        if (cb) {
          cb.checked = !cb.checked;
          Selection.handleItemClick(e, {
            id: bm.id,
            type: 'bookmark',
            title: bm.title || bm.url,
            parentId: bm.parentId,
            url: bm.url
          }, cb);
        }
      }
    });

    // Right-click to edit/delete bookmark
    a.addEventListener('contextmenu', (e) => {
      ContextMenu.showForBookmark(e, bm);
    });

    const iconWrap = document.createElement('div');
    iconWrap.className = 'bookmark-item__icon-wrap';

    const img = document.createElement('img');
    img.className = 'bookmark-item__favicon';

    const applySizing = () => {
      if (img.naturalWidth > 0 && img.naturalWidth < iconSize) {
        img.classList.remove('is-fullsize');
        img.classList.add('is-undersized');
        iconWrap.classList.add('has-undersized-icon');
      } else {
        img.classList.remove('is-undersized');
        img.classList.add('is-fullsize');
        iconWrap.classList.remove('has-undersized-icon');
      }
    };

    let fallbackTried = false;
    const handleLoadedImage = () => {
      const isGoogle = img.src.includes('t0.gstatic.com') || img.src.includes('faviconV2');
      const isChrome = img.src.startsWith('chrome-extension://');

      // If Google returned 16px fallback, OR if Chrome returned an undersized icon:
      // Try resolving direct high-resolution icon from the website HTML (SVG, Apple touch icon, high-res PNG)
      if (!fallbackTried && ((isGoogle && img.naturalWidth <= 16) || (isChrome && img.naturalWidth < iconSize))) {
        fallbackTried = true;
        Bookmarks.resolveDirectIcon(bm.url).then((directIcon) => {
          if (directIcon && img.src !== directIcon) {
            img.src = directIcon;
            return;
          }
          if (isGoogle) {
            Bookmarks.checkChromeFavicon(bm.url, iconSize).then((res) => {
              if (res.hasRealIcon) {
                img.src = Bookmarks.getChromeFavicon(bm.url, iconSize);
              } else {
                applySizing();
              }
            });
          } else {
            applySizing();
          }
        });
        return;
      }
      applySizing();
    };

    img.onload = () => {
      handleLoadedImage();
    };

    img.onerror = () => {
      const isGoogle = img.src.includes('t0.gstatic.com') || img.src.includes('faviconV2');
      if (isGoogle && !fallbackTried && !Bookmarks.isLocalUrl(bm.url)) {
        fallbackTried = true;
        Bookmarks.resolveDirectIcon(bm.url).then((directIcon) => {
          if (directIcon && img.src !== directIcon) {
            img.src = directIcon;
            return;
          }
          Bookmarks.checkChromeFavicon(bm.url, iconSize).then((res) => {
            if (res.hasRealIcon) {
              img.src = Bookmarks.getChromeFavicon(bm.url, iconSize);
              return;
            }
            img.remove();
            iconWrap.appendChild(Render.createLetterAvatar(bm));
          });
        });
        return;
      }
      img.remove();
      iconWrap.appendChild(Render.createLetterAvatar(bm));
    };

    img.src = Bookmarks.getFavicon(bm.url, iconSize);
    if (img.complete && img.naturalWidth > 0) {
      handleLoadedImage();
    }
    iconWrap.appendChild(img);
    a.appendChild(iconWrap);

    if (showTitle || showUrl || (showPath && bm._path)) {
      const info = document.createElement('div');
      info.className = 'bookmark-item__info';

      if (showTitle) {
        const ti = document.createElement('div');
        ti.className = 'bookmark-item__title';
        ti.textContent = bm.title || bm.url;
        info.appendChild(ti);
      }

      if (showUrl) {
        const u = document.createElement('div');
        u.className = 'bookmark-item__url';
        u.textContent = bm.url;
        info.appendChild(u);
      }

      if (showPath && bm._path) {
        const p = document.createElement('div');
        p.className = 'bookmark-item__path';
        p.textContent = bm._path;
        info.appendChild(p);
      }

      a.appendChild(info);
    }

    return a;
  },

  /** Generate stylized letter avatar for bookmarks without a favicon */
  createLetterAvatar(bm) {
    const div = document.createElement('div');
    div.className = 'bookmark-item__letter-avatar';

    let title = (bm.title || '').trim();
    if (!title && bm.url) {
      try {
        title = new URL(bm.url).hostname.replace(/^www\./, '');
      } catch {
        title = bm.url;
      }
    }
    const letter = (title ? title.charAt(0) : '?').toUpperCase();
    div.textContent = letter;

    let host = '';
    try {
      host = new URL(bm.url).hostname;
    } catch {
      host = title || '';
    }

    if (typeof Theme !== 'undefined' && Theme.getAvatarGradient) {
      div.style.background = Theme.getAvatarGradient(host || letter);
    } else {
      div.style.background = 'linear-gradient(135deg, #89b4fa, #74c7ec)';
    }

    return div;
  },

  /** For search results (filter.js) */
  createBookmarksList(bookmarks, hideEmptyPath = false) {
    const st = Render.s();
    const pos = st.labelPosition || 'right';
    const noLabel = (st.showTitle === false && st.showUrl === false);
    const t = Render.linkTarget();
    const g = document.createElement('div');
    g.className = `bookmarks-list label-pos-${pos}` + (noLabel ? ' no-label' : '');
    for (const bm of bookmarks) g.appendChild(Render._link(bm, t, !hideEmptyPath));
    if (bookmarks.length === 0) g.innerHTML = '<p style="color:var(--text-muted);padding:20px;">' + I18n.t('view.noBookmarks') + '</p>';
    return g;
  },

  // ==================== Explorer ====================

  _findNode(root, id) {
    if (!root) return null;
    if (root.id === id) return root;
    for (const child of (root.children || [])) {
      if (!child.url) {
        const found = Render._findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  },

  _containsNode(node, id) {
    if (!node || !node.children) return false;
    for (const child of node.children) {
      if (child.id === id) return true;
      if (!child.url && Render._containsNode(child, id)) return true;
    }
    return false;
  },

  /**
   * Ensure a folder and all its ancestors are added to expandedFolderIds
   * so they will be open and visible in the tree.
   * @param {string|number} folderId
   */
  async expandFolderAndAncestors(folderId) {
    if (!folderId || folderId === '0') return;
    let curr = String(folderId);
    while (curr && curr !== '0') {
      if (Render.expandedFolderIds) {
        Render.expandedFolderIds.add(curr);
      }
      try {
        const node = await Bookmarks.getNode(curr);
        if (!node || !node.parentId || node.parentId === '0') break;
        curr = String(node.parentId);
      } catch {
        break;
      }
    }
  },

  createExplorerView(rootNode) {
    let activeNode = rootNode;
    if (Render.activeFolderId) {
      const found = Render._findNode(rootNode, Render.activeFolderId);
      if (found) activeNode = found;
      else Render.activeFolderId = rootNode.id;
    } else {
      Render.activeFolderId = rootNode.id;
    }
    Render.currentExplorerNode = activeNode;

    const showLinks = Render.s().showLinksInTree !== false;
    const ex = document.createElement('div');
    ex.className = 'explorer';

    const tree = document.createElement('div');
    tree.className = 'explorer__tree';
    tree.appendChild(Render.treeNode(rootNode, 0, true, showLinks, activeNode.id));
    ex.appendChild(tree);

    const contentWrap = document.createElement('div');
    contentWrap.className = 'explorer__content-wrap';

    const content = document.createElement('div');
    content.className = 'explorer__content';
    content.id = 'explorerContent';
    Render.folderContent(content, activeNode);
    contentWrap.appendChild(content);

    const viewWrap = Render._viewSettingsWrap || document.getElementById('viewSettingsWrap');
    if (viewWrap) {
      contentWrap.appendChild(viewWrap);
    }

    ex.appendChild(contentWrap);

    return ex;
  },

  treeNode(node, level = 0, expanded = false, showLinks = true, activeNodeId = null) {
    const c = document.createElement('div');
    c.className = 'tree-node';
    c.dataset.level = level;
    c.dataset.folderId = node.id;

    const subs = (node.children || []).filter(x => !x.url);
    const links = (node.children || []).filter(x => x.url);
    const count = subs.length + links.length;

    const isSelfActive = activeNodeId ? (node.id === activeNodeId) : (level === 0);
    const hasActiveDescendant = activeNodeId && Render._containsNode(node, activeNodeId);
    const isExplicitlyExpanded = Render.expandedFolderIds && Render.expandedFolderIds.has(String(node.id));
    const shouldExpand = expanded || hasActiveDescendant || isExplicitlyExpanded;
    if (shouldExpand && Render.expandedFolderIds) {
      Render.expandedFolderIds.add(String(node.id));
    }

    const label = document.createElement('div');
    label.className = 'tree-node__label' + (isSelfActive ? ' active' : '');
    label.draggable = true;
    label.addEventListener('dragstart', (e) => {
      if (typeof Selection !== 'undefined') {
        Selection.handleDragStart(e, {
          id: node.id,
          type: 'folder',
          title: node.title || I18n.t('bookmarks.title'),
          parentId: node.parentId
        });
      }
      label.classList.add('is-dragging');
    });
    label.addEventListener('dragend', () => {
      label.classList.remove('is-dragging');
    });

    if (typeof Selection !== 'undefined') {
      Selection.makeDropTarget(label, node.id);
    }

    const toggle = document.createElement('span');
    toggle.className = 'tree-node__toggle' + (shouldExpand ? ' expanded' : '');
    toggle.textContent = (subs.length > 0 || (showLinks && links.length > 0)) ? '▶' : '';
    label.appendChild(toggle);

    if (typeof Selection !== 'undefined') {
      const cb = Selection.createCheckbox({
        id: node.id,
        type: 'folder',
        title: node.title || I18n.t('bookmarks.title'),
        parentId: node.parentId
      });
      label.appendChild(cb);
    }

    const icon = Theme.createFolderIcon('tree-node__icon');
    label.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'tree-node__title-text';
    title.textContent = node.title || I18n.t('bookmarks.title');
    label.appendChild(title);

    if (count > 0) {
      const cnt = document.createElement('span');
      cnt.className = 'tree-node__count';
      cnt.textContent = '(' + count + ')';
      label.appendChild(cnt);
    }

    label.addEventListener('click', (e) => {
      if (typeof Selection !== 'undefined' && (Selection.isMoveMode || e.shiftKey)) {
        if (!e.target.classList.contains('tree-node__toggle')) {
          e.preventDefault();
          e.stopPropagation();
          const cb = label.querySelector('.item-checkbox');
          if (cb) {
            cb.checked = !cb.checked;
            Selection.handleItemClick(e, {
              id: node.id,
              type: 'folder',
              title: node.title || I18n.t('bookmarks.title'),
              parentId: node.parentId
            }, cb);
          }
          return;
        }
      }

      document.querySelectorAll('.tree-node__label.active').forEach(el => el.classList.remove('active'));
      label.classList.add('active');
      Render.activeFolderId = node.id;
      Render.currentExplorerNode = node;
      const hasKids = subs.length > 0 || (showLinks && links.length > 0);
      if (hasKids) {
        const isNowExpanded = toggle.classList.toggle('expanded');
        const ch = c.querySelector(':scope > .tree-node__children');
        if (ch) ch.classList.toggle('open', isNowExpanded);
        if (Render.expandedFolderIds) {
          if (isNowExpanded) {
            Render.expandedFolderIds.add(String(node.id));
          } else {
            Render.expandedFolderIds.delete(String(node.id));
          }
        }
      }
      const cp = document.getElementById('explorerContent');
      if (cp) Render.folderContent(cp, node);
    });

    label.addEventListener('contextmenu', (e) => ContextMenu.showForFolder(e, node));
    c.appendChild(label);

    const hasKids = subs.length > 0 || (showLinks && links.length > 0);
    if (hasKids) {
      const ch = document.createElement('div');
      ch.className = 'tree-node__children' + (shouldExpand ? ' open' : '');
      for (const sub of subs) ch.appendChild(Render.treeNode(sub, level + 1, false, showLinks, activeNodeId));

      if (showLinks) {
        for (const lk of links) {
          const le = document.createElement('div');
          le.className = 'tree-node tree-node--link';
          le.dataset.level = level + 1;

          const la = document.createElement('a');
          la.className = 'tree-node__label tree-node__label--link';
          la.href = lk.url; la.target = Render.linkTarget(); la.title = lk.url;
          la.draggable = true;

          la.addEventListener('click', (e) => {
            if (typeof Selection !== 'undefined' && (Selection.isMoveMode || e.shiftKey)) {
              e.preventDefault();
              e.stopPropagation();
              const cb = la.querySelector('.item-checkbox');
              if (cb) {
                cb.checked = !cb.checked;
                Selection.handleItemClick(e, {
                  id: lk.id,
                  type: 'bookmark',
                  title: lk.title || lk.url,
                  parentId: lk.parentId,
                  url: lk.url
                }, cb);
              }
            }
          });

          la.addEventListener('dragstart', (e) => {
            if (typeof Selection !== 'undefined') {
              Selection.handleDragStart(e, {
                id: lk.id,
                type: 'bookmark',
                title: lk.title || lk.url,
                parentId: lk.parentId,
                url: lk.url
              });
            }
            la.classList.add('is-dragging');
          });
          la.addEventListener('dragend', () => {
            la.classList.remove('is-dragging');
          });

          // Right-click to edit/delete
          la.addEventListener('contextmenu', (e) => {
            ContextMenu.showForBookmark(e, lk);
          });

          const sp = document.createElement('span');
          sp.className = 'tree-node__toggle';
          la.appendChild(sp);

          if (typeof Selection !== 'undefined') {
            const cb = Selection.createCheckbox({
              id: lk.id,
              type: 'bookmark',
              title: lk.title || lk.url,
              parentId: lk.parentId,
              url: lk.url
            });
            la.appendChild(cb);
          }

          const fav = document.createElement('img');
          fav.className = 'tree-node__favicon';
          let treeFallbackDone = false;

          const handleTreeFavicon = () => {
            const isGoogle = fav.src.includes('t0.gstatic.com') || fav.src.includes('faviconV2');
            if (isGoogle && !treeFallbackDone) {
              treeFallbackDone = true;
              Bookmarks.resolveDirectIcon(lk.url).then((directIcon) => {
                if (directIcon && fav.src !== directIcon) {
                  fav.src = directIcon;
                  return;
                }
                Bookmarks.checkChromeFavicon(lk.url, 16).then((res) => {
                  if (res.hasRealIcon) {
                    fav.src = Bookmarks.getChromeFavicon(lk.url, 16);
                  }
                });
              });
            }
          };

          fav.onload = () => {
            handleTreeFavicon();
          };

          fav.onerror = () => {
            if (!treeFallbackDone) {
              treeFallbackDone = true;
              Bookmarks.resolveDirectIcon(lk.url).then((directIcon) => {
                if (directIcon && fav.src !== directIcon) {
                  fav.src = directIcon;
                  return;
                }
                Bookmarks.checkChromeFavicon(lk.url, 16).then((res) => {
                  if (res.hasRealIcon) {
                    fav.src = Bookmarks.getChromeFavicon(lk.url, 16);
                    return;
                  }
                  fav.style.display = 'none';
                });
              });
              return;
            }
            fav.style.display = 'none';
          };

          fav.src = Bookmarks.getFavicon(lk.url, 16);
          if (fav.complete && fav.naturalWidth > 0) {
            handleTreeFavicon();
          }
          la.appendChild(fav);

          const lt = document.createElement('span');
          lt.className = 'tree-node__title-text';
          lt.textContent = lk.title || lk.url;
          la.appendChild(lt);

          le.appendChild(la);
          ch.appendChild(le);
        }
      }
      c.appendChild(ch);
    }
    return c;
  },

  // ==================== Folder Content Panel ====================

  folderContent(panel, node) {
    Render.currentExplorerNode = node;
    Render.activeFolderId = node.id;
    panel.innerHTML = '';
    const target = Render.linkTarget();

    if (typeof Selection !== 'undefined') {
      Selection.makeDropTarget(panel, node.id);
    }

    // Right-click on panel background
    panel.oncontextmenu = (e) => {
      if (e.target.closest('.bookmark-item, .folder-item, .empty-state__btn')) return;
      ContextMenu.showForFolder(e, node);
    };

    if (!node.children || node.children.length === 0) {
      panel.appendChild(Render.createEmptyFolderState(node));
      return;
    }

    const st = Render.s();
    const pos = st.labelPosition || 'right';
    const showTitle = st.showTitle !== false;
    const noLabel = !showTitle;

    const grid = document.createElement('div');
    grid.className = `bookmarks-list label-pos-${pos}` + (noLabel ? ' no-label' : '');

    for (const folder of node.children.filter(x => !x.url)) {
      const div = document.createElement('div');
      div.className = `folder-item label-pos-${pos}` + (noLabel ? ' no-label' : '');
      div.draggable = true;
      div.title = folder.title;
      div.addEventListener('dragstart', (e) => {
        if (typeof Selection !== 'undefined') {
          Selection.handleDragStart(e, {
            id: folder.id,
            type: 'folder',
            title: folder.title,
            parentId: folder.parentId
          });
        }
        div.classList.add('is-dragging');
      });
      div.addEventListener('dragend', () => {
        div.classList.remove('is-dragging');
      });

      if (typeof Selection !== 'undefined') {
        Selection.makeDropTarget(div, folder.id);
        const cb = Selection.createCheckbox({
          id: folder.id,
          type: 'folder',
          title: folder.title,
          parentId: folder.parentId
        });
        div.appendChild(cb);
      }

      div.addEventListener('click', (e) => {
        if (typeof Selection !== 'undefined' && (Selection.isMoveMode || e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          const cb = div.querySelector('.item-checkbox');
          if (cb) {
            cb.checked = !cb.checked;
            Selection.handleItemClick(e, {
              id: folder.id,
              type: 'folder',
              title: folder.title,
              parentId: folder.parentId
            }, cb);
          }
          return;
        }
        Render.activeFolderId = folder.id;
        Render.currentExplorerNode = folder;
        if (Render.expandedFolderIds) {
          Render.expandedFolderIds.add(String(folder.id));
        }
        const tn = document.querySelector(`.tree-node[data-folder-id="${folder.id}"] > .tree-node__label`);
        if (tn) {
          let p = tn.closest('.tree-node__children');
          while (p) {
            p.classList.add('open');
            const parentToggle = p.parentElement?.querySelector(':scope > .tree-node__label > .tree-node__toggle');
            if (parentToggle) parentToggle.classList.add('expanded');
            const parentFolderId = p.parentElement?.dataset?.folderId;
            if (parentFolderId && Render.expandedFolderIds) {
              Render.expandedFolderIds.add(String(parentFolderId));
            }
            p = p.parentElement?.closest('.tree-node__children');
          }
          tn.click();
        } else {
          Render.folderContent(panel, folder);
        }
      });
      div.addEventListener('contextmenu', (e) => ContextMenu.showForFolder(e, folder));

      const ic = Theme.createFolderIcon('folder-item__icon');
      div.appendChild(ic);

      if (showTitle) {
        const info = document.createElement('div');
        info.className = 'folder-item__info';

        const ti = document.createElement('span');
        ti.className = 'folder-item__title'; ti.textContent = folder.title;
        info.appendChild(ti);

        const sc = (folder.children || []).length;
        if (sc > 0) {
          const cnt = document.createElement('span');
          cnt.className = 'folder-item__count'; cnt.textContent = '(' + sc + ')';
          info.appendChild(cnt);
        }

        div.appendChild(info);
      }
      grid.appendChild(div);
    }

    for (const bm of node.children.filter(x => x.url)) {
      grid.appendChild(Render._link(bm, target));
    }
    panel.appendChild(grid);
  }
};
