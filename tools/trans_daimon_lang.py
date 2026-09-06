# 各大問の「本文対訳」を"単一の追加言語"(既定 id=インドネシア語)で作り、content JSON の i18n[lang] へ
# **マージ追記のみ**する。en/ne/ja と languages 配列は絶対に壊さない(上書きしない)。
#   ※ en/ne は既存 tools/trans_daimon.py の担当(番人 passageTransNe/explainTransPolicy 依存)。本ツールは触らない。
#
# 対象大問(ユーザー確定 2026-09-06「読解・文章の文法も含め本当に全部」):
#   非聴解5: context / order / synonym / usage / grammar_form   (trans_daimon の抽出器を再利用)
#   聴解5  : kadai / point / gaiyou / hatsuwa / sokuji           (questions[0] のみ・既存踏襲)
#   読解3  : naiyou_tan / naiyou_chu / choubun (dokkai)          (item.body 1長文 + 各設問 q+choices)
#   文法1  : passage_grammar                                     (passages 各本文[空所【n】保持] + 各設問 choices)
#   ※ joho(情報検索) は en/ne 自体が無い(commit a21dcef9 で明示除外)ため id も除外。
#
# 使い方:
#   python tools/trans_daimon_lang.py <daimon> --dry-run [--lang id]
#   python tools/trans_daimon_lang.py <daimon> --apply   [--lang id]   # Gemini→cache(バッチ毎保存=再開可)
#   python tools/trans_daimon_lang.py <daimon> --write   [--lang id]   # cache を content JSON の i18n[lang] へマージ
#   python tools/trans_daimon_lang.py ALL      --dry-run [--lang id]   # 全対象を集計
# cache = scratchpad/pg/trans_<daimon>_<lang>_cache.json  {f"{id}\x01{field}": "訳文"}。--apply は既訳キーをスキップ。
import os, sys, json, glob, urllib.request
import trans_daimon as td  # 抽出器(context_texts等)・RUBY/BLANK/NL/_shape/SEP を再利用

ROOT = td.ROOT
KEY = os.environ.get('GEMINI_API_KEY', '')
URL = td.URL
BATCH = 25
MAXOUT = 16384
IN_PER_M, OUT_PER_M, YEN = td.IN_PER_M, td.OUT_PER_M, td.YEN
SEP = td.SEP
RUBY = td.RUBY

LANGNAME = {'id': 'Indonesian', 'th': 'Thai', 'vi': 'Vietnamese', 'ko': 'Korean',
            'zh': 'Chinese (Simplified)', 'bn': 'Bengali', 'my': 'Burmese'}

def deruby(s):
    return RUBY.sub('', s or '').strip()

# ── 抽出: daimon -> [(id, {field: ja})] ──────────────────────────────
# **/ で学習(dokkai/*.json)＋模試プール(dokkai/mock/*.json)の両方を拾う(en/ne は模試も訳済み=同カバレッジに揃える)。
DOKKAI = {'naiyou_tan': 'content/problems/dokkai/**/naiyou_tan_*.json',
          'naiyou_chu': 'content/problems/dokkai/**/naiyou_chu_*.json',
          'choubun':    'content/problems/dokkai/**/choubun_*.json'}
PGRAM = 'content/problems/bunpou/passage_grammar_*.json'
KADAI_FAM = ('kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji')

def family(daimon):
    if daimon in td.DAIMON:
        if daimon in KADAI_FAM: return 'kadai'
        return td.DAIMON[daimon].get('kind', 'single')  # 'single' or 'struct'
    if daimon in DOKKAI: return 'dokkai'
    if daimon == 'passage_grammar': return 'pgram'
    return None

def glob_for(daimon):
    if daimon in td.DAIMON: return td.DAIMON[daimon]['glob']
    if daimon in DOKKAI: return DOKKAI[daimon]
    if daimon == 'passage_grammar': return PGRAM
    return None

def files_for(daimon):
    return sorted(glob.glob(os.path.join(ROOT, glob_for(daimon)), recursive=True))

def extract_item(daimon, it):
    fam = family(daimon)
    if fam in ('single', 'struct'):
        return dict(td.DAIMON[daimon]['texts'](it))       # {field: ja}
    if fam == 'kadai':
        return dict(td.kadai_texts(it))                   # {script,q,c0..}
    if fam == 'dokkai':
        t = {}
        b = deruby(it.get('body', ''))
        if b: t['body'] = b
        for qi, q in enumerate(it.get('questions') or []):
            qq = deruby(q.get('q', ''))
            if qq: t[f'q{qi}'] = qq
            for ci, c in enumerate(q.get('choices') or []):
                cc = deruby(c)
                if cc: t[f'q{qi}c{ci}'] = cc
        return t
    if fam == 'pgram':
        t = {}
        for pi, p in enumerate(it.get('passages') or []):
            pb = deruby(p.get('body', ''))                 # 空所【n】は残す(ふりがなのみ除去)
            if pb: t[f'b{pi}'] = pb
        for qi, q in enumerate(it.get('questions') or []):
            for ci, c in enumerate(q.get('choices') or []):
                cc = deruby(c)
                if cc: t[f'q{qi}c{ci}'] = cc
        return t
    return {}

