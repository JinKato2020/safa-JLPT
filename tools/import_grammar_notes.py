# サイト(app_website)の文法解説をアプリの「くわしい解説」用に取り込む(無料・ローカル)。
#  入力 = ../app_website/src/data/grammar/<id>.json(12言語訳済)。アプリ grammar.json と同じIDの点だけ採用。
#  出力 = web/grammar-notes/<lang>/<id>.json(日本語の形・例文＋その言語の解説だけ)
#        + src/data/grammarNoteIds.json(解説がある点のID一覧＝ボタン表示判定・同梱)
#  配信 = deploy-pages が web/grammar-notes を _site/grammar-notes へコピー(R2/github.io)。端末は開いた時だけ取得。
#  サイトの解説を更新したら再実行→コミット→push(配信はビルド不要)。
#  使い方: python tools/import_grammar_notes.py [--site ../app_website]
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ['ja', 'en', 'ne', 'bn', 'id', 'ko', 'my', 'th', 'vi', 'zh', 'zh2']  # アプリの表示11言語


def pick(d, lang):
    """言語別の値。無ければ en → ja の順に代用。"""
    if not isinstance(d, dict):
        return d
    for k in (lang, 'en', 'ja'):
        if d.get(k):
            return d[k]
    return None


# サイトの中国語(簡体)版は、解説中の日本語の語まで簡体字に化けている(例「书く」=正しくは「書く」)。
# 「漢字の並び＋かな」の日本語の語だけを日本の字体に戻す。戻した語が日本語版の文章に実在する時だけ採用(誤変換を防ぐ)。
JA_TEXT = ''
S2JA = {}


def build_zh_fix(srcs):
    global JA_TEXT
    import opencc
    t2s = opencc.OpenCC('t2s')
    JA_TEXT = '\n'.join(json.dumps([d.get('title', {}).get('ja'), d.get('summary', {}).get('ja'), d.get('body', {}).get('ja'),
                                     d.get('pitfalls', {}).get('ja'), d.get('patterns'), [e.get('ja') for e in d.get('examples', [])]],
                                    ensure_ascii=False) for d in srcs)
    cands = {}
    for ch in set(re.findall(r'[一-鿿]', JA_TEXT)):
        sc = t2s.convert(ch)
        if sc != ch:
            cands.setdefault(sc, []).append(ch)
    S2JA.update(cands)


def fix_zh(t):
    if not isinstance(t, str):
        return t

    def rep(m):
        run, kana = m.group(1), m.group(2)
        opts = ['']
        for ch in run:
            opts = [o + j for o in opts for j in S2JA.get(ch, [ch])][:16]
        for o in opts:
            if o != run and (o + kana[:1]) in JA_TEXT:
                return o + kana
        return m.group(0)
    return re.sub(r'([一-鿿]+)([぀-ヿ]+)', rep, t)


def zh_deep(v):
    if isinstance(v, str):
        return fix_zh(v)
    if isinstance(v, list):
        return [zh_deep(x) for x in v]
    if isinstance(v, dict):
        return {k: (x if k == 'ja' else zh_deep(x)) for k, x in v.items()}  # 例文の日本語(ja)は元から正しいので触らない
    return v


def note_for(src, lang):
    out = {
        'id': src['slug'],
        'title': pick(src.get('title'), lang),
        'summary': pick(src.get('summary'), lang),
        'patterns': [{'form': p.get('form', ''), 'gloss': pick(p.get('gloss'), lang)} for p in src.get('patterns', [])],
        'body': [{'h': b.get('h', ''), 'p': b.get('p', '')} for b in (pick(src.get('body'), lang) or [])],
        'examples': [],
        'pitfalls': pick(src.get('pitfalls'), lang) or [],
    }
    for e in src.get('examples', []):
        ex = {'ja': e.get('ja', ''), 'romaji': e.get('romaji', '')}
        if lang != 'ja':
            tr = e.get(lang) or e.get('en')
            if tr:
                ex['tr'] = tr
        note = pick(e.get('note'), lang)
        if note:
            ex['note'] = note
        out['examples'].append(ex)
    return zh_deep(out) if lang == 'zh' else out


def main():
    site = ROOT.parent / 'app_website'
    if '--site' in sys.argv:
        site = Path(sys.argv[sys.argv.index('--site') + 1])
    src_dir = site / 'src' / 'data' / 'grammar'
    app_ids = {g['id'] for g in json.loads((ROOT / 'src/data/shared/grammar.json').read_text(encoding='utf-8'))}
    out_dir = ROOT / 'web' / 'grammar-notes'
    for old in out_dir.rglob('*.json'):
        old.unlink()  # 消えた点の幽霊ファイルを残さない(フォルダは他プロセスが掴むと消せないのでファイルだけ消す)
    ids = []
    srcs = [json.loads(f.read_text(encoding='utf-8')) for f in sorted(src_dir.glob('*.json'))]
    srcs = [d for d in srcs if d.get('slug') in app_ids]  # サイト独自の入門ページ等はアプリに無い点なので取り込まない
    build_zh_fix(srcs)
    for src in srcs:
        ids.append(src['slug'])
        for lang in LANGS:
            p = out_dir / lang / f"{src['slug']}.json"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(note_for(src, lang), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    ids.sort()
    (ROOT / 'src/data/grammarNoteIds.json').write_text(json.dumps(ids, ensure_ascii=False) + '\n', encoding='utf-8')
    size = sum(p.stat().st_size for p in out_dir.rglob('*.json'))
    missing = sorted(app_ids - set(ids))
    print(f'取り込み {len(ids)}点 × {len(LANGS)}言語 = {len(ids) * len(LANGS)}ファイル / {size / 1e6:.1f}MB / 解説なし {len(missing)}点 {missing[:5]}')


if __name__ == '__main__':
    main()
