/**
 * bookmarks.js — Chrome Bookmarks API wrapper
 */

const Bookmarks = {
  async getTree() {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getTree((results) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(results);
      });
    });
  },

  async getChildren(folderId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(folderId, (children) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(children);
      });
    });
  },

  async getSubTree(folderId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getSubTree(folderId, (results) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(results[0]);
      });
    });
  },

  async getNode(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, (results) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(results[0]);
      });
    });
  },

  async search(query) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.search(query, (results) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(results || []);
      });
    });
  },

  isFolder(node) { return !node.url; },

  hasSubFolders(node) {
    if (!node.children) return false;
    return node.children.some(child => !child.url);
  },

  flattenBookmarks(node, path = '') {
    const results = [];
    if (!node.children) return results;
    for (const child of node.children) {
      if (child.url) {
        results.push({ ...child, _path: path });
      } else if (child.children) {
        const subPath = path ? `${path} / ${child.title}` : child.title;
        results.push(...Bookmarks.flattenBookmarks(child, subPath));
      }
    }
    return results;
  },

  /**
   * Get the path from a folder to root.
   * Returns { fullPath: "Top/Sub/Folder", relativePath: "Sub/Folder", topFolderIndex: 0 }
   * relativePath excludes the top-level Chrome folder (Bookmarks Bar, Other, etc.)
   * topFolderIndex is the position of the top-level folder among root's children
   */
  async getFolderPathInfo(folderId) {
    const parts = [];
    let currentId = folderId;
    let topFolderIndex = -1;

    while (currentId) {
      try {
        const node = await Bookmarks.getNode(currentId);
        if (node.parentId === '0' || node.parentId === 0) {
          // This is a top-level folder (Bookmarks Bar, Other Bookmarks, etc.)
          parts.unshift(node.title);
          // Find its index among root's children
          const root = (await Bookmarks.getTree())[0];
          topFolderIndex = root.children.findIndex(c => c.id === node.id);
          break;
        }
        if (node.title) parts.unshift(node.title);
        currentId = node.parentId;
      } catch {
        break;
      }
    }

    const fullPath = parts.join('/');
    const relativePath = parts.slice(1).join('/');
    return { fullPath, relativePath, topFolderIndex, topFolderName: parts[0] || '' };
  },

  /**
   * Legacy: get full path as string
   */
  async getFolderPath(folderId) {
    const info = await Bookmarks.getFolderPathInfo(folderId);
    return info.fullPath;
  },

  /**
   * Find folder by path — robust, handles locale differences.
   * 
   * Strategy:
   * 1. Try exact path match
   * 2. If fails, try matching by topFolderIndex + relativePath
   *    (handles "Bookmarks bar" vs "Панель закладок")
   * 3. If fails, try finding relativePath in any top-level folder
   */
  async findFolderByPath(pathOrInfo) {
    const tree = (await Bookmarks.getTree())[0];

    // Handle both string paths and structured info objects
    let fullPath, relativePath, topFolderIndex;
    if (typeof pathOrInfo === 'string') {
      fullPath = pathOrInfo;
      const parts = fullPath.split('/').filter(Boolean);
      relativePath = parts.slice(1).join('/');
      topFolderIndex = -1;
    } else if (pathOrInfo && typeof pathOrInfo === 'object') {
      fullPath = pathOrInfo.fullPath || '';
      relativePath = pathOrInfo.relativePath || '';
      topFolderIndex = pathOrInfo.topFolderIndex !== undefined ? pathOrInfo.topFolderIndex : -1;
    } else {
      return null;
    }

    // Strategy 1: exact path match
    const exact = Bookmarks._walkPath(tree, fullPath.split('/').filter(Boolean));
    if (exact) return exact;

    // Strategy 2: match by topFolderIndex + relativePath
    if (topFolderIndex >= 0 && tree.children && tree.children[topFolderIndex]) {
      const topFolder = tree.children[topFolderIndex];
      if (relativePath) {
        const found = Bookmarks._walkPath(topFolder, relativePath.split('/').filter(Boolean));
        if (found) return found;
      } else {
        return topFolder; // the path WAS the top-level folder itself
      }
    }

    // Strategy 3: try all top-level folders
    if (relativePath && tree.children) {
      for (const topFolder of tree.children) {
        if (topFolder.url) continue;
        const found = Bookmarks._walkPath(topFolder, relativePath.split('/').filter(Boolean));
        if (found) return found;
      }
    }

    // Strategy 4: last resort — search by last segment name in all folders
    const parts = fullPath.split('/').filter(Boolean);
    const leafName = parts[parts.length - 1];
    if (leafName) {
      const found = Bookmarks._findByName(tree, leafName);
      if (found) return found;
    }

    return null;
  },

  /**
   * Walk a path of folder names starting from a node
   */
  _walkPath(node, parts) {
    let current = node;
    for (const part of parts) {
      if (!current.children) return null;
      const found = current.children.find(c => c.title === part && !c.url);
      if (!found) return null;
      current = found;
    }
    return current;
  },

  /**
   * Find a folder by name anywhere in the tree (DFS, first match)
   */
  _findByName(node, name) {
    if (!node.children) return null;
    for (const child of node.children) {
      if (!child.url && child.title === name) return child;
      if (!child.url) {
        const found = Bookmarks._findByName(child, name);
        if (found) return found;
      }
    }
    return null;
  },

  /**
   * Legacy compatibility
   */
  async findFolderByPathLegacy(path) {
    return Bookmarks.findFolderByPath(path);
  },

  isLocalUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.endsWith('.local') ||
        host.endsWith('.lan') ||
        host.endsWith('.internal') ||
        host.endsWith('.home') ||
        /^192\.168\./.test(host) ||
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
        !host.includes('.')
      );
    } catch {
      return false;
    }
  },

  getChromeFavicon(url, size = 48) {
    try {
      if (chrome.runtime?.id) {
        return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`;
      }
      return '';
    } catch {
      return '';
    }
  },

  getGoogleFavicon(url, size = 48) {
    try {
      return `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=${size}`;
    } catch {
      return '';
    }
  },

  CHROME_FALLBACK_HASHES: new Set([
    'AAAGSURBVAMAXWsWMPHGHasAAAAASUVORK5CYII=',
    'AAZJREFUAwCNtDhfh02j2gAAAABJRU5ErkJggg==',
    'AAAGSURBVAMA/6eXvT+A9ZYAAAAASUVORK5CYII='
  ]),

  _chromeFaviconCache: new Map(),
  _directIconCache: new Map(),

  /**
   * Pre-load saved site icons from Storage into memory cache.
   */
  async initDirectIcons() {
    if (typeof Storage !== 'undefined') {
      try {
        const saved = await Storage.getSiteIcons();
        for (const [url, iconUrl] of Object.entries(saved)) {
          Bookmarks._directIconCache.set(url, iconUrl);
        }
      } catch (e) {
        console.warn('Failed to load site icons cache:', e);
      }
    }
  },

  /**
   * Check if Chrome's internal favicon database has a genuine icon for the given URL.
   * Resolves to { hasRealIcon: boolean, width?: number, height?: number }.
   */
  async checkChromeFavicon(url, size = 48) {
    const cacheKey = `${url}::${size}`;
    if (Bookmarks._chromeFaviconCache.has(cacheKey)) {
      return Bookmarks._chromeFaviconCache.get(cacheKey);
    }

    const src = Bookmarks.getChromeFavicon(url, size);
    if (!src) return { hasRealIcon: false };

    const promise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL();
          const end = dataUrl.slice(-40);
          const isFallback = Bookmarks.CHROME_FALLBACK_HASHES.has(end);
          resolve({
            hasRealIcon: !isFallback,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        } catch {
          resolve({ hasRealIcon: false });
        }
      };
      img.onerror = () => resolve({ hasRealIcon: false });
      img.src = src;
    });

    Bookmarks._chromeFaviconCache.set(cacheKey, promise);
    return promise;
  },

  /**
   * Directly scrape and resolve the highest resolution icon from website HTML.
   * Finds vector SVGs, Apple Touch Icons (180x180), or high-res PNG icons.
   * @param {string} pageUrl
   * @param {boolean} forceRefresh
   * @returns {Promise<string|null>}
   */
  async resolveDirectIcon(pageUrl, forceRefresh = false) {
    if (!pageUrl || !pageUrl.startsWith('http')) return null;

    if (!forceRefresh && Bookmarks._directIconCache.has(pageUrl)) {
      return Bookmarks._directIconCache.get(pageUrl);
    }

    if (!forceRefresh && typeof Storage !== 'undefined') {
      try {
        const savedIcons = await Storage.getSiteIcons();
        if (savedIcons[pageUrl]) {
          Bookmarks._directIconCache.set(pageUrl, savedIcons[pageUrl]);
          return savedIcons[pageUrl];
        }
      } catch {}
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch(pageUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) return null;

      const html = await resp.text();
      const baseUrl = resp.url || pageUrl;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const links = Array.from(doc.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon'], link[rel='apple-touch-icon-precomposed'], meta[name='msapplication-TileImage'], meta[property='og:image']"));

      const candidates = [];
      for (const el of links) {
        const rel = (el.getAttribute('rel') || el.getAttribute('name') || el.getAttribute('property') || '').toLowerCase();
        const href = el.getAttribute('href') || el.getAttribute('content');
        if (!href) continue;

        let fullUrl;
        try {
          fullUrl = new URL(href, baseUrl).href;
        } catch {
          continue;
        }

        const sizes = el.getAttribute('sizes') || '';
        const type = (el.getAttribute('type') || '').toLowerCase();

        let parsedSize = 0;
        if (sizes) {
          const m = sizes.match(/(\d+)x(\d+)/i);
          if (m) parsedSize = parseInt(m[1], 10);
        }

        let priority = 100;
        if (type === 'image/svg+xml' || fullUrl.endsWith('.svg')) {
          priority = 10000;
        } else if (rel.includes('apple-touch-icon')) {
          priority = 5000 + (parsedSize || 180);
        } else if (parsedSize >= 64) {
          priority = 3000 + parsedSize;
        } else if (parsedSize >= 32) {
          priority = 2000 + parsedSize;
        } else {
          priority = 1000 + parsedSize;
        }

        candidates.push({ fullUrl, priority, type, rel, parsedSize });
      }

      candidates.sort((a, b) => b.priority - a.priority);

      let bestIconUrl = null;
      if (candidates.length > 0) {
        bestIconUrl = candidates[0].fullUrl;
      } else {
        const u = new URL(pageUrl);
        const rootFallbacks = [
          `${u.origin}/favicon.svg`,
          `${u.origin}/apple-touch-icon.png`,
          `${u.origin}/apple-touch-icon-precomposed.png`,
          `${u.origin}/favicon.ico`
        ];
        for (const fb of rootFallbacks) {
          const ok = await new Promise(res => {
            const img = new Image();
            img.onload = () => res(true);
            img.onerror = () => res(false);
            img.src = fb;
          });
          if (ok) {
            bestIconUrl = fb;
            break;
          }
        }
      }

      if (bestIconUrl) {
        Bookmarks._directIconCache.set(pageUrl, bestIconUrl);
        if (typeof Storage !== 'undefined') {
          await Storage.saveSiteIcon(pageUrl, bestIconUrl);
        }
        return bestIconUrl;
      }

      return null;
    } catch {
      return null;
    }
  },

  getFavicon(url, size = 48) {
    if (Bookmarks._directIconCache.has(url)) {
      return Bookmarks._directIconCache.get(url);
    }
    if (Bookmarks.isLocalUrl(url)) {
      return Bookmarks.getChromeFavicon(url, size);
    }
    return Bookmarks.getGoogleFavicon(url, size);
  },

  // ==================== CRUD ====================

  async update(id, changes) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.update(id, changes, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });
  },

  async create(details) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(details, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });
  },

  async remove(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.remove(id, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  },

  async removeTree(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.removeTree(id, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  },

  async move(id, destination) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.move(id, destination, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });
  },

  async isDescendantOf(childId, ancestorId) {
    if (childId === ancestorId) return true;
    let curr = childId;
    while (curr) {
      try {
        const node = await Bookmarks.getNode(curr);
        if (!node || !node.parentId || node.parentId === '0') return false;
        if (node.parentId === ancestorId) return true;
        curr = node.parentId;
      } catch {
        return false;
      }
    }
    return false;
  }
};
