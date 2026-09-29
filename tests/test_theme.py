#!/usr/bin/env python3
"""
test_theme.py — Automated test suite for Light Theme, Dark Theme, and Auto (system) mode via CDP.
Usage: python3 tests/test_theme.py [port]
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

    # Reload page
    evaluate(ws_url, "location.reload()")
    time.sleep(1)

    # 1. Check theme components existence
    res1 = evaluate(ws_url, """
    (() => {
        const toggle = document.querySelector('.topbar__theme-toggle');
        const btns = document.querySelectorAll('.theme-btn');
        return {
            hasThemeModule: typeof Theme !== 'undefined',
            hasToggleGroup: !!toggle,
            buttonsCount: btns.length,
            buttonValues: Array.from(btns).map(b => b.dataset.themeVal)
        };
    })()
    """)
    print("[1] Theme components check:", json.dumps(res1, indent=2))
    assert res1['hasThemeModule'], "Theme module must be loaded"
    assert res1['hasToggleGroup'], "Theme toggle container must exist in topbar"
    assert res1['buttonsCount'] == 3, f"Expected 3 theme buttons, got {res1['buttonsCount']}"
    assert 'auto' in res1['buttonValues'] and 'light' in res1['buttonValues'] and 'dark' in res1['buttonValues']

    # 2. Switch to Light theme
    res2 = evaluate(ws_url, """
    (async () => {
        const lightBtn = document.querySelector('.theme-btn[data-theme-val="light"]');
        lightBtn.click();
        await new Promise(r => setTimeout(r, 100));

        const saved = await new Promise(r => chrome.storage.local.get('bsp_theme', res => r(res.bsp_theme)));
        const htmlTheme = document.documentElement.dataset.theme;
        const bgVal = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase();

        return {
            saved,
            htmlTheme,
            bgVal,
            btnActive: lightBtn.classList.contains('active'),
            otherBtnsNotActive: !document.querySelector('.theme-btn[data-theme-val="dark"]').classList.contains('active')
        };
    })()
    """)
    print("[2] Light theme check:", json.dumps(res2, indent=2))
    assert res2['saved'] == 'light', f"Expected saved theme 'light', got {res2['saved']}"
    assert res2['htmlTheme'] == 'light', f"Expected html data-theme 'light', got {res2['htmlTheme']}"
    assert res2['btnActive'], "Light button must have .active class"
    assert res2['bgVal'] == '#eff1f5', f"Expected Latte background #eff1f5, got {res2['bgVal']}"

    # 3. Switch to Dark theme
    res3 = evaluate(ws_url, """
    (async () => {
        const darkBtn = document.querySelector('.theme-btn[data-theme-val="dark"]');
        darkBtn.click();
        await new Promise(r => setTimeout(r, 100));

        const saved = await new Promise(r => chrome.storage.local.get('bsp_theme', res => r(res.bsp_theme)));
        const htmlTheme = document.documentElement.dataset.theme;
        const bgVal = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase();

        return {
            saved,
            htmlTheme,
            bgVal,
            btnActive: darkBtn.classList.contains('active'),
            lightBtnNotActive: !document.querySelector('.theme-btn[data-theme-val="light"]').classList.contains('active')
        };
    })()
    """)
    print("[3] Dark theme check:", json.dumps(res3, indent=2))
    assert res3['saved'] == 'dark', f"Expected saved theme 'dark', got {res3['saved']}"
    assert res3['htmlTheme'] == 'dark', f"Expected html data-theme 'dark', got {res3['htmlTheme']}"
    assert res3['btnActive'], "Dark button must have .active class"
    assert res3['bgVal'] == '#1e1e2e', f"Expected Mocha background #1e1e2e, got {res3['bgVal']}"

    # 4. Switch to Auto (system) theme
    res4 = evaluate(ws_url, """
    (async () => {
        const autoBtn = document.querySelector('.theme-btn[data-theme-val="auto"]');
        autoBtn.click();
        await new Promise(r => setTimeout(r, 100));

        const saved = await new Promise(r => chrome.storage.local.get('bsp_theme', res => r(res.bsp_theme)));
        const htmlTheme = document.documentElement.dataset.theme;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const expectedTheme = prefersDark ? 'dark' : 'light';

        return {
            saved,
            htmlTheme,
            expectedTheme,
            btnActive: autoBtn.classList.contains('active')
        };
    })()
    """)
    print("[4] Auto theme check:", json.dumps(res4, indent=2))
    assert res4['saved'] == 'auto', f"Expected saved theme 'auto', got {res4['saved']}"
    assert res4['htmlTheme'] == res4['expectedTheme'], f"Expected htmlTheme {res4['expectedTheme']}, got {res4['htmlTheme']}"
    assert res4['btnActive'], "Auto button must have .active class"

    # 5. Storage change reactivity (cross-tab sync)
    res5 = evaluate(ws_url, """
    (async () => {
        // Simulate storage change from another tab
        await new Promise(r => chrome.storage.local.set({ bsp_theme: 'light' }, r));
        await new Promise(r => setTimeout(r, 150));

        const htmlTheme = document.documentElement.dataset.theme;
        const lightBtnActive = document.querySelector('.theme-btn[data-theme-val="light"]').classList.contains('active');

        // Restore to auto
        await new Promise(r => chrome.storage.local.set({ bsp_theme: 'auto' }, r));
        await new Promise(r => setTimeout(r, 150));

        return {
            syncedTheme: htmlTheme,
            lightBtnActive,
            restoredAuto: document.documentElement.dataset.theme
        };
    })()
    """)
    print("[5] Storage sync check:", json.dumps(res5, indent=2))
    assert res5['syncedTheme'] == 'light', f"Theme should reactively update to 'light', got {res5['syncedTheme']}"
    assert res5['lightBtnActive'], "Light button should be marked active upon storage event"

    # 6. Folder SVG icon contrast check
    res6 = evaluate(ws_url, """
    (async () => {
        // Test light theme colors
        await Theme.setTheme('light');
        await new Promise(r => setTimeout(r, 100));

        const treeSvgs = document.querySelectorAll('.tree-node__icon .folder-svg');
        const itemSvgs = document.querySelectorAll('.folder-item__icon .folder-svg');
        const frontEl = document.querySelector('.folder-svg__front');
        const backEl = document.querySelector('.folder-svg__back');

        const lightFrontColor = frontEl ? getComputedStyle(frontEl).fill : null;
        const lightBackColor = backEl ? getComputedStyle(backEl).fill : null;

        // Test dark theme colors
        await Theme.setTheme('dark');
        await new Promise(r => setTimeout(r, 100));

        const darkFrontColor = frontEl ? getComputedStyle(frontEl).fill : null;
        const darkBackColor = backEl ? getComputedStyle(backEl).fill : null;

        // Restore to auto
        await Theme.setTheme('auto');

        return {
            treeSvgsCount: treeSvgs.length,
            itemSvgsCount: itemSvgs.length,
            lightFrontColor,
            lightBackColor,
            darkFrontColor,
            darkBackColor
        };
    })()
    """)
    print("[6] Folder SVG icons check:", json.dumps(res6, indent=2))
    assert res6['treeSvgsCount'] > 0, "Tree node folder SVGs should exist"
    assert res6['lightFrontColor'] == 'rgb(223, 142, 29)', f"Expected light front color rgb(223, 142, 29), got {res6['lightFrontColor']}"
    assert res6['lightBackColor'] == 'rgb(184, 116, 12)', f"Expected light back color rgb(184, 116, 12), got {res6['lightBackColor']}"
    assert res6['darkFrontColor'] == 'rgb(250, 179, 135)', f"Expected dark front color rgb(250, 179, 135), got {res6['darkFrontColor']}"
    assert res6['darkBackColor'] == 'rgb(224, 143, 88)', f"Expected dark back color rgb(224, 143, 88), got {res6['darkBackColor']}"

    # 7. Tree node bookmark text & favicon backing plate check
    res7 = evaluate(ws_url, """
    (async () => {
        await Theme.setTheme('light');
        await new Promise(r => setTimeout(r, 100));

        const lightLink = document.querySelector('.tree-node__label--link');
        const lightFolder = document.querySelector('.tree-node:not(.tree-node--link) > .tree-node__label:not(.active)');
        const lightFavicon = document.querySelector('.tree-node__favicon');

        const lightLinkColor = lightLink ? getComputedStyle(lightLink).color : null;
        const lightFolderColor = lightFolder ? getComputedStyle(lightFolder).color : null;
        const lightFavBg = lightFavicon ? getComputedStyle(lightFavicon).backgroundColor : null;
        const lightFavPadding = lightFavicon ? getComputedStyle(lightFavicon).padding : null;
        const lightFavRadius = lightFavicon ? getComputedStyle(lightFavicon).borderRadius : null;

        await Theme.setTheme('dark');
        await new Promise(r => setTimeout(r, 100));

        const darkLink = document.querySelector('.tree-node__label--link');
        const darkFolder = document.querySelector('.tree-node:not(.tree-node--link) > .tree-node__label:not(.active)');
        const darkFavicon = document.querySelector('.tree-node__favicon');

        const darkLinkColor = darkLink ? getComputedStyle(darkLink).color : null;
        const darkFolderColor = darkFolder ? getComputedStyle(darkFolder).color : null;
        const darkFavBg = darkFavicon ? getComputedStyle(darkFavicon).backgroundColor : null;

        await Theme.setTheme('auto');

        return {
            lightLinkColor,
            lightFolderColor,
            lightFavBg,
            lightFavPadding,
            lightFavRadius,
            darkLinkColor,
            darkFolderColor,
            darkFavBg
        };
    })()
    """)
    print("[7] Tree navigator styling check:", json.dumps(res7, indent=2))
    assert res7['lightLinkColor'] == 'rgb(92, 95, 119)', f"Expected light link color rgb(92, 95, 119), got {res7['lightLinkColor']}"
    assert res7['lightFolderColor'] == 'rgb(76, 79, 105)', f"Expected light folder color rgb(76, 79, 105), got {res7['lightFolderColor']}"
    assert res7['lightFavBg'] == 'rgb(255, 255, 255)', f"Expected light favicon bg rgb(255, 255, 255), got {res7['lightFavBg']}"
    assert res7['lightFavPadding'] == '0px', f"Expected light favicon padding 0px, got {res7['lightFavPadding']}"
    assert res7['lightFavRadius'] == '3px', f"Expected light favicon radius 3px, got {res7['lightFavRadius']}"
    assert res7['darkLinkColor'] == 'rgb(166, 173, 200)', f"Expected dark link color rgb(166, 173, 200), got {res7['darkLinkColor']}"
    assert res7['darkFolderColor'] == 'rgb(205, 214, 244)', f"Expected dark folder color rgb(205, 214, 244), got {res7['darkFolderColor']}"
    assert res7['darkFavBg'] == 'rgb(255, 255, 255)', f"Expected dark favicon bg rgb(255, 255, 255), got {res7['darkFavBg']}"

    print("\nALL THEME TESTS PASSED! ✅")

if __name__ == '__main__':
    main()


