# -*- coding: utf-8 -*-
"""聴解の各問題(item)に場面フィールド `scenario` を保存する(遡り付与)。
分類は scene_ledger.classify(台本のキーワード判定)を再利用=場面台帳と同じ基準。

使い方:
  python tools/choukai/backfill_scenario.py kadai            # kadai_{N5,N4,N3} に付与(ドライラン=表示のみ)
  python tools/choukai/backfill_scenario.py kadai --apply    # 実際に書き込む
  daimon 省略時は kadai。複数可: ... kadai point --apply

- item['scenario'] を 'title' の直後に挿入(既存キー順は維持)。既にあれば上書き更新。
- 'その他'(キーワード未ヒット)は自動では確定できないので一覧表示→手当てを促す。
- 現行フォーマット(indent=1, ensure_ascii=False)を維持=差分最小。
"""
import json, os, sys, glob
from collections import Counter
sys.path.insert(0, os.path.dirname(__file__))
from scene_ledger import classify, CDIR, SCENE
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

# 自動キーワード分類が明確に誤る問題の手動確定(全120件目視・2026-08-12)。
OVR_PATH = os.path.join(os.path.dirname(__file__), 'scenario_overrides.json')
OVERRIDE = {k: v for k, v in json.load(open(OVR_PATH, encoding='utf-8')).items() if not k.startswith('_')} if os.path.exists(OVR_PATH) else {}

def scene_of(it):
    """まず手動確定(override)、なければ台本キーワード分類。"""
    return OVERRIDE.get(it.get('id')) or classify(it.get('script') or '')

def reorder(it, scenario):
    """title の直後に scenario を入れた新 dict を返す(順序維持)。"""
    out = {}
    for k, v in it.items():
        if k == 'scenario':      # 旧値は捨てて後で入れ直す
            continue
        out[k] = v
        if k == 'title':
            out['scenario'] = scenario
    if 'scenario' not in out:     # title が無い異常時は末尾に
        out['scenario'] = scenario
    return out

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    apply = '--apply' in sys.argv
    daimons = args or ['kadai']
    grand = Counter(); other = []
    for cat in daimons:
        for f in sorted(glob.glob(os.path.join(CDIR, f'{cat}_*.json'))):
            data = json.load(open(f, encoding='utf-8'))
            lv = data['level']; c = Counter()
            newitems = []
            for it in data['items']:
                sc = scene_of(it)
                c[sc] += 1; grand[sc] += 1
                if sc == 'その他':
                    other.append((os.path.basename(f), it['id']))
                newitems.append(reorder(it, sc))
            data['items'] = newitems
            print(f'  {os.path.basename(f):18} 計{sum(c.values())}: '
                  + ' '.join(f'{s}{c[s]}' for s in list(SCENE) + ['その他'] if c[s]))
            if apply:
                json.dump(data, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n合計: ' + ' '.join(f'{s}{grand[s]}' for s in list(SCENE) + ['その他'] if grand[s]))
    if other:
        print(f'\n⚠ 「その他」(キーワード未ヒット=要手当て) {len(other)}件:')
        for f, i in other: print(f'   {f} {i}')
    print('\n(--apply なし=表示のみ)' if not apply else '\n書き込み完了。')

if __name__ == '__main__':
    main()
