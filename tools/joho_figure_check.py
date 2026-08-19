# -*- coding: utf-8 -*-
"""情報検索(joho)の「図版込み字数」と「図版必須性」を機械集計する恒久ツール。

背景: dokkai_solvability.py は body だけを数えるため、情報検索は本文が激短に見える(実体は figure=表/掲示に情報がある)。
このツールは figure(表・箇条・注記・脚注)のテキストも含めた実効字数を出し、さらに各設問が
「本文だけで解けてしまう(=図が飾り)」のか「図を読まないと解けない(=情報検索として妥当)」のかを近似する。

測るもの:
  ① 実効字数     : body + figure の全テキスト字数(ルビ・空白除去)。公式帯[目標×0.6,1.5]と比較。
  ② figure比率   : figure字数 / 実効字数。低すぎ=図が薄い、高すぎ=本文がほぼ無い。
  ③ 図版依存%    : 正解の内容が body より figure に強く出る設問の率。高い=情報検索らしい。
                   低い=本文だけで答えが出る(図が必須でない)恐れ。
  ④ 本文自足%    : 正解の内容が body に十分あり figure 不要で解ける恐れのある設問の率(=③の裏・要点検)。
使い方: python tools/joho_figure_check.py [--examples] [--check]
  --check: 実効字数の帯外 or 図版依存%が閾値未満の水準があれば exit 1(番人)。
"""
import json, os, re, sys, statistics
from collections import Counter

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DDIR = os.path.join(BASE, 'content', 'problems', 'dokkai')
# 公式字数目標(情報検索・09_読解.md) / 出題数(1回)
CHARS = {'N5': 250, 'N4': 400, 'N3': 600}
COUNTS = {'N5': 1, 'N4': 2, 'N3': 2}
FIG_DEP_MIN = 50   # 図版依存%の下限(番人)

KANJI = r'[一-鿿々〆ヶ]'
KATA = r'[ァ-ヶー]'

def strip_ruby(s):
    return re.sub(r'（[^）]*）', '', s or '')

def collect_text(v):
    """dict/list/str を再帰的に走査して全文字列を連結。"""
    if isinstance(v, str):
        return v
    if isinstance(v, dict):
        return ''.join(collect_text(x) for x in v.values())
    if isinstance(v, list):
        return ''.join(collect_text(x) for x in v)
    return ''

def clen(s):
    return len(re.sub(r'\s', '', strip_ruby(s)))

def content_bigrams(s):
    s = strip_ruby(s)
    s = re.sub(r'[^0-9A-Za-zぁ-ゖァ-ヶー一-鿿々〆]', '', s)
    g = set()
    for i in range(len(s) - 1):
        x = s[i:i+2]
        if re.search(KANJI, x) or re.search(KATA, x):
            g.add(x)
    return g

def main():
    show_ex = '--examples' in sys.argv
    check = '--check' in sys.argv
    rows = []
    viol = []
    for lv in ('N5', 'N4', 'N3'):
        f = os.path.join(DDIR, f'joho_{lv}.json')
        if not os.path.exists(f): continue
        d = json.load(open(f, encoding='utf-8'))
        items = d if isinstance(d, list) else d['items']
        eff = []; figr = []
        nq = 0; figdep = 0; bodyself = 0; nofig = 0
        for it in items:
            body = it.get('body', '')
            fig = it.get('figure')
            bt = clen(body)
            ft = clen(collect_text(fig)) if fig else 0
            if not fig: nofig += 1
            eff.append(bt + ft)
            figr.append(ft)
            bg_body = content_bigrams(body)
            bg_fig = content_bigrams(collect_text(fig)) if fig else set()
            for q in (it.get('questions') or []):
                ch = q.get('choices') or []
                ai = q.get('answerIndex', 0)
                if not ch or ai >= len(ch): continue
                nq += 1
                ans = ch[ai]
                bg_a = content_bigrams(ans) | content_bigrams(q.get('q', ''))
                ov_body = len(bg_a & bg_body)
                ov_fig = len(bg_a & bg_fig)
                if ov_fig > ov_body: figdep += 1
                elif ov_body > 0 and ov_body >= ov_fig: bodyself += 1
        tgt = CHARS[lv]; lo = int(tgt*0.6); hi = int(tgt*1.5)
        out_lo = sum(1 for x in eff if x < lo)
        out_hi = sum(1 for x in eff if x > hi)
        med = int(statistics.median(eff)) if eff else 0
        figpct = 100*sum(figr)//max(1, sum(eff))
        dep = 100*figdep//max(1, nq)
        selfp = 100*bodyself//max(1, nq)
        rows.append((lv, len(items), nq, med, min(eff or [0]), max(eff or [0]),
                     tgt, lo, hi, out_lo, out_hi, figpct, dep, selfp, nofig))
        if check:
            if out_lo: viol.append(f'joho {lv}: 実効字数 帯外(短) {out_lo}件 (<{lo})')
            if dep < FIG_DEP_MIN: viol.append(f'joho {lv}: 図版依存={dep}%<{FIG_DEP_MIN}')
            if nofig: viol.append(f'joho {lv}: figure欠落 {nofig}件')
    if check:
        if viol:
            print('NG 情報検索 番人:')
            for v in viol: print('  -', v)
            sys.exit(1)
        print(f'OK 情報検索 番人: 実効字数帯内・図版依存≥{FIG_DEP_MIN}%・figure欠落0')
        return
    print('=== 情報検索 図版込み字数・図版必須性 (joho) ===')
    print('Lv  掲示 設問 実効字数med(min/max) 目標[許容]  帯外(短/長) figure比率 図版依存% 本文自足% fig欠落')
    for (lv, npass, nq, med, mn, mx, tgt, lo, hi, ol, oh, figpct, dep, selfp, nofig) in rows:
        print(f'{lv}  {npass:4} {nq:4}  {med:4}({mn:4}/{mx:4})  {tgt:>4}[{lo}-{hi}]  {ol:3}/{oh:2}   '
              f'{figpct:3}%     {dep:3}%     {selfp:3}%    {nofig}')
    print('\n※図版依存%=正解の内容が本文より図に強く出る設問の率(高い=情報検索らしい)。'
          '本文自足%=本文だけで答えが出る恐れ(高い=図が飾り=要点検)。')

if __name__ == '__main__':
    main()
