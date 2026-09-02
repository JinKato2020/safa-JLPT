# UI(i18n)文字列を Gemini 2.5 Flash で他言語へ一括翻訳する。ja.json(正本)の全キーを対象言語へ訳す。
# 方針(ユーザー指示 2026-09-02): 7言語(bn/id/ko/my/th/vi/zh)の既存315キーは古い可能性が高いので
#   全削除して ja の全キー(1405)から再翻訳=23%→100%。en/ne は番人 parity.test.ts が維持するので対象外。
# ※先回り翻訳は普段は禁止(仕様変更が多い)。今回はユーザーの明示指示。7言語には番人が無いので今後また陳腐化する。
#
# 使い方:
#   python tools/trans_i18n.py --dry-run           # API呼ばず 件数/バッチ/概算費用(全7言語)
#   python tools/trans_i18n.py --apply             # Gemini実行→langごとキャッシュに保存(バッチ毎=再開可)
#   python tools/trans_i18n.py --write             # キャッシュを src/i18n/<lang>.json へ書込(ja全キーで作り直し=旧315破棄)
#   python tools/trans_i18n.py --lang th --apply   # 1言語だけ
# キャッシュ = scratchpad/pg/trans_i18n_<lang>_cache.json  {key: translation}。--apply は既訳keyをスキップ(再開)。
import os, re, sys, json, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I18N = os.path.join(ROOT, 'src', 'i18n')
MODEL = 'gemini-2.5-flash'
KEY = os.environ.get('GEMINI_API_KEY', '')
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}'
BATCH = 30
IN_PER_M, OUT_PER_M, YEN = 0.30, 2.50, 155.0
# 7言語(バックログ)。en/ne は番人維持ゆえ対象外。ja は元。
TARGETS = {'bn': 'Bengali', 'id': 'Indonesian', 'ko': 'Korean', 'my': 'Burmese (Myanmar)',
           'th': 'Thai', 'vi': 'Vietnamese', 'zh': 'Simplified Chinese'}
PLACE = re.compile(r'\{[^}]+\}')  # {n} {level} 等


def load_ja():
    return json.load(open(os.path.join(I18N, 'ja.json'), encoding='utf-8'))


def cache_path(lang):
    return os.path.join(ROOT, 'scratchpad', 'pg', f'trans_i18n_{lang}_cache.json')


def load_cache(lang):
    p = cache_path(lang)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


def save_cache(lang, cache):
    p = cache_path(lang)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(cache, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


def gemini_batch(pairs, lang_name):
    # pairs = [(key, ja), ...]。JSONで {番号: 訳} を返させる。プレースホルダは保持。
    lines = [f'{i+1}. {ja}' for i, (_k, ja) in enumerate(pairs)]
    prompt = (
        f'You are a professional UI localizer for a JLPT (Japanese language test) learning app. '
        f'Translate each Japanese UI string into natural, concise {lang_name} suitable for buttons, labels and short messages. '
        f'CRITICAL: keep every placeholder token EXACTLY as-is and untranslated (e.g. {{n}}, {{level}}, {{count}}); keep newlines (\\n), '
        f'and leave brand/technical tokens like "JLPT", "N5"-"N1", "OK" unchanged. '
        f'Return ONLY a JSON object mapping the item number (as string) to the translated string.\n\n'
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
    for i, (k, ja) in enumerate(pairs):
        v = obj.get(str(i + 1))
        if isinstance(v, str) and v.strip():
            # プレースホルダ保全: ja に有る {..} が訳で全て残っているか。欠けたら不採用(次回再訳)。
            need = set(PLACE.findall(ja))
            if need and not need.issubset(set(PLACE.findall(v))):
                continue
            out[k] = v.strip()
    return out, um.get('promptTokenCount', 0), um.get('candidatesTokenCount', 0)


def targets(only):
    return [only] if only else list(TARGETS)


def do_dry_run(only):
    ja = load_ja()
    keys = list(ja)
    print(f'[dry-run] ja keys={len(keys)}  対象言語={targets(only)}')
    tot_units = tot_cost = 0
    for lang in targets(only):
        cache = load_cache(lang)
        todo = [k for k in keys if k not in cache]
        batches = -(-len(todo) // BATCH)
        in_tok = batches * 70 + len(todo) * 42
        out_tok = len(todo) * 40
        cost = in_tok / 1e6 * IN_PER_M + out_tok / 1e6 * OUT_PER_M
        tot_units += len(todo); tot_cost += cost
        print(f'  {lang}({TARGETS[lang]}): 未訳={len(todo)} batch={batches} ≈ ¥{cost*YEN:.0f}')
    print(f'  --- 合計 未訳={tot_units} ≈ ${tot_cost:.2f} ≈ ¥{tot_cost*YEN:.0f}')


def translate_lang(lang):
    ja = load_ja()
    keys = list(ja)
    cache = load_cache(lang)
    todo = [(k, ja[k]) for k in keys if k not in cache]
    print(f'[apply] {lang}({TARGETS[lang]}) 未訳 {len(todo)}/{len(keys)} キー...', file=sys.stderr)
    tin = tout = 0; done = failed = 0

    def chunk(pairs):
        nonlocal tin, tout
        try:
            out, pi, po = gemini_batch(pairs, TARGETS[lang])
            tin += pi; tout += po
            cache.update(out); save_cache(lang, cache)
            miss = [c for c in pairs if c[0] not in out]
            if miss and len(pairs) > 1:
                g2, f2 = chunk(miss); return len(out) + g2, f2
            return len(out), len(miss)
        except Exception as e:
            if len(pairs) == 1:
                print(f'  drop key={pairs[0][0]} {type(e).__name__}', file=sys.stderr); return 0, 1
            mid = len(pairs) // 2
            g1, f1 = chunk(pairs[:mid]); g2, f2 = chunk(pairs[mid:]); return g1 + g2, f1 + f2

    for b in range(0, len(todo), BATCH):
        g, f = chunk(todo[b:b + BATCH]); done += g; failed += f
        if (b // BATCH) % 10 == 0:
            print(f'  {lang} ...{b+min(BATCH,len(todo)-b)}/{len(todo)} done={done} fail={failed}', file=sys.stderr)
    cost = tin / 1e6 * IN_PER_M + tout / 1e6 * OUT_PER_M
    print(f'[apply] {lang} 完了 done={done} failed={failed} cache={len(cache)}  実測 in={tin:,} out={tout:,} ≈ ¥{cost*YEN:.0f}')
    return failed, cost


def do_apply(only):
    if not KEY:
        print('GEMINI_API_KEY 未設定'); sys.exit(1)
    total_fail = total_cost = 0
    for lang in targets(only):
        f, c = translate_lang(lang); total_fail += f; total_cost += c
    print(f'[apply] 全完了 failed合計={total_fail}  実費 ≈ ¥{total_cost*YEN:.0f}')


def do_write(only):
    ja = load_ja()
    keys = list(ja)
    for lang in targets(only):
        cache = load_cache(lang)
        # ja 全キーで作り直し=旧315キー/幽霊キーは破棄。未訳キーは ja へ自動フォールバックゆえ入れない。
        out = {k: cache[k] for k in keys if k in cache}
        p = os.path.join(I18N, f'{lang}.json')
        json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        miss = len(keys) - len(out)
        print(f'[write] {lang}.json keys={len(out)}/{len(keys)}' + (f'  未訳(ja表示){miss}' if miss else '  =100%'))


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args()
    if a.dry_run: do_dry_run(a.lang)
    elif a.apply: do_apply(a.lang)
    elif a.write: do_write(a.lang)
    else: do_dry_run(a.lang)
