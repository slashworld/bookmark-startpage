# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-09-26

### Added
- JSON file export and import for settings and tabs
- Clear and short button labels for backup destinations: «В закладки» / «В файл»
- Automatic config restoration from synced bookmarks on fresh install (silent background restore)
- Quick action buttons in the toolbar to add bookmarks and folders from any view
- Ability to create bookmarks and subfolders directly from the tab context menu
- Drag-and-drop moving of bookmarks and folders (direct single-item drag without extra steps, «Move» toolbar button, Shift-click range selection, progressive level-by-level selection, and automatic expansion of source and destination folders in the tree)
- Light theme (Catppuccin Latte) with a 3-state switcher on the start page: 💻 Auto (device default), ☀️ Light, 🌙 Dark, with local installation-level persistence
- High-contrast dual-tone vector SVG folder icons replacing emoji across all views (tree navigator, folder cards, group headers, and options page) with tailored colors for light (warm amber) and dark (peach/gold) themes

### Fixed
- Updated extension icons (`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`) rendered at exact resolutions from vector source `icons/bmsp-icon.svg`
- Fixed view mode toggle («Explorer» / «All links»): now always available for any folder/tab, even without subfolders
- Added empty states with quick action buttons and right-click context menus for empty folders and flat views
- Improved visibility and borders for inactive tabs without an assigned color
- Fixed modal editor behavior: clicking outside the modal dialog no longer closes it

## [1.0.0] - 2026-03-22

### Added
- Initial release of Bookmark Startpage
- Tab-based bookmark organization
- Two view modes: Explorer and All Links
- Context menu for bookmark management (add, edit, delete)
- Search functionality across all bookmarks
- Import/Export configuration via URL
- Auto-backup configs as bookmarks (last 20 versions)
- Multi-language support (English, Russian)
- Dark theme (Catppuccin Mocha)
- Customizable font sizes
- Color-coded tabs
- Drag-and-drop folder to create tabs
- Pinned tabs support

### Technical
- Chrome Extension Manifest V3
- Vanilla JavaScript (no frameworks)
- Custom i18n system
- No external dependencies
