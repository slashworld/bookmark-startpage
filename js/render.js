/**
 * render.js — UI rendering
 */

const Render = {
  _settings: null,

  async renderAll() {
    await Render.loadSettings();
    Render.renderTabsStrip();
    await Render.renderContent();
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
          btn.style.borderBottomColor = tab.color;
        } else {
          btn.style.background = Render.hexToRgba(tab.color, 0.15);
          btn.style.color = tab.color;
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

      btn.addEventListener('dragover', (e) => { e.preventDefault(); btn.classList.add('drag-over'); });
      btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
      btn.addEventListener('drop', async (e) => {
        e.preventDefault(); btn.classList.remove('drag-over');
        try {
          const d = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (d.type === 'tab-reorder') { await Tabs.moveTab(d.index, index); await Render.renderAll(); }
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
        const d = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (d.type === 'folder') { await Tabs.addTab(d.folderId, d.title); await Render.renderAll(); }
      } catch {}
    });
    strip.appendChild(dz);
  },

  // ==================== Content ====================

  async renderContent() {
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
      const hasSubFolders = Bookmarks.hasSubFolders(folderNode);
      const viewMode = activeTab.viewMode || 'explorer';

      area.innerHTML = '';

      // Apply font sizes
      const st = Render.s();
      document.documentElement.style.setProperty('--font-size-tabs', st.fontSizeTabs + 'px');
      document.documentElement.style.setProperty('--font-size-nav', st.fontSizeNav + 'px');
      document.documentElement.style.setProperty('--font-size-content', st.fontSizeContent + 'px');

      if (hasSubFolders) {
        area.appendChild(Render.createViewToggle(viewMode, activeTab.id));
      }

      if (viewMode === 'flat' || !hasSubFolders) {
        area.appendChild(Render.createGroupedBookmarksList(folderNode));
      } else {
        area.appendChild(Render.createExplorerView(folderNode));
      }
    } catch (e) {
      area.innerHTML = '<div class="content__empty"><p>' + I18n.t('view.folderNotFound') + '</p></div>';
      console.error(e);
    }
  },

  createViewToggle(currentMode, tabId) {
    const div = document.createElement('div');
    div.className = 'view-toggle';

    ['explorer', 'flat'].forEach(mode => {
      const btn = document.createElement('button');
      btn.className = 'view-toggle__btn' + (currentMode === mode ? ' active' : '');
      btn.textContent = mode === 'explorer' ? '📁 ' + I18n.t('view.explorer') : '📋 ' + I18n.t('view.allLinks');
      btn.addEventListener('click', async () => {
        Tabs.setViewMode(tabId, mode);  // synchronous + fire-and-forget save
        const tab = Tabs.list.find(t => t.id === tabId);
        if (tab) tab.viewMode = mode;
        await Render.renderContent();
      });
      div.appendChild(btn);
    });

    return div;
  },

  // ==================== Grouped Flat List ====================

  createGroupedBookmarksList(rootNode) {
    const c = document.createElement('div');
    c.className = 'grouped-list';
    const t = Render.linkTarget();

    const rootLinks = (rootNode.children || []).filter(x => x.url);
    if (rootLinks.length > 0) c.appendChild(Render._grid(rootLinks, t));

    Render._groups(c, rootNode, t, 0);

    if (c.children.length === 0) c.innerHTML = '<p style="color:var(--text-muted);padding:20px;">' + I18n.t('view.noBookmarks') + '</p>';
    return c;
  },

  _groups(container, node, target, depth) {
    for (const folder of (node.children || []).filter(x => !x.url)) {
      const links = (folder.children || []).filter(x => x.url);
      const subs = (folder.children || []).filter(x => !x.url);
      if (links.length > 0 || subs.length > 0) {
        const h = document.createElement('div');
        h.className = 'group-header';
        h.style.paddingLeft = (depth * 16) + 'px';
        h.textContent = '📁 ' + folder.title;
        container.appendChild(h);
        if (links.length > 0) {
          const g = Render._grid(links, target);
          g.style.marginLeft = (depth * 16) + 'px';
          container.appendChild(g);
        }
        Render._groups(container, folder, target, depth + 1);
      }
    }
  },

  _grid(bookmarks, target) {
    const g = document.createElement('div');
    g.className = 'bookmarks-list';
    for (const bm of bookmarks) g.appendChild(Render._link(bm, target));
    return g;
  },

  _link(bm, target, showPath = false) {
    const a = document.createElement('a');
    a.className = 'bookmark-item';
    a.href = bm.url; a.target = target; a.title = bm.url;

    // Right-click to edit/delete bookmark
    a.addEventListener('contextmenu', (e) => {
      ContextMenu.showForBookmark(e, bm);
    });

    const img = document.createElement('img');
    img.className = 'bookmark-item__favicon';
    img.src = Bookmarks.getFavicon(bm.url);
    img.onerror = () => img.style.display = 'none';
    a.appendChild(img);

    const info = document.createElement('div');
    info.className = 'bookmark-item__info';

    const ti = document.createElement('div');
    ti.className = 'bookmark-item__title';
    ti.textContent = bm.title || bm.url;
    info.appendChild(ti);

    const u = document.createElement('div');
    u.className = 'bookmark-item__url';
    u.textContent = bm.url;
    info.appendChild(u);

    if (showPath && bm._path) {
      const p = document.createElement('div');
      p.className = 'bookmark-item__path';
      p.textContent = bm._path;
      info.appendChild(p);
    }

    a.appendChild(info);
    return a;
  },

  /** For search results (filter.js) */
  createBookmarksList(bookmarks, hideEmptyPath = false) {
    const t = Render.linkTarget();
    const g = document.createElement('div');
    g.className = 'bookmarks-list';
    for (const bm of bookmarks) g.appendChild(Render._link(bm, t, !hideEmptyPath));
    if (bookmarks.length === 0) g.innerHTML = '<p style="color:var(--text-muted);padding:20px;">' + I18n.t('view.noBookmarks') + '</p>';
    return g;
  },

  // ==================== Explorer ====================

  createExplorerView(rootNode) {
    const showLinks = Render.s().showLinksInTree !== false;
    const ex = document.createElement('div');
    ex.className = 'explorer';

    const tree = document.createElement('div');
    tree.className = 'explorer__tree';
    tree.appendChild(Render.treeNode(rootNode, 0, true, showLinks));
    ex.appendChild(tree);

    const content = document.createElement('div');
    content.className = 'explorer__content';
    content.id = 'explorerContent';
    Render.folderContent(content, rootNode);
    ex.appendChild(content);

    return ex;
  },

  treeNode(node, level = 0, expanded = false, showLinks = true) {
    const c = document.createElement('div');
    c.className = 'tree-node';
    c.dataset.level = level;
    c.dataset.folderId = node.id;

    const subs = (node.children || []).filter(x => !x.url);
    const links = (node.children || []).filter(x => x.url);
    const count = subs.length + links.length;

    const label = document.createElement('div');
    label.className = 'tree-node__label';
    label.draggable = true;
    label.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', folderId: node.id, title: node.title || I18n.t('bookmarks.title') }));
    });

    const toggle = document.createElement('span');
    toggle.className = 'tree-node__toggle' + (expanded ? ' expanded' : '');
    toggle.textContent = (subs.length > 0 || (showLinks && links.length > 0)) ? '▶' : '';
    label.appendChild(toggle);

    const icon = document.createElement('span');
    icon.textContent = '📁';
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

    label.addEventListener('click', () => {
      document.querySelectorAll('.tree-node__label.active').forEach(el => el.classList.remove('active'));
      label.classList.add('active');
      const hasKids = subs.length > 0 || (showLinks && links.length > 0);
      if (hasKids) {
        toggle.classList.toggle('expanded');
        const ch = c.querySelector(':scope > .tree-node__children');
        if (ch) ch.classList.toggle('open');
      }
      const cp = document.getElementById('explorerContent');
      if (cp) Render.folderContent(cp, node);
    });

    label.addEventListener('contextmenu', (e) => ContextMenu.showForFolder(e, node));
    c.appendChild(label);

    const hasKids = subs.length > 0 || (showLinks && links.length > 0);
    if (hasKids) {
      const ch = document.createElement('div');
      ch.className = 'tree-node__children' + (expanded ? ' open' : '');
      for (const sub of subs) ch.appendChild(Render.treeNode(sub, level + 1, false, showLinks));

      if (showLinks) {
        for (const lk of links) {
          const le = document.createElement('div');
          le.className = 'tree-node tree-node--link';
          le.dataset.level = level + 1;

          const la = document.createElement('a');
          la.className = 'tree-node__label tree-node__label--link';
          la.href = lk.url; la.target = Render.linkTarget(); la.title = lk.url;

          // Right-click to edit/delete
          la.addEventListener('contextmenu', (e) => {
            ContextMenu.showForBookmark(e, lk);
          });

          const sp = document.createElement('span');
          sp.className = 'tree-node__toggle';
          la.appendChild(sp);

          const fav = document.createElement('img');
          fav.src = Bookmarks.getFavicon(lk.url);
          fav.className = 'tree-node__favicon';
          fav.onerror = () => fav.style.display = 'none';
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
    panel.innerHTML = '';
    const target = Render.linkTarget();

    if (!node.children || node.children.length === 0) {
      panel.innerHTML = '<p style="color:var(--text-muted);padding:20px;">' + I18n.t('view.emptyFolder') + '</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'bookmarks-list';

    for (const folder of node.children.filter(x => !x.url)) {
      const div = document.createElement('div');
      div.className = 'folder-item'; div.draggable = true;
      div.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', folderId: folder.id, title: folder.title }));
      });
      div.addEventListener('click', () => {
        const tn = document.querySelector(`.tree-node[data-folder-id="${folder.id}"] > .tree-node__label`);
        if (tn) tn.click();
      });
      div.addEventListener('contextmenu', (e) => ContextMenu.showForFolder(e, folder));

      const ic = document.createElement('span');
      ic.className = 'folder-item__icon'; ic.textContent = '📁';
      div.appendChild(ic);

      const ti = document.createElement('span');
      ti.className = 'folder-item__title'; ti.textContent = folder.title;
      div.appendChild(ti);

      const sc = (folder.children || []).length;
      if (sc > 0) {
        const cnt = document.createElement('span');
        cnt.className = 'folder-item__count'; cnt.textContent = '(' + sc + ')';
        div.appendChild(cnt);
      }
      grid.appendChild(div);
    }

    for (const bm of node.children.filter(x => x.url)) {
      grid.appendChild(Render._link(bm, target));
    }
    panel.appendChild(grid);
  }
};
