# 各大問の「本文対訳(en/ne)」を Gemini 2.5 Flash で生成し、content JSON の i18n に投入する。
# 方針(ユーザー確定 2026-09-02): 本文＋(文の選択肢のみ)を en/ne 化。解説は訳さず削除。表示=回答後に本文下。
#   文脈規定(context)= 選択肢が単語のため本文のみ。本文=空所を答えで埋めた「完成文」を訳す。
#
# 使い方:
#   python tools/trans_daimon.py context --dry-run   # API呼ばず 件数/バッチ/概算費用
#   python tools/trans_daimon.py context --apply      # Gemini実行→キャッシュに保存(バッチ毎に保存=再開可)
#   python tools/trans_daimon.py context --write       # キャッシュを content JSON へ書込(i18n設定・解説削除)
# キャッシュ = scratchpad/pg/trans_<daimon>_cache.json  {id:{en,ne}}。--apply は既訳idをスキップ(再開)。
import os, re, sys, json, glob, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = 'gemini-2.5-flash'
KEY = os.environ.get('GEMINI_API_KEY', '')
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}'
BATCH = 30
BLANK = re.compile(r'〔[\s　]*〕')
# Gemini 2.5 Flash 標準単価(USD/1M tok)。円換算 155円/$。
IN_PER_M, OUT_PER_M, YEN = 0.30, 2.50, 155.0

# 大問ごとの設定: file glob と「訳す文(完成文)」の作り方。
def context_texts(it):
    # 文脈規定: 完成文=prompt の空所を answer で埋める。選択肢は単語なので訳さない。
    comp = BLANK.sub(it.get('answer', ''), it.get('prompt', ''))
    return {'prompt': comp}

RUBY = re.compile(r'（[ぁ-んァ-ヶー]+）')  # 漢字（かな）のふりがなを除去してから訳す
def order_texts(it):
    # 文の組み立て(order): 訳す文=i18n.ja.explain(=回答後に見せる「正しい並びの文」)。ふりがなは除く。
    ja = (it.get('i18n') or {}).get('ja', {}).get('explain', '')
    ja = RUBY.sub('', ja).strip()
    return {'explain': ja} if ja else {}

def synonym_texts(it):
    # 言い換え(synonym): 回答後の復習用に「本文＋答え＋誤答すべて」を訳す。誤答も正当な日本語語ゆえ訳す価値あり。
    #   選択肢の対訳キー c0..cN は content の choices 配列と同順。ふりがなは除いて訳す。
    t = {}
    if it.get('sentence'): t['sentence'] = RUBY.sub('', it['sentence']).strip()
    if it.get('answer'):   t['answer']   = RUBY.sub('', it['answer']).strip()
    for i, c in enumerate(it.get('choices') or []):
        cc = RUBY.sub('', c).strip()
        if cc: t[f'c{i}'] = cc
    return t

def usage_texts(it):
    # 用法(usage): 正解の文だけ訳す(誤答3つはわざと不自然な日本語ゆえ訳さない=ユーザー確定 2026-09-02)。
    ans = RUBY.sub('', it.get('answer', '')).strip()
    return {'answer': ans} if ans else {}

def grammar_form_texts(it):
    # 文法形式判断(grammar_form): stem の空所〔　〕を answer で埋めた「完成文」を訳す(選択肢=文法パーツは訳さない)。
    #   表示=回答後に「意味」カード(promptTrans)へ。文脈規定と同じ完成文ロジック。ふりがなは除く。
    comp = BLANK.sub(it.get('answer', ''), it.get('stem', ''))
    comp = RUBY.sub('', comp).strip()
    return {'prompt': comp} if comp else {}

NL = re.compile(r'\n+')  # 台本の改行(話者ターン)。翻訳バッチが行番号方式ゆえ ⏎ に退避し書込時に復元。
def kadai_texts(it):
    # 課題理解(kadai): 台本(script)＋設問(q)＋選択肢(choices)を en/ne 化(範囲=ユーザー選択A)。表示=回答後のみ。
    #   1item=1設問(questions[0])。台本の改行→` ⏎ `で退避。ふりがな（かな）は訳前に除去。
    t = {}
    s = RUBY.sub('', it.get('script', '') or '').strip()
    s = NL.sub(' ⏎ ', s)
    if s: t['script'] = s
    qs = it.get('questions') or []
    if qs:
        q0 = qs[0]
        qq = RUBY.sub('', q0.get('q', '') or '').strip()
        if qq: t['q'] = qq
        for i, c in enumerate(q0.get('choices') or []):
            cc = RUBY.sub('', c or '').strip()
            if cc: t[f'c{i}'] = cc
    return t

