# -*- coding: utf-8 -*-
"""情報検索 新方式パイロット導入: 旧60問を没問題へ退避し、新10問(中間フォーマット)を live へ差し替え。
   対象=N3/N4 のみ(N5は据え置き)。live パスは bundled が静的importするため、パスは残して中身だけ差し替える。
   使い方: python tools/joho_install_new.py            # 検証のみ(書き込まない)
           python tools/joho_install_new.py --apply    # 検証OKなら退避＋差し替え
"""
import os, re, json, shutil, argparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LIVE = os.path.join(ROOT, 'content', 'problems', 'dokkai')
SRC = os.path.join(ROOT, 'scratchpad', 'joho_hard')
ARCHIVE = os.path.join(ROOT, '没問題', '情報検索_旧2_2026-08-21')
BAND = {'N4': (320, 600), 'N3': (480, 900)}
NEW = {'N3': 'N3_new.json', 'N4': 'N4_new.json'}
Q_TYPES = {'選ぶ', '金額', '時刻', '対象者', '正誤', '手続き'}

def strip_ruby(s):
    return re.sub(r'\s', '', re.sub(r'（[^）]*）', '', s or ''))

def collect(v):
    if isinstance(v, str): return v
    if isinstance(v, list): return ''.join(collect(x) for x in v)
    if isinstance(v, dict): return ''.join(collect(x) for x in v.values())
    return ''

def eff_chars(it):
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

def validate(it, lv, seen_titles, seen_cs):
    errs = []
    lo, hi = BAND[lv]
    c = eff_chars(it)
    if not (lo <= c <= hi): errs.append(f"band {c}")
    q = it['questions'][0]
    ch = q['choices']
    if len(ch) != 4: errs.append(f"choices={len(ch)}")
    elif len(set(ch)) != 4: errs.append("dup-choice")
    if not (isinstance(q['answerIndex'], int) and 0 <= q['answerIndex'] < 4): errs.append("answerIndex")
    if not q['i18n']['ja']['explain'].strip(): errs.append("no-explain")
    sk = it.get('skeleton', {})
    for k in ['q_type', 'notice', 'scene', 'figure_pattern', 'medium']:
        if not sk.get(k): errs.append(f"skeleton.{k}")
    types = [b['type'] for b in it['figure']['blocks']]
    if sk.get('figure_pattern') == '表+注記' and not (types.count('table') >= 1 and types.count('notice') >= 1):
        errs.append("fp!=表+注記")
    tkey = strip_ruby(it['title'])
    if tkey in seen_titles: errs.append(f"dup-title:{tkey}")
    seen_titles.add(tkey)
    cs = tuple(sorted(ch))
    if cs in seen_cs: errs.append("dup-choiceset")
    seen_cs.add(cs)
    return errs, c

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    plan = {}
    total_bad = 0
    for lv in ['N3', 'N4']:
        live = os.path.join(LIVE, f'joho_{lv}.json')
        env = json.load(open(live, encoding='utf-8'))
        old_n = len(env['items'])
        inter = json.load(open(os.path.join(SRC, NEW[lv]), encoding='utf-8'))
        seen_titles, seen_cs = set(), set()
        finals, bad = [], 0
        print(f"== {lv}: 旧{old_n}問 → 新{len(inter)}問")
        for i, itr in enumerate(inter, 1):
            it = to_final(itr, i, lv)
            errs, c = validate(it, lv, seen_titles, seen_cs)
            qt = it['skeleton'].get('q_type')
            if errs:
                bad += 1; total_bad += 1
                print(f"   NG {it['id']} [{strip_ruby(it['title'])[:14]}] {'; '.join(errs)}")
            else:
                print(f"   OK {it['id']} {c:4d}字 {qt:>3} ans={it['questions'][0]['answerIndex']} {strip_ruby(it['title'])[:16]}")
            finals.append(it)
        new_env = dict(env)
        new_env['items'] = finals
        plan[lv] = (live, env, new_env)
        print(f"   => 不良{bad}")
    print(f"\n合計不良 {total_bad}")
    if args.apply:
        if total_bad:
            print("不良ありのため中止。"); return
        os.makedirs(ARCHIVE, exist_ok=True)
        for lv, (live, old_env, new_env) in plan.items():
            arc = os.path.join(ARCHIVE, f'joho_{lv}.json')
            json.dump(old_env, open(arc, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            json.dump(new_env, open(live, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print(f"APPLIED {lv}: 退避 {len(old_env['items'])}問 -> {arc}")
            print(f"          差替 {len(new_env['items'])}問 -> {live}")
    else:
        print("(検証のみ。--apply で退避＋差し替え)")

if __name__ == '__main__':
    main()
