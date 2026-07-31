# -*- coding: utf-8 -*-
"""文脈規定の「4語がそろっているか」を機械測定する（0トークン）。

公式20問の実測値（問題対策と問題作成.md より）:
  4語の文字種がそろう=90.0% / 語末1字がそろう=40.0% / 漢字を共有する語あり=20.0%
そろっていない＝分野・語形で消せる＝当てずっぽうで解ける＝測定にならない。

使い方: python tools/audit_context_alignment.py N4
"""
import io, json, os, re, sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LV = (sys.argv[1] if len(sys.argv) > 1 else 'N4').upper()

KANJI = re.compile(r'[㐀-鿿]')
HIRA = re.compile(r'^[ぁ-ん]+$')
KATA = re.compile(r'^[ァ-ヴー]+$')


def char_kind(w):
    """語の文字種。漢字を含む/ひらがなのみ/カタカナのみ/混在。"""
    if KANJI.search(w):
        return 'kanji'
    if HIRA.match(w):
        return 'hira'
    if KATA.match(w):
        return 'kata'
    return 'mix'


def metrics(answer, choices):
    words = [answer] + list(choices)
    kinds = {char_kind(w) for w in words}
    same_kind = len(kinds) == 1
    same_tail = len({w[-1] for w in words}) == 1
    # 正解と漢字を共有する誤答があるか（公式の主力=延期/延長・欠席/出席）
    a_k = set(KANJI.findall(answer))
    shares = any(a_k & set(KANJI.findall(c)) for c in choices) if a_k else False
    return same_kind, same_tail, shares


def report(name, rows):
    n = len(rows)
    if not n:
        print(f'{name}: 0問')
        return
    sk = st = sh = 0
    for a, ch in rows:
        k, t, s = metrics(a, ch)
        sk += k; st += t; sh += s
    print(f'{name:<22} n={n:<5} 文字種そろい={sk*100/n:5.1f}%  語末そろい={st*100/n:5.1f}%  漢字共有あり={sh*100/n:5.1f}%')


print('公式20問(問題対策と問題作成.mdの実測)  文字種そろい= 90.0%  語末そろい= 40.0%  漢字共有あり= 20.0%')
print('-' * 92)

old = json.load(io.open(os.path.join(ROOT, f'content/problems/moji_goi/context_{LV}.json'), encoding='utf-8'))
report(f'旧{LV}(在庫全部)', [(i['answer'], i['choices']) for i in old['items']])

baked = json.load(io.open(os.path.join(ROOT, f'scratchpad/context_regen/baked_{LV}.json'), encoding='utf-8'))
good = baked['good']
# 生成直後（反証で削る前）と、削った後を比べる＝「削るだけ」の副作用を測る
report(f'新{LV}(生成直後・削る前)', [(i['answer'], i['choices'] + []) for i in good])

sel = {i['id'] for i in good}
oldsel = [(i['answer'], i['choices']) for i in old['items'] if i['id'] in sel]
report(f'旧{LV}(同じ300語だけ)', oldsel)

print()
# 削除で近い誤答が消えて遠いのだけ残っていないか＝削除数別に見る
by_del = {}
for i in good:
    by_del.setdefault(i.get('deletedCount', 0), []).append((i['answer'], i['choices']))
for d in sorted(by_del):
    report(f'  うち削除{d}個の問題', by_del[d])

print()
print(f'誤答の個数分布: {dict(sorted(Counter(len(i["choices"]) for i in good).items()))}')
print(f'手口の分布    : {dict(sorted(Counter(str(i.get("trick")) for i in good).items()))}')
