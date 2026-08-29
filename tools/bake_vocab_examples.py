# -*- coding: utf-8 -*-
"""入れ替え: 作り直した新文を「語彙単語の例題」として投入する（文脈規定は触らない）。

書き込み先（対象=filled_{N4,N5}.json の vocabId のみ）:
  1. src/data/dict/vocabExamplesAi.json   … [vid] = {ja: 完成文, en: 英訳}
  2. src/data/dict/vocabFurigana.json     … [vid] = ふりがな付き完成文（括弧除去で ja と一致を検算）
  3. content/lexicon/example_{LV}.json     … items[vid].ne = ネパール語訳（他言語は保持）

入力:
  - scratchpad/vocab_swap/filled_{LV}.json           （id, vocabId, answer, ja）
  - ルビ run（--ruby-n4 <runId> --ruby-n5 <runId>）  （id -> furi）
  - scratchpad/vocab_swap/out/{en,ne}/batch*.json    （id -> 訳）

使い方:
  python tools/bake_vocab_examples.py --ruby-n4 wf_xxx --ruby-n5 wf_yyy            # ドライラン
  python tools/bake_vocab_examples.py --ruby-n4 wf_xxx --ruby-n5 wf_yyy --write    # 書き込み
"""
import argparse, io, json, os, re, sys, glob
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, os.path.join(ROOT, 'data-build'))
from harvest_workflow import find_journal, harvest  # noqa: E402

STRIP = re.compile(r'[（(][^）)]*[）)]')
KANJI = re.compile(r'[㐀-鿿]')
SP = ('　', ' ', '\t')


def nospace(s):
    for c in SP:
        s = s.replace(c, '')
    return s


def respace(ja, furi):
    """furi＝ja にルビ(（よみ）)を足しスペースを詰めた文。ja の分かち書きスペースを furi に戻す。
    括弧を除いた非スペース列が ja の非スペース列と一致する時だけ成功。ダメなら None。"""
    out, j, n = [], 0, len(furi)
    for c in ja:
        if c in SP:
            out.append(c); continue
        if j < n and furi[j] == c:
            out.append(furi[j]); j += 1
            if j < n and furi[j] in ('（', '('):        # 直後のルビ群を丸ごと取り込む
                while j < n and furi[j] not in ('）', ')'):
                    out.append(furi[j]); j += 1
                if j < n:
                    out.append(furi[j]); j += 1
        else:
            return None
    return ''.join(out) if j == n else None


def load(p):
    return json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))


def ruby_map(runid):
    if not runid:
        return {}
    res, _, _ = harvest(find_journal(runid))
    d = {}
    for r in res.values():
        if isinstance(r, dict):
            for it in r.get('items') or []:
                if it.get('id') and it.get('furi'):
                    d[it['id']] = it['furi']
    return d


