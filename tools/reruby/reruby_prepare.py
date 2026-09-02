# -*- coding: utf-8 -*-
"""聴解・読解の「無ルビ本文」123件に再ルビを付けるための準備。
方式 = 既存の確立パイプライン(MeCab下書き→Opusが校正)。gen_usage_furigana_wf.py と同型。

やること:
  1) targets.txt の item を全 content JSON から探す
  2) ルビ対象フィールド(script/body/passage/text/stem, questions[].q/stem, choices[])を取り出す
  3) 既存ルビ（漢字直後の（かな））を剥がして「素の本文」にする → prompt
  4) MeCab で下書き（draft）を作る
  5) rows.json（{id, loc, prompt, draft}）と wf_reruby_furi.mjs（Opus校正ワークフロー）を書き出す

出力: tools/reruby/rows.json / tools/reruby/wf_reruby_furi.mjs / tools/reruby/rows_index.json
回収後: reruby_apply.py が furi を content JSON へ書き戻す。
"""
import io, json, os, re, sys, glob

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))          # JLPTアプリ/
sys.path.insert(0, os.path.join(ROOT, 'data-build'))
from gen_furigana import furigana, has_kanji  # noqa: E402

TARGETS = set(l.strip() for l in io.open(os.path.join(HERE, 'targets.txt'), encoding='utf-8') if l.strip())
DRAFT_CHARS_PER_BATCH = 12000                                   # 1バッチの下書き文字数の目安(≦15体に収める)

KANJI = r'一-鿿㐀-䶿々〆〇ヶ'
STRIP_RUBY = re.compile(r'(?<=[' + KANJI + r'])（[ぁ-ゖー]+）')   # 漢字直後の（かな）＝ルビのみ剥がす
def strip_ruby(s):
    prev = None
    while prev != s:                                            # 送りがな連鎖に備えて収束まで
        prev = s; s = STRIP_RUBY.sub('', s)
    return s

def draft_of(bare):
    """MeCab下書き。furigana() が改行を潰すので行ごとに掛けて元の改行を保つ。"""
    return '\n'.join(furigana(ln) if ln else '' for ln in bare.split('\n'))

def ruby_fields(it):
    """(loc, text) を返す。loc は書き戻し用の位置キー。"""
    out = []
    for f in ('script', 'body', 'passage', 'text', 'stem'):
        if isinstance(it.get(f), str): out.append((f, it[f]))
    for qi, q in enumerate(it.get('questions', []) or []):
        if isinstance(q.get('q'), str):    out.append((f'q{qi}', q['q']))
        if isinstance(q.get('stem'), str): out.append((f'qs{qi}', q['stem']))
        for ci, c in enumerate(q.get('choices', []) or []):
            if isinstance(c, str):         out.append((f'c{qi}_{ci}', c))
    return out

