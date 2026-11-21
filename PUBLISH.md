# Chrome Web Store Publication Checklist

## Pre-Publication Steps

### 1. Account Setup
- [ ] Create Chrome Web Store Developer account (\$5 one-time fee)
- [ ] Set up payment method
- [ ] Verify email address

### 2. Code Preparation
- [x] Update `manifest.json` with `author` and `homepage_url`
- [x] Update version to `1.1.0`
- [x] Verify `PRIVACY.md` matches all permissions in `manifest.json` (including `host_permissions`)
- [x] Test extension thoroughly in Chrome (manual and CDP tests)

### 3. Required Assets

#### Icons (in `icons/` folder)
- [x] `icon16.png` (16x16 pixels)
- [x] `icon32.png` (32x32 pixels)
- [x] `icon48.png` (48x48 pixels)
- [x] `icon128.png` (128x128 pixels)

#### Screenshots (1-5 images, 1280x800 or 640x400)
- [ ] Screenshot 1: Main view with tabs and bookmark grid
- [ ] Screenshot 2: Explorer view with folder tree and view settings popover
- [ ] Screenshot 3: Light theme (Catppuccin Latte)
- [ ] Screenshot 4: Settings/configuration page
- [ ] Screenshot 5: Search or drag-and-drop move mode

#### Optional Promo Images
- [ ] Small promo tile (440x280)
- [ ] Marquee promo tile (1400x560)

### 4. Documentation
- [x] `README.md` updated for v1.1.0
- [x] `PRIVACY.md` updated with accurate permission disclosures
- [x] `STORE.md` updated for v1.1.0
- [x] `CHANGELOG.md` updated

### 5. Store Listing Information

Copy from `STORE.md` to Chrome Web Store Developer Dashboard:

- **Extension Name:** Bookmark Startpage
- **Short Description:** Replace new tab with a customizable bookmark-powered start page. Organize into tabs, customize cards, drag-and-drop, and search.
- **Detailed Description:** See `STORE.md`
- **Category:** Productivity
- **Language:** English, Russian
- **Privacy Policy URL:** `https://github.com/slashworld/bookmark-startpage/blob/master/PRIVACY.md`
- **Support URL:** `https://github.com/slashworld/bookmark-startpage/issues`
- **Website:** `https://github.com/slashworld/bookmark-startpage`

### 6. Permission Justifications (for Chrome Web Store Review)
- `bookmarks`: Core functionality — renders user bookmarks on the new tab page, allows creating/editing/moving/deleting bookmarks and folders, and optionally saves config backups as bookmarks.
- `storage`: Persists user configuration, theme selection, tree state, and cached site icon URLs locally.
- `favicon`: Reads locally cached favicons via Chromium's `_favicon` endpoint, especially for intranet/local URLs.
- `host_permissions` (`http://*/*`, `https://*/*`): Directly fetches bookmarked page HTML from the user's browser to extract high-resolution/SVG site icons (`<link rel="icon">`, `apple-touch-icon`) when standard favicon caches only return low-resolution fallbacks.

### 7. Final Testing

Test the following scenarios:
- [ ] Fresh install (no previous settings, and auto-restore from synced bookmark backup)
- [ ] Import/export via JSON file, Chrome bookmarks, and URL hash
- [ ] Settings, theme, and tree open/closed state persist after browser restart
- [ ] Language switching works (Auto / English / Russian)
- [ ] All context menus and modals function
- [ ] Search works in both modes (all tabs and current tab only)
- [ ] View toggle (Explorer / All Links) and card view popover work
- [ ] Drag-and-drop and Move mode multi-select work

### 8. Publishing Steps

1. Create a clean ZIP archive excluding development files (`.git/`, `tests/`, `*.md`, `icons/bmsp-icon.svg`):
   ```bash
   zip -r bookmark-startpage-1.1.0.zip manifest.json newtab.html options.html css/ js/ locales/ icons/*.png
   ```
2. Open https://chrome.google.com/webstore/devconsole
3. Click "New Item" and upload the ZIP file
4. Fill in listing metadata from `STORE.md` and permission justifications above
5. Upload screenshots and submit for review

### 9. After Publication
- [ ] Update `README.md` with Chrome Web Store link
- [ ] Create release tag on GitHub
- [ ] Monitor reviews and issues

## Important Notes

### Review Time
Chrome Web Store review typically takes 1-3 days for simple extensions and up to 1-2 weeks when broad `host_permissions` are requested.

### Manifest Field Limits
- Name: max 45 characters (OK — 18 chars)
- Description: max 132 characters (OK — 69 chars)

### Updates
To publish updates:
1. Increment `version` in `manifest.json`
2. Update `CHANGELOG.md`
3. Build a clean ZIP archive
4. Upload to the existing item in the Developer Dashboard and submit for review
