#!/usr/bin/env python3
"""
test_tree_persistence.py — Test preservation of open/closed tree node states across page reloads.
Usage: python3 tests/test_tree_persistence.py [port]
"""

import json
import sys
import time
import urllib.request
from test_dnd import cdp_send, CDP_PORT

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else CDP_PORT
    print(f"Connecting to Chrome on port {port}...")

    # Find startpage newtab page
    req = urllib.request.Request(f'http://127.0.0.1:{port}/json/list')
    with urllib.request.urlopen(req, timeout=3) as r:
        targets = json.loads(r.read())

    newtab = next((t for t in targets if 'newtab' in t.get('url', '') and t.get('type') == 'page'), None)
    if not newtab:
        print("Error: newtab target not found")
        sys.exit(1)

    ws_url = newtab['webSocketDebuggerUrl']
    print(f"Target: {newtab.get('title')} ({ws_url})")

    # Step 0: Setup bookmark hierarchy
    setup_code = """
    (async () => {
        // Find or create test folder structure in Bookmarks bar ('1')
        const tree = await new Promise(r => chrome.bookmarks.getTree(r));
        const bar = tree[0]?.children?.find(c => c.id === '1') || tree[0]?.children?.[0];
        const barId = bar ? bar.id : '1';

        // Clean previous test folders if any
        const existing = bar.children || [];
        for (const ch of existing) {
            if (ch.title === 'Test Work' || ch.title === 'Test Personal') {
                await new Promise(r => chrome.bookmarks.removeTree(ch.id, r));
            }
        }

        const fWork = await new Promise(r => chrome.bookmarks.create({ parentId: barId, title: 'Test Work' }, r));
        const fProj = await new Promise(r => chrome.bookmarks.create({ parentId: fWork.id, title: 'Test Project Alpha' }, r));
        await new Promise(r => chrome.bookmarks.create({ parentId: fProj.id, title: 'Spec Doc', url: 'https://spec.example.org' }, r));

        const fPersonal = await new Promise(r => chrome.bookmarks.create({ parentId: barId, title: 'Test Personal' }, r));
        await new Promise(r => chrome.bookmarks.create({ parentId: fPersonal.id, title: 'Notes', url: 'https://notes.example.org' }, r));

        // Configure test tab
        const cfg = await Storage.load();
        cfg.rootFolderId = barId;
        cfg.tabs = [{
            id: 'tab-tree-test',
            title: 'Test Bar',
            bookmarkFolderId: barId,
            pinned: false,
            order: 0,
            color: null,
            viewMode: 'explorer'
        }];
        cfg.lastActiveTabId = 'tab-tree-test';
        await Storage.save(cfg);

        // Reset any saved tree state
        localStorage.removeItem('bsp_tree_state');
        await new Promise(r => chrome.storage.local.remove('bsp_tree_state', r));

        return {
            barId,
            workId: fWork.id,
            projId: fProj.id,
            personalId: fPersonal.id
        };
    })()
    """

    res = cdp_send(ws_url, 'Runtime.evaluate', {'expression': setup_code, 'awaitPromise': True, 'returnByValue': True})
    created = res['result']['result']['value']
    work_id = created['workId']
    proj_id = created['projId']
    personal_id = created['personalId']
    bar_id = created['barId']

    print(f"Created folders: Work={work_id}, Project Alpha={proj_id}, Personal={personal_id}")

    # Reload page
    cdp_send(ws_url, 'Page.reload', {})
    time.sleep(1.5)

    # 1. Verify initial state: root is open, subfolders are closed
    check_fn = f"""
    (() => {{
        const getF = (id) => {{
            const el = document.querySelector(`.tree-node[data-folder-id="${{id}}"]`);
            return {{
                exists: !!el,
                expanded: el?.querySelector(':scope > .tree-node__label > .tree-node__toggle')?.classList.contains('expanded'),
                open: el?.querySelector(':scope > .tree-node__children')?.classList.contains('open')
            }};
        }};
        return {{
            root: getF('{bar_id}'),
            work: getF('{work_id}'),
            proj: getF('{proj_id}'),
            personal: getF('{personal_id}'),
            expandedIds: Array.from(Render.expandedFolderIds || []),
            activeFolderId: Render.activeFolderId
        }};
    }})()
    """

    res1 = cdp_send(ws_url, 'Runtime.evaluate', {'expression': check_fn, 'returnByValue': True})['result']['result']['value']
    print("[1] Initial state check:")
    print(json.dumps(res1, indent=2))
    assert res1['root']['open'], "Root folder must be open initially"
    assert not res1['work']['open'], "Work folder must be closed initially"
    assert not res1['personal']['open'], "Personal folder must be closed initially"

    # 2. Open Work folder by clicking its label
    open_work_code = f"""
    (() => {{
        const label = document.querySelector('.tree-node[data-folder-id="{work_id}"] > .tree-node__label');
        if (label) label.click();
        return {{
            workOpen: document.querySelector('.tree-node[data-folder-id="{work_id}"] > .tree-node__children')?.classList.contains('open'),
            expandedIds: Array.from(Render.expandedFolderIds || [])
        }};
    }})()
    """
    res2 = cdp_send(ws_url, 'Runtime.evaluate', {'expression': open_work_code, 'returnByValue': True})['result']['result']['value']
    print("[2] After clicking Work folder:")
    print(json.dumps(res2, indent=2))
    assert res2['workOpen'], "Work folder must now be open"
    assert str(work_id) in res2['expandedIds'], "Work ID must be in Render.expandedFolderIds"

    # 3. Open Project Alpha folder by clicking its label
    open_proj_code = f"""
    (() => {{
        const label = document.querySelector('.tree-node[data-folder-id="{proj_id}"] > .tree-node__label');
        if (label) label.click();
        return {{
            projOpen: document.querySelector('.tree-node[data-folder-id="{proj_id}"] > .tree-node__children')?.classList.contains('open'),
            expandedIds: Array.from(Render.expandedFolderIds || [])
        }};
    }})()
    """
    res3 = cdp_send(ws_url, 'Runtime.evaluate', {'expression': open_proj_code, 'returnByValue': True})['result']['result']['value']
    print("[3] After clicking Project Alpha folder:")
    print(json.dumps(res3, indent=2))
    assert res3['projOpen'], "Project Alpha must now be open"
    assert str(proj_id) in res3['expandedIds'], "Project Alpha ID must be in Render.expandedFolderIds"

    # Wait a moment for any async storage write
    time.sleep(0.5)

    # 4. REFRESH PAGE (simulating user pressing F5 / Ctrl+R)
    print("\nReloading page...")
    cdp_send(ws_url, 'Page.reload', {})
    time.sleep(1.5)

    # 5. Check state after reload: Work and Project Alpha MUST REMAIN OPEN!
    res4 = cdp_send(ws_url, 'Runtime.evaluate', {'expression': check_fn, 'returnByValue': True})['result']['result']['value']
    print("[4] State after page reload:")
    print(json.dumps(res4, indent=2))
    assert res4['root']['open'], "Root folder must still be open after reload"
    assert res4['work']['open'], "Work folder MUST STAY OPEN after reload"
    assert res4['proj']['open'], "Project Alpha MUST STAY OPEN after reload"
    assert not res4['personal']['open'], "Personal folder MUST STAY CLOSED after reload"
    assert str(work_id) in res4['expandedIds'], "Work ID must still be in Render.expandedFolderIds"
    assert str(proj_id) in res4['expandedIds'], "Project Alpha ID must still be in Render.expandedFolderIds"

    # 6. Collapse Work folder and verify it stays collapsed after another reload
    print("\nCollapsing Work folder...")
    collapse_work_code = f"""
    (() => {{
        const toggle = document.querySelector('.tree-node[data-folder-id="{work_id}"] > .tree-node__label > .tree-node__toggle');
        const label = document.querySelector('.tree-node[data-folder-id="{work_id}"] > .tree-node__label');
        if (label) label.click();
        return {{
            workOpen: document.querySelector('.tree-node[data-folder-id="{work_id}"] > .tree-node__children')?.classList.contains('open'),
            expandedIds: Array.from(Render.expandedFolderIds || [])
        }};
    }})()
    """
    res5 = cdp_send(ws_url, 'Runtime.evaluate', {'expression': collapse_work_code, 'returnByValue': True})['result']['result']['value']
    print("[5] After collapsing Work folder:")
    print(json.dumps(res5, indent=2))
    assert not res5['workOpen'], "Work folder must be collapsed"
    assert str(work_id) not in res5['expandedIds'], "Work ID must be removed from expandedIds"

    time.sleep(0.5)
    print("\nReloading page again...")
    cdp_send(ws_url, 'Page.reload', {})
    time.sleep(1.5)

    res6 = cdp_send(ws_url, 'Runtime.evaluate', {'expression': check_fn, 'returnByValue': True})['result']['result']['value']
    print("[6] State after second page reload:")
    print(json.dumps(res6, indent=2))
    assert not res6['work']['open'], "Work folder MUST STAY COLLAPSED after second reload"
    assert not res6['personal']['open'], "Personal folder must stay collapsed"

    # Cleanup test bookmarks
    cleanup_code = f"""
    (async () => {{
        await new Promise(r => chrome.bookmarks.removeTree('{work_id}', () => chrome.runtime.lastError && null || r()));
        await new Promise(r => chrome.bookmarks.removeTree('{personal_id}', () => chrome.runtime.lastError && null || r()));
    }})()
    """
    cdp_send(ws_url, 'Runtime.evaluate', {'expression': cleanup_code, 'awaitPromise': True})
    print("\nAll tree state persistence tests passed successfully!")

if __name__ == '__main__':
    main()