# kind: 'single'(context/order)= 1フィールド。'struct'(synonym/usage)= 複数フィールドを i18n.en/ne に構造化。
# field/keep: 既定(context)= i18n を {en/ne:{prompt}} で上書き・解説削除。
#   keep=True(order)= i18n.ja.explain(正しい文)を残し、i18n.en/ne.<field> に訳を足す。
DAIMON = {
    'context': {'glob': 'content/problems/moji_goi/**/context_*.json', 'texts': context_texts, 'field': 'prompt', 'keep': False, 'kind': 'single'},
    'order':   {'glob': 'content/problems/bunpou/**/order_*.json',      'texts': order_texts,   'field': 'explain', 'keep': True,  'kind': 'single'},
    'synonym': {'glob': 'content/problems/moji_goi/**/synonym_*.json',  'texts': synonym_texts, 'kind': 'struct'},
    'usage':   {'glob': 'content/problems/moji_goi/**/usage_*.json',    'texts': usage_texts,   'kind': 'struct'},
    'grammar_form': {'glob': 'content/problems/bunpou/**/grammar_form_*.json', 'texts': grammar_form_texts, 'field': 'prompt', 'keep': False, 'kind': 'single'},
    'kadai':   {'glob': 'content/problems/choukai/**/kadai_*.json',    'texts': kadai_texts,   'kind': 'struct'},
    # point(ポイント理解)=kadaiと同構造(会話script＋設問q＋画面表示の選択肢)。抽出/書込とも kadai を流用。
    'point':   {'glob': 'content/problems/choukai/**/point_*.json',    'texts': kadai_texts,   'kind': 'struct'},
    # gaiyou(概要理解)=audioChoices(選択肢は音声・画面は番号)だが、回答後は台本/設問/選択肢テキスト＋訳を表示(ListeningScreen:334)。
    #   よって訳す対象は kadai/point と同じ script＋q＋choices。抽出/書込とも kadai を流用。N3のみ。
    'gaiyou':  {'glob': 'content/problems/choukai/**/gaiyou_*.json',   'texts': kadai_texts,   'kind': 'struct'},
    # hatsuwa(発話表現)=audioChoices。設問文qは無く(場面文=script)＋選択肢3つ。回答後は script訳(body)＋選択肢訳を表示。
    #   訳す対象は script＋choices(qは空でkadai_texts側で自動スキップ)。抽出/書込とも kadai を流用。
    'hatsuwa': {'glob': 'content/problems/choukai/**/hatsuwa_*.json', 'texts': kadai_texts,   'kind': 'struct'},
    # sokuji(即時応答)=hatsuwaと同構造(場面文=script＋q空＋選択肢3つ=返し)。抽出/書込とも kadai を流用。
    'sokuji':  {'glob': 'content/problems/choukai/**/sokuji_*.json',  'texts': kadai_texts,   'kind': 'struct'},
}
SEP = '\x01'  # struct: cache key = f'{itemId}{SEP}{fieldKey}'

def load_items(daimon):
    cfg = DAIMON[daimon]
    files = sorted(glob.glob(os.path.join(ROOT, cfg['glob']), recursive=True))
    items = []  # (id, {field: ja_text})
    for f in files:
        d = json.load(open(f, encoding='utf-8'))
        for it in d['items']:
            t = cfg['texts'](it)
            if t:  # 訳す文が無い item はスキップ
                items.append((it['id'], t))
    return files, items

def cache_path(daimon):
    return os.path.join(ROOT, 'scratchpad', 'pg', f'trans_{daimon}_cache.json')

def load_cache(daimon):
    p = cache_path(daimon)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}

def save_cache(daimon, cache):
    p = cache_path(daimon)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(cache, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

def gemini_batch(pairs):
    # pairs = [(id, ja), ...]  1フィールド分。JSONで {id:{en,ne}} を返させる。
    lines = [f'{i+1}. {ja}' for i, (_id, ja) in enumerate(pairs)]
    prompt = (
        'You are a professional translator for a JLPT learning app. Translate each Japanese sentence '
        'into natural English (en) and natural Nepali (ne). Keep it faithful and learner-friendly. '
        'Return ONLY a JSON object mapping the item number (as string) to {"en":..., "ne":...}.\n\n'
        + '\n'.join(lines)
    )
    body = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'temperature': 0.2, 'thinkingConfig': {'thinkingBudget': 0}, 'responseMimeType': 'application/json', 'maxOutputTokens': 8192},
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    txt = resp['candidates'][0]['content']['parts'][0]['text']
    um = resp.get('usageMetadata', {})
    obj = json.loads(txt)
    out = {}
    for i, (_id, _ja) in enumerate(pairs):
        e = obj.get(str(i + 1)) or {}
        if e.get('en') and e.get('ne'):
            out[_id] = {'en': e['en'].strip(), 'ne': e['ne'].strip()}
    return out, um.get('promptTokenCount', 0), um.get('candidatesTokenCount', 0)

