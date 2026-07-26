# -*- coding: utf-8 -*-
"""人手送りになった語のうち、誤答を足して救出できたものをデータへ焼き込む（N4/N3共通）。

採用の規則（厳しい方に倒す）:
  1. 2体の反証役が【両方とも合格】と言った候補だけが使える（和集合＝どちらかがrejectなら不採用）
  2. 【両方が「揃っている」】(aT/aT)と言ったものを優先
  3. 3個に届かない時だけ、揃いの判定が割れたもの(aT/aF)で補充
  4. 【両方が「場違い」】(aF/aF)は絶対に使わない＝当てずっぽうで消せる＝今回根絶している欠陥そのもの
  5. 揃っている誤答(keep+good)が2個未満なら不採用（1個しかまともな誤答が無い問題は出さない）
  6. Claude が疑っている誤答は明示的に除外（DOUBT）
  7. 採用できない語は【データを変更せず】タグを付けて記録する

使い方:
  python tools/apply_rescued.py N3 <本走行runId> <仕上げrunId>            # ドライラン
  python tools/apply_rescued.py N3 <本走行runId> <仕上げrunId> --write
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from harvest_workflow import find_journal, harvest  # noqa: E402

LV = sys.argv[1].upper()
POLISH_RUN = sys.argv[2]
WRITE = '--write' in sys.argv

# Claude が疑っている誤答。反証役は合格にしたが、こちらの判断で落とす。
DOUBT = {}

# 反証段より前に外れた問題はルビが未生成。数が少ないので手で書く（下で機械検算をかける）。
MANUAL_FURI = {
    'cx:n3-v-1118': 'この地域（ちいき）は水（みず）と緑（みどり）が多（おお）く、自然（しぜん）が〔　〕なことで知（し）られている。',
    'cx:n3-v-1540': '会議（かいぎ）で、費用（ひよう）をおさえる新（あたら）しい方法（ほうほう）を〔　〕したが、だれも賛成（さんせい）してくれなかった。',
    'cx:n3-v-359': 'その国（くに）の物価（ぶっか）はここ数年（すうねん）〔　〕していて、急（きゅう）に上（あ）がることも下（さ）がることもない。',
    'cx:n3-v-1445': '二（ふた）つの村（むら）が一（ひと）つになり、人口（じんこう）五万人（ごまんにん）の新（あたら）しい市（し）が〔　〕した。',
}

union = json.load(io.open(os.path.join(ROOT, f'scratchpad/context_regen/union17_{LV.lower()}.json'), encoding='utf-8'))
baked = json.load(io.open(os.path.join(ROOT, f'scratchpad/context_regen/baked_{LV}.json'), encoding='utf-8'))
src = {x['id']: x for x in baked['flagged']}

ruby = dict(MANUAL_FURI)
res, _st, _un = harvest(find_journal(POLISH_RUN))
for r in res.values():
    if isinstance(r, dict):
        for it in r.get('items') or []:
            if isinstance(it, dict) and it.get('id') and it.get('furi') and it['id'] not in ruby:
                ruby[it['id']] = it['furi']

adopt, tagged = [], []
for iid, e in union.items():
    if iid.startswith('_'):
        continue
    doubt = set(DOUBT.get(iid, []))
    good = [c for c, (a, b) in e['v'].items() if a == 'aT' and b == 'aT' and c not in doubt]
    weak = [c for c, (a, b) in e['v'].items()
            if a != 'r' and b != 'r' and {a, b} == {'aT', 'aF'} and c not in doubt]
    keep = [c for c in e['keep'] if c not in doubt]
    pool, used = keep + good, []
    while len(pool) < 3 and weak:
        used.append(weak.pop(0))
        pool = keep + good + used
    pool = pool[:5]
    naligned = len(keep) + len(good)
    row = {'id': iid, 'word': e['word'], 'pool': pool, 'weak': used, 'naligned': naligned,
           'dropped': sorted(doubt)}
    (adopt if len(pool) >= 3 and naligned >= 2 else tagged).append(row)

print(f'採用 {len(adopt)}語 / タグ付けて記録 {len(tagged)}語\n')
print('=== 採用 ===')
for r in adopt:
    w = f"  ※揃いに疑義のあるものを補充: {r['weak']}" if r['weak'] else ''
    print(f"  {r['word']:6} 誤答{len(r['pool'])}個 {r['pool']}{w}")
print('\n=== タグ付けて記録（誤答が足りない/品質不足） ===')
for r in tagged:
    print(f"  {r['word']:6} 使える誤答{len(r['pool'])}個(揃っているもの{r['naligned']}個) {r['pool']}")

bad = []
for r in adopt:
    p = src[r['id']]['prompt']
    f = ruby.get(r['id'])
    if not f:
        bad.append((r['id'], 'ルビなし'))
    elif re.sub(r'[（(][^）)]*[）)]', '', f) != p:
        bad.append((r['id'], f'検算NG: {f}\n         本文: {p}'))
print(f"\nルビ検算: {len(adopt) - len(bad)}/{len(adopt)} 件OK")
for iid, why in bad:
    print(f'  ⚠ {iid}: {why}')
if bad:
    sys.exit('中止: ルビが不正な問題があります。')

if not WRITE:
    print('\n※ ドライランです。書き込むには --write を付けてください。')
    sys.exit(0)

cpath = os.path.join(ROOT, f'app/content/problems/moji_goi/context_{LV}.json')
doc = json.load(io.open(cpath, encoding='utf-8'))
idx = {it['id']: it for it in doc['items']}
for r in adopt:
    e, s = idx[r['id']], src[r['id']]
    e['prompt'], e['answer'], e['choices'] = s['prompt'], s['answer'], r['pool']
    e['verified'] = True
    e.pop('i18n', None)
    e.pop('needsWork', None)
for r in tagged:
    idx[r['id']]['needsWork'] = 'distractor-shortage'   # データは変更しない。印だけ付ける
with io.open(cpath, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
print(f'\n→ {cpath} を更新（採用{len(adopt)}語・タグ{len(tagged)}語）')

fpath = os.path.join(ROOT, 'app/src/data/dict/sentenceFuri.json')
sf = json.load(io.open(fpath, encoding='utf-8'))
for r in adopt:
    sf[r['id']] = ruby[r['id']]
with io.open(fpath, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(sf, f, ensure_ascii=False)
print(f'→ {fpath} を更新（ルビ{len(adopt)}件）')
