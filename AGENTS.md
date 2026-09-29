# AGENTS.md — Coding Guidelines for Bookmark Startpage

## Project Overview

Chrome extension (Manifest V3) that replaces the new tab page with a customizable start page powered by Chrome bookmarks. Built entirely with vanilla JavaScript and CSS without build tools or external frameworks.

Key features in v1.1.0:
- Tab-based bookmark organization with custom colors and pinned tabs
- Two view modes: Explorer (hierarchical folder tree) and All Links (grouped flat list)
- Dual themes: Catppuccin Mocha (dark) and Catppuccin Latte (light) with a 3-state switcher (Auto / Light / Dark)
- Customizable card view: configurable icon size (16×16 to 256×256), 4 label positions (right, bottom, left, top), and granular title/URL visibility toggles
- Multi-tier high-resolution favicon resolution with direct site HTML scraping for SVGs and Apple Touch Icons
- Drag-and-drop bookmark and folder moving with multi-select (Shift-click range, toolbar move mode) and auto-expanding tree
- Dual backup system: auto-backup to synced bookmarks with silent install restore + direct JSON file export/import
- Full localization: English and Russian

## Build/Test Commands

**No build system** — this is vanilla JS/CSS.

### Manual Browser Testing
```bash
# Load extension in Chrome for testing:
# 1. Open chrome://extensions/
# 2. Enable Developer Mode (toggle top right)
# 3. Click "Load unpacked"
# 4. Select this project folder
```

### Automated CDP Integration Tests
The project includes automated integration tests using the Chrome DevTools Protocol (CDP) in the `tests/` directory:

```bash
# Launch Chrome with test profile and extension loaded (port 9222):
python3 tests/run_browser.py &

# Run individual test suites:
python3 tests/test_view_settings.py  # Tests card layouts, icon sizes, and favicon resolution
python3 tests/test_theme.py          # Tests theme switching, SVG folder icons, and CSS variables
python3 tests/test_dnd.py            # Tests drag-and-drop, multi-select, and tree movements
```

**Linting:** None configured (no ESLint/Prettier setup). Follow style guide below.

## Git Workflow

**Every change must be committed and pushed:**
- Create atomic commits for each logical change
- Follow commit message format: `type: description` (e.g., `feat: add direct site icon scraper`, `fix: correct i18n paths`)
- Push to remote after each commit
- Never leave uncommitted changes

**Privacy & Anonymity Rule:**
- **NEVER** hardcode or commit personal/internal domain names, hostnames, or specific user IP addresses into code, tests, or commit messages. All tests and implementations must remain 100% universal and domain-agnostic.

**Commit workflow:**
```bash
# After making changes
git status
git diff
git add <files>
git commit -m "type: description"
git push
```

## Code Style Guidelines

### JavaScript

**Language:** Vanilla ES6+, no frameworks, no TypeScript

**Module Pattern:** Use namespace objects:
```javascript
const ModuleName = {
  async method() { /* ... */ },
  property: value
};
```

**File Header:** JSDoc comment describing purpose:
```javascript
/**
 * filename.js — Brief description of module purpose
 */
```

**Formatting:**
- 2-space indentation
- Single quotes for strings
- No trailing semicolons after object properties
- Space after `if`, `for`, `while`
- One blank line between methods

**Naming:**
- `camelCase` for variables, functions, methods
- `PascalCase` for module objects (`Storage`, `Bookmarks`, `Tabs`, `Render`, `Filter`, `ContextMenu`, `ConfigStore`, `Theme`, `Selection`, `I18n`)
- `UPPER_SNAKE_CASE` for constants (`DEFAULT_CONFIG`, `EXPORT_VERSION`)
- Private methods prefixed with underscore: `_persist()`, `_walkPath()`

**Async Patterns:**
- Always wrap Chrome APIs in Promises:
```javascript
async getTree() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((results) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(results);
    });
  });
}
```
- Use `async/await` over raw promises
- Fire-and-forget pattern for non-critical saves (`Tabs.activate`)

**Error Handling:**
- Log errors with `console.error()`
- Graceful fallbacks with default configs
- Try-catch around critical operations (especially HTML parsing and network requests)

**Comments:**
- JSDoc for complex functions
- Inline comments for non-obvious logic
- Section dividers: `// ==================== Section Name ====================`

### CSS

