# -*- coding: utf-8 -*-
"""作り直した文脈規定の【仕上げ】ワークフローを生成する。

2つの独立した仕事を1本にまとめて並行実行する（別々に回すよりエージェントが減る）:
  A) 揃い監査 … 誤答が「分野・語形で消せない」か判定し、場違いな誤答を削る（削るだけ＝新バグなし）
  B) ルビ    … 問題文にふりがなを付ける（MeCabの下書きをOpusが校正）
Aは誤答だけ、Bは問題文だけを触るので、互いに干渉しない。

使い方: python tools/gen_polish_workflow.py N4
"""
import io, json, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'data-build'))
from gen_furigana import furigana, has_kanji  # noqa: E402

LEVEL = (sys.argv[1] if len(sys.argv) > 1 else 'N4').upper()
AUDIT_BATCH = 20   # 実測 40問=58k・50問=64k超過で失敗 → 20問(約29k)で安全マージン確保
RUBY_BATCH = 100   # ルビは出力が短く思考も軽いので大きく束ねる

baked = json.load(io.open(os.path.join(ROOT, f'scratchpad/context_regen/baked_{LEVEL}.json'), encoding='utf-8'))
good = baked['good']

audit_rows = [{'id': x['id'], 'prompt': x['prompt'], 'answer': x['answer'], 'choices': x['choices']} for x in good]
ruby_rows = [{'id': x['id'], 'prompt': x['prompt'], 'draft': furigana(x['prompt'])}
             for x in good if has_kanji(x['prompt'])]

AUDIT_RULES = r'''あなたはJLPT ''' + LEVEL + r''' 「文脈規定」問題の【品質測定役】です。作った本人ではないので、遠慮なく厳しく測ってください。

測るのは一意性ではありません（それは別の役が済ませました）。測るのは【**当てずっぽうで消せてしまわないか**】です。

## 背景
文脈規定は必ず2段階で作られる。
1. **4語(正解+誤答)を何らかの軸で揃える** → 分野・品詞・語形では消せなくする
2. **文中に鍵を1つだけ置く** → その鍵だけが正解を一意にする
「揃える」を怠ると、**対象語の意味を知らない学習者でも、分野違いというだけで誤答を消せてしまう**。それでは語彙力を測ったことにならない。**これが現行アプリの最大の欠陥**。

## 判定の質問（1問ごと）
**「answer の意味を全く知らない学習者が、誤答を"明らかに場違い"というだけで消せてしまうか？」**

- `aligned` … 誤答が正解と同じ意味フィールド／同じ語形／同じ漢字を共有していて、**分野や語形では消せない**。文中の鍵を読んで初めて絞れる＝**良問**
- `partly` … 大半は揃っているが、**1個以上が明らかに場違い**で即消しできる → その語を `offenders` に列挙する
- `guessable` … 誤答が総じて分野違い・場違いで、**鍵を読まなくても消せる**＝測定にならない＝**不良**

## 実例（この基準で）
- 正解「貿易」に誤答 工事/放送/計算 → **guessable**。貿易を知らなくても「外国と自動車の〜をして大きくなった」に工事/放送/計算は場違い
- 正解「看護婦」に誤答 店員/駅員/運転手/学生 → **guessable**。職業名という点しか揃っておらず、病院・注射の場と分野違い
- 正解「時代」に誤答 時間/時刻/時期/期間/当時 → **aligned**。全部「時」の語で漢字も共有し分野で消せない
- 正解「社長」に誤答 部長/課長/係長/店長/駅長 → **aligned**。全部「長」のつく役職
- 正解「お祝い」に誤答 お見舞い/**おつり**/**お知らせ** → **partly**。お祝い/お見舞いは贈答フィールドだが、おつり(金銭)とお知らせ(情報)は「お〜」の語形しか共有せず即消しできる → offenders=["おつり","お知らせ"]

## offenders の出し方（重要）
`offenders` に挙げた語は**そのまま削除**されます。**追加はしません**（追加すると新しい第2の正解が生まれるため）。
- 削除して誤答が**3個未満**になる場合でも、**遠慮なく挙げてください**。個数が足りない問題は人が手直しする箱に回すだけで、データは壊しません。
- 逆に、**揃っている誤答を無理に挙げないでください**。「やや弱いが同じフィールド内」なら offenders に入れない。

## 対象外（今回は見ない）
- 「文が不自然」「第2の正解がある」＝別の役が済ませました
- 誤答の個数のばらつき（3〜5個）＝第2の正解を削った結果なので**減点材料にしない**

## 出力
各問について {"id":..., "verdict":"aligned|partly|guessable", "offenders":[場違いな誤答の文字列], "note":"一行で理由"}
`aligned` なら offenders は空配列。'''

