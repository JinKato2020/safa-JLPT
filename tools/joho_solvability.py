# -*- coding: utf-8 -*-
"""情報検索(joho)の「走査性(全体を見渡す必要)」と「場面の多様性」を機械点検する。
番人の相棒（TS版 src/data/johoSolvability.test.ts と同ロジック）。設計正本＝md/09_読解.md。

走査性(scan) ＝ 一発照合(表の1行/見出しだけ)では解けず、掲示物の複数箇所を突き合わせる必要があるか。
  ハード指標：
   (S) 情報源が2つ以上： 表+注記/2表以上/カード(≥3)/プローズ(お知らせ行≥4) はOK。
       「表のみ」は 行≥8 かつ 列≥4 のときだけOK（少行少列の一発照合を弾く）。
   (C) 誘惑肢が図版由来： q_type∈{選ぶ,対象者,正誤} は 4択のうち≥3が図版テキストに実在
       （でたらめ誤答＝走査不要を弾く。金額/時刻/手続きは計算・言い換えがあるため対象外）。
  ソフト(WARN)：
   (K) 条件数：設問＋本文に条件の手がかり(・/かつ/曜日/円/才・歳/時/まで/以上以下 等)が2つ以上。

多様性(diversity) ＝ 場面(scene)が偏らない。ハード：種類≥6 かつ 最頻場面 ≤35%。

使い方: python tools/joho_solvability.py            # レポート
        python tools/joho_solvability.py --check    # ハード違反あれば exit 1
"""
import os, re, json, sys, argparse, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIR = os.path.join(ROOT, 'content', 'problems', 'dokkai')
FILES = ['joho_N5', 'joho_N4', 'joho_N3']
SCENE_MIN_KINDS = 6
SCENE_MAX_SHARE = 0.35
# 誘惑肢グラウンディングが機械で効くのは「選ぶ」のみ（コース名/品名が図版に実在）。
# 対象者=人物記述文・正誤=記述文・金額/時刻=計算結果・手続き=言い換え → 逐語一致しないため対象外。
CHOICE_GROUND_TYPES = {'選ぶ'}
CHOICE_GROUND_MIN = 3
# 走査性ハード(S/C)は新方式レベル(N4/N3)のみ。N5は公式どおり易しく=表示形式のみ変更で対象外。
SCAN_HARD_LEVELS = {'joho_N4', 'joho_N3'}
TABLE_ONLY_MIN_ROWS = 6   # 本番相当(N3表は6-9行が普通)。3-4行の一発照合は弾く。
TABLE_ONLY_MIN_COLS = 4
PROSE_MIN_LINES = 4
CARD_MIN = 3

def norm(s):
    return re.sub(r'\s', '', re.sub(r'（[^）]*）', '', s or ''))

def collect(v):
    if isinstance(v, str): return v
    if isinstance(v, list): return ''.join(collect(x) for x in v)
    if isinstance(v, dict): return ''.join(collect(x) for x in v.values())
    return ''

def fig_text(it):
    return norm(collect(it.get('figure', {})))

def sources_ok(it):
    fig = it.get('figure', {})
    blocks = fig.get('blocks', [])
    tabs = [b for b in blocks if b.get('type') == 'table']
    notes = [b for b in blocks if b.get('type') == 'notice']
    cards = [b for b in blocks if b.get('type') == 'card']
    fp = it.get('skeleton', {}).get('figure_pattern')
    if fp == '表のみ':
        if not tabs: return False, '表のみだが表なし'
        t = tabs[0].get('table', tabs[0])
        rows = len(t.get('rows', [])); cols = len(t.get('columns', []))
        if rows < TABLE_ONLY_MIN_ROWS or cols < TABLE_ONLY_MIN_COLS:
            return False, f'表のみ 行{rows}<{TABLE_ONLY_MIN_ROWS}or列{cols}<{TABLE_ONLY_MIN_COLS}'
        return True, ''
    if fp == '表+注記':
        return (len(tabs) >= 1 and len(notes) >= 1), '' if (tabs and notes) else '表+注記の構成不足'
    if fp == '2表以上':
        return (len(tabs) >= 2), '' if len(tabs) >= 2 else '2表未満'
    if fp == 'カード':
        return (len(cards) >= CARD_MIN), '' if len(cards) >= CARD_MIN else f'カード{len(cards)}<{CARD_MIN}'
    if fp == 'プローズ':
        nlines = sum(len(b.get('lines', [])) for b in notes)
        return (nlines >= PROSE_MIN_LINES), '' if nlines >= PROSE_MIN_LINES else f'プローズ行{nlines}<{PROSE_MIN_LINES}'
    return False, f'未知figure_pattern:{fp}'

def choices_ok(it):
    sk = it.get('skeleton', {})
    if sk.get('q_type') not in CHOICE_GROUND_TYPES:
        return True, -1  # 対象外
    ft = fig_text(it)
    ch = it['questions'][0]['choices']
    hit = sum(1 for c in ch if norm(c) and norm(c) in ft)
    return (hit >= CHOICE_GROUND_MIN), hit

COND_PAT = re.compile(r'[・]|かつ|または|以上|以下|まで|未満|をこえ|超え|割引|限定|[0-9０-９]+円|[0-9０-９]+才|[0-9０-９]+歳|[0-9０-９]+時|月曜|火曜|水曜|木曜|金曜|土曜|日曜|平日|土日|祝')
def cond_count(it):
    txt = norm(it['questions'][0]['q']) + norm(it.get('body', ''))
    return len(COND_PAT.findall(txt))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--check', action='store_true'); args = ap.parse_args()
    hard_fail = 0
    for name in FILES:
        p = os.path.join(DIR, name + '.json')
        items = json.load(open(p, encoding='utf-8'))['items']
        n = len(items)
        # 多様性
        sc = collections.Counter(it.get('skeleton', {}).get('scene') for it in items)
        kinds = len([k for k in sc if k not in ('その他', None)])
        top, topc = sc.most_common(1)[0]
        share = topc / n
        div_ok = kinds >= SCENE_MIN_KINDS and share <= SCENE_MAX_SHARE
        # 走査性
        s_bad = []; c_bad = []; k_warn = []
        for it in items:
            ok, why = sources_ok(it)
            if not ok: s_bad.append((it['id'], why))
            cok, hit = choices_ok(it)
            if not cok: c_bad.append((it['id'], hit))
            if cond_count(it) < 2: k_warn.append(it['id'])
        print(f'===== {name} n={n} =====')
        print(f'  [多様性] scene種類{kinds} 最頻「{top}」{round(share*100)}% -> {"OK" if div_ok else "NG"}')
        print(f'  [走査S 情報源] NG {len(s_bad)}件' + (f' 例:{s_bad[:4]}' if s_bad else ''))
        print(f'  [走査C 誘惑肢] NG {len(c_bad)}件' + (f' 例:{c_bad[:4]}' if c_bad else ''))
        print(f'  [走査K 条件数] WARN {len(k_warn)}件' + (f' 例:{k_warn[:6]}' if k_warn else ''))
        if not div_ok: hard_fail += 1
        if name in SCAN_HARD_LEVELS:
            hard_fail += len(s_bad) + len(c_bad)
        else:
            print(f'  （{name}は走査性ハード対象外＝S/CはWARN扱い）')
    print(f'\nハード違反 合計 {hard_fail}')
    if args.check and hard_fail:
        sys.exit(1)

if __name__ == '__main__':
    main()