**Themes:**
- **Catppuccin Mocha** (Dark): `#1e1e2e` (base), `#262637` (surface), `#cdd6f4` (text), `#89b4fa` (accent)
- **Catppuccin Latte** (Light): `#eff1f5` (base), `#e6e9ef` (surface), `#4c4f69` (text), `#1e66f5` (accent)
- Theme applied via `document.documentElement.dataset.theme = 'dark' | 'light'`
- Theme mode stored in `chrome.storage.local` under `bsp_theme` (`'auto' | 'light' | 'dark'`)

**Formatting:**
- 2-space indentation
- One blank line between rule sets
- BEM naming: `.block__element--modifier`
- CSS variables in `:root` and scoped `[data-theme="light"]` / `[data-theme="dark"]`

**Modular CSS Architecture:**
- `css/newtab.css` — Central import hub (`@import "theme.css";`, etc.)
- `css/theme.css` — Design tokens, resets, typography, and base components
- `css/layout.css` — Top bar, tabs strip, content container, bottom bar
- `css/explorer.css` — Bookmarks grid, cards, tree navigator, toolbar, folders
- `css/modals.css` — Context menus, popovers, modal dialogs
- `css/dnd.css` — Selection mode, checkboxes, drag-and-drop visual states

### HTML

- Root-level entry points: `newtab.html` and `options.html`
- CSP-compliant: **no inline event handlers** (`onclick`, `onchange`, etc.)
- All events attached via `addEventListener()` in JS
- Semantic class names following BEM

## Architecture Patterns

### Storage
Stored in `chrome.storage.local`:
1. `bsp_config` — Main extension configuration:
   ```javascript
   {
     rootFolderId: null,
     tabs: [],
     settings: {
       openInNewTab: true,
       showLinksInTree: true,
       fontSizeTabs: 13,
       fontSizeNav: 13,
       fontSizeContent: 13,
       language: null,        // 'en' | 'ru' | null (auto-detect)
       iconSize: 48,          // 16 to 256 px
       labelPosition: 'right', // 'right' | 'bottom' | 'left' | 'top'
       showTitle: true,
       showUrl: true
     }
   }
   ```
2. `bsp_site_icons` — Scraped high-resolution site icon URLs: `{ [pageUrlOrOrigin]: iconUrl }`
3. `bsp_theme` — Theme setting: `'auto' | 'light' | 'dark'`

Tab IDs generated: `'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)`

### Event Communication
- Use `chrome.storage.onChanged` for cross-page communication between the start page and options page
- Synchronize view settings, themes, and tab configurations in real-time
- Skip re-init for minor state updates (`lastActiveTabId`, `viewMode`)

### Favicon & Icon Resolution Pipeline
Multi-tier pipeline delivering maximum resolution without blurry upscaling:
1. **Direct Site Icon Scraper (`Bookmarks.resolveDirectIcon`)**: Background cross-origin HTML fetch parsing `<link rel="icon" type="image/svg+xml">`, `<link rel="apple-touch-icon">`, and large PNGs; cached in `bsp_site_icons`.
2. **Custom Icon Override**: Per-bookmark custom icon URL specified by the user in the edit bookmark modal.
3. **Local / Intranet URLs**: `localhost`, `127.0.0.1`, private IP ranges (`10.x`, `172.16-31.x`, `192.168.x`), `.local`, `.lan`, `.internal` dispatched directly to Chromium's internal cache (`chrome-extension://.../_favicon/?pageUrl=...&size=N`).
4. **Google Favicon API**: `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=...&size=N` for public domains.
5. **Smart Custom Domain Fallback**: If Google returns 16px fallback on unindexed/private domains, seamlessly upgrades to Chrome's local visited favicon database (`_favicon`).
6. **Smart Crisp Display**: Small icons (e.g. 16px or 32px when 64px is requested) are rendered at 1:1 scale centered inside `.item__icon-wrap` without blurry bilinear distortion.
7. **Letter Avatar Fallback (`Render._createLetterAvatar`)**: High-contrast vector letter avatars with deterministic Catppuccin color gradients for sites without any icon.

### Multi-Selection and Drag & Drop (`Selection`)
- Single-item direct drag of bookmarks and folders to tabs or tree folders
- Multi-item Move Mode (activated via toolbar button or `Selection.toggleMoveMode`)
- Shift-click range selection and checkbox toggling
- Auto-expansion of collapsed tree folders on drag hover

