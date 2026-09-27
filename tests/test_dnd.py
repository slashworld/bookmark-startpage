#!/usr/bin/env python3
"""
test_dnd.py — Automated test suite for bookmark selection, drag & drop, and move operations via Chrome DevTools Protocol.
Usage: python3 tests/test_dnd.py [port]
"""

import base64
import json
import os
import socket
import struct
import sys
import time
import urllib.request

CDP_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9222

def cdp_send(ws_url, method, params=None, req_id=1):
    path = ws_url.split(f':{CDP_PORT}')[1]
    s = socket.create_connection(('127.0.0.1', CDP_PORT), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    handshake = (
        f'GET {path} HTTP/1.1\r\n'
        f'Host: 127.0.0.1:{CDP_PORT}\r\n'
        f'Upgrade: WebSocket\r\n'
        f'Connection: Upgrade\r\n'
        f'Sec-WebSocket-Key: {key}\r\n'
        f'Sec-WebSocket-Version: 13\r\n\r\n'
    )
    s.sendall(handshake.encode())
    resp = s.recv(4096)
    if b'101' not in resp:
        raise RuntimeError(f"CDP handshake failed: {resp}")

    msg = json.dumps({'id': req_id, 'method': method, 'params': params or {}}).encode()
    mask = os.urandom(4)
    l = len(msg)
    if l <= 125:
        header = bytearray([0x81, 0x80 | l]) + mask
    elif l <= 65535:
        header = bytearray([0x81, 0x80 | 126]) + struct.pack('>H', l) + mask
    else:
        header = bytearray([0x81, 0x80 | 127]) + struct.pack('>Q', l) + mask
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(msg))
    s.sendall(header + masked)

    chunks = []
    s.settimeout(5)
    while True:
        try:
            chunk = s.recv(65536)
            if not chunk:
                break
            chunks.append(chunk)
            raw = b''.join(chunks)
            if len(raw) > 2:
                plen = raw[1] & 0x7f
                offset = 2
                if plen == 126:
                    plen = int.from_bytes(raw[2:4], 'big')
                    offset = 4
                elif plen == 127:
                    plen = int.from_bytes(raw[2:10], 'big')
                    offset = 10
                if len(raw) >= offset + plen:
                    payload = raw[offset:offset+plen]
                    try:
                        parsed = json.loads(payload)
                        if parsed.get('id') == req_id:
                            s.close()
                            return parsed
                    except Exception:
                        pass
        except Exception:
            break

    s.close()
    if chunks:
        raw = b''.join(chunks)
        plen = raw[1] & 0x7f
        offset = 2
        if plen == 126:
            offset = 4
            plen = int.from_bytes(raw[2:4], 'big')
        elif plen == 127:
            offset = 10
            plen = int.from_bytes(raw[2:10], 'big')
        return json.loads(raw[offset:offset+plen])
    return None

