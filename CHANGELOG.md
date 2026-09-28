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
- High-resolution site icons via Google Favicon API (`t0.gstatic.com`) with configurable icon sizes from 16×16 up to 256×256 (default 48×48)
- Flexible card layouts with directional label positioning: Right (default horizontal), Bottom (speed-dial tile), Left, Top
- Granular display toggles to show or hide titles and URLs on cards
- Synchronous vector folder icon scaling in the content area matching bookmark icons while keeping the tree navigator compact (16px)
- Dual-access configuration: bottom-right quick view popover on the start page and a dedicated settings section on the options page with real-time storage synchronization
- Smart Crisp Display: icons smaller than requested size (e.g. 16px or 32px when 64px is chosen) are centered 1:1 in a dedicated container without blurry upscaling
- Multi-tier favicon fallback: Google Favicon API with automatic Chrome local cache dispatch for intranet/internal URLs (`localhost`, private IPs, `.local`), and stylized vector letter avatars with deterministic Catppuccin gradients for sites without icons
- Smart custom domain & NAS fallback: detects Google Favicon API 16px fallback on unindexed/private domains (e.g. DDNS, personal domains like `jf.nas.abvgde.xyz`) and seamlessly upgrades to Chrome's local favicon cache for visited sites
- Direct Site Icon Scraper: automatic background extraction of genuine high-resolution icons (vector SVGs, Apple Touch Icons up to 180×180, and large PNGs) directly from website HTML, eliminating blurry upscaled 32px bitmaps for self-hosted services like qBittorrent and Jellyfin
- Bookmark context menu action «Обновить иконку с сайта» (Refresh icon from site) and custom icon URL input in the edit bookmark modal

### Changed
- Split monolithic stylesheet into modular CSS files (`theme.css`, `layout.css`, `explorer.css`, `modals.css`, `dnd.css`) with `newtab.css` acting as the master import hub for clean maintainability

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
