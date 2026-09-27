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
    } else {
      fullPath = pathOrInfo.fullPath;
      relativePath = pathOrInfo.relativePath;
      topFolderIndex = pathOrInfo.topFolderIndex;
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

  getFavicon(url) {
    try {
      const u = new URL(url);
      if (chrome.runtime?.id) {
        return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=16`;
      }
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`;
    } catch {
      return '';
    }
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
