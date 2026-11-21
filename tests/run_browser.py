#!/usr/bin/env python3
"""
run_browser.py — Launch Chrome with test profile, developer mode, and extension loaded.
"""

import base64
import json
import os
import socket
import struct
import subprocess
import sys
import time
import urllib.request

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EXT_PATH = ROOT_DIR
CDP_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9222
PROFILE_DIR = f'/tmp/chrome-test-startpage-{CDP_PORT}' if CDP_PORT != 9222 else '/tmp/chrome-test-startpage'

def prepare_profile():
    default_dir = os.path.join(PROFILE_DIR, 'Default')
    os.makedirs(default_dir, exist_ok=True)

    # 1. Set developer mode in Preferences
    pref_file = os.path.join(default_dir, 'Preferences')
    pref = {}
    if os.path.exists(pref_file):
        try:
            with open(pref_file, 'r', encoding='utf-8') as f:
                pref = json.load(f)
        except Exception:
            pref = {}

    pref.setdefault('extensions', {}).setdefault('ui', {})['developer_mode'] = True

    with open(pref_file, 'w', encoding='utf-8') as f:
        json.dump(pref, f, indent=2)

    # 2. Ensure Bookmarks exist
    bm_file = os.path.join(default_dir, 'Bookmarks')
    if not os.path.exists(bm_file):
        sample_bm = {
            'checksum': '',
            'roots': {
                'bookmark_bar': {
                    'children': [
                        {
                            'date_added': '13300000000000000',
                            'date_last_used': '0',
                            'id': '5',
                            'name': 'Работа',
                            'type': 'folder',
                            'children': [
                                {'date_added': '13300000000000000', 'date_last_used': '0', 'id': '6', 'name': 'GitHub', 'type': 'url', 'url': 'https://github.com'},
                                {'date_added': '13300000000000000', 'date_last_used': '0', 'id': '7', 'name': 'Google', 'type': 'url', 'url': 'https://google.com'}
                            ]
                        },
                        {
                            'date_added': '13300000000000000',
                            'date_last_used': '0',
                            'id': '8',
                            'name': 'Новости',
                            'type': 'folder',
                            'children': [
                                {'date_added': '13300000000000000', 'date_last_used': '0', 'id': '9', 'name': 'Hacker News', 'type': 'url', 'url': 'https://news.ycombinator.com'},
                                {'date_added': '13300000000000000', 'date_last_used': '0', 'id': '10', 'name': 'Habr', 'type': 'url', 'url': 'https://habr.com'}
                            ]
                        }
                    ],
                    'date_added': '13300000000000000',
                    'date_modified': '0',
                    'id': '1',
                    'name': 'Панель закладок',
                    'type': 'folder'
                },
                'other': {
                    'children': [],
                    'date_added': '13300000000000000',
                    'date_modified': '0',
                    'id': '2',
                    'name': 'Другие закладки',
                    'type': 'folder'
                },
                'synced': {
                    'children': [],
                    'date_added': '13300000000000000',
                    'date_modified': '0',
                    'id': '3',
                    'name': 'Мобильные закладки',
                    'type': 'folder'
                }
            },
            'version': 1
        }
        with open(bm_file, 'w', encoding='utf-8') as f:
            json.dump(sample_bm, f, ensure_ascii=False, indent=2)

def load_extension_cdp(port, ext_path):
    try:
        req = urllib.request.Request(f'http://127.0.0.1:{port}/json/version')
        with urllib.request.urlopen(req, timeout=3) as r:
            ver = json.loads(r.read())
        ws_url = ver.get('webSocketDebuggerUrl')
        if not ws_url:
            print("Warning: webSocketDebuggerUrl not found")
            return None

        path = ws_url.split(f':{port}')[1]
        s = socket.create_connection(('127.0.0.1', port), timeout=3)
        key = base64.b64encode(os.urandom(16)).decode()
        handshake = (
            f'GET {path} HTTP/1.1\r\n'
            f'Host: 127.0.0.1:{port}\r\n'
            f'Upgrade: WebSocket\r\n'
            f'Connection: Upgrade\r\n'
            f'Sec-WebSocket-Key: {key}\r\n'
            f'Sec-WebSocket-Version: 13\r\n\r\n'
        )
        s.sendall(handshake.encode())
        resp = s.recv(4096)
        if b'101' not in resp:
            print("Warning: WebSocket handshake failed")
            s.close()
            return None

        msg = json.dumps({'id': 1, 'method': 'Extensions.loadUnpacked', 'params': {'path': ext_path}}).encode()
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(msg))
        header = bytearray([0x81])
        if len(msg) < 126:
            header.append(0x80 | len(msg))
        elif len(msg) < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack('!H', len(msg)))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack('!Q', len(msg)))
        header.extend(mask)
        s.sendall(header + masked)

        data = s.recv(4096)
        s.close()

        # Parse payload
        if len(data) < 2:
            print("CDP load extension warning: empty WebSocket response")
            return None
        plen = data[1] & 0x7f
        offset = 2
        if plen == 126:
            plen = struct.unpack('!H', data[2:4])[0]
            offset = 4
        elif plen == 127:
            plen = struct.unpack('!Q', data[2:10])[0]
            offset = 10
        payload = json.loads(data[offset:offset+plen])
        if 'error' in payload:
            print(f"CDP load extension error: {payload['error']}")
            return None
        ext_id = payload.get('result', {}).get('id')
        print(f"Extension successfully loaded via CDP: ID={ext_id}")
        return ext_id
    except Exception as e:
        print(f"CDP load extension warning: {e}")
        return None

def main():
    prepare_profile()

    env = os.environ.copy()
    if 'DISPLAY' not in env and 'WAYLAND_DISPLAY' not in env:
        env['DISPLAY'] = ':0'

    cmd = [
        'google-chrome',
        f'--user-data-dir={PROFILE_DIR}',
        f'--remote-debugging-port={CDP_PORT}',
        '--enable-unsafe-extension-debugging',
        '--no-first-run',
        '--no-default-browser-check',
        'chrome://extensions',
        'chrome://newtab'
    ]

    print("Launching Chrome...")
    proc = subprocess.Popen(
        cmd,
        env=env,
        start_new_session=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL
    )

    # Wait for Chrome to initialize CDP
    for _ in range(10):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{CDP_PORT}/json/version', timeout=1):
                break
        except Exception:
            pass

    ext_id = load_extension_cdp(CDP_PORT, EXT_PATH)
    if ext_id:
        try:
            req = urllib.request.Request(
                f'http://127.0.0.1:{CDP_PORT}/json/new?chrome://newtab',
                method='PUT'
            )
            with urllib.request.urlopen(req, timeout=3):
                pass
        except Exception as e:
            print(f"Warning: could not open newtab after loading extension: {e}")

    print("Chrome launched successfully in detached mode.")

if __name__ == '__main__':
    main()