def main():
    rows = []           # {id, loc, prompt, draft}
    index = {}          # itemId -> file (relpath)
    seen = set()
    for f in sorted(glob.glob(os.path.join(ROOT, 'content/problems/**/*.json'), recursive=True)):
        rel = os.path.relpath(f, ROOT).replace('\\', '/')
        d = json.load(io.open(f, encoding='utf-8'))
        if not isinstance(d, dict) or 'items' not in d: continue
        for it in d['items']:
            Id = it.get('id')
            if Id not in TARGETS: continue
            index[Id] = rel; seen.add(Id)
            for loc, text in ruby_fields(it):
                bare = strip_ruby(text)
                if not has_kanji(bare): continue                # 漢字なしは対象外(そのまま)
                rows.append({'id': Id, 'loc': loc, 'prompt': bare, 'draft': draft_of(bare)})
    missing = TARGETS - seen
    # バッチ分割: draft 文字数で束ねる
    batches = []; cur = []; cc = 0
    for r in rows:
        wr = {'id': f"{r['id']}||{r['loc']}", 'prompt': r['prompt'], 'draft': r['draft']}
        if cc and cc + len(r['draft']) > DRAFT_CHARS_PER_BATCH:
            batches.append(cur); cur = []; cc = 0
        cur.append(wr); cc += len(r['draft'])
    if cur: batches.append(cur)

    json.dump(rows, io.open(os.path.join(HERE, 'rows.json'), 'w', encoding='utf-8', newline='\n'),
              ensure_ascii=False, indent=0)
    json.dump(index, io.open(os.path.join(HERE, 'rows_index.json'), 'w', encoding='utf-8', newline='\n'),
              ensure_ascii=False, indent=1)

    RUBY_RULES = ('あなたはJLPTの教材（聴解の台本・読解の本文）にふりがな（ルビ）を付ける担当です。\n\n'
        '## やること\n'
        '各テキストの漢字に `漢字（かな）` 形式でふりがなを付けます。\n'
        '`draft` は**MeCabによる機械生成の下書き**で、**実測で約18%が間違っています**。必ず自分で読みを確認して直してください。\n'
        '`prompt` が素の本文（ルビ無し）です。これに正しいルビを付けた結果を `furi` として返します。\n\n'
        '## 書式（厳守）\n'
        '- 読みは**全角の丸括弧**`（）`で、漢字の**直後**に置く\n'
        '- **送りがなは括弧の外**に出す。例: `立（た）ち上（あ）がった` / `休（やす）みます`\n'
        '- 熟語は**まとまりでルビを振ってよい**。例: `日曜日（にちようび）` `集中力（しゅうちゅうりょく）`\n'
        '- **漢字を含む語は必ずルビを付ける**（下書きが振り漏らすことがある）\n'
        '- ひらがな・カタカナ・数字・記号・アルファベットにはルビを付けない\n'
        '- 会話の話者ラベル（例 `女1：` `男2：`）や記号はそのまま残す\n\n'
        '## 多読み漢字は文脈で正しい読みに\n'
        '例 `辛（つら）い`/`辛（から）い`、`治（なお）す`/`治（おさ）める`、`人（ひと）`/`二人（ふたり）`、`一日（ついたち）`/`一日（いちにち）`\n\n'
        '## 【絶対の検算】\n'
        '`furi` から**括弧とその中身を全部取り除いた文字列が、`prompt` と1文字も違わず一致**しなければなりません。\n'
        '文字を足しても減らしてもいけません（改行・空白・記号も含め）。出力前に必ず自分で確認してください。\n\n'
        '## 出力\n各テキストについて {"id":..., "furi": ふりがな付き本文}')
    RUBY_SCHEMA = {'type': 'object', 'required': ['items'], 'properties': {'items': {'type': 'array',
        'items': {'type': 'object', 'required': ['id', 'furi'],
                  'properties': {'id': {'type': 'string'}, 'furi': {'type': 'string'}}}}}}

    js = ('export const meta = {\n'
          "  name: 'reruby-choukai-dokkai',\n"
          f"  description: '無ルビ本文{len(seen)}件の再ルビ（{len(rows)}テキスト・MeCab下書きをOpusが校正）',\n"
          "  phases: [{ title: 'ルビ', detail: 'MeCab下書きをOpusが校正' }],\n"
          '}\n\n'
          f'const RUBY_RULES = {json.dumps(RUBY_RULES, ensure_ascii=False)}\n'
          f'const RUBY_SCHEMA = {json.dumps(RUBY_SCHEMA, ensure_ascii=False)}\n'
          f'const RUBY_BATCHES = {json.dumps(batches, ensure_ascii=False)}\n\n'
          'const ruby = await parallel(RUBY_BATCHES.map((b, i) => () =>\n'
          "  agent(RUBY_RULES + '\\n\\n## 対象(' + b.length + '件)\\n' + JSON.stringify(b),\n"
          "    { label: 'ruby:b' + (i + 1), phase: 'ルビ', schema: RUBY_SCHEMA })))\n"
          'const items = (ruby || []).filter(Boolean).flatMap((r) => (r && r.items) || [])\n'
          "log('ルビ=' + items.length + '/' + " + str(len(rows)) + " + '件')\n"
          'return { items }\n')
    outmjs = os.path.join(HERE, 'wf_reruby_furi.mjs')
    io.open(outmjs, 'w', encoding='utf-8', newline='\n').write(js)
    assert b'\r' not in io.open(outmjs, 'rb').read(), 'CRLF混入'

    print(f'targets={len(TARGETS)} 見つかった={len(seen)} 見つからない={len(missing)}')
    if missing: print('  MISSING:', ','.join(sorted(missing)))
    print(f'ルビ対象テキスト={len(rows)}  バッチ={len(batches)}(各≦{DRAFT_CHARS_PER_BATCH}下書き文字)')
    print(f'  rows.json / rows_index.json / {os.path.basename(outmjs)} -> {HERE}')

if __name__ == '__main__':
    main()