def trans_map(srcdir, lang):
    d = {}
    for fp in sorted(glob.glob(os.path.join(ROOT, f'scratchpad/{srcdir}/out/{lang}/batch*.json'))):
        for iid, tr in (json.load(io.open(fp, encoding='utf-8')).get('out') or {}).items():
            if tr:
                d[iid] = tr
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ruby-n4')
    ap.add_argument('--ruby-n5')
    ap.add_argument('--ruby-n3')
    ap.add_argument('--src-dir', default='vocab_swap', help='filled_{lv}.json と out/{en,ne} の置き場（scratchpad配下）')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()
    SRC = args.src_dir

    # SRC 内の filled_*.json すべてを対象（級非依存）
    filled = {}
    LEVELS = sorted(re.findall(r'filled_(N\d)\.json', ' '.join(os.listdir(os.path.join(ROOT, 'scratchpad', SRC)))))
    for lv in LEVELS:
        for x in load(f'scratchpad/{SRC}/filled_{lv}.json'):
            filled[x['id']] = {**x, 'level': lv}
    ruby = {**ruby_map(args.ruby_n4), **ruby_map(args.ruby_n5), **ruby_map(args.ruby_n3)}
    en, ne = trans_map(SRC, 'en'), trans_map(SRC, 'ne')
    print(f'対象={len(filled)}  ルビ={len(ruby)}  en訳={len(en)}  ne訳={len(ne)}')

    # 検算しながら各書き込みぶんを組む
    ex_ai = load('src/data/dict/vocabExamplesAi.json')
    furi_all = load('src/data/dict/vocabFurigana.json')
    lex = {lv: load(f'content/lexicon/example_{lv}.json') for lv in LEVELS}

    n_ja = n_en = n_ne = n_furi = 0
    furi_bad, en_miss, ne_miss = [], [], []
    for iid, x in filled.items():
        vid, ja, lv = x['vocabId'], x['ja'], x['level']
        # 1) ja
        prev = ex_ai.get(vid) if isinstance(ex_ai.get(vid), dict) else {}
        newrec = {**prev, 'ja': ja}
        # 2) en
        if en.get(iid):
            newrec['en'] = en[iid]; n_en += 1
        else:
            en_miss.append(iid)
        ex_ai[vid] = newrec; n_ja += 1
        # 3) furigana（漢字を含む文だけ・検算OKのみ）
        if KANJI.search(ja):
            f = ruby.get(iid)
            spaced = respace(ja, nospace(f)) if f else None    # ルビ側スペースを除去→jaのスペースを戻す
            if spaced and nospace(STRIP.sub('', spaced)) == nospace(ja):
                furi_all[vid] = spaced; n_furi += 1
            else:
                furi_bad.append((iid, vid, ja, f))
                furi_all.pop(vid, None)   # 古い（旧文の）ルビが残らないよう除去→素のjaで表示
        else:
            furi_all.pop(vid, None)       # かな文はルビ不要
        # 4) ne（lexicon）
        d = lex[lv]
        items = d.setdefault('items', {})
        if ne.get(iid):
            rec = items.get(vid) if isinstance(items.get(vid), dict) else {}
            items[vid] = {**rec, 'ne': ne[iid]}; n_ne += 1
        else:
            ne_miss.append(iid)

    print(f'\n=== 反映予定 ===')
    print(f'  ja(vocabExamplesAi) : {n_ja}')
    print(f'  en(vocabExamplesAi) : {n_en}  （欠={len(en_miss)}）')
    print(f'  ne(lexicon)         : {n_ne}  （欠={len(ne_miss)}）')
    print(f'  ふりがな(vocabFurigana): {n_furi}  （検算NG/欠={len(furi_bad)}=素のja表示）')
    if furi_bad[:3]:
        for iid, vid, ja, f in furi_bad[:3]:
            print(f'     furi NG {iid}/{vid}: ja={ja}\n              furi={f}')

    # サンプル
    sid = next(iter(filled))
    sx = filled[sid]
    print(f'\n  例 {sx["vocabId"]}: ja={sx["ja"]}')
    print(f'     furi={furi_all.get(sx["vocabId"], "(素のja)")}')
    print(f'     en={en.get(sid)}\n     ne={ne.get(sid)}')

    if not args.write:
        print('\n※ ドライラン。書き込むには --write。')
        return

    with io.open(os.path.join(ROOT, 'src/data/dict/vocabExamplesAi.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(ex_ai, f, ensure_ascii=False, indent=1)
    with io.open(os.path.join(ROOT, 'src/data/dict/vocabFurigana.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(furi_all, f, ensure_ascii=False, indent=1)
    for lv in LEVELS:
        with io.open(os.path.join(ROOT, f'content/lexicon/example_{lv}.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(lex[lv], f, ensure_ascii=False, indent=1)
    print('\n書き込み完了: vocabExamplesAi.json / vocabFurigana.json / lexicon/example_{N4,N5}.json')
    print('※ content/ を変更したので _manifest.json 再生成が必要。')


if __name__ == '__main__':
    main()
