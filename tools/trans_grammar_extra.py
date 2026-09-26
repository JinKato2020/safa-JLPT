# 文法辞書の「追加例文」(src/data/shared/grammarExtra.json)の tr(多言語訳)を Gemini で一括翻訳する。
# 本例文の翻訳(exampleGrammar_N*.json)は trans_dict_lang.py が担当。本ツールは grammarExtra.json 専用(tr を埋める)。
#   元テキスト = ja(ルビ除去) ＋ en(英訳ヒント)。訳先 = ne/id/bn/ko/my/th/vi/zh/hi(Gemini) ＋ zh2(zhからOpenCC)。
#   保存先 = grammarExtra.json の各例文 tr{lang}。UI(BrowseScreen)は l1 訳→無ければ en にフォールバック。
# 使い方:
#   python tools/trans_grammar_extra.py --dry-run          # API無し。対象件数と概算費用(円)
#   python tools/trans_grammar_extra.py --apply            # Gemini実行→キャッシュ(バッチ毎=再開可)
#   python tools/trans_grammar_extra.py --write            # キャッシュを grammarExtra.json の tr へ書込(zh2=OpenCCも)
#   [--lang ne,id,...] で言語を限定(既定=全9言語)。
import os, re, sys, json, urllib.request

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEXTRA = os.path.join(ROOT, 'src/data/shared/grammarExtra.json')
MODEL = 'gemini-2.5-flash'
KEY = os.environ.get('GEMINI_API_KEY', '')
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}'
BATCH = 40
RUBY = re.compile(r'（[ぁ-んァ-ヶー・]+）')
IN_PER_M, OUT_PER_M, YEN = 0.30, 2.50, 155.0
# Gemini で訳す9言語。zh2 は zh から OpenCC(繁体)で機械変換する(APIに投げない)。
LANG_NAME = {'ne': 'Nepali', 'id': 'Indonesian', 'bn': 'Bengali', 'ko': 'Korean',
             'my': 'Burmese (Myanmar)', 'th': 'Thai', 'vi': 'Vietnamese',
             'zh': 'Simplified Chinese', 'hi': 'Hindi'}
GEMINI_LANGS = list(LANG_NAME.keys())
INSTR = ('Translate each Japanese example sentence into natural, faithful, learner-friendly {L}. '
         'An English translation is given in parentheses as a hint. Output only the {L} sentence. '
         'Return ONLY a JSON object mapping the item number (as string) to the translated string.')


def load(f): return json.load(open(f, encoding='utf-8'))
def dump(o, f): json.dump(o, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


def examples():
    """[(key, ja_plain, en)] 全追加例文。key=f'{pid}#{idx}'。"""
    d = load(GEXTRA)
    out = []
    for pid, arr in d.items():
        for i, ex in enumerate(arr):
            ja = RUBY.sub('', ex.get('ja', '')).strip()
            if ja:
                out.append((f'{pid}#{i}', ja, ex.get('en', '')))
    return out


def gemini(pairs, lang):
    instr = INSTR.replace('{L}', LANG_NAME[lang])
    lines = [f'{i+1}. {ja}' + (f'  (EN: {en})' if en else '') for i, (_k, ja, en) in enumerate(pairs)]
    prompt = instr + '\n\n' + '\n'.join(lines)
    body = {'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'temperature': 0.2, 'thinkingConfig': {'thinkingBudget': 0},
                                 'responseMimeType': 'application/json', 'maxOutputTokens': 8192}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode('utf-8'),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    txt = resp['candidates'][0]['content']['parts'][0]['text']
    um = resp.get('usageMetadata', {})
    obj = json.loads(txt); out = {}
    for i, (k, _ja, _en) in enumerate(pairs):
        v = obj.get(str(i + 1))
        if isinstance(v, str) and v.strip():
            out[k] = v.strip()
    return out, um.get('promptTokenCount', 0), um.get('candidatesTokenCount', 0)


def cache_path(lang): return os.path.join(ROOT, 'scratchpad', 'pg', f'gextra_{lang}.json')
def load_cache(lang):
    p = cache_path(lang); return load(p) if os.path.exists(p) else {}
def save_cache(lang, c):
    p = cache_path(lang); os.makedirs(os.path.dirname(p), exist_ok=True); dump(c, p)


def dry_run(langs):
    exs = examples()
    print(f'追加例文 total = {len(exs)} 件')
    est_in = est_out = 0
    for lang in langs:
        c = load_cache(lang)
        miss = [e for e in exs if e[0] not in c]
        # 概算: 入力=(指示~60t + 各文~40t)、出力=各訳~28t
        n = len(miss); nb = (n + BATCH - 1) // BATCH
        est_in += nb * 60 + n * 40
        est_out += n * 28
        print(f'  {lang:3} 未訳 {n:4} / {len(exs)}  (cache {len(c)})')
    yen = (est_in / 1e6 * IN_PER_M + est_out / 1e6 * OUT_PER_M) * YEN
    print(f'zh2 = zh から OpenCC 変換(API課金なし)')
    print(f'概算トークン in≈{est_in:,} out≈{est_out:,}  → 概算費用 ≈ ¥{yen:.0f} (${yen/YEN:.3f}, {MODEL})')


def apply(langs):
    if not KEY:
        print('GEMINI_API_KEY 未設定'); sys.exit(1)
    exs = examples()
    for lang in langs:
        c = load_cache(lang)
        miss = [e for e in exs if e[0] not in c]
        print(f'[{lang}] 未訳 {len(miss)} を翻訳…')
        for i in range(0, len(miss), BATCH):
            batch = miss[i:i + BATCH]
            got, pin, pout = gemini(batch, lang)
            c.update(got); save_cache(lang, c)
            print(f'  {lang} {i+len(batch)}/{len(miss)}  (+{len(got)})')
    print('完了(--write で grammarExtra.json へ反映)')


def write(langs):
    d = load(GEXTRA)
    caches = {lang: load_cache(lang) for lang in langs}
    # OpenCC(zh→zh2)。無ければ zh2 はスキップ(後で入れられる)。
    cc = None
    try:
        from opencc import OpenCC
        cc = OpenCC('s2twp')
    except Exception:
        print('※ opencc 未導入 → zh2 はスキップ(pip install opencc-python-reimplemented で後追い可)')
    filled = {lang: 0 for lang in langs}; z2 = 0
    for pid, arr in d.items():
        for i, ex in enumerate(arr):
            key = f'{pid}#{i}'
            tr = ex.setdefault('tr', {})
            for lang in langs:
                v = caches[lang].get(key)
                if v:
                    tr[lang] = v; filled[lang] += 1
            if cc and tr.get('zh'):
                tr['zh2'] = cc.convert(tr['zh']); z2 += 1
    dump(d, GEXTRA)
    print('書込:', ', '.join(f'{k}={v}' for k, v in filled.items()), f'zh2={z2}')
    print('→', GEXTRA)


if __name__ == '__main__':
    args = sys.argv[1:]
    langs = GEMINI_LANGS
    if '--lang' in args:
        langs = args[args.index('--lang') + 1].split(',')
    if '--apply' in args: apply(langs)
    elif '--write' in args: write(langs)
    else: dry_run(langs)
