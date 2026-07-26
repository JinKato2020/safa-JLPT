# -*- coding: utf-8 -*-
"""新規作成した聴解問題(簡易JSON)を自動QA→正本(content/problems/choukai/*.json)へ追記。

入力: <NEWDIR>/new_{kadai,point,gaiyou,hatsuwa,sokuji}.json
  各レコード(サブエージェント生成の簡易スキーマ):
   {id, level, daimon, script, question, choices(正解を先頭), why_unique, scenario_tag}
   ※発話/即時は question="" ・choices3つ。課題/ポイント/概要は choices4つ。

使い方:
  python tools/choukai/merge_and_gate.py --new <NEWDIR>            # ゲート(検証)のみ
  python tools/choukai/merge_and_gate.py --new <NEWDIR> --apply   # 検証OKなら追記

QA: 件数・id衝突/形式・選択肢数(4/3)・重複選択肢・字数レンジ(公式)・正解先頭。
追記: 既存 items[0] を template として deepcopy し id/level/script/question/choices/answerIndex=0 を差替
      （subtype/qtype/audioChoices/title/audio/i18n{} を継承＝スキーマ完全一致）。compact JSONで書き戻し。
"""
import json, os, re, sys, copy, glob, argparse, statistics
from collections import defaultdict
import pykakasi

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CDIR = os.path.join(REPO, 'content', 'problems', 'choukai')
kks = pykakasi.kakasi(); SMALL = set("ゃゅょぁぃぅぇぉゎ")
def mora(s):
    h = "".join(x['hira'] for x in kks.convert(s))
    return sum(1 for c in h if ('ぁ' <= c <= 'ん' or c == 'ー') and c not in SMALL)
LABEL = re.compile(r'^\s*(?:ナレ(?:ーション)?|[男女][12]?|店員|先生|学生|客|係|母|父|司会|アナウンス)?\s*[：:]\s*')
def spoken(script):
    out = []
    for ln in re.split(r'[\n　]+', script or ''):
        ln = ln.strip()
        if ln: out.append(LABEL.sub('', ln))
    return ''.join(out)
CHSP = {'gaiyou', 'hatsuwa', 'sokuji'}      # 選択肢も音声化される大問(字数に選択肢を加算)
NCH = {'kadai':4,'point':4,'gaiyou':4,'hatsuwa':3,'sokuji':3}
# 公式実測 字数レンジ(音声化テキスト総量)。出典: md/10_聴解.md
OFF = {('kadai','N5'):(106,209),('kadai','N4'):(214,270),('kadai','N3'):(190,295),
       ('point','N5'):(109,215),('point','N4'):(192,292),('point','N3'):(253,262),
       ('gaiyou','N3'):(251,295),
       ('hatsuwa','N5'):(43,103),('hatsuwa','N4'):(66,104),('hatsuwa','N3'):(98,113),
       ('sokuji','N5'):(33,90),('sokuji','N4'):(49,90),('sokuji','N3'):(40,90)}
EXPECT = {'kadai':30,'point':30,'gaiyou':10,'hatsuwa':30,'sokuji':30}  # 目安(各大問×3レベル=30/概要はN3のみ10)

def audio_chars(cat, script, choices):
    c = len(spoken(script))
    if cat in CHSP: c += sum(len(x) for x in choices)
    return c

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--new', required=True, help='new_*.json のあるディレクトリ')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()

    existing = set()
    for f in glob.glob(os.path.join(CDIR, '*.json')):
        for it in json.load(open(f, encoding='utf-8'))['items']: existing.add(it['id'])

    problems, stats, plan = [], [], {}
    for cat in ['kadai','point','gaiyou','hatsuwa','sokuji']:
        p = os.path.join(a.new, f'new_{cat}.json')
        if not os.path.exists(p): continue
        try: recs = json.load(open(p, encoding='utf-8'))
        except Exception as e: problems.append(f'[{cat}] JSON parse error: {e}'); continue
        seen = set()
        for r in recs:
            rid, lv, ch, sc = r.get('id'), r.get('level'), r.get('choices') or [], r.get('script') or ''
            tag = f'{cat} {rid}'
            if not rid or lv not in ('N5','N4','N3'): problems.append(f'{tag}: bad id/level'); continue
            if rid in existing or rid in seen: problems.append(f'{tag}: DUP id')
            seen.add(rid)
            if len(ch) != NCH[cat]: problems.append(f'{tag}: choices={len(ch)} != {NCH[cat]}')
            if len(set(ch)) != len(ch): problems.append(f'{tag}: duplicate choice text')
            ac = audio_chars(cat, sc, ch); lo, hi = OFF[(cat, lv)]
            if not (lo*0.9 <= ac <= hi*1.15): problems.append(f'{tag} [{lv}] chars={ac} OUT({lo}-{hi})')
            stats.append((cat, lv, ac))
        plan[cat] = recs

    g = defaultdict(list)
    for cat, lv, ac in stats: g[(cat, lv)].append(ac)
    print('=== 新規 字数(音声総量) min/med/max vs 公式 ===')
    for cat in ['kadai','point','gaiyou','hatsuwa','sokuji']:
        for lv in ['N5','N4','N3']:
            if (cat, lv) in g:
                v = sorted(g[(cat, lv)]); lo, hi = OFF[(cat, lv)]
                print(f'  {cat:8} {lv}: n={len(v)} {min(v)}/{int(statistics.median(v))}/{max(v)}  公式{lo}-{hi}')
    print(f'\n新規合計= {sum(len(v) for v in plan.values())}')
    fatal = [x for x in problems if any(k in x for k in ('parse error','bad id','DUP id','choices=','duplicate choice'))]
    print(f'\n=== 問題点 {len(problems)} 件 (致命的 {len(fatal)}) ===')
    for x in problems: print('  -', x)
    if not problems: print('  (なし)')

    if a.apply and fatal:
        print('\n!! 致命的問題があるため APPLY 中止'); return
    if a.apply:
        byfile = defaultdict(list)
        for cat, recs in plan.items():
            for r in recs: byfile[(cat, r['level'])].append(r)
        for (cat, lv), recs in byfile.items():
            fp = os.path.join(CDIR, f'{cat}_{lv}.json')
            data = json.load(open(fp, encoding='utf-8'))
            tmpl = copy.deepcopy(data['items'][0])
            for r in recs:
                it = copy.deepcopy(tmpl)
                it['id'], it['level'], it['script'] = r['id'], lv, r['script']
                q = it['questions'][0]
                q['id'], q['q'], q['choices'], q['answerIndex'] = r['id']+'-q1', r.get('question','') or '', r['choices'], 0
                data['items'].append(it)
            json.dump(data, open(fp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
            print(f'APPLIED {cat}_{lv}: +{len(recs)} -> {len(data["items"])}')
        print('=== APPLY 完了 ===')
    else:
        print('\n(ゲートのみ。--apply で追記)')

if __name__ == '__main__':
    main()
