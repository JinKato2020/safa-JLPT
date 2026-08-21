# -*- coding: utf-8 -*-
"""情報検索 追加バッチ(サブエージェント出力)を joho_{N5,N4,N3}.json へマージ＋全数検証。
   入力: scratchpad/joho_gen/{N5_a,N5_b,N4_a,N4_b,N3_a,N3_b}.json (中間フォーマットの配列)
   中間item: {title,body,figure{kind,header,intro,blocks[],notes[],footer},q,choices[4],answer,explain,skeleton{...}}
     blocks: {"type":"table","columns":[],"rows":[[]]} / {"type":"notice","title","lines":[]} / {"type":"card","title","lines":[]}
   使い方: python tools/joho_merge_validate.py            # 検証レポートのみ(applyしない)
           python tools/joho_merge_validate.py --apply    # 検証OKなら joho_*.json へ書き込み
   id採番: 既存を温存し、新規は各レベルの続き番号(N5/N4は0011-、N3は0031-)を a→b の順で連番。"""
import os, re, json, sys, argparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GEN = os.path.join(ROOT, 'scratchpad', 'joho_gen')
BAND = {'N5': (200, 375), 'N4': (340, 460), 'N3': (510, 690)}  # N4/N3=目標±15%(2026-08-21)
START = {'N5': 11, 'N4': 11, 'N3': 11}  # 2026-08-21: N3を新方式10問へ差替済ゆえ続きは0011から
BATCHES = {'N5': ['N5_a', 'N5_b'], 'N4': ['N4_a', 'N4_b'], 'N3': ['N3_a', 'N3_b']}
Q_TYPES = {'選ぶ', '金額', '時刻', '対象者', '正誤', '手続き'}
FIGP = {'表のみ', '表+注記', 'プローズ', 'カード', '2表以上'}
MEDIA = {'案内', 'お知らせ', '広告', 'パンフレット', 'カレンダー', '時刻表', '料金表', '募集・申込'}

def strip_ruby(s):
    return re.sub(r'\s', '', re.sub(r'（[^）]*）', '', s or ''))

def eff_chars(it):
    def collect(v):
        if isinstance(v, str): return v
        if isinstance(v, list): return ''.join(collect(x) for x in v)
        if isinstance(v, dict): return ''.join(collect(x) for x in v.values())
        return ''
    return len(strip_ruby(collect(it.get('body')) + collect(it.get('figure'))))

def to_final(inter, idx, lv):
    _id = f"{lv}-D-J-{idx:04d}"
    fig = inter.get('figure', {})
    blocks = []
    for b in fig.get('blocks', []):
        t = b.get('type')
        if t == 'table':
            blocks.append({"type": "table", "table": {"columns": b.get('columns', []), "rows": b.get('rows', [])}})
        elif t == 'notice':
            blocks.append({"type": "notice", "title": b.get('title', ''), "lines": b.get('lines', [])})
        elif t == 'card':
            blocks.append({"type": "card", "title": b.get('title', ''), "lines": b.get('lines', [])})
    figure = {"kind": fig.get('kind', ''), "header": fig.get('header', ''), "intro": fig.get('intro', ''),
              "blocks": blocks, "notes": fig.get('notes', []), "footer": fig.get('footer', '')}
    return {"id": _id, "level": lv, "category": "dokkai", "type": "reading", "subtype": "joho",
            "title": inter.get('title', ''), "body": inter.get('body', ''), "figure": figure,
            "questions": [{"id": _id + "-q1", "q": inter.get('q', ''), "choices": inter.get('choices', []),
                           "answerIndex": inter.get('answer', 0), "i18n": {"ja": {"explain": inter.get('explain', '')}}}],
            "skeleton": inter.get('skeleton', {})}

