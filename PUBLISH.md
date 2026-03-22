# Chrome Web Store Publication Checklist

## Pre-Publication Steps

### 1. Account Setup
- [ ] Create Chrome Web Store Developer account ($5 one-time fee)
- [ ] Set up payment method
- [ ] Verify email address

### 2. Code Preparation
- [x] Update manifest.json with author and homepage_url
- [x] Update version to 1.0.0
- [x] Remove or minimize console.log statements (optional)
- [x] Test extension thoroughly in Chrome

### 3. Required Assets

#### Icons (Create in icons/ folder)
- [ ] Create icon16.png (16x16 pixels)
- [ ] Create icon32.png (32x32 pixels)
- [x] icon48.png exists ✓
- [x] icon128.png exists ✓

#### Screenshots (1-5 images, 1280x800 or 640x400)
- [ ] Screenshot 1: Main view with tabs showing
- [ ] Screenshot 2: Explorer view with folder tree
- [ ] Screenshot 3: Settings/configuration page
- [ ] Screenshot 4: Search functionality demo
- [ ] Screenshot 5: Context menu / bookmark editing

#### Optional Promo Images
- [ ] Small promo tile (440x280)
- [ ] Large promo tile (1400x560)
- [ ] Marquee promo tile (1400x560)

### 4. Documentation
- [x] README.md created
- [x] PRIVACY.md created
- [x] STORE.md created (listing description)
- [x] CHANGELOG.md created

### 5. Store Listing Information

From STORE.md - copy these to Chrome Web Store:

**Extension Name:** Bookmark Startpage

**Short Description:** Replace new tab with customizable bookmark-powered start page. Organize bookmarks into tabs, search, and manage directly.

**Detailed Description:** See STORE.md for full text

**Category:** Productivity

**Language:** English, Russian

**Privacy Policy URL:** (Upload PRIVACY.md to GitHub Pages or similar)

**Support URL:** https://github.com/yourusername/bookmark-startpage/issues

**Website:** https://github.com/yourusername/bookmark-startpage

### 6. Final Testing

Test the following scenarios:
- [ ] Fresh install (no previous settings)
- [ ] Import from URL works
- [ ] Settings persist after browser restart
- [ ] Language switching works
- [ ] All context menus function
- [ ] Search works in both modes
- [ ] View toggle (explorer/flat) works

### 7. Publishing Steps

1. Zip the extension folder (exclude .git, node_modules if any)
2. Go to https://chrome.google.com/webstore/devconsole
3. Click "New Item"
4. Upload the zip file
5. Fill in all required information from STORE.md
6. Upload screenshots
7. Submit for review

### 8. After Publication

- [ ] Update README.md with Chrome Web Store link
- [ ] Create release on GitHub
- [ ] Share on social media/productivity forums
- [ ] Monitor reviews and issues

## Important Notes

### Review Time
Chrome Web Store review typically takes:
- 1-3 days for simple extensions
- Up to 2 weeks for complex ones

### Privacy Policy
- A privacy policy is **required** for extensions with bookmarks permission
- Host PRIVACY.md on GitHub Pages, or use a free hosting service
- URL must be publicly accessible

### Manifest Field Limits
- Name: max 45 characters ✓
- Description: max 132 characters ✓

### Extension ID
After first upload, Chrome Web Store will assign a unique extension ID. You'll need this for:
- External messaging
- OAuth flows (not needed here)

### Updates
To publish updates:
1. Increment version in manifest.json
2. Create new zip
3. Upload to existing item in Developer Dashboard
4. Submit for review
