# Bookmark Startpage

A Chrome extension (Manifest V3) that replaces the new tab page with a customizable start page powered by your Chrome bookmarks. Built with vanilla JavaScript and CSS — no frameworks, no build tools.

## Features

- **Tab-based navigation** - Organize bookmark folders into custom tabs with colors, pinning, and drag-and-drop tab creation/reordering
- **Two view modes** - Explorer (hierarchical folder tree with persistent open/closed state per tab) and All Links (grouped flat list)
- **Themes** - Catppuccin Mocha (dark) and Catppuccin Latte (light) with a 3-state switcher (Auto / Light / Dark)
- **Customizable cards** - Adjustable icon size (16x16 to 256x256 with standard presets), 4 label positions (Right, Bottom, Left, Top), and granular title/URL visibility toggles
- **High-resolution favicons** - Multi-tier resolution combining Google Favicon API, Chromium's local `_favicon` cache for intranet/local URLs, direct HTML scraping for SVG and Apple Touch Icons, per-bookmark custom icon URLs, and vector letter avatars
- **Drag-and-drop & multi-select** - Drag bookmarks and folders directly, or enable Move mode with Shift-click range selection, level-by-level selection, and auto-expanding tree folders
- **Search** - Instant search across all tabs or the current tab only (by title, URL, or folder path)
- **Bookmark management** - Add, edit, rename, move, and delete bookmarks and folders directly from the start page
- **Dual backup & sync** - Automatic backup of the last 20 configs to synced Chrome bookmarks (with silent auto-restore on fresh install), JSON file export/import, and shareable config URLs
- **Multi-language** - English and Russian with automatic browser language detection

## Permissions

- `bookmarks` - Read and manage your bookmarks, and store optional config backups
- `storage` - Save extension settings, theme, tree state, and icon cache locally
- `favicon` - Display website icons from Chromium's local favicon cache
- `http://*/*`, `https://*/*` - Fetch bookmarked pages directly from your browser to extract high-resolution/SVG site icons

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)

1. Download or clone the repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the project folder
5. Open a new tab to see the start page

## Usage

1. **First setup**: Click "Open settings" and select a root bookmark folder
2. **Create tabs**: Right-click any folder and choose "Create tab from folder", or drag a folder onto the `+` zone in the tab strip
3. **Customize view**: Use the floating "View" button in the bottom-right corner to adjust icon size, label position, and title/URL visibility, or switch themes in the top bar
4. **Manage & organize**: Right-click bookmarks, folders, or tabs for context menus; drag items directly or click "Move" for multi-select
5. **Backup & restore**: Use the Options page to save/load backups via Chrome bookmarks, export/import JSON files, or copy a shareable config URL

## Development

Vanilla ES6+ JavaScript and modular CSS with no build step.

### File Structure
```text
manifest.json           # Extension Manifest V3
newtab.html             # Main start page
options.html            # Settings page
js/
  newtab.js             # Start page entry point & view settings popover
  options.js            # Options page logic & import/export
  storage.js            # Config persistence (chrome.storage.local)
  bookmarks.js          # Chrome Bookmarks API wrapper & icon resolution
  tabs.js               # Tab state management
  render.js             # UI rendering, explorer tree & card layouts
  filter.js             # Bookmark search and filtering
  contextmenu.js        # Context menus and modal editor
  configstore.js        # Synced bookmark backups & auto-restore
  theme.js              # Theme management (Auto / Light / Dark) & SVG icons
  selection.js          # Multi-selection and Drag & Drop manager
  i18n.js               # Custom localization engine
css/
  newtab.css            # Master stylesheet (@import hub)
  theme.css             # Theme tokens & base styles
  layout.css            # Top bar, tabs strip, content area, bottom bar
  explorer.css          # Bookmark grid, cards, tree nav, folder icons
  modals.css            # Context menus, popovers, modal dialogs
  dnd.css               # Selection mode & drag-and-drop states
locales/
  en.json               # English translations
  ru.json               # Russian translations
tests/
  run_browser.py        # Test Chrome launcher with CDP
  test_view_settings.py # Card layout, icon sizing, and favicon tests
  test_theme.py         # Theme switcher and SVG folder icon tests
  test_dnd.py           # Drag-and-drop & multi-select tests
  test_tree_persistence.py # Tree state persistence tests
```

## License

MIT

## Privacy

This extension does not collect personal data, run analytics, or send data to any developer-controlled servers. All settings are stored locally in your browser; external requests are made only to load website favicons (Google Favicon API for public URLs, or direct browser fetch for high-resolution site icons; local/intranet URLs are never sent to Google).

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.
