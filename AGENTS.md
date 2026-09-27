# AGENTS.md — Coding Guidelines for Bookmark Startpage

## Project Overview

Chrome extension (Manifest V3) that replaces the new tab page with a customizable start page powered by bookmarks. Uses vanilla JavaScript without build tools or frameworks.

## Build/Test Commands

**No build system** — this is vanilla JS/CSS. Test manually:

```bash
# Load extension in Chrome for testing
# 1. Open chrome://extensions/
# 2. Enable Developer Mode
# 3. Click "Load unpacked"
# 4. Select this project folder
```

**Linting:** None configured (no ESLint/Prettier setup). Follow style guide below.

**Testing:** Manual browser testing only. No unit tests configured.

## Git Workflow

**Every change must be committed and pushed:**
- Create atomic commits for each logical change
- Follow commit message format: `type: description` (e.g., "feat: add language selector", "fix: correct i18n paths")
- Push to remote after each commit
- Never leave uncommitted changes

**Commit workflow:**
```bash
# After making changes
bash git status  # Check what changed
bash git diff    # Review changes
bash git add <files>
bash git commit -m "type: description"
bash git push
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
- `PascalCase` for module objects (Storage, Bookmarks, Tabs, etc.)
- `UPPER_SNAKE_CASE` for constants (DEFAULT_CONFIG, EXPORT_VERSION)
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
- Fire-and-forget pattern for non-critical saves (Tabs.activate)

**Error Handling:**
- Log errors with `console.error()`
- Graceful fallbacks with default configs
- Try-catch around critical operations

**Comments:**
- JSDoc for complex functions
- Inline comments for non-obvious logic
- Section dividers: `// ==================== Section Name ====================`

### CSS

**Theme:** Catppuccin Mocha (dark)
- Background: `#1e1e2e`
- Surface: `#262637`
- Text: `#cdd6f4`
- Accent: `#89b4fa`

**Formatting:**
- 2-space indentation
- One blank line between rule sets
- BEM naming: `.block__element--modifier`
- CSS variables in `:root`

**Structure:**
```css
/* === Section Header === */
.element {
  property: value;
}

.element__child {
  /* ... */
}
```

### HTML

- CSP-compliant: **no inline event handlers** (onclick, onchange, etc.)
- All events attached via `addEventListener()` in JS
- Semantic class names following BEM

## Architecture Patterns

**Storage:**
- Key: `bsp_config` in `chrome.storage.local`
- Default config object exported from Storage module
- Tab IDs generated: `'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)`

**Event Communication:**
- Use `chrome.storage.onChanged` for cross-page communication
- Skip re-init for `lastActiveTabId` and `viewMode` changes
- Full re-init only for `rootFolderId` and `settings` changes

**Chrome APIs:**
- `chrome.bookmarks` — CRUD operations on bookmarks
- `chrome.storage.local` — config persistence
- `chrome.runtime.getURL()` — resolve extension URLs

## Localization

**Custom i18n system** (not Chrome's built-in):
- Translation files in `locales/` folder (not `_locales/` to avoid Chrome's i18n conflict)
- Hierarchical keys: `tabs.colors.red`, `bookmarks.add`
- Variable substitution: `I18n.t('tabs.closeConfirm', {title: 'Work'})`
- Supported languages: `en`, `ru`
- Adding new language: create `locales/de.json` and add 'de' to `I18n._availableLangs`

**Usage:**
```javascript
// In HTML: data-i18n="key"
// In JS: I18n.t('key', {var: 'value'})
```

**Language setting stored in:** `config.settings.language`

## File Organization

```
js/
  newtab.js      # Entry point for new tab page
  options.js     # Options page logic
  storage.js     # Config persistence
  bookmarks.js   # Chrome Bookmarks API wrapper
  tabs.js        # Tab state management
  render.js      # UI rendering
  filter.js      # Search/filter logic
  contextmenu.js # Context menus and modals
  configstore.js # Config export/import via bookmarks
  theme.js       # Theme state and switcher

css/
  newtab.css     # Main stylesheet (imports modular CSS files)
  theme.css      # Variables, resets, typography, and base elements
  layout.css     # Top bar, tabs strip, content area, bottom bar
  explorer.css   # Bookmarks grid, tree navigator, toolbar, folders
  modals.css     # Context menus and modal dialogs
  dnd.css        # Selection mode and drag-and-drop

html/
  newtab.html    # New tab page
  options.html   # Settings page
```

## Extension Manifest

- Manifest V3
- Permissions: `bookmarks`, `storage`, `favicon`
- No background/service worker scripts
- CSP-compliant (no eval, no inline scripts)

## Common Tasks

**Adding a new Chrome API wrapper:**
1. Add method to appropriate module (usually `bookmarks.js`)
2. Wrap callback API in Promise
3. Handle `chrome.runtime.lastError`

**Adding UI state:**
1. Add to DEFAULT_CONFIG in storage.js
2. Add getter/setter methods in appropriate module
3. Update render.js if visual change needed

**Adding a new tab feature:**
1. Update Tabs module for state management
2. Update Render module for UI
3. Update ContextMenu for right-click options
