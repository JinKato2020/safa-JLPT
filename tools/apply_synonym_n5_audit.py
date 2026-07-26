# -*- coding: utf-8 -*-
"""反証2パスの結果を【和集合】で適用する。追加生成はしない。削除だけ。

設計: docs/superpowers/specs/2026-07-17-n5-synonym-sentence-level-design.md §5.0
方針(実測に基づく・2026-07-17):
- 【和集合】どれか1パスでも valid なら削除。損害が非対称だから
  (誤って消す=軽微・下限で保護 / 第2の正解を見逃す=バグ出荷)。
- 【追加しない】削除だけ＝新しい第2の正解が構造的に入らない(修理役は実際に4件の新バグを作った)。
- 【添字で同定】validChoices は choices の添字。テキスト照合はふりがな括弧の表記ゆれで
  空振りし「削除したつもりが削除されない」(実績あり)。

surfaceIssue(表層で正解が浮く)は【削除では直らない】(誤答を変える必要がある)ので、
自動適用せず別枠で報告する。

使い方: python tools/apply_synonym_n5_audit.py -o pilot_out/final.json [--report r.md]
"""
import argparse
import collections
import glob
import io
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CROSS = ('negation_cross', 'perspective_cross')

ap = argparse.ArgumentParser()
ap.add_argument('-o', '--out')
ap.add_argument('--report')
a = ap.parse_args()


def load(p):
    return json.load(io.open(p, encoding='utf-8'))


items = {x['id']: x for x in load(os.path.join(ROOT, 'pilot_out/merged.json'))}

# ── 2パスの結果を読む
res = collections.defaultdict(dict)          # id -> {'A': r, 'B': r}
for tag in ('A', 'B'):
    for p in sorted(glob.glob(os.path.join(ROOT, 'pilot_out', f'r{tag}_*.json'))):
        for r in load(p):
            res[r['id']][tag] = r

missing = [i for i in items if len(res.get(i, {})) < 2]
if missing:
    print(f'★2パス揃っていないid = {len(missing)}件: {missing[:8]}')

# ── 和集合
onlyA = onlyB = both = 0
del_plan, pair_plan, surface, bad_ans = {}, {}, [], []
for i, x in items.items():
    r = res.get(i, {})
    va = set(r.get('A', {}).get('validChoices') or [])
    vb = set(r.get('B', {}).get('validChoices') or [])
    onlyA += len(va - vb); onlyB += len(vb - va); both += len(va & vb)
    if va | vb:
        del_plan[i] = va | vb
    # pairIssue: 等価な誤答ペアの片方を落とす(和集合・添字の大きい方を落とす=決定的)
    pp = set()
    for tag in ('A', 'B'):
        for pr in (r.get(tag, {}).get('pairIssue') or []):
            if isinstance(pr, (list, tuple)) and len(pr) == 2:
                pp.add(max(pr))
    if pp:
        pair_plan[i] = pp
    for tag in ('A', 'B'):
        s = r.get(tag, {}).get('surfaceIssue')
        if s:
            surface.append((i, tag, s))
        if r.get(tag, {}).get('verdict') == 'bad_answer':
            bad_ans.append((i, tag, r[tag].get('note')))

# ── 適用(削除のみ)
BAD = {i for i, _, _ in bad_ans}          # ★正解が成立しない=削除では直らない。問題ごと落とす
out, dropped_q, shrunk = [], [], []
for i, x in items.items():
    if i in BAD:
        dropped_q.append((i, x['pattern'], 'bad_answer=正解が成立しない(削除では直らない)'))
        continue
    rm = set(del_plan.get(i, set())) | set(pair_plan.get(i, set()))
    if not rm:
        out.append(x); continue
    ch = [c for k, c in enumerate(x['choices']) if k not in rm]
    lo = 3 if x['pattern'] not in CROSS else 3
    if x['pattern'] in CROSS and len(ch) != 3:
        # クロスは3個ちょうどでないと壊れる。削除で割れたら【問題ごと落とす】(軸選びの失敗)
        dropped_q.append((i, x['pattern'], f'クロスが{len(ch)}個に割れた=軸選びの失敗'))
        continue
    if len(ch) < lo:
        dropped_q.append((i, x['pattern'], f'誤答が{len(ch)}個で下限3を割った'))
        continue
    y = dict(x); y['choices'] = ch
    out.append(y)
    shrunk.append((i, len(x['choices']), len(ch)))

print(f'★2パスの食い違い(添字単位): 両方が指摘={both}  パスAのみ={onlyA}  パスBのみ={onlyB}')
tot = both + onlyA + onlyB
if tot:
    print(f'   → 1パスだけなら パスA単独で{onlyB}件({onlyB/tot*100:.0f}%) / パスB単独で{onlyA}件({onlyA/tot*100:.0f}%) 取りこぼしていた')
print(f'\n削除対象のあった問題 = {len(del_plan)}件 / pairIssue = {len(pair_plan)}件')
print(f'誤答を減らした問題 = {len(shrunk)}件')
print(f'★問題ごと落とした = {len(dropped_q)}件')
for i, p, why in dropped_q:
    print(f'    {i} [{p}] {why}')
print(f'\n★bad_answer = {len(bad_ans)}件')
for i, t, n in bad_ans:
    print(f'    {i} (pass{t}) {n}')
print(f'\n★surfaceIssue = {len(surface)}件【削除では直らない。誤答の作り直しが要る】')
for i, t, s in surface[:20]:
    print(f'    {i} (pass{t}) {s[:90]}')
if len(surface) > 20:
    print(f'    …他{len(surface)-20}件')

print(f'\n確定 = {len(out)}問')
print(f'  誤答数分布: {dict(sorted(collections.Counter(len(x["choices"]) for x in out).items()))}')
print(f'  pattern分布: {dict(collections.Counter(x["pattern"] for x in out))}')

if a.out:
    out.sort(key=lambda x: int(x['id'].rsplit('-', 1)[1]))
    p = os.path.join(ROOT, a.out)
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    assert b'\r' not in io.open(p, 'rb').read()
    print(f'\n書きました: {p}')
if a.report:
    with io.open(os.path.join(ROOT, a.report), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# 言い換えN5 反証2パス 和集合レポート\n\n')
        f.write(f'- 2パスの食い違い(添字単位): 両方={both} / Aのみ={onlyA} / Bのみ={onlyB}\n')
        f.write(f'- 誤答を減らした問題: {len(shrunk)}件\n- 問題ごと落とした: {len(dropped_q)}件\n')
        f.write(f'- surfaceIssue(要作り直し): {len(surface)}件\n\n## surfaceIssue 一覧\n')
        for i, t, s in surface:
            f.write(f'- `{i}` (pass{t}) {s}\n')
        f.write('\n## 問題ごと落とした\n')
        for i, p2, why in dropped_q:
            f.write(f'- `{i}` [{p2}] {why}\n')
    print(f'レポート: {a.report}')
