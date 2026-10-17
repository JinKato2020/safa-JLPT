# 辞書コンテンツの「英語・ネパール語の欠落」を Gemini で埋める（ユーザー厳命 2026-09-03「すべてを満たして」）。
# 対象3種＋掃除1:
#   kanji_ne : 漢字の例語グロス(kanjiCards.json 例語1859)のうちネパール語が無い677語 → content/lexicon/kanjigloss_N{lvl}.json へ追記
#   vocab_en : 語彙例文(vocabExamplesAi.json)のうち英語が空の705件 → 同ファイルの en を埋める(src=要ビルド)
#   vocab_ne : 語彙例文のうちネパール語が無い89件 → content/lexicon/example_N{lvl}.json へ追記
#   orphan   : vocab.json に無い幽霊 n3-v-1005 の ne を example_N3.json から削除
# 使い方: python tools/trans_dict_fill.py <target> [--dry-run|--apply|--write]   (target: kanji_ne|vocab_en|vocab_ne|orphan)
#   キャッシュ = scratchpad/pg/dictfill_<target>.json
import os, re, sys, json, glob, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = 'gemini-2.5-flash'
KEY = os.environ.get('GEMINI_API_KEY', '')
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}'
BATCH = 40
RUBY = re.compile(r'（[ぁ-んァ-ヶー]+）')
IN_PER_M, OUT_PER_M, YEN = 0.30, 2.50, 155.0