RUBY_RULES = r'''あなたはJLPT ''' + LEVEL + r''' の教材にふりがな（ルビ）を付ける担当です。

## やること
各問題文の漢字に `漢字（かな）` 形式でふりがなを付けます。
`draft` は**MeCabによる機械生成の下書き**です。**実測で約18%が間違っています**。必ず自分で読みを確認し、直してください。

## 書式（厳守）
- 読みは**全角の丸括弧**`（）`で、漢字の**直後**に置く
- **送りがなは括弧の外**に出す。例: `立（た）ち上（あ）がった` / `休（やす）みます` / `習（なら）った`
- 熟語は**まとまりでルビを振ってよい**。例: `日曜日（にちようび）` `満員電車（まんいんでんしゃ）` `授業（じゅぎょう）`
- **漢字を含む語は必ずルビを付ける**（下書きが振り漏らすことがある）
- ひらがな・カタカナ・数字・記号にはルビを付けない
- 空所 `〔　〕` は**そのまま1文字も変えず**に残す

## 下書きの実際の間違い（必ず直す）
- `日曜（にちよう）日（ひ）` → 正しくは `日曜日（にちようび）`
- `送べつ`（ルビが全く無い） → 正しくは `送（おく）べつ`
- `明日（あす）` → ''' + LEVEL + r'''で教える読みは `明日（あした）`
- 熟語を不自然に割る／送りがなを括弧に巻き込む

## 【絶対の検算】
`furi` から**括弧とその中身を全部取り除いた文字列が、`prompt` と1文字も違わず一致**しなければなりません。
文字を足しても減らしてもいけません。出力前に必ず自分で確認してください。

## 出力
各問について {"id":..., "furi": ふりがな付きの問題文}'''

AUDIT_SCHEMA = {
    'type': 'object', 'required': ['results'],
    'properties': {'results': {'type': 'array', 'items': {
        'type': 'object', 'required': ['id', 'verdict', 'offenders'],
        'properties': {
            'id': {'type': 'string'},
            'verdict': {'type': 'string', 'enum': ['aligned', 'partly', 'guessable']},
            'offenders': {'type': 'array', 'items': {'type': 'string'}},
            'note': {'type': 'string'},
        }}}},
}
RUBY_SCHEMA = {
    'type': 'object', 'required': ['items'],
    'properties': {'items': {'type': 'array', 'items': {
        'type': 'object', 'required': ['id', 'furi'],
        'properties': {'id': {'type': 'string'}, 'furi': {'type': 'string'}}}}},
}

ab = [audit_rows[i:i + AUDIT_BATCH] for i in range(0, len(audit_rows), AUDIT_BATCH)]
rb = [ruby_rows[i:i + RUBY_BATCH] for i in range(0, len(ruby_rows), RUBY_BATCH)]

js = f'''export const meta = {{
  name: 'context-{LEVEL.lower()}-polish',
  description: '文脈規定{LEVEL} の仕上げ（揃い全数監査＋ルビ生成を並行）',
  phases: [
    {{ title: '揃い監査', detail: '{AUDIT_BATCH}問×{len(ab)}体・場違いな誤答を削る（削るだけ）' }},
    {{ title: 'ルビ', detail: '{RUBY_BATCH}問×{len(rb)}体・MeCabの下書きをOpusが校正' }},
  ],
}}

const AUDIT_RULES = {json.dumps(AUDIT_RULES, ensure_ascii=False)}
const RUBY_RULES = {json.dumps(RUBY_RULES, ensure_ascii=False)}
const AUDIT_SCHEMA = {json.dumps(AUDIT_SCHEMA, ensure_ascii=False)}
const RUBY_SCHEMA = {json.dumps(RUBY_SCHEMA, ensure_ascii=False)}
const AUDIT_BATCHES = {json.dumps(ab, ensure_ascii=False)}
const RUBY_BATCHES = {json.dumps(rb, ensure_ascii=False)}

// 監査は誤答だけ、ルビは問題文だけを触るので互いに干渉しない＝同時に走らせてよい
const [audit, ruby] = await parallel([
  () => parallel(AUDIT_BATCHES.map((b, i) => () =>
    agent(AUDIT_RULES + '\\n\\n## 検査対象(' + b.length + '問)\\n' + JSON.stringify(b),
      {{ label: 'audit:b' + (i + 1), phase: '揃い監査', schema: AUDIT_SCHEMA }}))),
  () => parallel(RUBY_BATCHES.map((b, i) => () =>
    agent(RUBY_RULES + '\\n\\n## 対象(' + b.length + '問)\\n' + JSON.stringify(b),
      {{ label: 'ruby:b' + (i + 1), phase: 'ルビ', schema: RUBY_SCHEMA }}))),
])

const results = (audit || []).filter(Boolean).flatMap((r) => (r && r.results) || [])
const items = (ruby || []).filter(Boolean).flatMap((r) => (r && r.items) || [])
const n = {{ aligned: 0, partly: 0, guessable: 0 }}
for (const r of results) if (n[r.verdict] !== undefined) n[r.verdict]++
log('揃い監査=' + results.length + '件 (aligned=' + n.aligned + ' partly=' + n.partly + ' guessable=' + n.guessable + ') / ルビ=' + items.length + '件')
return {{ level: '{LEVEL}', results, items }}
'''

out = os.path.join(ROOT, f'scratchpad/context_regen/wf_polish_{LEVEL}.mjs')
with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)
raw = io.open(out, 'rb').read()
assert b'\r' not in raw, 'CRLFが混入した（Workflowが拒否する）'
print(f'出力: {out}')
print(f'  揃い監査: {len(audit_rows)}問 → {len(ab)}体（各{AUDIT_BATCH}問）')
print(f'  ルビ    : {len(ruby_rows)}問 → {len(rb)}体（各{RUBY_BATCH}問）')
print(f'  合計エージェント数={len(ab) + len(rb)}体 / CR混入なし / {len(raw)/1024:.0f}KB')
print(f'  監査 先頭: {json.dumps(audit_rows[0], ensure_ascii=False)}')
print(f'  ルビ 末尾: {json.dumps(ruby_rows[-1], ensure_ascii=False)}')
