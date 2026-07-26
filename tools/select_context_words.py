# -*- coding: utf-8 -*-
"""文脈規定の精選リストを作る（機械処理・0トークン）。

今回の「追加作問・修理」用に改修:
  - **verified 済みの語は除外**（＝次のバッチだけを選ぶ。以前は在庫全体から選び直していた）
  - **N5**: 手作り待ち＝未検証を**全部**（接辞も含める。ユーザー要望で本文ごと作り直すため freq/接辞フィルタを掛けない）
  - **N4**: 残りの未検証を**全部**（freq>=50 の未評価語・接辞・単漢字だけ除外）
  - **N3**: 未検証から freq 上位 **403** 語（1カテゴリ偏りに上限）

出力: scratchpad/context_regen/select_{level}.json
使い方: python tools/select_context_words.py
"""
import io, json, os, re, sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# None = 未検証を全部 / 数値 = freq上位その数だけ
TARGET = {'N5': None, 'N4': None, 'N3': 403}
CAT_SHARE_CAP = 0.22  # 1カテゴリが精選全体の22%を超えないようにする（数値ターゲット時のみ）

def load(p):
    return json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))

freq = load('app/src/data/dict/vocabFreq.json')
cat = load('app/src/data/dict/vocabCategory.json')

AFFIX = re.compile(r'[～〜]|^御')

def unusable(word):
    if AFFIX.search(word):
        return '接辞'
    if len(word) == 1 and not re.match(r'^[ぁ-んァ-ヴ]$', word):
        return '単漢字'  # 上・品・下・数・末 など接尾語用法
    return None

os.makedirs(os.path.join(ROOT, 'scratchpad/context_regen'), exist_ok=True)

for lv, target in TARGET.items():
    d = load(f'app/content/problems/moji_goi/context_{lv}.json')
    items = d['items']
    unver = [x for x in items if x.get('verified') is not True]  # 未検証だけ＝次のバッチ

    if lv == 'N5':
        # 未検証73を全部（接辞も含む＝本文ごと作り直す）。freq/catは分かる範囲で付ける
        picked = []
        for x in unver:
            vid = x['id'].replace('cx:', '')
            picked.append({'id': x['id'], 'word': x['answer'], 'freq': freq.get(vid, 99),
                           'cat': cat.get(vid, 'other'), 'oldPrompt': x['prompt']})
        dropped = {}
    else:
        pool, dropped = [], Counter()
        for x in unver:
            vid = x['id'].replace('cx:', '')
            word = x['answer']
            if vid not in freq:
                dropped['辞書にIDなし'] += 1
                continue
            f = freq[vid]
            if f >= 50:
                dropped['freq=50(未評価)'] += 1
                continue
            why = unusable(word)
            if why:
                dropped[why] += 1
                continue
            pool.append({'id': x['id'], 'word': word, 'freq': f,
                         'cat': cat.get(vid, 'other'), 'oldPrompt': x['prompt']})
        # 重複語を除去（頻度が高い方＝freqが小さい方を残す）
        best = {}
        for e in pool:
            cur = best.get(e['word'])
            if cur is None or e['freq'] < cur['freq']:
                best[e['word']] = e
        dropped['同一語の重複'] = len(pool) - len(best)
        pool = sorted(best.values(), key=lambda e: (e['freq'], e['id']))

        if target is None:
            picked = pool  # 残り全部
        else:
            cap = int(target * CAT_SHARE_CAP)
            picked, used = [], Counter()
            for e in pool:
                if len(picked) >= target:
                    break
                if used[e['cat']] >= cap:
                    continue
                picked.append(e)
                used[e['cat']] += 1
            if len(picked) < target:  # 上限で埋まらなければfreq順で補充
                have = {e['id'] for e in picked}
                for e in pool:
                    if len(picked) >= target:
                        break
                    if e['id'] not in have:
                        picked.append(e)

    out = os.path.join(ROOT, f'scratchpad/context_regen/select_{lv}.json')
    with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(picked, f, ensure_ascii=False, indent=1)

    print(f'=== {lv} ===  在庫{len(items)} / 未検証{len(unver)} → 精選 {len(picked)}')
    if dropped:
        print(f'  除外内訳: {dict(dropped)}')
    print(f'  カテゴリ: {Counter(e["cat"] for e in picked).most_common(6)}')
    print(f'  例(先頭12語): {[e["word"] for e in picked[:12]]}')
    print(f'  出力: {out}')