def load(f): return json.load(open(f, encoding='utf-8'))
def dump(o, f): json.dump(o, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
def lvl(i):
    m = re.match(r'n(\d)', i); return 'N' + m.group(1) if m else 'N3'


# ---- 欠落収集 ----
def collect(target):
    kc = load(os.path.join(ROOT, 'src/data/words/kanjiCards.json'))
    if target == 'kanji_ne':
        ne = {}
        for f in glob.glob(os.path.join(ROOT, 'content/lexicon/kanjigloss_*.json')): ne.update(load(f)['items'])
        seen = {}; out = []
        for c, card in kc.items():
            for ln in card.get('readings', []):
                for ex in ln.get('examples', []):
                    w = ex.get('word')
                    if not w or w in seen: continue
                    seen[w] = 1
                    if not (ne.get(w) or {}).get('ne'):
                        # 文脈: 語（読み）— 英語gloss を渡してネパール語gloss を得る
                        ctx = f"{w}（{ex.get('reading','')}） — {ex.get('gloss','')}"
                        out.append((w, ctx, card.get('level', 'N3')))
        return out  # [(key=word, src, level)]
    vex = load(os.path.join(ROOT, 'src/data/dict/vocabExamplesAi.json'))
    if target == 'vocab_en':
        return [(i, RUBY.sub('', vex[i].get('ja', '')).strip(), lvl(i)) for i in vex if not (vex[i].get('en') or '').strip() and vex[i].get('ja')]
    if target == 'vocab_ne':
        neex = {}
        for f in glob.glob(os.path.join(ROOT, 'content/lexicon/example_*.json')): neex.update(load(f)['items'])
        return [(i, RUBY.sub('', vex[i].get('ja', '')).strip(), lvl(i)) for i in vex if i not in neex and vex[i].get('ja')]
    return []


FIELD = {'kanji_ne': 'ne', 'vocab_en': 'en', 'vocab_ne': 'ne'}
INSTR = {
    'kanji_ne': 'Translate the MEANING of each Japanese word into natural Nepali (ne). The reading and an English gloss are given to disambiguate the sense. Keep it short (a dictionary gloss, comma-separated senses).',
    'vocab_en': 'Translate each Japanese example sentence into natural English (en). Faithful and learner-friendly.',
    'vocab_ne': 'Translate each Japanese example sentence into natural Nepali (ne). Faithful and learner-friendly.',
}


def gemini(pairs, target):
    fld = FIELD[target]
    lines = [f'{i+1}. {s}' for i, (_k, s, _l) in enumerate(pairs)]
    prompt = (INSTR[target] + f' Return ONLY a JSON object mapping the item number (as string) to {{"{fld}":...}}.\n\n' + '\n'.join(lines))
    body = {'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'temperature': 0.2, 'thinkingConfig': {'thinkingBudget': 0}, 'responseMimeType': 'application/json', 'maxOutputTokens': 8192}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    txt = resp['candidates'][0]['content']['parts'][0]['text']
    um = resp.get('usageMetadata', {})
    obj = json.loads(txt); out = {}
    for i, (k, _s, _l) in enumerate(pairs):
        e = obj.get(str(i + 1)) or {}
        if e.get(fld): out[k] = e[fld].strip()
    return out, um.get('promptTokenCount', 0), um.get('candidatesTokenCount', 0)


def cache_path(t): return os.path.join(ROOT, 'scratchpad', 'pg', f'dictfill_{t}.json')
def load_cache(t):
    p = cache_path(t); return load(p) if os.path.exists(p) else {}
def save_cache(t, c):
    p = cache_path(t); os.makedirs(os.path.dirname(p), exist_ok=True); dump(c, p)


def do_dry(t):
    items = collect(t); n = len(items); ch = sum(len(s) for _k, s, _l in items)
    b = -(-n // BATCH); intok = b * 60 + n * 30; outtok = n * 40
    cost = intok / 1e6 * IN_PER_M + outtok / 1e6 * OUT_PER_M
    print(f'[dry] {t} 欠落={n} 文字={ch} batch{BATCH}->{b}回 概算 ${cost:.2f} ≈ ¥{cost*YEN:.0f}')


def do_apply(t):
    items = collect(t); cache = load_cache(t)
    todo = [(k, s, l) for (k, s, l) in items if k not in cache]
    print(f'[apply] {t} 未訳 {len(todo)}/{len(items)}', file=sys.stderr)
    tin = tout = done = 0
    def chunk(cs):
        nonlocal tin, tout, done
        try:
            out, pi, po = gemini(cs, t); tin += pi; tout += po
            for k, v in out.items(): cache[k] = v
            done += len(out); save_cache(t, cache)
            miss = [c for c in cs if c[0] not in out]
            if miss and len(cs) > 1: chunk(miss)
        except Exception as e:
            if len(cs) == 1: print('  drop', cs[0][0], type(e).__name__, file=sys.stderr); return
            m = len(cs) // 2; chunk(cs[:m]); chunk(cs[m:])
    for b in range(0, len(todo), BATCH):
        chunk(todo[b:b + BATCH])
        if (b // BATCH) % 5 == 0: print(f'  ..{b+BATCH}/{len(todo)} done={done}', file=sys.stderr)
    cost = tin / 1e6 * IN_PER_M + tout / 1e6 * OUT_PER_M
    print(f'[apply] {t} done={done} cache={len(cache)} 実測 in={tin} out={tout} ≈ ¥{cost*YEN:.0f}')


def do_write(t):
    cache = load_cache(t); items = collect(t)
    if t == 'vocab_en':
        p = os.path.join(ROOT, 'src/data/dict/vocabExamplesAi.json'); d = load(p); n = 0
        for k, _s, _l in items:
            if cache.get(k): d[k]['en'] = cache[k]; n += 1
        dump(d, p); print(f'[write] vocab_en {n}件 → {p}')
        return
    # ne 系: レベル別ファイルへ追記
    kind = 'kanjigloss' if t == 'kanji_ne' else 'example'
    bylvl = {}
    for k, _s, l in items:
        if cache.get(k): bylvl.setdefault(l, {})[k] = {'ne': cache[k]}
    tot = 0
    for l, add in bylvl.items():
        p = os.path.join(ROOT, f'content/lexicon/{kind}_{l}.json')
        d = load(p); d['items'].update(add); tot += len(add)
        langs = set(d.get('languages') or []); langs.add('ne'); d['languages'] = sorted(langs)
        dump(d, p); print(f'  {kind}_{l}: +{len(add)}')
    print(f'[write] {t} 追記 {tot}件')


def do_orphan(mode):
    p = os.path.join(ROOT, 'content/lexicon/example_N3.json'); d = load(p)
    if 'n3-v-1005' in d['items']:
        if mode == '--write':
            del d['items']['n3-v-1005']; dump(d, p); print('[orphan] n3-v-1005 を example_N3.json から削除')
        else:
            print('[orphan] n3-v-1005 が存在（--write で削除）')
    else:
        print('[orphan] n3-v-1005 なし（掃除済）')


if __name__ == '__main__':
    t = sys.argv[1] if len(sys.argv) > 1 else ''
    mode = sys.argv[2] if len(sys.argv) > 2 else '--dry-run'
    if t == 'orphan': do_orphan(mode); sys.exit(0)
    if t not in FIELD: print('target: kanji_ne|vocab_en|vocab_ne|orphan'); sys.exit(1)
    if not KEY and mode == '--apply': print('GEMINI_API_KEY 未設定'); sys.exit(1)
    {'--dry-run': do_dry, '--apply': do_apply, '--write': do_write}[mode](t)