def validate(it, lv, seen_titles, seen_choicesets):
    errs = []
    lo, hi = BAND[lv]
    c = eff_chars(it)
    if not (lo <= c <= hi): errs.append(f"band {c}∉[{lo},{hi}]")
    q = it['questions'][0]
    ch = q['choices']
    if len(ch) != 4: errs.append(f"choices={len(ch)}")
    elif len(set(ch)) != 4: errs.append("dup-choice")
    if not (isinstance(q['answerIndex'], int) and 0 <= q['answerIndex'] < 4): errs.append("answerIndex")
    if not q['i18n']['ja']['explain'].strip(): errs.append("no-explain")
    sk = it.get('skeleton', {})
    for k in ['q_type', 'notice', 'scene', 'figure_pattern', 'medium']:
        if not sk.get(k): errs.append(f"skeleton.{k}")
    if sk.get('q_type') and sk['q_type'] not in Q_TYPES: errs.append(f"q_type?{sk['q_type']}")
    if sk.get('figure_pattern') and sk['figure_pattern'] not in FIGP: errs.append(f"figp?{sk['figure_pattern']}")
    if sk.get('medium') and sk['medium'] not in MEDIA: errs.append(f"medium?{sk['medium']}")
    # figure_pattern と blocks の整合
    types = [b['type'] for b in it['figure']['blocks']]
    fp = sk.get('figure_pattern')
    ntab = types.count('table'); ncard = types.count('card'); nnote = types.count('notice')
    if fp == '表のみ' and not (ntab == 1 and nnote == 0 and ncard == 0): errs.append("fp!=表のみ")
    if fp == '表+注記' and not (ntab >= 1 and nnote >= 1): errs.append("fp!=表+注記")
    if fp == 'プローズ' and not (ntab == 0 and nnote >= 1 and ncard == 0): errs.append("fp!=プローズ")
    if fp == 'カード' and not (ncard >= 3): errs.append("fp!=カード")
    if fp == '2表以上' and not (ntab >= 2): errs.append("fp!=2表以上")
    tkey = strip_ruby(it['title'])
    if tkey in seen_titles: errs.append(f"dup-title:{tkey}")
    cs = tuple(sorted(ch))
    if cs in seen_choicesets: errs.append("dup-choiceset")
    return errs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    total_bad = 0
    apply_data = {}
    for lv in ['N5', 'N4', 'N3']:
        existing_path = os.path.join(ROOT, 'content', 'problems', 'dokkai', f'joho_{lv}.json')
        env = json.load(open(existing_path, encoding='utf-8'))
        seen_titles = set(strip_ruby(x['title']) for x in env['items'])
        seen_cs = set(tuple(sorted(x['questions'][0]['choices'])) for x in env['items'])
        inter = []
        for b in BATCHES[lv]:
            fp = os.path.join(GEN, b + '.json')
            if not os.path.exists(fp):
                print(f"  [MISSING] {b}.json"); continue
            arr = json.load(open(fp, encoding='utf-8'))
            print(f"  {b}.json: {len(arr)}件")
            inter += arr
        idx = START[lv]
        finals = []
        bad = 0
        for it_inter in inter:
            it = to_final(it_inter, idx, lv)
            errs = validate(it, lv, seen_titles, seen_cs)
            if errs:
                bad += 1; total_bad += 1
                print(f"    NG {it['id']} [{strip_ruby(it['title'])[:16]}] {'; '.join(errs)}")
            else:
                seen_titles.add(strip_ruby(it['title']))
                seen_cs.add(tuple(sorted(it['questions'][0]['choices'])))
            finals.append(it)
            idx += 1
        print(f"=== {lv}: 新規{len(finals)}問 (既存{len(env['items'])}) 不良{bad} ===")
        # apply用: 既存 + 新規(id置換)
        by = {x['id']: x for x in env['items']}
        for it in finals:
            by[it['id']] = it
        env['items'] = [by[k] for k in sorted(by)]
        apply_data[lv] = (existing_path, env, len(finals))
    print(f"\n合計不良 {total_bad}")
    if args.apply:
        if total_bad:
            print("不良があるため apply 中止。修正後に再実行。")
            sys.exit(1)
        for lv, (path, env, n) in apply_data.items():
            json.dump(env, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print(f"APPLIED {lv}: 計{len(env['items'])}問 -> {path}")

if __name__ == '__main__':
    main()
