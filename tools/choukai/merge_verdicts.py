# -*- coding: utf-8 -*-
"""意味監査(judge)の verdict_*.json を集計。
使い方: python tools/choukai/merge_verdicts.py --verdicts <DIR>
出力: 大問別/レベル別の 合格・要修正・作り直し・削除 集計、severity=high一覧、
      <DIR>/_merged_all.json（全件）と <DIR>/_nonpass.json（非合格のみ）。
"""
import json, os, glob, argparse
from collections import Counter, defaultdict
DLBL = {'kadai':'①課題理解','point':'②ポイント理解','gaiyou':'③概要理解','hatsuwa':'④発話表現','sokuji':'⑤即時応答'}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--verdicts', required=True); a = ap.parse_args()
    allrec = []
    for f in sorted(glob.glob(os.path.join(a.verdicts, 'verdict_*.json'))):
        try: allrec += json.load(open(f, encoding='utf-8'))
        except Exception as e: print('ERR', f, e)
    byd, bylv, tot = defaultdict(Counter), defaultdict(Counter), Counter()
    for r in allrec:
        v = r.get('verdict', '?'); byd[r.get('daimon')][v] += 1; bylv[r.get('level')][v] += 1; tot[v] += 1
    print(f'records={len(allrec)}\n=== 大問別 ===')
    print(f'{"大問":<14}{"合格":>5}{"要修正":>6}{"作直":>6}{"削除":>5}{"計":>5}')
    for cat in ['kadai','point','gaiyou','hatsuwa','sokuji']:
        c = byd.get(cat, Counter()); n = sum(c.values())
        print(f'{DLBL[cat]:<14}{c["合格"]:>5}{c["要修正"]:>6}{c["作り直し"]:>6}{c["削除"]:>5}{n:>5}')
    print(f'{"合計":<14}{tot["合格"]:>5}{tot["要修正"]:>6}{tot["作り直し"]:>6}{tot["削除"]:>5}{sum(tot.values()):>5}')
    print('=== レベル別 ===')
    for lv in ['N5','N4','N3']:
        c = bylv.get(lv, Counter()); print(f'{lv}: 合格{c["合格"]} 要修正{c["要修正"]} 作り直し{c["作り直し"]} 削除{c["削除"]}')
    print('=== severity=high(非合格) ===')
    for r in sorted([x for x in allrec if x.get('verdict') != '合格' and x.get('severity') == 'high'], key=lambda x: (x.get('daimon'), x.get('id'))):
        print(f'  {r.get("id")} [{r.get("level")}/{DLBL.get(r.get("daimon"))}] {r.get("verdict")}: {" / ".join(r.get("issues", []))[:80]}')
    json.dump(allrec, open(os.path.join(a.verdicts, '_merged_all.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump([r for r in allrec if r.get('verdict') != '合格'], open(os.path.join(a.verdicts, '_nonpass.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\nnon-pass -> _nonpass.json / all -> _merged_all.json')

if __name__ == '__main__':
    main()
