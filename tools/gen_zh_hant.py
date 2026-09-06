# -*- coding: utf-8 -*-
"""
簡体字(zh) → 繁体字(zh-Hant) を OpenCC s2twp で機械生成する（全3層）。
  ① UI      : src/i18n/zh.json          -> src/i18n/zh-Hant.json（全値変換）
  ② コンテンツ: content/problems/**/*.json の i18n.zh -> i18n.zh-Hant（zhの直後に挿入）
  ③ 辞書    : content/lexicon/**/*.json の i18n.zh -> i18n.zh-Hant

方針: zh は簡体字として温存し、zh-Hant を"追加"するだけ（既存ユーザー・既存訳を壊さない）。
冪等: 何度でも再実行可。zh を直したら再実行すれば zh-Hant が最新に追随する。
旗は使わず文字ラベル（中文（简体）/中文（繁體））で区別する方針。
"""
import json, glob, os, sys, io
import opencc

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def make_cc():
    for name in ('s2twp', 's2twp.json'):
        try:
            cc = opencc.OpenCC(name)
            cc.convert('测试')
            return cc
        except Exception:
            continue
    raise SystemExit('OpenCC s2twp を初期化できませんでした')

CC = make_cc()

def conv(v):
    if isinstance(v, str):
        return CC.convert(v)
    if isinstance(v, list):
        return [conv(x) for x in v]
    if isinstance(v, dict):
        return {k: conv(x) for k, x in v.items()}
    return v

def inject(node):
    """node配下で 'zh' キーを持つ全dictに 'zh-Hant'(=s2twp(zh)) を zh の直後へ追加。変更有無を返す。"""
    changed = False
    if isinstance(node, dict):
        for v in node.values():
            if inject(v):
                changed = True
        if 'zh' in node:
            newv = conv(node['zh'])
            if node.get('zh-Hant') != newv:
                items = []
                for k, v in node.items():
                    if k == 'zh-Hant':
                        continue
                    items.append((k, v))
                    if k == 'zh':
                        items.append(('zh-Hant', newv))
                node.clear()
                node.update(items)
                changed = True
    elif isinstance(node, list):
        for it in node:
            if inject(it):
                changed = True
    return changed

def load(path):
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()
    return json.loads(raw), raw.endswith('\n')

def dump(path, obj, nl):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        if nl:
            f.write('\n')

# ① UI
zh, nl = load('src/i18n/zh.json')
zhh = {k: (CC.convert(v) if isinstance(v, str) else conv(v)) for k, v in zh.items()}
dump('src/i18n/zh-Hant.json', zhh, nl)
print(f'[UI]  src/i18n/zh-Hant.json  keys={len(zhh)}')

# ②③ コンテンツ＋辞書
files = sorted(glob.glob('content/problems/**/*.json', recursive=True)
               + glob.glob('content/lexicon/**/*.json', recursive=True))
n_files = 0
n_zh_blocks = 0
for p in files:
    try:
        obj, nl = load(p)
    except Exception as e:
        print(f'  !! skip (parse) {p}: {e}')
        continue
    # このファイルに zh がいくつあるか数える（変換前）
    def count_zh(node):
        c = 0
        if isinstance(node, dict):
            if 'zh' in node:
                c += 1
            for v in node.values():
                c += count_zh(v)
        elif isinstance(node, list):
            for it in node:
                c += count_zh(it)
        return c
    before = count_zh(obj)
    if inject(obj):
        dump(p, obj, nl)
        n_files += 1
        n_zh_blocks += before
print(f'[CONTENT] 変更ファイル {n_files} / 走査 {len(files)}・zh-Hant付与ブロック合計 {n_zh_blocks}')
print('DONE')
