#!/usr/bin/env python3
"""
test_view_settings.py — Automated test suite for customizable card view settings:
- Icon size (16 to 256, default 48)
- Label position (right, bottom, left, top)
- Show/hide title and URL
- Folder icon size matching bookmark icons
- Bottom-right popover in newtab.html
- Options page controls in options.html
"""

import json
import sys
import time
import urllib.request
from test_dnd import evaluate, CDP_PORT

def main():
    print(f"Connecting to Chrome on port {CDP_PORT}...")
    try:
        req = urllib.request.Request(f'http://127.0.0.1:{CDP_PORT}/json/list')
        with urllib.request.urlopen(req, timeout=3) as r:
            targets = json.loads(r.read())
    except Exception as e:
        print(f"Error connecting to CDP: {e}")
        sys.exit(1)

    newtab = next((t for t in targets if (t.get('url', '').startswith('chrome://newtab') or 'newtab.html' in t.get('url', '')) and t.get('type') == 'page'), None)
    if not newtab:
        print("Error: newtab page target not found")
        sys.exit(1)

    ws_url = newtab['webSocketDebuggerUrl']
    print(f"Target: {newtab['title']} ({ws_url})")

    # Reset to defaults and reload
    evaluate(ws_url, """
    (async () => {
        const cfg = await Storage.load();
        cfg.settings = { ...Storage.DEFAULT_CONFIG.settings };
        await Storage.save(cfg);
    })()
    """)
    evaluate(ws_url, "location.reload()")
    time.sleep(1)

    # 1. Check default settings
    res1 = evaluate(ws_url, """
    (async () => {
        const cfg = await Storage.load();
        const s = cfg.settings || {};
        const iconSize = s.iconSize;
        const labelPos = s.labelPosition;
        const showTitle = s.showTitle;
        const showUrl = s.showUrl;
        const rootVar = getComputedStyle(document.documentElement).getPropertyValue('--bookmark-icon-size').trim();
        const popoverBtn = document.getElementById('viewSettingsBtn');
        const popover = document.getElementById('viewSettingsPopover');

        return {
            iconSize,
            labelPos,
            showTitle,
            showUrl,
            rootVar,
            hasPopoverBtn: !!popoverBtn,
            popoverHidden: popover ? popover.hidden : null
        };
    })()
    """)
    print("[1] Default settings check:", json.dumps(res1, indent=2))
    assert res1["iconSize"] == 48, f"Expected default iconSize 48, got {res1['iconSize']}"
    assert res1["labelPos"] == "right", f"Expected default labelPos 'right', got {res1['labelPos']}"
    assert res1["showTitle"] == True, "Expected showTitle True"
    assert res1["showUrl"] == True, "Expected showUrl True"
    assert res1["rootVar"] == "48px", f"Expected --bookmark-icon-size 48px, got {res1['rootVar']}"
    assert res1["hasPopoverBtn"], "viewSettingsBtn missing"
    assert res1["popoverHidden"] == True, "Popover should be hidden initially"

    # 2. Check Popover Toggle & Presets
    res2 = evaluate(ws_url, """
    (() => {
        const btn = document.getElementById('viewSettingsBtn');
        const popover = document.getElementById('viewSettingsPopover');
        btn.click();
        const isVisible = !popover.hidden;
        const sizeVal = document.getElementById('popoverIconSizeVal').textContent;
        const sliderVal = document.getElementById('popoverIconSize').value;
        return { isVisible, sizeVal, sliderVal };
    })()
    """)
    print("[2] Popover open check:", json.dumps(res2, indent=2))
    assert res2["isVisible"], "Popover should be visible after button click"
    assert res2["sizeVal"] == "48×48", f"Expected 48×48, got {res2['sizeVal']}"

    # 3. Test changing icon size to 64 via preset
    res3 = evaluate(ws_url, """
    (async () => {
        const preset64 = document.querySelector('.view-popover__preset-btn[data-size="64"]');
        preset64.click();
        await new Promise(r => setTimeout(r, 200));

        const cfg = await Storage.load();
        const rootVar = getComputedStyle(document.documentElement).getPropertyValue('--bookmark-icon-size').trim();
        const sliderVal = document.getElementById('popoverIconSize').value;
        const sizeVal = document.getElementById('popoverIconSizeVal').textContent;
        
        // Check folder icon sizing in explorer
        const folderIcon = document.querySelector('.folder-item__icon');
        const folderW = folderIcon ? getComputedStyle(folderIcon).width : null;
        const folderH = folderIcon ? getComputedStyle(folderIcon).height : null;

        return {
            savedSize: cfg.settings.iconSize,
            rootVar,
            sliderVal,
            sizeVal,
            folderW,
            folderH
        };
    })()
    """)
    print("[3] Preset 64 check:", json.dumps(res3, indent=2))
    assert res3["savedSize"] == 64, f"Saved size expected 64, got {res3['savedSize']}"
    assert res3["rootVar"] == "64px", f"CSS rootVar expected 64px, got {res3['rootVar']}"
    if res3["folderW"]:
        assert res3["folderW"] == "64px", f"Folder icon width expected 64px, got {res3['folderW']}"

    # 4. Test label position change to 'bottom'
    res4 = evaluate(ws_url, """
    (async () => {
        const bottomBtn = document.querySelector('.view-popover__pos-btn[data-pos="bottom"]');
        bottomBtn.click();
        await new Promise(r => setTimeout(r, 200));

        const cfg = await Storage.load();
        const list = document.querySelector('.bookmarks-list');
        const hasClass = list ? list.classList.contains('label-pos-bottom') : false;
        const activePosBtn = document.querySelector('.view-popover__pos-btn.active')?.dataset?.pos;

        return {
            savedPos: cfg.settings.labelPosition,
            hasClass,
            activePosBtn
        };
    })()
    """)
    print("[4] Label position bottom check:", json.dumps(res4, indent=2))
    assert res4["savedPos"] == "bottom", f"Expected savedPos bottom, got {res4['savedPos']}"
    assert res4["hasClass"], "bookmarks-list should have class label-pos-bottom"
    assert res4["activePosBtn"] == "bottom", "Active pos button should be bottom"

    # 5. Test hide URL (showUrl = false)
    res5 = evaluate(ws_url, """
    (async () => {
        const urlCb = document.getElementById('popoverShowUrl');
        urlCb.click(); // toggle to false
        await new Promise(r => setTimeout(r, 200));

        const cfg = await Storage.load();
        const urls = document.querySelectorAll('.bookmark-item__url');

        return {
            showUrl: cfg.settings.showUrl,
            urlsCount: urls.length
        };
    })()
    """)
    print("[5] Hide URL check:", json.dumps(res5, indent=2))
    assert res5["showUrl"] == False, f"Expected showUrl False, got {res5['showUrl']}"
    assert res5["urlsCount"] == 0, f"Expected 0 URL elements rendered, got {res5['urlsCount']}"

    # 6. Test Google Favicon URL with high-res parameter
    res6 = evaluate(ws_url, """
    (() => {
        const url = 'https://github.com';
        const f16 = Bookmarks.getFavicon(url, 16);
        const f64 = Bookmarks.getFavicon(url, 64);
        const f256 = Bookmarks.getFavicon(url, 256);
        return { f16, f64, f256 };
    })()
    """)
    print("[6] Google Favicon URLs check:", json.dumps(res6, indent=2))
    assert "t0.gstatic.com" in res6["f16"] and "size=16" in res6["f16"]
    assert "t0.gstatic.com" in res6["f64"] and "size=64" in res6["f64"]
    assert "t0.gstatic.com" in res6["f256"] and "size=256" in res6["f256"]

    # 6b. Test Local URLs detection and Chrome local favicon dispatch
    res6b = evaluate(ws_url, """
    (() => {
        const locals = [
            'http://localhost:3000',
            'http://127.0.0.1:8080',
            'http://192.168.1.1',
            'http://my-nas.local',
            'http://internal-router/admin'
        ];
        const externals = [
            'https://google.com',
            'https://github.com',
            'https://wikipedia.org'
        ];

        const localChecks = locals.map(u => ({
            url: u,
            isLocal: Bookmarks.isLocalUrl(u),
            faviconSrc: Bookmarks.getFavicon(u, 64)
        }));

        const externalChecks = externals.map(u => ({
            url: u,
            isLocal: Bookmarks.isLocalUrl(u),
            faviconSrc: Bookmarks.getFavicon(u, 64)
        }));

        return { localChecks, externalChecks };
    })()
    """)
    print("[6b] Local URLs check:", json.dumps(res6b, indent=2))
    for item in res6b["localChecks"]:
        assert item["isLocal"] == True, f"Expected {item['url']} to be local"
        assert item["faviconSrc"].startswith("chrome-extension://"), f"Expected Chrome favicon for {item['url']}, got {item['faviconSrc']}"
    for item in res6b["externalChecks"]:
        assert item["isLocal"] == False, f"Expected {item['url']} to be external"
        assert "t0.gstatic.com" in item["faviconSrc"], f"Expected Google favicon for {item['url']}, got {item['faviconSrc']}"

    # 6c. Test Smart Crisp Sizing and Letter Avatar fallback
    res6c = evaluate(ws_url, """
    (async () => {
        // Test letter avatar generation
        const bmNoIcon = { id: 'test-1', title: 'Example Router', url: 'http://192.168.1.1' };
        const avatar = Render.createLetterAvatar(bmNoIcon);
        
        // Test Render._link structure with iconWrap
        const target = Render.linkTarget();
        const linkEl = Render._link(bmNoIcon, target);
        const iconWrap = linkEl.querySelector('.bookmark-item__icon-wrap');
        const img = iconWrap ? iconWrap.querySelector('.bookmark-item__favicon') : null;

        // Simulate broken image error to trigger letter avatar fallback
        if (img) {
            img.onerror();
        }
        const avatarInCard = iconWrap ? iconWrap.querySelector('.bookmark-item__letter-avatar') : null;

        return {
            avatarLetter: avatar.textContent,
            hasAvatarBg: !!avatar.style.background,
            hasIconWrap: !!iconWrap,
            avatarInCardLetter: avatarInCard ? avatarInCard.textContent : null
        };
    })()
    """)
    print("[6c] Smart Crisp and Avatar fallback check:", json.dumps(res6c, indent=2))
    assert res6c["avatarLetter"] == "E", f"Expected letter 'E', got {res6c['avatarLetter']}"
    assert res6c["hasAvatarBg"] == True, "Avatar must have background gradient"
    assert res6c["hasIconWrap"] == True, "Link card must have .bookmark-item__icon-wrap"
    assert res6c["avatarInCardLetter"] == "E", "Avatar must replace broken image in card"

    # 6d. Test smart Google 16px fallback to Chrome cache for custom domains (e.g. jf.nas.abvgde.xyz)
    res6d = evaluate(ws_url, """
    (async () => {
        const jfCheck = await Bookmarks.checkChromeFavicon("https://jf.nas.abvgde.xyz/", 48);
        const fakeCheck = await Bookmarks.checkChromeFavicon("https://nonexistent-abc-12345.com/", 48);

        // Test link card creation and automatic onload upgrade
        const card = Render._link({ title: 'JF', url: 'https://jf.nas.abvgde.xyz/' }, '_blank');
        document.body.appendChild(card);
        const img = card.querySelector('img');

        // Wait for image onload and upgrade
        await new Promise(r => setTimeout(r, 600));

        const isChromeSrc = img.src.startsWith('chrome-extension://');
        const naturalW = img.naturalWidth;
        card.remove();

        return {
            jfHasRealIcon: jfCheck.hasRealIcon,
            fakeHasRealIcon: fakeCheck.hasRealIcon,
            cardUpgradedToChrome: isChromeSrc,
            cardNaturalWidth: naturalW
        };
    })()
    """)
    print("[6d] Smart Google Fallback to Chrome cache for custom domains:", json.dumps(res6d, indent=2))
    assert res6d["jfHasRealIcon"] == True, "Chrome cache must recognize real icon for jf.nas.abvgde.xyz"
    assert res6d["fakeHasRealIcon"] == False, "Chrome cache must detect fallback globe for nonexistent domain"
    assert res6d["cardUpgradedToChrome"] == True, "Bookmark card must upgrade to Chrome cache when Google returns 16px"
    assert res6d["cardNaturalWidth"] >= 48, f"Card naturalWidth must be >= 48, got {res6d['cardNaturalWidth']}"

    # 7. Restore defaults
    evaluate(ws_url, """
    (async () => {
        const cfg = await Storage.load();
        cfg.settings.iconSize = 48;
        cfg.settings.labelPosition = 'right';
        cfg.settings.showTitle = true;
        cfg.settings.showUrl = true;
        await Storage.save(cfg);
        await Render.renderContent();
        syncViewSettingsUI(cfg.settings);
    })()
    """)
    print("[7] Restored defaults successfully.")

    # 8. Test Options Page controls
    ext_id = evaluate(ws_url, "chrome.runtime.id")
    opts_url = f"chrome-extension://{ext_id}/options.html"
    print(f"Opening options page: {opts_url}...")

    # Open tab via CDP
    req = urllib.request.Request(f'http://127.0.0.1:{CDP_PORT}/json/new?{opts_url}', method='PUT')
    with urllib.request.urlopen(req) as r:
        opts_target = json.loads(r.read())
    
    opts_ws = opts_target['webSocketDebuggerUrl']
    try:
        time.sleep(1)
        res8 = evaluate(opts_ws, """
        (() => {
            const optSlider = document.getElementById('optIconSize');
            const optVal = document.getElementById('optIconSizeVal');
            const optPos = document.getElementById('optLabelPosition');
            const optTitle = document.getElementById('optShowTitle');
            const optUrl = document.getElementById('optShowUrl');

            return {
                sliderVal: optSlider ? optSlider.value : null,
                valText: optVal ? optVal.textContent : null,
                posVal: optPos ? optPos.value : null,
                titleChecked: optTitle ? optTitle.checked : null,
                urlChecked: optUrl ? optUrl.checked : null
            };
        })()
        """)
        print("[8] Options page initial view settings check:", json.dumps(res8, indent=2))
        assert res8["sliderVal"] == "48", f"Options slider expected 48, got {res8['sliderVal']}"
        assert res8["valText"] == "48×48", f"Options valText expected 48×48, got {res8['valText']}"
        assert res8["posVal"] == "right", f"Options pos expected 'right', got {res8['posVal']}"
        assert res8["titleChecked"] == True
        assert res8["urlChecked"] == True

        # Save changed settings from options page
        res9 = evaluate(opts_ws, """
        (async () => {
            document.getElementById('optIconSize').value = 128;
            document.getElementById('optIconSize').dispatchEvent(new Event('input'));
            document.getElementById('optLabelPosition').value = 'top';
            document.getElementById('saveViewSettingsBtn').click();
            await new Promise(r => setTimeout(r, 300));

            const cfg = await Storage.load();
            return {
                savedIconSize: cfg.settings.iconSize,
                savedPos: cfg.settings.labelPosition
            };
        })()
        """)
        print("[9] Options page save check:", json.dumps(res9, indent=2))
        assert res9["savedIconSize"] == 128
        assert res9["savedPos"] == "top"

        # Restore defaults
        evaluate(opts_ws, """
        (async () => {
            const cfg = await Storage.load();
            cfg.settings.iconSize = 48;
            cfg.settings.labelPosition = 'right';
            cfg.settings.showTitle = true;
            cfg.settings.showUrl = true;
            await Storage.save(cfg);
        })()
        """)
        print("[10] Storage restored after options test.")
    finally:
        # Close options tab
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/close/{opts_target['id']}")

    print("\nALL VIEW SETTINGS TESTS PASSED! ✅\n")

if __name__ == "__main__":
    main()
