/**
 * filter.js — Search/filter through bookmark data recursively
 */

const Filter = {
  _debounceTimer: null,

  init() {
    const input = document.getElementById('filterInput');

    input.addEventListener('input', () => {
      clearTimeout(Filter._debounceTimer);
      Filter._debounceTimer = setTimeout(() => Filter.apply(input.value.trim()), 250);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        Filter.apply('');
      }
    });
  },

  async apply(query) {
    if (!query) {
      Filter.clearHighlights();
      // Re-render current tab normally
      await Render.renderContent();
      return;
    }

    const currentTabOnly = document.getElementById('filterCurrentTab').checked;
    const lowerQuery = query.toLowerCase();

    if (currentTabOnly) {
      await Filter.searchInTab(Tabs.getActive(), lowerQuery);
    } else {
      await Filter.searchEverywhere(lowerQuery);
    }
  },

  /**
   * Search within a single tab's bookmarks recursively
   */
  async searchInTab(tab, query) {
    if (!tab) return;

    try {
      const folderNode = await Bookmarks.getSubTree(tab.bookmarkFolderId);
      const allBookmarks = Bookmarks.flattenBookmarks(folderNode);
      const matched = Filter.matchBookmarks(allBookmarks, query);

      // Also check folder names — if folder matches, include all its children
      const folderMatched = Filter.matchFolders(folderNode, query);
      
      // Merge results
      const allResults = Filter.mergeResults(matched, folderMatched);

      // Render results as flat list in content area
      const area = document.getElementById('contentArea');
      area.innerHTML = '';

      const header = document.createElement('div');
      header.style.cssText = 'color:var(--text-muted);font-size:13px;margin-bottom:12px;';
      header.textContent = I18n.t('search.found', {count: allResults.length, title: tab.title});
      area.appendChild(header);

      area.appendChild(Render.createBookmarksList(allResults, false));
    } catch (e) {
      console.error('Search error:', e);
    }
  },

  /**
   * Search across all tabs
   */
  async searchEverywhere(query) {
    const area = document.getElementById('contentArea');
    area.innerHTML = '';

    let totalResults = 0;

    for (const tab of Tabs.list) {
      try {
        const folderNode = await Bookmarks.getSubTree(tab.bookmarkFolderId);
        const allBookmarks = Bookmarks.flattenBookmarks(folderNode);
        const matched = Filter.matchBookmarks(allBookmarks, query);
        const folderMatched = Filter.matchFolders(folderNode, query);
        const results = Filter.mergeResults(matched, folderMatched);

        if (results.length > 0) {
          const section = document.createElement('div');
          section.style.cssText = 'margin-bottom:20px;';

          const header = document.createElement('div');
          header.style.cssText = 'color:var(--accent);font-size:14px;font-weight:500;margin-bottom:8px;padding:4px 0;border-bottom:1px solid var(--border);';
          header.textContent = `📑 ${tab.title} (${results.length})`;
          section.appendChild(header);

          section.appendChild(Render.createBookmarksList(results, false));
          area.appendChild(section);
          totalResults += results.length;
        }
      } catch (e) {
        console.error('Search error for tab:', tab.title, e);
      }
    }

    // Highlight matching tabs in strip
    Filter.highlightTabs(query);

    if (totalResults === 0) {
      area.innerHTML = '<div style="color:var(--text-muted);padding:40px;text-align:center;">' + I18n.t('search.nothingFound') + '</div>';
    }
  },

  /**
   * Filter bookmarks by query in title, url, path
   */
  matchBookmarks(bookmarks, query) {
    return bookmarks.filter(bm => {
      const title = (bm.title || '').toLowerCase();
      const url = (bm.url || '').toLowerCase();
      const path = (bm._path || '').toLowerCase();
      return title.includes(query) || url.includes(query) || path.includes(query);
    });
  },

  /**
   * Find folders matching query and return all their child bookmarks
   */
  matchFolders(node, query) {
    const results = [];
    if (!node.children) return results;

    for (const child of node.children) {
      if (!child.url) {
        // It's a folder
        const folderTitle = (child.title || '').toLowerCase();
        if (folderTitle.includes(query)) {
          // Include all bookmarks from this folder
          const allInFolder = Bookmarks.flattenBookmarks(child, child.title);
          results.push(...allInFolder);
        } else {
          // Recurse into subfolders
          results.push(...Filter.matchFolders(child, query));
        }
      }
    }
    return results;
  },

  /**
   * Merge and deduplicate results by bookmark id
   */
  mergeResults(list1, list2) {
    const seen = new Set();
    const results = [];
    for (const bm of [...list1, ...list2]) {
      if (!seen.has(bm.id)) {
        seen.add(bm.id);
        results.push(bm);
      }
    }
    return results;
  },

  /**
   * Highlight tabs that have matching content
   */
  async highlightTabs(query) {
    document.querySelectorAll('.tab-btn').forEach(async (btn) => {
      const tabId = btn.dataset.tabId;
      const tab = Tabs.list.find(t => t.id === tabId);
      if (!tab) return;

      const tabTitle = tab.title.toLowerCase();
      if (tabTitle.includes(query)) {
        btn.style.outline = '2px solid var(--accent)';
        return;
      }

      try {
        const folder = await Bookmarks.getSubTree(tab.bookmarkFolderId);
        const allBookmarks = Bookmarks.flattenBookmarks(folder);
        const hasMatch = allBookmarks.some(bm => {
          const t = (bm.title || '').toLowerCase();
          const u = (bm.url || '').toLowerCase();
          return t.includes(query) || u.includes(query);
        });
        btn.style.outline = hasMatch ? '2px solid var(--accent)' : '';
      } catch {
        btn.style.outline = '';
      }
    });
  },

  clearHighlights() {
    document.querySelectorAll('.tab-btn').forEach(el => {
      el.style.outline = '';
    });
  }
};