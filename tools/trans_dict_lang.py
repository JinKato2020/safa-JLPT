# 辞書コンテンツ(意味・例文・漢字グロス)を、指定した母語(lang)へ Gemini で一括翻訳し content/lexicon 上書き層へ書き込む。
# en/ne は既存(番人あり)。本ツールは bn/id/ko/my/th/vi/zh 等の追加言語用。
# 既存の ne overlay と「完全に同じ key 集合」を対象にする(= ne があるものだけ訳す=フル対応)。
# 元テキスト = ja(語/文/字) ＋ en(意味/英訳) を両方渡して精度を上げる。
#
# 4コーパス:
#   meaning      : content/lexicon/meaning_N*.json      key= 語彙id / 文法id / 漢字char。元= VOCAB/GRAMMAR/KANJI
#   kanjigloss   : content/lexicon/kanjigloss_N*.json   key= 例語(word)。元= kanjiCards の例語 gloss(en)
#   vocab_ex     : content/lexicon/example_N*.json       key= 語彙id。元= vocabExamplesAi(ja/en)
#   grammar_ex   : content/lexicon/exampleGrammar_N*.json key= 文法id。元= grammar(exampleJa/exampleEn)
#
# 使い方:
#   python tools/trans_dict_lang.py <lang> <corpus|all> --dry-run   # API無し。対象件数/元の突合率/概算費用
#   python tools/trans_dict_lang.py <lang> <corpus|all> --apply     # Gemini実行→キャッシュ保存(バッチ毎=再開可)
#   python tools/trans_dict_lang.py <lang> <corpus|all> --write     # キャッシュを overlay へ書込(langフィールド追記＋languages更新)
#   corpus = meaning | kanjigloss | vocab_ex | grammar_ex | all
# キャッシュ = scratchpad/pg/dictlang_<lang>_<corpus>.json  {key: 訳}
import os, re, sys, json, glob, urllib.request

# Windows既定のcp932だと集計print内の「≈」等でクラッシュ→all途中で中断する事故があった。stdoutをutf-8に固定。
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = 'gemini-2.5-flash'
KEY = os.environ.get('GEMINI_API_KEY', '')
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}'
BATCH = 40
RUBY = re.compile(r'（[ぁ-んァ-ヶー・]+）')
IN_PER_M, OUT_PER_M, YEN = 0.30, 2.50, 155.0
CORPORA = ['meaning', 'kanjigloss', 'vocab_ex', 'grammar_ex']
LANG_NAME = {'bn': 'Bengali', 'id': 'Indonesian', 'ko': 'Korean', 'my': 'Burmese (Myanmar)',
             'th': 'Thai', 'vi': 'Vietnamese', 'zh': 'Simplified Chinese'}
OVERLAY_KIND = {'meaning': 'meaning', 'kanjigloss': 'kanjigloss', 'vocab_ex': 'example', 'grammar_ex': 'exampleGrammar'}


