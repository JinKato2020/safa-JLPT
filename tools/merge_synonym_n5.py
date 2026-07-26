# -*- coding: utf-8 -*-
"""言い換えN5の生成物(gen_*.json)を統合し、機械で検査する。

設計: docs/superpowers/specs/2026-07-17-n5-synonym-sentence-level-design.md
役割: 生成役8体の出力を1本にまとめ、【投入前に】規約違反を機械で洗い出す。
      LLMの判断(第2の正解)は反証段の仕事。ここは【数えられること】だけを見る。

使い方:
  python tools/merge_synonym_n5.py --report          # 検査だけ(書かない)
  python tools/merge_synonym_n5.py -o out.json       # 統合して書く
"""
import argparse
import collections
import glob
import io
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CROSS = ('negation_cross', 'perspective_cross')
PATTERNS = ('noun', 'adj', 'adv', 'verb', 'hypernym') + CROSS
HANKAKU = re.compile(r'\([^)]*\)')      # stem/answer/choices のルビ
ZENKAKU = re.compile(r'（[^）]*）')      # sentenceFuri のルビ

# 重複id の採用方針(バッチ組みのバグで4件が2バッチに入った。1語=1問なので片方を捨てる)
# 理由は各行に明記する。judgement は実物を見て決めた。
DUP_KEEP = {
    'sy:n5-v-98':  'negation_cross',  # 多い→沢山 は「多い」→「沢山いる」で述語ごと変わり周辺不変を破る
    'sy:n5-v-320': 'new_pair',        # 丈夫→強い は素直な類義。否定クロスより公式の型に近い
}


def strip_ruby(s, zen=False):
    return (ZENKAKU if zen else HANKAKU).sub('', s or '')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true')
    ap.add_argument('-o', '--out')
    a = ap.parse_args()

    live, dropped, by_id = [], [], collections.defaultdict(list)
    for p in sorted(glob.glob(os.path.join(ROOT, 'pilot_out', 'gen_*.json'))):
        for x in json.load(io.open(p, encoding='utf-8')):
            (dropped if x.get('needsDrop') else live).append(x)
            if not x.get('needsDrop'):
                by_id[x['id']].append((os.path.basename(p), x))

    # ── 重複id の解決
    dups = {k: v for k, v in by_id.items() if len(v) > 1}
    resolved = []
    for k, v in dups.items():
        want = DUP_KEEP.get(k)
        keep = None
        for _, x in v:
            tag = x.get('pattern') if str(x.get('pattern', '')).endswith('_cross') else 'new_pair'
            if tag == want:
                keep = x
        if keep is None:
            print(f'  ★重複が未解決: {k} — DUP_KEEP に方針が無い: {[x.get("pattern") for _, x in v]}')
            keep = v[0][1]
        resolved.append(k)
        live = [x for x in live if x['id'] != k] + [keep]

    # ── 機械検査(数えられることだけ)
    err = collections.defaultdict(list)
    for x in live:
        i = x['id']
        pat, ch, ans = x.get('pattern'), x.get('choices') or [], x.get('answer') or ''
        if pat not in PATTERNS:
            err['pattern不正'].append(f'{i}: {pat}')
        if ans in ch:
            err['正解がchoicesに混入'].append(i)
        if len(set(ch)) != len(ch):
            err['誤答が重複'].append(i)
        n = len(ch)
        if pat in CROSS and n != 3:
            err['クロスなのに誤答が3個でない'].append(f'{i}: {n}個')
        if pat not in CROSS and not (3 <= n <= 5):
            err['非クロスの誤答が3〜5個でない'].append(f'{i}: {n}個')
        for f in ('stem', 'answer'):
            if '（' in (x.get(f) or ''):
                err[f'{f}に全角カッコ混入(半角が正)'].append(i)
        for c in ch:
            if '（' in c:
                err['選択肢に全角カッコ混入'].append(i)
        sf = x.get('sentenceFuri') or ''
        if not sf:
            err['sentenceFuriが無い(学習カードのルビが出ない)'].append(i)
        elif '(' in sf:
            err['sentenceFuriに半角カッコ混入(全角が正)'].append(i)
        for f in ('sentence', 'underline', 'word'):
            if not x.get(f):
                err[f'{f}が無い(学習カードが壊れる)'].append(i)
        # ルビを剥がすと sentence と一致するか(=語を勝手に変えていないか)
        if x.get('sentence') and strip_ruby(x.get('stem')) != x['sentence']:
            err['stemからルビを剥がすとsentenceと不一致'].append(i)
        if sf and x.get('sentence') and strip_ruby(sf, zen=True) != x['sentence']:
            err['sentenceFuriからルビを剥がすとsentenceと不一致'].append(i)
        if x.get('underline') and x['underline'] not in (x.get('sentence') or ''):
            err['underlineがsentenceに無い'].append(i)
        # 分かち書き(N5必須)
        if x.get('stem') and ' ' not in x['stem'] and '　' not in x['stem']:
            err['分かち書きが無い'].append(i)

    pat_cnt = collections.Counter(x.get('pattern') for x in live)
    print(f'採用 {len(live)}問 / 却下 {len(dropped)}問 / 重複解決 {len(resolved)}件 {resolved}')
    print(f'pattern分布: {dict(sorted(pat_cnt.items(), key=lambda kv: -kv[1]))}')
    print(f'誤答数分布: {dict(sorted(collections.Counter(len(x.get("choices") or []) for x in live).items()))}')
    print()
    if err:
        print('★機械検査で見つかった違反:')
        for k, v in err.items():
            print(f'  [{len(v)}件] {k}')
            for s in v[:6]:
                print(f'       {s}')
            if len(v) > 6:
                print(f'       …他{len(v)-6}件')
    else:
        print('機械検査: 違反なし')

    if a.out and not err:
        live.sort(key=lambda x: int(x['id'].rsplit('-', 1)[1]))
        p = os.path.join(ROOT, a.out)
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(live, f, ensure_ascii=False, indent=1)
        assert b'\r' not in io.open(p, 'rb').read()
        print(f'\n書きました: {p} ({len(live)}問)')
    elif a.out:
        print('\n★違反があるので書きませんでした。直してから再実行してください。')
        return 1
    return 0


sys.exit(main())
