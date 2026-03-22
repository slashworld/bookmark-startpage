# Bookmark Startpage

A Chrome extension that replaces the new tab page with a customizable start page powered by your bookmarks.

## Features

- **Tab-based navigation** - Organize bookmarks into tabs for quick access
- **Visual customization** - Choose colors for tabs, adjust font sizes
- **Two view modes** - Explorer (folder tree) or flat list of all bookmarks
- **Search** - Find bookmarks across all folders or in current tab only
- **Import/Export** - Share configurations via URL or save to bookmarks
- **Bookmark management** - Add, edit, delete bookmarks and folders directly from start page
- **Multi-language** - Supports English and Russian (auto-detects browser language)
- **Dark theme** - Beautiful Catppuccin Mocha color scheme

## Permissions

- `bookmarks` - Read and manage your bookmarks
- `storage` - Save extension settings
- `favicon` - Display website icons

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)

1. Download and extract the extension files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. Open a new tab to see the start page

## Usage

1. **First setup**: Click "Open settings" and select a root bookmark folder
2. **Create tabs**: Right-click on any folder → "Create tab from folder"
3. **Manage bookmarks**: Right-click on bookmarks or folders for context menu
4. **Customize**: Open settings to change font sizes, colors, and behavior
5. **Backup**: Use "Save config" to backup settings as a bookmark

## Configuration Export/Import

The extension can export your entire configuration (tabs, settings, selected folders) as a URL that you can:
- Share with others
- Open on another device to import settings
- Save as a bookmark for automatic backup

## Development

This extension uses vanilla JavaScript with no build tools or frameworks.

### File Structure
```
js/
  newtab.js      # Entry point
  options.js     # Settings page
  storage.js     # Config persistence
  bookmarks.js   # Chrome Bookmarks API wrapper
  tabs.js        # Tab management
  render.js      # UI rendering
  filter.js      # Search functionality
  contextmenu.js # Context menus and modals
  configstore.js # Config backup via bookmarks
  i18n.js        # Localization

locales/
  en.json        # English translations
  ru.json        # Russian translations
```

## License

MIT

## Privacy

This extension:
- Does not collect any personal data
- Does not send data to external servers
- Stores all data locally in your browser
- Only accesses bookmarks and storage APIs as needed for functionality

See [PRIVACY.md](PRIVACY.md) for full privacy policy.
