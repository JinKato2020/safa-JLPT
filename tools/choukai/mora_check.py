# -*- coding: utf-8 -*-
"""生成した簡易レコード(list[{id,level,daimon,script,choices,...}])の本文モーラを自己検証。
merge_and_gate.py と全く同じ body_mora / 帯基準を使う(判定を二重管理しない)。

使い方: python tools/choukai/mora_check.py <records.json> [daimon]
  daimon 未指定ならレコードの 'daimon' を使う。
出力: id / level / 本文mora / 帯 / OK|SHORT(不足)|LONG(超過) と要約。
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from merge_and_gate import body_mora, load_bands, NCH
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

def main():
    if len(sys.argv) < 2:
        print('usage: python mora_check.py <records.json> [daimon]'); return
    recs = json.load(open(sys.argv[1], encoding='utf-8'))
    forced = sys.argv[2] if len(sys.argv) > 2 else None
    BAND = load_bands()
    n_ok = n_short = n_long = n_bad = 0
    for r in recs:
        cat = forced or r.get('daimon'); lv = r.get('level'); sc = r.get('script') or ''
        ch = r.get('choices') or []
        bm = body_mora(cat, sc); band = BAND.get(f'{cat}_{lv}')
        verdict = '?'
        if band:
            lo, hi = band
            if bm < lo: verdict = f'SHORT 不足{lo-bm}'; n_short += 1
            elif bm > hi: verdict = f'LONG 超過{bm-hi}'; n_long += 1
            else: verdict = 'OK'; n_ok += 1
        bandtxt = f'{band[0]}-{band[1]}' if band else '基準なし'
        chwarn = '' if len(ch) == NCH.get(cat, 4) else f' !choices={len(ch)}'
        print(f'{r.get("id"):14} {lv}  本文mora={bm:4}  帯[{bandtxt}]  {verdict}{chwarn}')
    print(f'--- 計 {len(recs)}: OK={n_ok} SHORT={n_short} LONG={n_long} ---')
    print('SHORT→本文に自然文を加筆(答え/一意性/観点は不変)。 LONG→短縮せず作り直し。')

if __name__ == '__main__':
    main()
