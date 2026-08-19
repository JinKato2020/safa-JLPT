# -*- coding: utf-8 -*-
"""読解(内容理解 短/中/長・情報検索)の攻略耐性・品質を機械集計する恒久ツール。
聴解の daimon_solvability.py に相当する読解版。作問データは content/problems/dokkai/*.json。

測るパラメータ(本文を読まずに解けてしまう=攻略される穴を機械で検出):
  ① 字数        : ルビ・空白を除いた本文字数。公式目標帯と比較(短すぎ/長すぎ=難度が本番とズレる)。
  ② 最長=正解%   : 正解が最長選択肢である率。基準25%(4択)。高い=「長い方を選ぶ」で解ける。
  ③ verbatim答% : 正解の核(6字+)が本文にそのまま出る率。高い=本文コピペ=読解でなく一致探し。
  ④ 語彙マッチ答%: 4択のうち正解が本文と最も表層一致(内容bigram)する率。高い=キーワード照合で解ける。
  ⑤ 選択肢重複   : 設問内で同一選択肢。 passage/設問重複: バンク内の近重複(=在庫の水増し)。
  ⑥ 設問型分布   : 指示語/理由/主張主旨/内容一致/条件照合/行動。大問ごとの狙いに合うか(偏り=技能が測れない)。
  ⑦ i18n欠落    : 選択肢の en/ne 翻訳欠落(非日本語話者が解けない)。
  ⑧ 在庫/回     : 設問数 ÷ 公式出題数 = 本番何回分の非重複ストックか。

公式基準(09_読解.md 冒頭表):
  字数目標 / 出題数(1回) を DAIMON に格納。字数帯は目標×[0.6,1.5]を許容(下限/上限)。
使い方: python tools/dokkai_solvability.py [--examples]
"""
import json, os, re, sys, glob, statistics
from collections import Counter, defaultdict

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DDIR = os.path.join(BASE, 'content', 'problems', 'dokkai')

# 大問キー -> (表示名, 公式字数目標, 公式出題数/回)  ※字数目標は級別
# ファイル名: naiyou_tan_{Lv} / naiyou_chu_{Lv} / choubun_{Lv} / joho_{Lv}
SPEC = {
    'naiyou_tan': ('内容理解短', {'N5': 80, 'N4': 150, 'N3': 175}, {'N5': 3, 'N4': 4, 'N3': 4}),
    'naiyou_chu': ('内容理解中', {'N5': 250, 'N4': 450, 'N3': 350}, {'N5': 2, 'N4': 4, 'N3': 6}),
    'choubun':    ('内容理解長', {'N3': 550}, {'N3': 4}),
    'joho':       ('情報検索',   {'N5': 250, 'N4': 400, 'N3': 600}, {'N5': 1, 'N4': 2, 'N3': 2}),
}

def strip_ruby(s):
    return re.sub(r'（[^）]*）', '', s or '')

def body_len(s):
    return len(re.sub(r'\s', '', strip_ruby(s)))

# 内容bigram: 漢字/カタカナを含む2gram(助詞かぶりを避け、内容語の表層一致を近似)
KANJI = r'[一-鿿々〆ヶ]'
KATA = r'[ァ-ヶー]'
def content_bigrams(s):
    s = strip_ruby(s)
    s = re.sub(r'[^0-9A-Za-zぁ-ゖァ-ヶー一-鿿々〆]', '', s)
    grams = set()
    for i in range(len(s) - 1):
        g = s[i:i+2]
        if re.search(KANJI, g) or re.search(KATA, g):
            grams.add(g)
    return grams

def classify(q):
    q = strip_ruby(q)
    if re.search(r'いくら|何時|何曜|どれ|どちら|条件|料金|いつ|申し?込|予約|参加できる|当てはまる', q): return '条件照合'
    if re.search(r'なぜ|どうして|理由|わけ', q): return '理由'
    if re.search(r'(それ|これ|この|その|あの)は?何|指し|下線|＿＿|___', q): return '指示語'
    if re.search(r'筆者|言いたい|考え|主張|一番|もっとも|なぜかというと|どんなこと.*言', q): return '主張主旨'
    if re.search(r'合って|正し|本文の内容|内容と', q): return '内容一致'
    if re.search(r'次に|まず|何をす|どうす|しなければ', q): return '行動'
    return 'その他'

