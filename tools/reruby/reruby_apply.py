# -*- coding: utf-8 -*-
"""Opus校正の結果（furi）を content JSON に書き戻す。
使い方: python tools/reruby/reruby_apply.py <results.json> [<results2.json> ...]
  results.json = ワークフロー出力。{items:[{id:"itemId||loc", furi}]} でも [{id,furi}] でも可。
検算: furi から漢字直後の（かな）を全部剥がした文字列が prompt と1文字も違わないこと。
      違うものは**書き戻さない**（fails に記録）。安全側。
書き戻し後: tools\\publish-content.ps1 で _manifest.json 再生成→配信（別ステップ・手動）。
"""
import io, json, os, re, sys, glob

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
KANJI = r'一-鿿㐀-䶿々〆〇ヶ'
STRIP_RUBY = re.compile(r'(?<=[' + KANJI + r'])（[ぁ-ゖー]+）')
def strip_ruby(s):
    prev = None
    while prev != s:
        prev = s; s = STRIP_RUBY.sub('', s)
    return s

def set_loc(it, loc, val):
    if loc in ('script', 'body', 'passage', 'text', 'stem'):
        if loc not in it: return False
        it[loc] = val; return True
    m = re.match(r'^(q|qs|c)(\d+)(?:_(\d+))?$', loc)
    if not m: return False
    kind, qi, ci = m.group(1), int(m.group(2)), m.group(3)
    qs = it.get('questions') or []
    if qi >= len(qs): return False
    q = qs[qi]
    if kind == 'q':  q['q'] = val; return True
    if kind == 'qs': q['stem'] = val; return True
    if kind == 'c':
        ch = q.get('choices') or []
        ci = int(ci)
        if ci >= len(ch): return False
        ch[ci] = val; return True
    return False

def main():
    if len(sys.argv) < 2:
        print('usage: reruby_apply.py <results.json> [...]'); sys.exit(1)
    rows = json.load(io.open(os.path.join(HERE, 'rows.json'), encoding='utf-8'))
    prompt_of = {f"{r['id']}||{r['loc']}": r['prompt'] for r in rows}
    index = json.load(io.open(os.path.join(HERE, 'rows_index.json'), encoding='utf-8'))

    results = {}
    for rp in sys.argv[1:]:
        data = json.load(io.open(rp, encoding='utf-8'))
        items = data.get('items') if isinstance(data, dict) else data
        for r in items or []:
            results[r['id']] = r['furi']

    # 検算 → file 毎に (itemId, loc, furi) を集約
    fails = []; ok_keys = []; byfile = {}
    for key, furi in results.items():
        if key not in prompt_of:
            fails.append((key, 'unknown-id')); continue
        if strip_ruby(furi) != prompt_of[key]:
            fails.append((key, 'checksum-mismatch')); continue
        Id, loc = key.split('||', 1)
        rel = index.get(Id)
        if not rel:
            fails.append((key, 'no-file')); continue
        byfile.setdefault(rel, []).append((Id, loc, furi))
        ok_keys.append(key)
    missing_results = [k for k in prompt_of if k not in results]

    applied = 0
    for rel, edits in byfile.items():
        p = os.path.join(ROOT, rel)
        d = json.load(io.open(p, encoding='utf-8'))
        byid = {it.get('id'): it for it in d['items']}
        for Id, loc, furi in edits:
            it = byid.get(Id)
            if it is None: fails.append((f'{Id}||{loc}', 'item-gone')); continue
            if set_loc(it, loc, furi): applied += 1
            else: fails.append((f'{Id}||{loc}', 'bad-loc'))
        json.dump(d, io.open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)

    print(f'適用 {applied}件 / 対象 {len(prompt_of)}件')
    print(f'  検算OK={len(ok_keys)}  失敗={len(fails)}  結果未着={len(missing_results)}')
    if fails:
        fp = os.path.join(HERE, 'apply_fails.txt')
        io.open(fp, 'w', encoding='utf-8', newline='\n').write('\n'.join(f'{k}\t{why}' for k, why in fails))
        print('  失敗一覧 ->', fp)
    if missing_results:
        mp = os.path.join(HERE, 'apply_missing.txt')
        io.open(mp, 'w', encoding='utf-8', newline='\n').write('\n'.join(sorted(missing_results)))
        print('  結果未着 ->', mp, '(再ワークフローで補完)')
    print('次: tools\\publish-content.ps1 で _manifest.json 再生成→OTA配信（手動・別ステップ）')

if __name__ == '__main__':
    main()