def load_items(daimon):
    items = []
    for f in files_for(daimon):
        d = json.load(open(f, encoding='utf-8'))
        for it in d['items']:
            t = extract_item(daimon, it)
            if t: items.append((it['id'], t))
    return items

# ── cache ────────────────────────────────────────────────────────────
def cache_path(daimon, lang):
    return os.path.join(ROOT, 'scratchpad', 'pg', f'trans_{daimon}_{lang}_cache.json')

def load_cache(daimon, lang):
    p = cache_path(daimon, lang)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}

def save_cache(daimon, lang, cache):
    p = cache_path(daimon, lang)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(cache, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

# ── Gemini(単一lang・番号→訳文の平JSON) ───────────────────────────────
def gemini_batch(pairs, lang):
    langname = LANGNAME.get(lang, lang)
    lines = [f'{i+1}. {ja}' for i, (_k, ja) in enumerate(pairs)]
    prompt = (
        f'You are a professional translator for a JLPT learning app. Translate each Japanese line '
        f'into natural {langname}. Keep it faithful and learner-friendly. '
        f'Preserve any placeholder markers EXACTLY as they appear (e.g. 【1】, ⏎, 〔　〕). '
        f'Return ONLY a JSON object mapping the line number (as string) to its {langname} translation string.\n\n'
        + '\n'.join(lines)
    )
    body = {'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'temperature': 0.2, 'thinkingConfig': {'thinkingBudget': 0},
                                 'responseMimeType': 'application/json', 'maxOutputTokens': MAXOUT}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode('utf-8'),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    txt = resp['candidates'][0]['content']['parts'][0]['text']
    um = resp.get('usageMetadata', {})
    obj = json.loads(txt)
    out = {}
    for i, (k, _ja) in enumerate(pairs):
        v = obj.get(str(i + 1))
        if isinstance(v, str) and v.strip():
            out[k] = v.strip()
    return out, um.get('promptTokenCount', 0), um.get('candidatesTokenCount', 0)

# ── dry-run / apply ───────────────────────────────────────────────────
def do_dry_run(daimon, lang):
    items = load_items(daimon)
    cache = load_cache(daimon, lang)
    flat = [(f'{i}{SEP}{fk}', ja) for (i, t) in items for fk, ja in t.items() if f'{i}{SEP}{fk}' not in cache]
    chars = sum(len(v) for _k, v in flat)
    batches = -(-len(flat) // BATCH) if flat else 0
    in_tok = batches * 60 + int(chars * 0.9)       # 日本語≈0.9tok/字 + 命令
    out_tok = int(chars * 1.1)                     # id 訳出力の概算
    cost = in_tok / 1e6 * IN_PER_M + out_tok / 1e6 * OUT_PER_M
    print(f'[dry-run] {daimon}({lang}) files={len(files_for(daimon))} items={len(items)} '
          f'未訳ユニット={len(flat)} 文字={chars:,} batch={BATCH}->{batches}回 '
          f'概算 in≈{in_tok:,} out≈{out_tok:,}tok ≈ ${cost:.2f} ≈ ¥{cost*YEN:.0f}')
    return len(flat), chars, cost

def do_apply(daimon, lang):
    items = load_items(daimon)
    cache = load_cache(daimon, lang)
    flat = [(f'{i}{SEP}{fk}', ja) for (i, t) in items for fk, ja in t.items() if f'{i}{SEP}{fk}' not in cache]
    print(f'[apply] {daimon}({lang}) 未訳 {len(flat)} ユニットを翻訳...', file=sys.stderr)
    tin = tout = 0; done = 0; failed = 0

    def translate_chunk(chunk):
        nonlocal tin, tout
        try:
            out, pi, po = gemini_batch(chunk, lang)
            tin += pi; tout += po
            for k, tr in out.items():
                cache[k] = tr
            save_cache(daimon, lang, cache)
            miss = [c for c in chunk if c[0] not in out]
            if miss and len(chunk) > 1:
                g2, f2 = translate_chunk(miss)
                return len(out) + g2, f2
            return len(out), len(miss)
        except Exception as e:
            if len(chunk) == 1:
                print(f'  drop {chunk[0][0]} {type(e).__name__}', file=sys.stderr)
                return 0, 1
            mid = len(chunk) // 2
            g1, f1 = translate_chunk(chunk[:mid])
            g2, f2 = translate_chunk(chunk[mid:])
            return g1 + g2, f1 + f2

    for b in range(0, len(flat), BATCH):
        chunk = flat[b:b + BATCH]
        g, f = translate_chunk(chunk)
        done += g; failed += f
        if (b // BATCH) % 10 == 0:
            print(f'  ...{b+len(chunk)}/{len(flat)} done={done} fail={failed}', file=sys.stderr)
    cost = tin / 1e6 * IN_PER_M + tout / 1e6 * OUT_PER_M
    print(f'[apply] {daimon}({lang}) 完了 done={done} failed={failed} cache={len(cache)} '
          f'実測 in={tin:,} out={tout:,}tok ≈ ${cost:.3f} ≈ ¥{cost*YEN:.0f}')
    if failed:
        print(f'  ※ 未完 {failed} 件。--apply 再実行で残りだけ(既訳スキップ)。', file=sys.stderr)

# ── write(マージ: i18n[lang] を追記・他langは温存) ─────────────────────
def _set_lang(obj, lang, value):
    i = obj.get('i18n') or {}
    i[lang] = value
    obj['i18n'] = i

def do_write(daimon, lang):
    fam = family(daimon)
    cache = load_cache(daimon, lang)
    files = files_for(daimon)
    total = wrote = missing = 0
    for f in files:
        d = json.load(open(f, encoding='utf-8')); changed = False
        for it in d['items']:
            total += 1
            tr = {fk.split(SEP, 1)[1]: v for fk, v in cache.items() if fk.startswith(it['id'] + SEP)}
            texts = extract_item(daimon, it)
            if not texts:
                continue
            if any(fk not in tr for fk in texts):   # このitemは未完→スキップ(再開可)
                missing += 1; continue
            if fam == 'single':
                field = td.DAIMON[daimon].get('field', 'prompt')
                i = it.get('i18n') or {}
                i.setdefault(lang, {})[field] = tr[field]
                it['i18n'] = i
            elif fam == 'struct':
                _set_lang(it, lang, td._shape(tr))
            elif fam == 'kadai':
                q0 = (it.get('questions') or [{}])[0]
                _set_lang(it, lang, {'body': _to_lines(tr['script'])} if 'script' in tr else {})
                cidx = sorted(int(k[1:]) for k in tr if k.startswith('c') and k[1:].isdigit())
                qv = {'choices': [tr[f'c{i}'] for i in cidx]}
                if 'q' in tr: qv['q'] = tr['q']
                _set_lang(q0, lang, qv)
            elif fam == 'dokkai':
                _set_lang(it, lang, {'body': [tr['body']]} if 'body' in tr else {'body': []})
                for qi, q in enumerate(it.get('questions') or []):
                    cidx = sorted(int(k[len(f'q{qi}c'):]) for k in tr if k.startswith(f'q{qi}c'))
                    qv = {'choices': [tr[f'q{qi}c{ci}'] for ci in cidx]}
                    if f'q{qi}' in tr: qv['q'] = tr[f'q{qi}']
                    _set_lang(q, lang, qv)
            elif fam == 'pgram':
                bidx = sorted(int(k[1:]) for k in tr if k.startswith('b') and k[1:].isdigit())
                _set_lang(it, lang, {'body': [tr[f'b{pi}'] for pi in bidx]})
                for qi, q in enumerate(it.get('questions') or []):
                    cidx = sorted(int(k[len(f'q{qi}c'):]) for k in tr if k.startswith(f'q{qi}c'))
                    _set_lang(q, lang, {'choices': [tr[f'q{qi}c{ci}'] for ci in cidx]})
            wrote += 1; changed = True
        if changed:
            langs = sorted({l for it in d['items'] for l in (it.get('i18n') or {})})
            if lang not in langs: langs.append(lang); langs = sorted(langs)
            d['languages'] = langs
            json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'[write] {daimon}({lang}) files={len(files)} items={total} 書込={wrote} 未訳スキップ={missing}')
    if missing:
        print(f'  ※ {missing} 件がキャッシュ未完。先に --apply を完走させること。')

def _to_lines(s):
    s = (s or '').replace(' ⏎ ', '\n').replace('⏎', '\n')
    return [ln.strip() for ln in s.split('\n') if ln.strip()]

ALL = ['context', 'order', 'synonym', 'usage', 'grammar_form',
       'kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji',
       'naiyou_tan', 'naiyou_chu', 'choubun', 'passage_grammar']

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('usage: python tools/trans_daimon_lang.py <daimon|ALL> [--dry-run|--apply|--write] [--lang id]'); sys.exit(1)
    daimon, mode = sys.argv[1], sys.argv[2]
    lang = 'id'
    if '--lang' in sys.argv:
        lang = sys.argv[sys.argv.index('--lang') + 1]
    if mode == '--apply' and not KEY:
        print('GEMINI_API_KEY 未設定'); sys.exit(1)
    targets = ALL if daimon == 'ALL' else [daimon]
    if daimon != 'ALL' and family(daimon) is None:
        print(f'unknown daimon: {daimon}  (対象: {", ".join(ALL)})'); sys.exit(1)
    fn = {'--dry-run': do_dry_run, '--apply': do_apply, '--write': do_write}[mode]
    if daimon == 'ALL' and mode == '--dry-run':
        tot_u = tot_c = 0; tot_cost = 0.0
        for dm in targets:
            u, c, cost = do_dry_run(dm, lang)
            tot_u += u; tot_c += c; tot_cost += cost
        print(f'\n[ALL dry-run] 未訳ユニット計={tot_u:,} 文字計={tot_c:,} '
              f'概算合計 ≈ ${tot_cost:.2f} ≈ ¥{tot_cost*YEN:.0f}')
    else:
        for dm in targets:
            fn(dm, lang)