def evaluate(ws_url, expression):
    res = cdp_send(ws_url, 'Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
    if not res:
        return None
    val = res.get('result', {}).get('result', {})
    if 'value' in val:
        return val['value']
    if res.get('result', {}).get('exceptionDetails'):
        print(f"JS Exception: {res['result']['exceptionDetails']}")
    return val

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

    # 1. Initial components check
    init_res = evaluate(ws_url, """
    ({
      hasSelection: typeof Selection !== 'undefined',
      hasBookmarksMove: typeof Bookmarks.move === 'function',
      hasDescendantOf: typeof Bookmarks.isDescendantOf === 'function',
      checkboxesCount: document.querySelectorAll('.item-checkbox').length,
      checkboxesHiddenByDefault: Array.from(document.querySelectorAll('.item-checkbox')).every(cb => getComputedStyle(cb).display === 'none'),
      moveBtnExists: !!document.querySelector('.view-toggle__btn--move'),
      moveBtnText: document.querySelector('.view-toggle__btn--move')?.textContent?.trim(),
      folderItemsCount: document.querySelectorAll('.folder-item').length,
      bookmarkItemsCount: document.querySelectorAll('.bookmark-item').length,
      treeLabelsCount: document.querySelectorAll('.tree-node__label').length
    })
    """)
    print("[1] Components check:", json.dumps(init_res, indent=2))
    assert init_res['hasSelection'], "Selection module not loaded"
    assert init_res['hasBookmarksMove'], "Bookmarks.move not loaded"
    assert init_res['hasDescendantOf'], "Bookmarks.isDescendantOf not loaded"
    assert init_res['checkboxesCount'] > 0, "No checkboxes found in UI"
    assert init_res['checkboxesHiddenByDefault'], "Checkboxes should be hidden by default"
    assert init_res['moveBtnExists'], "Move button should exist in toolbar"

    # 2. Toggle Move mode ON via button
    move_mode_res = evaluate(ws_url, """
    (() => {
      const btn = document.querySelector('.view-toggle__btn--move');
      btn.click();
      const anyCb = document.querySelector('.item-checkbox');
      return {
        isMoveMode: Selection.isMoveMode,
        btnActive: btn.classList.contains('active'),
        bodyHasSelectMode: document.body.classList.contains('select-mode'),
        checkboxesVisible: anyCb ? getComputedStyle(anyCb).display !== 'none' : false
      };
    })()
    """)
    print("[2] Move mode ON check:", json.dumps(move_mode_res, indent=2))
    assert move_mode_res['isMoveMode'], "Selection.isMoveMode should be true"
    assert move_mode_res['btnActive'], "Move button should have active class"
    assert move_mode_res['bodyHasSelectMode'], "Body should have select-mode class"
    assert move_mode_res['checkboxesVisible'], "Checkboxes should be visible when Move mode is ON"

    # 3. Checkbox click and selection bar
    toggle_res = evaluate(ws_url, """
    (() => {
      const cb = document.querySelector('.item-checkbox');
      if (!cb) return { error: 'No checkbox found' };
      cb.click();
      return {
        selectedCount: Selection.count(),
        barVisible: !!document.querySelector('.selection-bar'),
        barText: document.querySelector('.selection-bar__count')?.textContent,
        bodyHasClass: document.body.classList.contains('has-selection')
      };
    })()
    """)
    print("[3] Checkbox toggle check:", json.dumps(toggle_res, indent=2))
    assert toggle_res['selectedCount'] == 1, "Expected 1 selected item"
    assert toggle_res['barVisible'], "Selection bar should be visible"
    assert toggle_res['bodyHasClass'], "document.body should have 'has-selection' class"

    # 4. Progressive level selection test
    level_sel_res = evaluate(ws_url, """
    (() => {
      Selection.clear();
      const allCbs = Array.from(document.querySelectorAll('.item-checkbox')).filter(cb => !cb.closest('.tree-node__children:not(.open)'));
      const levels = Array.from(new Set(allCbs.map(cb => parseInt(cb.dataset.level || '0', 10)))).sort((a, b) => b - a);

      const steps = [];
      for (let i = 0; i < levels.length + 1; i++) {
        Selection.selectNextLevel();
        steps.push({
          step: i + 1,
          selectedCount: Selection.count(),
          selectedLevels: Array.from(new Set(Selection.getItems().map(item => item.level))).sort((a, b) => b - a)
        });
      }

      return {
        levels,
        steps,
        allCheckboxesCount: allCbs.length
      };
    })()
    """)
    print("[4] Level selection check:", json.dumps(level_sel_res, indent=2))
    assert len(level_sel_res['steps']) >= 2, "Expected multiple level selection steps"
    assert level_sel_res['steps'][0]['selectedLevels'] == [level_sel_res['levels'][0]], "Step 1 should select only deepest level"
    if len(level_sel_res['levels']) > 1:
      assert len(level_sel_res['steps'][1]['selectedLevels']) > 1, "Step 2 should expand to next level up"
    last_step = level_sel_res['steps'][-1]
    prev_step = level_sel_res['steps'][-2]
    assert last_step['selectedCount'] == prev_step['selectedCount'], "When all levels are selected, nothing should change"

    # 5. Shift+click range selection test
    shift_test_res = evaluate(ws_url, """
    (() => {
      Selection.clear();
      const cbs = Array.from(document.querySelectorAll('.item-checkbox')).filter(el => !el.closest('.tree-node__children:not(.open)'));
      if (cbs.length < 3) return { skipped: true, msg: 'Need at least 3 visible checkboxes' };

      // Click first item (index 0)
      cbs[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      const afterFirst = Selection.count();

      // Shift-click third item (index 2)
      cbs[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
      const afterShift = Selection.count();

      const items012Checked = cbs[0].checked && cbs[1].checked && cbs[2].checked;

      return {
        afterFirst,
        afterShift,
        items012Checked,
        barText: document.querySelector('.selection-bar__count')?.textContent
      };
    })()
    """)
    print("[5] Shift-click range selection check:", json.dumps(shift_test_res, indent=2))
    assert shift_test_res['afterFirst'] == 1, "First item should be selected"
    assert shift_test_res['afterShift'] >= 3, "Range of at least 3 items should be selected with Shift"
    assert shift_test_res['items012Checked'], "Items 0, 1, 2 should all be checked"

    # 5b. Card Shift-click when Move mode is OFF
    card_shift_res = evaluate(ws_url, """
    (() => {
      Selection.toggleMoveMode(false);
      const items = Array.from(document.querySelectorAll('.bookmark-item, .folder-item, .tree-node__label')).filter(el => {
        return !el.closest('.tree-node__children:not(.open)');
      });
      if (items.length < 3) return { skipped: true };

      // Click item 0 with Shift
      items[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
      const isMoveModeAfter = Selection.isMoveMode;
      const count1 = Selection.count();

      // Click item 2 with Shift
      items[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
      const count2 = Selection.count();

      Selection.clear();
      Selection.toggleMoveMode(true); // Restore for next step

      return {
        isMoveModeAfter,
        count1,
        count2
      };
    })()
    """)
    print("[5b] Card Shift-click check:", json.dumps(card_shift_res, indent=2))
    assert card_shift_res['isMoveModeAfter'], "Shift-click on card should activate Move mode"
    assert card_shift_res['count1'] == 1, "First Shift-click should select 1 item"
    assert card_shift_res['count2'] >= 3, "Second Shift-click should select range"

    # 6. Deselect
    deselect_res = evaluate(ws_url, """
    (() => {
      Selection.clear();
      return {
        selectedCount: Selection.count(),
        barVisible: !!document.querySelector('.selection-bar'),
        bodyHasClass: document.body.classList.contains('has-selection'),
        anyChecked: Array.from(document.querySelectorAll('.item-checkbox')).some(cb => cb.checked)
      };
    })()
    """)
    print("[6] Deselect check:", json.dumps(deselect_res, indent=2))
    assert deselect_res['selectedCount'] == 0, "Selected count should be 0"
    assert not deselect_res['barVisible'], "Selection bar should not be visible"
    assert not deselect_res['bodyHasClass'], "Body should not have 'has-selection' class"
    assert not deselect_res['anyChecked'], "No checkbox should be checked"

    # 7. Toggle Move mode OFF via button
    off_res = evaluate(ws_url, """
    (() => {
      const btn = document.querySelector('.view-toggle__btn--move');
      btn.click();
      const anyCb = document.querySelector('.item-checkbox');
      return {
        isMoveMode: Selection.isMoveMode,
        btnActive: btn.classList.contains('active'),
        bodyHasSelectMode: document.body.classList.contains('select-mode'),
        checkboxesHidden: anyCb ? getComputedStyle(anyCb).display === 'none' : true
      };
    })()
    """)
    print("[7] Move mode OFF check:", json.dumps(off_res, indent=2))
    assert not off_res['isMoveMode'], "Selection.isMoveMode should be false"
    assert not off_res['btnActive'], "Move button should not be active"
    assert off_res['checkboxesHidden'], "Checkboxes should be hidden when Move mode is OFF"

    # 8. Drop targets & draggable attributes (must work EVEN WHEN MOVE MODE IS OFF)
    drop_targets = evaluate(ws_url, """
    (() => {
      const folders = document.querySelectorAll('.tree-node:not(.tree-node--link) > .tree-node__label, .folder-item, .explorer__content');
      return {
        folderDropTargetsCount: folders.length,
        draggableBookmarksCount: document.querySelectorAll('.bookmark-item[draggable="true"], .tree-node__label--link[draggable="true"]').length,
        draggableFolderItemsCount: document.querySelectorAll('.folder-item[draggable="true"]').length
      };
    })()
    """)
    print("[8] Drop targets check:", json.dumps(drop_targets, indent=2))
    assert drop_targets['folderDropTargetsCount'] > 0, "No folder drop targets found"
    assert drop_targets['draggableBookmarksCount'] > 0, "Bookmarks must be draggable"

    # 9. Move operation and circular move prevention (single item move without checkboxes)
    move_test = evaluate(ws_url, """
    (async () => {
      const tree = await Bookmarks.getTree();
      const allBms = [];
      const allFolders = [];
      function walk(n) {
        if (n.url) allBms.push(n);
        else {
          allFolders.push(n);
          (n.children || []).forEach(walk);
        }
      }
      tree.forEach(walk);

      if (allBms.length === 0 || allFolders.length < 2) {
        return { skipped: true, msg: 'Not enough bookmarks/folders for move test' };
      }

      const bm = allBms[0];
      const origParentId = bm.parentId;
      const targetFolder = allFolders.find(f => f.id !== origParentId && f.id !== '0' && !f.url);
      if (!targetFolder) return { skipped: true, msg: 'No alternate folder found' };

      // Move bm to targetFolder
      await Selection.moveItems([{ id: bm.id, type: 'bookmark', title: bm.title, parentId: origParentId }], targetFolder.id);
      const afterMove = await Bookmarks.getNode(bm.id);
      const movedOk = afterMove && afterMove.parentId === targetFolder.id;

      // Move it back
      await Selection.moveItems([{ id: bm.id, type: 'bookmark', title: bm.title, parentId: targetFolder.id }], origParentId);
      const afterRestore = await Bookmarks.getNode(bm.id);
      const restoredOk = afterRestore && afterRestore.parentId === origParentId;

      // Circular folder move prevention
      const isDescendant = await Bookmarks.isDescendantOf(targetFolder.id, targetFolder.id);

      return {
        movedOk,
        restoredOk,
        preventSelfMove: isDescendant,
        targetFolderName: targetFolder.title
      };
    })()
    """)
    print("[9] Move test check:", json.dumps(move_test, indent=2))
    if not move_test.get('skipped'):
      assert move_test['movedOk'], "Moving bookmark failed"
      assert move_test['restoredOk'], "Restoring bookmark failed"
      assert move_test['preventSelfMove'], "Self-move should be prevented"

    # 10. Auto-expansion of source and target folders after move
    expand_test = evaluate(ws_url, """
    (async () => {
      const tree = await Bookmarks.getTree();
      const allFolders = [];
      const allBms = [];
      function walk(n) {
        if (n.url) allBms.push(n);
        else {
          allFolders.push(n);
          (n.children || []).forEach(walk);
        }
      }
      tree.forEach(walk);

      const bm = allBms[0];
      const sourceFolderId = bm.parentId;
      const targetFolder = allFolders.find(f => f.id !== sourceFolderId && f.id !== '0' && !f.url && f.id !== '1');
      if (!targetFolder) return { skipped: true };

      // Ensure folders are initially closed
      Render.expandedFolderIds.clear();
      await Render.renderAll();

      const getFolderState = (id) => {
        const nodeEl = document.querySelector(`.tree-node[data-folder-id="${id}"]`);
        if (!nodeEl) return null;
        const toggle = nodeEl.querySelector(':scope > .tree-node__label > .tree-node__toggle');
        const children = nodeEl.querySelector(':scope > .tree-node__children');
        return {
          title: nodeEl.querySelector('.tree-node__title-text')?.textContent,
          expanded: toggle ? toggle.classList.contains('expanded') : false,
          open: children ? children.classList.contains('open') : false
        };
      };

      const beforeSource = getFolderState(sourceFolderId);
      const beforeTarget = getFolderState(targetFolder.id);

      // Move bm to targetFolder
      await Selection.moveItems([{ id: bm.id, type: 'bookmark', title: bm.title, parentId: sourceFolderId }], targetFolder.id);

      const afterMoveSource = getFolderState(sourceFolderId);
      const afterMoveTarget = getFolderState(targetFolder.id);

      // Restore back
      await Selection.moveItems([{ id: bm.id, type: 'bookmark', title: bm.title, parentId: targetFolder.id }], sourceFolderId);

      const afterRestoreSource = getFolderState(sourceFolderId);
      const afterRestoreTarget = getFolderState(targetFolder.id);

      return {
        sourceFolderId,
        targetFolderId: targetFolder.id,
        beforeSource,
        beforeTarget,
        afterMoveSource,
        afterMoveTarget,
        afterRestoreSource,
        afterRestoreTarget
      };
    })()
    """)
    print("[10] Auto-expansion check:", json.dumps(expand_test, indent=2))
    if not expand_test.get('skipped'):
      assert expand_test['afterMoveSource']['expanded'] and expand_test['afterMoveSource']['open'], "Source folder must be expanded after move"
      assert expand_test['afterMoveTarget']['expanded'] and expand_test['afterMoveTarget']['open'], "Target folder must be expanded after move"
      assert expand_test['afterRestoreSource']['expanded'] and expand_test['afterRestoreSource']['open'], "Source folder must stay expanded after restore"
      assert expand_test['afterRestoreTarget']['expanded'] and expand_test['afterRestoreTarget']['open'], "Target folder must stay expanded after restore"

    print("\nALL TESTS PASSED! ✅")

if __name__ == '__main__':
    main()