def do_dry_run(daimon):
    files, items = load_items(daimon)
    cache = load_cache(daimon)
    todo = [(i, t) for (i, t) in items if i not in cache]
    fields = sum(len(t) for _i, t in todo)  # 訳す文の総数(context=1/item)
    chars = sum(len(v) for _i, t in todo for v in t.values())
    batches = -(-fields // BATCH)
    # 概算: 入力=命令60tok + 文35tok平均, 出力=文あたり約75tok(en+ne+JSON)
    in_tok = batches * 60 + fields * 40
    out_tok = fields * 78
    cost = in_tok / 1e6 * IN_PER_M + out_tok / 1e6 * OUT_PER_M
    print(f'[dry-run] daimon={daimon} files={len(files)} items={len(items)} 未訳={len(todo)} 訳す文={fields} 文字={chars}')
    print(f'  batch={BATCH} → {batches}回  概算 in≈{in_tok:,}tok out≈{out_tok:,}tok  ≈ ${cost:.2f} ≈ ¥{cost*YEN:.0f}')

def do_apply(daimon):
    _files, items = load_items(daimon)
    cache = load_cache(daimon)
    todo = [(i, t) for (i, t) in items if i not in cache]
    kind = DAIMON[daimon].get('kind', 'single')
    if kind == 'struct':
        # 複数フィールド: cache キー = f'{id}{SEP}{fieldKey}'。未訳ユニットだけ投げる(再開可)。
        flat = [(f'{i}{SEP}{fk}', ja) for (i, t) in items for fk, ja in t.items() if f'{i}{SEP}{fk}' not in cache]
    else:
        flat = [(i, next(iter(t.values()))) for (i, t) in todo]  # single: 1フィールド
    print(f'[apply] {daimon} 未訳 {len(flat)} ユニットを翻訳...', file=sys.stderr)
    tin = tout = 0; done = 0; failed = 0
    def translate_chunk(chunk):
        # 失敗(JSON崩れ/切れ)時は半分に分割して再試行(最終1件まで)。戻り=(訳数, in_tok, out_tok, 失敗数)
        nonlocal tin, tout
        try:
            out, pi, po = gemini_batch(chunk)
            tin += pi; tout += po
            for _id, tr in out.items():
                cache[_id] = tr
            got = len(out)
            save_cache(daimon, cache)
            miss = [c for c in chunk if c[0] not in out]
            if miss and len(chunk) > 1:  # 一部欠け→欠けだけ再分割
                g2, f2 = translate_chunk(miss)
                return got + g2, f2
            return got, len(miss)
        except Exception as e:
            if len(chunk) == 1:
                print(f'  drop id={chunk[0][0]} {type(e).__name__}', file=sys.stderr)
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
    print(f'[apply] 完了 done={done} failed={failed} cache={len(cache)}  実測 in={tin:,} out={tout:,} tok  ≈ ${cost:.3f} ≈ ¥{cost*YEN:.0f}')
    if failed:
        print(f'  ※ 未完 {failed} 件。もう一度 --apply で残りだけ再実行(既訳はスキップ)。', file=sys.stderr)

def _shape(m):
    # struct: {sentence,answer,script,q,c0,c1,..} -> {sentence,answer,script,q,choices:[c0,c1,..]}
    #   script は台本の ⏎ マーカを改行へ復元(kadai)。
    out = {}
    if 'sentence' in m: out['sentence'] = m['sentence']
    if 'answer' in m:   out['answer'] = m['answer']
    if 'script' in m:   out['script'] = m['script'].replace(' ⏎ ', '\n').replace('⏎', '\n').strip()
    if 'q' in m:        out['q'] = m['q']
    cidx = sorted(int(k[1:]) for k in m if k.startswith('c') and k[1:].isdigit())
    if cidx: out['choices'] = [m[f'c{i}'] for i in cidx]
    return out

def do_write_struct(daimon):
    cfg = DAIMON[daimon]
    files = sorted(glob.glob(os.path.join(ROOT, cfg['glob']), recursive=True))
    cache = load_cache(daimon)
    total = wrote = missing = 0
    for f in files:
        d = json.load(open(f, encoding='utf-8')); changed = False
        for it in d['items']:
            total += 1
            texts = cfg['texts'](it)
            en = {}; ne = {}
            for fk in texts:
                tr = cache.get(f"{it['id']}{SEP}{fk}")
                if not tr: continue
                en[fk] = tr['en']; ne[fk] = tr['ne']
            if not en:
                missing += 1; continue
            i = it.get('i18n') or {}
            i['en'] = _shape(en); i['ne'] = _shape(ne)
            it['i18n'] = i; wrote += 1; changed = True
        if changed:
            langs = sorted({l for it in d['items'] for l in (it.get('i18n') or {})})
            d['languages'] = langs
            json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'[write] {daimon}(struct) files={len(files)} items={total} 書込={wrote} 未訳(スキップ)={missing}')

