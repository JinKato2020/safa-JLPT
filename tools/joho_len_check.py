# -*- coding: utf-8 -*-
"""情報検索の中間バッチ(scratchpad/joho_gen/*.json)の実効字数を機械計測。
   実効字数＝ルビ「（かな）」と空白を除いた body＋figure 全テキストの文字数（＝番人と同じ測り方）。
   使い方: python tools/joho_len_check.py scratchpad/joho_gen/N4_a.json
   出力: 各itemの字数一覧＋帯外件数。帯外があれば exit 1。"""
import json, re, sys, os
# 目標字数±15%（ルビ除く）＝ユーザー指示2026-08-21。N4/N3は公式目標の±15%に厳格化。N5は従来据置。
BAND = {'N5': (200, 375), 'N4': (340, 460), 'N3': (510, 690)}
TARGET = {'N5': 265, 'N4': 400, 'N3': 600}  # 公式目標そのもの（±15%の中心）
def strip_ruby(s): return re.sub(r'\s', '', re.sub(r'（[^）]*）', '', s or ''))
def collect(v):
    if isinstance(v, str): return v
    if isinstance(v, list): return ''.join(collect(x) for x in v)
    if isinstance(v, dict): return ''.join(collect(x) for x in v.values())
    return ''
def eff(it): return len(strip_ruby(collect(it.get('body')) + collect(it.get('figure'))))
def main():
    path = sys.argv[1]
    lv = 'N5' if 'N5' in os.path.basename(path) else 'N4' if 'N4' in os.path.basename(path) else 'N3'
    lo, hi = BAND[lv]; tgt = TARGET[lv]
    d = json.load(open(path, encoding='utf-8'))
    bad = []
    for i, it in enumerate(d):
        c = eff(it)
        mark = 'OK' if lo <= c <= hi else ('UNDER' if c < lo else 'OVER')
        if mark != 'OK': bad.append((i, it.get('title', '')[:16], c, mark))
    print(f'{os.path.basename(path)} lv={lv} 帯[{lo}-{hi}] 狙い{tgt} n={len(d)}')
    for i, t, c, m in bad:
        need = lo - c if m == 'UNDER' else 0
        print(f'  [{i}] {m} {c}字 {"(+"+str(tgt-c)+"字ほしい)" if m=="UNDER" else ""} {t}')
    print(f'帯外 {len(bad)}/{len(d)} 件' + ('' if bad else ' ✅全件帯内'))
    sys.exit(1 if bad else 0)
if __name__ == '__main__':
    main()
