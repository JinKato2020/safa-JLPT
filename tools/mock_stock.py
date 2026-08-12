# -*- coding: utf-8 -*-
"""大問×レベルの在庫問題数 ÷ 本番出題数 = 何回分のフル模試が作れるか（模試ストック数）。
   在庫=stock_report.scan（監査落ちを除外した公式在庫）。本番数=examBlueprint.ts の正本表。
   出力: memory/模試ストック数.txt（＋標準出力に要約数行）。"""
import io, os, glob, math
from collections import OrderedDict
import stock_report as S

ROOT = S.ROOT
LEVELS = ['N5', 'N4', 'N3']

# examBlueprint.ts の正本（本番典型構成の出題数）。
BP = {
    'kanji_read':     {'N5': 7,  'N4': 9,  'N3': 8},
    'orthography':    {'N5': 5,  'N4': 6,  'N3': 6},
    'context':        {'N5': 6,  'N4': 10, 'N3': 11},
    'synonym':        {'N5': 3,  'N4': 5,  'N3': 5},
    'usage':          {'N5': 0,  'N4': 5,  'N3': 5},
    'grammar_form':   {'N5': 9,  'N4': 15, 'N3': 13},
    'order':          {'N5': 4,  'N4': 5,  'N3': 5},
    'passage_grammar':{'N5': 4,  'N4': 5,  'N3': 5},
    'naiyou_tan':     {'N5': 3,  'N4': 4,  'N3': 4},
    'naiyou_chu':     {'N5': 2,  'N4': 4,  'N3': 6},
    'choubun':        {'N5': 0,  'N4': 0,  'N3': 4},
    'joho':           {'N5': 0,  'N4': 2,  'N3': 2},
    'kadai':          {'N5': 7,  'N4': 8,  'N3': 6},
    'point':          {'N5': 6,  'N4': 7,  'N3': 6},
    'gaiyou':         {'N5': 0,  'N4': 0,  'N3': 3},
    'hatsuwa':        {'N5': 5,  'N4': 5,  'N3': 4},
    'sokuji':         {'N5': 6,  'N4': 8,  'N3': 9},
}
SEC = {'moji_goi': '文字・語彙', 'bunpou': '文法', 'dokkai': '読解', 'choukai': '聴解'}
DAIMON_SEC = {
    'kanji_read': 'moji_goi', 'orthography': 'moji_goi', 'context': 'moji_goi',
    'synonym': 'moji_goi', 'usage': 'moji_goi',
    'grammar_form': 'bunpou', 'order': 'bunpou', 'passage_grammar': 'bunpou',
    'naiyou_tan': 'dokkai', 'naiyou_chu': 'dokkai', 'choubun': 'dokkai', 'joho': 'dokkai',
    'kadai': 'choukai', 'point': 'choukai', 'gaiyou': 'choukai', 'hatsuwa': 'choukai', 'sokuji': 'choukai',
}

# 在庫を集計
stock = {}
for p in sorted(glob.glob(os.path.join(ROOT, 'content', 'problems', '*', '*.json'))):
    base = os.path.basename(p)[:-5]
    for lv in LEVELS:
        if base.endswith('_' + lv):
            key = base[:-(len(lv) + 1)]
            if key in S.DAIMON:
                stock[(key, lv)] = S.scan(p)['n']
            break

L = []
L.append('まいにちJLPT 模試ストック数（在庫 ÷ 本番出題数 = 何回分のフル模試）')
L.append('自動生成 / tools/mock_stock.py')
L.append('※在庫=公式在庫（監査落ち除外, stock_report と同定義）。本番数=examBlueprint.ts。')
L.append('※÷=floor(在庫/本番数)＝その大問だけ見た時に組めるフル模試回数。0=本番数に満たない。')
L.append('')

sec_min = {}   # セクション別 大問÷の最小
overall = {lv: math.inf for lv in LEVELS}
order = S.ORDER
cur = None
for key in order:
    rows = [(lv, stock.get((key, lv))) for lv in LEVELS if (key, lv) in stock]
    if not rows:
        continue
    sec = DAIMON_SEC.get(key, '')
    if sec != cur:
        cur = sec
        L.append('=' * 58)
        L.append('■ ' + SEC.get(sec, sec))
        L.append('=' * 58)
        L.append('  大問              レベル  在庫   本番   ÷模試')
    name = S.DAIMON[key][0]
    for lv, n in rows:
        bp = BP.get(key, {}).get(lv, 0)
        div = (n // bp) if bp > 0 else None
        cell = '−(本番になし)' if bp == 0 else str(div)
        L.append('  %-14s %s   %5d  %4s   %s'
                 % (name, lv, n, (str(bp) if bp else '0'), cell))
        if bp > 0:
            sec_min.setdefault((sec, lv), math.inf)
            sec_min[(sec, lv)] = min(sec_min[(sec, lv)], div)
            overall[lv] = min(overall[lv], div)
    L.append('')

L.append('=' * 58)
L.append('■ セクション別 “律速” = そのセクションで最も少ない大問の÷（＝そのセクションを何回分組めるか）')
L.append('=' * 58)
for sec in ['moji_goi', 'bunpou', 'dokkai', 'choukai']:
    parts = []
    for lv in LEVELS:
        v = sec_min.get((sec, lv))
        if v is not None:
            parts.append('%s %d回' % (lv, v))
    L.append('  %-8s : %s' % (SEC[sec], ' / '.join(parts)))
L.append('')
L.append('=' * 58)
L.append('■ 級ごとの “フル模試” 完成可能回数（全大問の最小＝律速大問で決まる）')
L.append('=' * 58)
for lv in LEVELS:
    L.append('  %s : %d 回分' % (lv, overall[lv] if overall[lv] != math.inf else 0))

out = os.path.join(ROOT, 'memory', '模試ストック数.txt')
io.open(out, 'w', encoding='utf-8', newline='\r\n').write('\n'.join(L) + '\n')
# 標準出力は要約だけ（トークン節約）
print('wrote', out)
for lv in LEVELS:
    print('%s フル模試 %d回分  (律速: moji%s bunpou%s dokkai%s choukai%s)' % (
        lv, overall[lv],
        sec_min.get(('moji_goi', lv)), sec_min.get(('bunpou', lv)),
        sec_min.get(('dokkai', lv)), sec_min.get(('choukai', lv))))