def load(f): return json.load(open(f, encoding='utf-8'))
def dump(o, f): json.dump(o, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


# ---- 元テキストの索引 ----
def build_sources():
    S = {}
    vocab = load(os.path.join(ROOT, 'src/data/shared/vocab.json'))
    S['vocab'] = {v['id']: v for v in vocab}
    grammar = load(os.path.join(ROOT, 'src/data/shared/grammar.json'))
    S['grammar'] = {g['id']: g for g in grammar}
    kanji = load(os.path.join(ROOT, 'src/data/dict/kanji.json'))
    S['kanji'] = {k['char']: k for k in kanji}
    S['vocabex'] = load(os.path.join(ROOT, 'src/data/dict/vocabExamplesAi.json'))
    # 漢字カード例語 word -> en gloss(初出優先)
    kc = load(os.path.join(ROOT, 'src/data/words/kanjiCards.json'))
    wg = {}
    for _c, card in kc.items():
        for ln in card.get('readings', []):
            for ex in ln.get('examples', []):
                w = ex.get('word')
                if w and w not in wg:
                    wg[w] = {'reading': ex.get('reading', ''), 'gloss': ex.get('gloss', '')}
    S['wordgloss'] = wg
    return S


def overlay_files(corpus):
    kind = OVERLAY_KIND[corpus]
    return sorted(glob.glob(os.path.join(ROOT, f'content/lexicon/{kind}_N*.json')))


def src_text(corpus, key, S):
    """翻訳の元テキスト。無ければ None(=対象外)。"""
    if corpus == 'meaning':
        if '-v-' in key:
            v = S['vocab'].get(key)
            return f"{v['word']}（{v.get('reading','')}）= {v.get('meaning','')}" if v else None
        if '-g-' in key:
            g = S['grammar'].get(key)
            return f"{g['point']} = {g.get('meaning','')}" if g else None
        k = S['kanji'].get(key)  # 単字
        return f"漢字「{k['char']}」= {k.get('meaning','')}" if k else None
    if corpus == 'kanjigloss':
        wg = S['wordgloss'].get(key)
        return f"{key}（{wg['reading']}）= {wg['gloss']}" if wg else None
    if corpus == 'vocab_ex':
        e = S['vocabex'].get(key)
        if not e or not e.get('ja'):
            return None
        ja = RUBY.sub('', e['ja']).strip()
        return f"{ja}" + (f"  (EN: {e['en']})" if e.get('en') else '')
    if corpus == 'grammar_ex':
        g = S['grammar'].get(key)
        if not g or not g.get('exampleJa'):
            return None
        return f"{g['exampleJa']}" + (f"  (EN: {g.get('exampleEn','')})" if g.get('exampleEn') else '')
    return None


INSTR = {
    'meaning': 'You are a bilingual dictionary editor. Translate the MEANING (gloss) of each Japanese entry into natural, concise {L}. The Japanese term (with reading) and its English gloss are given. Output a short dictionary gloss in {L} (comma-separated senses if needed). Do NOT include the Japanese or English.',
    'kanjigloss': 'You are a bilingual dictionary editor. Give a short {L} gloss for the MEANING of each Japanese word. Its reading and English gloss are given. Output only the {L} gloss (concise, comma-separated senses).',
    'vocab_ex': 'Translate each Japanese example sentence into natural, faithful, learner-friendly {L}. An English translation is given in parentheses as a hint. Output only the {L} sentence.',
    'grammar_ex': 'Translate each Japanese example sentence into natural, faithful, learner-friendly {L}. An English translation is given in parentheses as a hint. Output only the {L} sentence.',
}


def collect(corpus, S):
    """[(key, level, src)] を overlay の key(=ne対象)全件から。"""
    out = []
    for f in overlay_files(corpus):
        d = load(f)
        lvl = d.get('level') or 'N3'
        for key in d.get('items', {}):
            s = src_text(corpus, key, S)
            out.append((key, lvl, s))
    return out


def gemini(pairs, corpus, lang):
    instr = INSTR[corpus].replace('{L}', LANG_NAME[lang])
    lines = [f'{i+1}. {s}' for i, (_k, _l, s) in enumerate(pairs)]
    prompt = (instr + ' Return ONLY a JSON object mapping the item number (as string) to the translated string.\n\n' + '\n'.join(lines))
    body = {'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'temperature': 0.2, 'thinkingConfig': {'thinkingBudget': 0}, 'responseMimeType': 'application/json', 'maxOutputTokens': 8192}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    txt = resp['candidates'][0]['content']['parts'][0]['text']
    um = resp.get('usageMetadata', {})
    obj = json.loads(txt); out = {}
    for i, (k, _l, _s) in enumerate(pairs):
        v = obj.get(str(i + 1))
        if isinstance(v, str) and v.strip():
            out[k] = v.strip()
    return out, um.get('promptTokenCount', 0), um.get('candidatesTokenCount', 0)


def cache_path(lang, corpus): return os.path.join(ROOT, 'scratchpad', 'pg', f'dictlang_{lang}_{corpus}.json')
def load_cache(lang, corpus):
    p = cache_path(lang, corpus); return load(p) if os.path.exists(p) else {}
def save_cache(lang, corpus, c):
    p = cache_path(lang, corpus); os.makedirs(os.path.dirname(p), exist_ok=True); dump(c, p)


def do_dry(lang, corpus, S):
    items = collect(corpus, S)
    have = [(k, l, s) for (k, l, s) in items if s]
    miss = [k for (k, l, s) in items if not s]
    chars = sum(len(s) for _k, _l, s in have)
    n = len(have); b = -(-n // BATCH)
    intok = b * 60 + int(chars / 2.5); outtok = int(n * 42)
    cost = intok / 1e6 * IN_PER_M + outtok / 1e6 * OUT_PER_M
    print(f'[dry] {lang}/{corpus} 対象={len(items)} 元あり={n} 元なし(skip)={len(miss)} 文字={chars} batch->{b} ≈ ${cost:.2f} ¥{cost*YEN:.0f}')
    if miss[:5]:
        print('   例(元なし):', miss[:5])
    return n, cost


def do_apply(lang, corpus, S):
    items = [(k, l, s) for (k, l, s) in collect(corpus, S) if s]
    cache = load_cache(lang, corpus)
    todo = [(k, l, s) for (k, l, s) in items if k not in cache]
    print(f'[apply] {lang}/{corpus} 未訳 {len(todo)}/{len(items)}', file=sys.stderr)
    tin = tout = done = 0

    def chunk(cs):
        nonlocal tin, tout, done
        try:
            out, pi, po = gemini(cs, corpus, lang); tin += pi; tout += po
            cache.update(out); done += len(out); save_cache(lang, corpus, cache)
            m = [c for c in cs if c[0] not in out]
            if m and len(cs) > 1: chunk(m)
        except Exception as e:
            if len(cs) == 1: print('  drop', cs[0][0], type(e).__name__, file=sys.stderr); return
            h = len(cs) // 2; chunk(cs[:h]); chunk(cs[h:])
    for b in range(0, len(todo), BATCH):
        chunk(todo[b:b + BATCH])
        if (b // BATCH) % 5 == 0: print(f'  ..{min(b+BATCH,len(todo))}/{len(todo)} done={done}', file=sys.stderr)
    cost = tin / 1e6 * IN_PER_M + tout / 1e6 * OUT_PER_M
    print(f'[apply] {lang}/{corpus} done={done} cache={len(cache)} 実測 in={tin} out={tout} ≈ ¥{cost*YEN:.0f}')
    return cost


def do_write(lang, corpus, S):
    cache = load_cache(lang, corpus)
    tot = 0
    for f in overlay_files(corpus):
        d = load(f); items = d.get('items', {}); n = 0
        for key, ent in items.items():
            if cache.get(key):
                ent[lang] = cache[key]; n += 1
        if n:
            langs = set(d.get('languages') or []); langs.add(lang); d['languages'] = sorted(langs)
            dump(d, f); tot += n
            print(f'  {os.path.basename(f)}: +{n}')
    print(f'[write] {lang}/{corpus} 追記 {tot}件')
    return tot


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('usage: trans_dict_lang.py <lang> <corpus|all> [--dry-run|--apply|--write]'); sys.exit(1)
    lang = sys.argv[1]; corpus = sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else '--dry-run'
    if lang not in LANG_NAME: print('lang:', ','.join(LANG_NAME)); sys.exit(1)
    corps = CORPORA if corpus == 'all' else [corpus]
    for c in corps:
        if c not in CORPORA: print('corpus:', ','.join(CORPORA), '| all'); sys.exit(1)
    if mode == '--apply' and not KEY: print('GEMINI_API_KEY 未設定'); sys.exit(1)
    S = build_sources()
    total = 0.0
    for c in corps:
        if mode == '--dry-run': _n, cost = do_dry(lang, c, S); total += cost
        elif mode == '--apply': total += do_apply(lang, c, S)
        elif mode == '--write': do_write(lang, c, S)
        else: print('mode: --dry-run|--apply|--write'); sys.exit(1)
    if mode in ('--dry-run', '--apply'):
        print(f'=== {lang} {corpus} 合計 ≈ ${total:.2f} ¥{total*YEN:.0f} ===')
