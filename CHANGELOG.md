# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-09-26

### Added
- JSON file export and import for settings and tabs
- Clear and short button labels for backup destinations: «В закладки» / «В файл»
- Automatic config restoration from synced bookmarks on fresh install (silent background restore)
- Quick action buttons in the toolbar to add bookmarks and folders from any view
- Ability to create bookmarks and subfolders directly from the tab context menu

### Fixed
- Updated extension icons (`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`) rendered at exact resolutions from vector source `icons/bmsp-icon.svg`
- Fixed view mode toggle («Explorer» / «All links»): now always available for any folder/tab, even without subfolders
- Added empty states with quick action buttons and right-click context menus for empty folders and flat views

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