def do_write_kadai(daimon='kadai'):
    # 課題理解(kadai)/ポイント理解(point): 読解と同型に投入。台本訳→item.i18n.{lang}.body(行配列)／設問訳→questions[0].i18n.{lang}.{q,choices}。
    #   Gemini出力は台本の改行(話者ターン)を実際の \n で保持済み→\n で分割し行配列化。設問のjaは温存。
    files = sorted(glob.glob(os.path.join(ROOT, DAIMON[daimon]['glob']), recursive=True))
    cache = load_cache(daimon)
    total = wrote = missing = 0
    def to_lines(s):
        s = s.replace(' ⏎ ', '\n').replace('⏎', '\n')
        return [ln.strip() for ln in s.split('\n') if ln.strip()]
    for f in files:
        d = json.load(open(f, encoding='utf-8')); changed = False
        for it in d['items']:
            total += 1
            sid = it['id']
            sc = cache.get(f'{sid}{SEP}script')
            qs = it.get('questions') or []
            q0 = qs[0] if qs else {}
            has_q = bool((q0.get('q') or '').strip())  # 発話表現は q が空(場面文=script)→q訳は要求しない
            qtr = cache.get(f'{sid}{SEP}q') if has_q else None
            choices = q0.get('choices', [])
            cen = []; cne = []; ok = bool(sc) and (qtr is not None or not has_q)
            for i in range(len(choices)):
                ctr = cache.get(f'{sid}{SEP}c{i}')
                if not ctr: ok = False; break
                cen.append(ctr['en']); cne.append(ctr['ne'])
            if not ok or not qs:
                missing += 1; continue
            it['i18n'] = {'en': {'body': to_lines(sc['en'])}, 'ne': {'body': to_lines(sc['ne'])}}
            qi = q0.get('i18n') or {}
            en_q = {'choices': cen}; ne_q = {'choices': cne}
            if has_q and qtr:
                en_q['q'] = qtr['en']; ne_q['q'] = qtr['ne']
            qi['en'] = en_q; qi['ne'] = ne_q
            q0['i18n'] = qi
            wrote += 1; changed = True
        if changed:
            d['languages'] = ['en', 'ne']
            json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'[write] {daimon} files={len(files)} items={total} 書込={wrote} 未訳(スキップ)={missing}')
    if missing:
        print(f'  ※ {missing} 件がキャッシュ未訳。先に --apply を完走させること。')

def do_write(daimon):
    if daimon in ('kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji'):
        return do_write_kadai(daimon)
    cfg = DAIMON[daimon]
    if cfg.get('kind') == 'struct':
        return do_write_struct(daimon)
    field = cfg.get('field', 'prompt'); keep = cfg.get('keep', False)
    files = sorted(glob.glob(os.path.join(ROOT, cfg['glob']), recursive=True))
    cache = load_cache(daimon)
    total = 0; wrote = 0; missing = 0
    for f in files:
        d = json.load(open(f, encoding='utf-8'))
        changed = False
        for it in d['items']:
            total += 1
            tr = cache.get(it['id'])
            if not tr:
                missing += 1; continue
            if keep:
                # order: ja(正しい文)を残し en/ne.<field> に訳を足す(旧訳は上書き=再翻訳)
                i = it.get('i18n') or {}
                i.setdefault('en', {})[field] = tr['en']
                i.setdefault('ne', {})[field] = tr['ne']
                it['i18n'] = i
            else:
                # context: 本文対訳のみ。解説(explain)は方針により削除。
                it['i18n'] = {'en': {field: tr['en']}, 'ne': {field: tr['ne']}}
            wrote += 1; changed = True
        if changed:
            langs = sorted({l for it in d['items'] for l in (it.get('i18n') or {})}) if keep else ['en', 'ne']
            d['languages'] = langs
            json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'[write] {daimon} files={len(files)} items={total} 書込={wrote} キャッシュ欠={missing}')
    if missing:
        print(f'  ※ {missing} 件がキャッシュ未訳。先に --apply を完走させること。')

if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in DAIMON:
        print('usage: python tools/trans_daimon.py <daimon> [--dry-run|--apply|--write]'); sys.exit(1)
    daimon, mode = sys.argv[1], sys.argv[2]
    if not KEY and mode == '--apply':
        print('GEMINI_API_KEY 未設定'); sys.exit(1)
    {'--dry-run': do_dry_run, '--apply': do_apply, '--write': do_write}[mode](daimon)
