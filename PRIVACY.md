# Privacy Policy

**Last updated:** November 21, 2026

## Introduction

Bookmark Startpage ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how our Chrome extension handles data and network requests.

## Data Collection

**We do not collect, store, or sell any personal data.**

The Bookmark Startpage extension:
- Does not collect, transmit, or share personal information with the extension developer
- Does not track your browsing history
- Does not use analytics, telemetry, or tracking tools
- Does not display advertisements

## Data Storage

All extension data is stored **locally** in your browser (or synced through your own Chrome account via Chrome Bookmarks Sync if you enable browser sync):

- **Chrome Storage API (`chrome.storage.local`)**: Stores your extension configuration (`bsp_config`), theme preference (`bsp_theme`), cached site icon URLs (`bsp_site_icons`), and per-tab folder tree state (`bsp_tree_state`).
- **Chrome Bookmarks API (`chrome.bookmarks`)**: Reads and manages your bookmarks, and optionally stores configuration backups in your own `Other Bookmarks / BookmarksStartpage` folder (last 20 versions).

## External Requests for Website Icons (Favicons)

To display high-resolution website icons next to your bookmarks, the extension makes read-only icon requests from your browser:

1. **Google Favicon API (`https://t0.gstatic.com/faviconV2`)**: Used for public website URLs to fetch crisp high-resolution favicons. Local and intranet addresses (`localhost`, `127.0.0.1`, `::1`, private IP ranges `10.x`, `172.16-31.x`, `192.168.x`, `.local`, `.lan`, `.internal`, `.home`, and single-label hostnames) are **never** sent to Google Favicon API — they are resolved using Chromium's local `_favicon` cache.
2. **Direct Site HTML Fetch**: When a high-resolution icon is not available via Google Favicon API or when you explicitly click "Refresh icon from site", your browser fetches the bookmarked page's HTML directly to parse `<link rel="icon">`, `<link rel="apple-touch-icon">`, or similar icon tags, and caches the resolved icon URL locally in `bsp_site_icons`.

No bookmark titles, folder structures, or personal data are sent to any server controlled by the developer.

## Permissions

The extension requests the following permissions:

### `bookmarks`
**Purpose:** Read your bookmark tree to display it on the start page, manage bookmarks and folders (add, edit, move, delete), and store optional configuration backups as bookmarks.

### `storage`
**Purpose:** Save extension settings, tab layout, theme preference, tree state, and cached icon URLs locally between browser sessions.

### `favicon`
**Purpose:** Access Chromium's built-in `_favicon` endpoint to display locally cached favicons, including for intranet and self-hosted services.

### Host Permissions (`http://*/*`, `https://*/*`)
**Purpose:** Allow the extension to directly fetch bookmarked pages from your browser to extract vector (SVG) or high-resolution (`apple-touch-icon`, PNG) site icons when standard favicon sources return low-resolution fallbacks.

## Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date.

## Contact

If you have any questions about this Privacy Policy, please open an issue on our GitHub repository:
https://github.com/slashworld/bookmark-startpage/issues

## Open Source

This extension is open source. You can review the complete source code at:
https://github.com/slashworld/bookmark-startpage