### Backup & Sync (`ConfigStore`)
- **Synced Bookmarks**: Automatic backup of last 20 configuration versions to a hidden bookmark folder, with silent background restoration on fresh installation
- **JSON File**: Export configuration directly to `.json` file or import with preview/restore

## Localization

**Custom i18n system** (not Chrome's built-in `_locales`):
- Translation files in `locales/` folder (`locales/en.json`, `locales/ru.json`)
- Hierarchical keys: `tabs.colors.red`, `viewSettings.iconSize`, `bookmarks.add`
- Variable substitution: `I18n.t('tabs.closeConfirm', {title: 'Work'})`
- Supported languages: `en`, `ru`
- Adding new language: create `locales/<code>.json` and add `<code>` to `I18n._availableLangs`

**Usage:**
```javascript
// In HTML: data-i18n="key"
// In JS: I18n.t('key', {var: 'value'})
```

## File Organization

```
├── manifest.json         # Extension Manifest V3
├── newtab.html           # Main start page
├── options.html          # Settings page
├── js/
│   ├── newtab.js         # Entry point for start page
│   ├── options.js        # Options page logic & view settings sync
│   ├── storage.js        # Config persistence (chrome.storage.local)
│   ├── bookmarks.js      # Bookmarks API wrapper & icon resolution
│   ├── tabs.js           # Tab state & navigation management
│   ├── render.js         # UI rendering, card layouts & avatar fallbacks
│   ├── filter.js         # Bookmark search and filtering
│   ├── contextmenu.js    # Context menus, popovers, and edit modals
│   ├── configstore.js    # Bookmark backup sync & JSON export/import
│   ├── theme.js          # Theme management (Mocha / Latte / Auto)
│   ├── selection.js      # Multi-selection and Drag & Drop manager
│   └── i18n.js           # Custom localization engine
├── css/
│   ├── newtab.css        # Master stylesheet (@import hub)
│   ├── theme.css         # Theme tokens, resets, typography, base elements
│   ├── layout.css        # Header, tabs strip, content area, bottom bar
│   ├── explorer.css      # Bookmark grid, cards, tree nav, folder icons
│   ├── modals.css        # Context menus, popovers, and dialogs
│   └── dnd.css           # Selection mode and drag-and-drop styling
├── locales/
│   ├── en.json           # English translations
│   └── ru.json           # Russian translations
├── icons/
│   ├── bmsp-icon.svg     # Vector master icon
│   ├── icon16.png        # 16x16 extension icon
│   ├── icon32.png        # 32x32 extension icon
│   ├── icon48.png        # 48x48 extension icon
│   └── icon128.png       # 128x128 extension icon
├── tests/
│   ├── run_browser.py    # Test environment Chrome runner
│   ├── test_view_settings.py # Card layout, icon sizing, and favicon tests
│   ├── test_theme.py     # Theme switcher and SVG folder icon tests
│   └── test_dnd.py       # Drag-and-drop & multi-select integration tests
├── CHANGELOG.md          # Version history and release notes
├── README.md             # Project documentation
├── PRIVACY.md            # Privacy policy for Chrome Web Store
├── PUBLISH.md            # Chrome Web Store publication checklist
└── STORE.md              # Store listing metadata
```

## Extension Manifest

- Manifest V3
- Permissions: `bookmarks`, `storage`, `favicon`
- Host Permissions: `http://*/*`, `https://*/*` (enables cross-origin HTML fetching for direct high-res icon extraction)
- No background service worker scripts required
- Full CSP compliance (no `eval`, no inline scripts)

## Common Tasks

**Adding a new Chrome API wrapper:**
1. Add method to appropriate module (usually `bookmarks.js`)
2. Wrap callback API in Promise
3. Handle `chrome.runtime.lastError`

**Adding a new setting/UI state:**
1. Add property to `DEFAULT_CONFIG.settings` in `js/storage.js`
2. Update options page UI in `options.html` and `js/options.js`
3. Update start page quick settings in `newtab.html`, `js/contextmenu.js`, and `js/render.js`
4. Add localization keys in `locales/en.json` and `locales/ru.json`

**Adding automated tests:**
1. Create or extend a test script in `tests/test_<feature>.py`
2. Use CDP connection via `test_dnd.evaluate()` to interact with the live page
3. Verify state assertions and cleanup modified storage afterwards