def norm_body(s):
    return re.sub(r'\s', '', strip_ruby(s))[:120]

def main():
    show_ex = '--examples' in sys.argv
    seen_bodies = defaultdict(list)   # norm_body -> ids (bank-wide dup)
    rows = []
    for daimon, (name, chars, counts) in SPEC.items():
        for lv in ('N5', 'N4', 'N3'):
            f = os.path.join(DDIR, f'{daimon}_{lv}.json')
            if not os.path.exists(f): continue
            d = json.load(open(f, encoding='utf-8'))
            items = d if isinstance(d, list) else d['items']
            nq = 0; longest = 0; verbat = 0; lexmatch = 0; dupchoice = 0
            lens = []; qtypes = Counter(); i18n_miss = 0; body_dup = 0
            for it in items:
                bl = body_len(it.get('body', ''))
                bg_body = content_bigrams(it.get('body', ''))
                nb = norm_body(it.get('body', ''))
                seen_bodies[nb].append(it['id'])
                for q in (it.get('questions') or []):
                    nq += 1
                    lens.append(bl)
                    ch = q.get('choices') or []
                    ai = q.get('answerIndex', 0)
                    if not ch or ai >= len(ch): continue
                    L = [len(strip_ruby(c)) for c in ch]
                    if L[ai] == max(L) and L.count(max(L)) == 1: longest += 1
                    ans = strip_ruby(ch[ai])
                    core = ans[:max(6, len(ans)//2)]
                    if len(core) >= 6 and core in strip_ruby(it.get('body', '')): verbat += 1
                    ov = [len(content_bigrams(c) & bg_body) for c in ch]
                    if ov[ai] == max(ov) and ov.count(max(ov)) == 1: lexmatch += 1
                    if len(set(strip_ruby(c) for c in ch)) < len(ch): dupchoice += 1
                    qtypes[classify(q.get('q', ''))] += 1
                    i = q.get('i18n') or {}
                    ci = (i.get('en') or {}) if isinstance(i, dict) else {}
                    # 選択肢翻訳の有無(en) : i18n.en.choices が無ければ欠落とみなす
                    if not (isinstance(i, dict) and i.get('en')): i18n_miss += 1
            tgt = chars.get(lv)
            lo = int(tgt * 0.6) if tgt else 0; hi = int(tgt * 1.5) if tgt else 0
            out_short = sum(1 for x in lens if tgt and x < lo)
            out_long = sum(1 for x in lens if tgt and x > hi)
            per = counts.get(lv)
            stock = f'{nq/per:.0f}回分' if per else '—'
            med = int(statistics.median(lens)) if lens else 0
            mn = min(lens) if lens else 0; mx = max(lens) if lens else 0
            qt = ' '.join(f'{k}{v}' for k, v in qtypes.most_common())
            rows.append((name, lv, len(items), nq, med, mn, mx, tgt, lo, hi, out_short, out_long,
                         longest, verbat, lexmatch, dupchoice, i18n_miss, stock, qt))
    # bank-wide passage dup
    dupsets = {k: v for k, v in seen_bodies.items() if len(v) > 1 and k}
    print('=== 読解 攻略耐性・品質 (content/problems/dokkai) ===')
    print('大問       Lv  設問 字数med(min/max) 目標[許容]  帯外(短/長) 最長%(基25) verbatim% 語彙マッチ% 選択肢重複 en訳欠落 在庫/回')
    for (name, lv, npass, nq, med, mn, mx, tgt, lo, hi, os_, ol, lng, vb, lx, dc, i18n, stock, qt) in rows:
        p = lambda x: f'{100*x//nq}%' if nq else '0%'
        print(f'{name:8} {lv}  {nq:4} {med:4}({mn:3}/{mx:4})  {tgt or "-":>4}[{lo}-{hi}]  {os_:2}/{ol:2}  '
              f'{p(lng):>4} {p(vb):>5} {p(lx):>5}  {dc:3} {i18n:4}  {stock}')
        print(f'            └ 設問型: {qt}')
    print(f'\n=== バンク内 本文近重複: {len(dupsets)} 群 ===')
    for k, v in list(dupsets.items())[:10]:
        print(f'  {len(v)}本: {v}')
    if show_ex:
        print('\n(--examples: 個票は別途)')

if __name__ == '__main__':
    main()
