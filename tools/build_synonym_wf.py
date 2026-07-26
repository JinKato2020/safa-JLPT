# -*- coding: utf-8 -*-
"""言い換え類義の再生成 workflow スクリプトを組み立てる(データを埋め込む)。

workflow スクリプトはファイルアクセス不可・args は過去に undefined 事故を起こしたため、
候補データは JS のリテラルとして直接埋め込む(= 入力欠落が構造的に起きない)。

使い方:
  python tools/build_synonym_wf.py --level N4 --start 0 --count 185 -o <出力.js>
  python tools/build_synonym_wf.py --level N3 --start 0 --count 150 -o <出力.js>
"""
import argparse
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "content", "problems", "moji_goi")
VOCAB = os.path.join(ROOT, "app", "src", "data", "shared", "vocab.json")

RECIPE = """【言い換え類義 作問レシピ(公式PDF分析)】
狙い: 語の意味の核を別の言い方で捉えられるか。文脈は語義を一義に固定する最小限。
正解の条件: 文に代入して意味が変わらない真の同義(あまった⇄のこった / むかい⇄まえ / 流行している⇄はやっている)。
誤答の型(公式の手口):
 1 同一意味フィールドで揃える(位置語なら位置語だけ/量なら量だけ)=分野で消せない。
 2 同一品詞・同一文型スロット=文法で消せない。
 3 連想の罠(near-miss)を必ず1つ: 対象語に連想で結びつくが同義でない(くさる→まずくなった=腐れば不味いが定義でない)。
 4 方向違い・程度違い(あまる↔ふえた/少なくなった)。
禁止: 荒唐無稽な分野違いダミー(易しすぎ=現行アプリの欠陥。例 作法→天気/音楽/地図)は絶対に入れない。
禁止: 個人名。役割ベース(先生/学生/店員/客)で書く。国際的にボーダーレスな内容にする。

★★一意性(最重要・ここで用法もパイロットも失敗した)★★
各誤答を「文に代入→意味が保たれるか」テストせよ。少しでも同義が成り立つ語は【第2の正解】=絶対に不可。
パイロットの実際の失敗例(必ず避けよ):
 - 刷った→正解「印刷する」に対し誤答「コピーする」…「ポスターを百枚コピーした」は自然で意味が重なる=失格。
 - 活気→正解「活力」に対し誤答「熱気」「エネルギー」…「町は熱気にあふれていた」も成立=失格。
教訓: 【自分が選んだ正解の近縁語を誤答にするな】。誤答は「下線語とも正解とも非同義」でなければならない。

★誤答の個数: 原則6個。ただし一意な6個目がどうしても作れないなら、無理にひねり出して第2の正解を作るより【5個】にせよ。
 5個も無理なら【4個】でよい(4択出題には誤答3個あれば足りる)。4個すら一意に作れない語は needsDrop=true を立てて誤答は作れるだけでよい。
 個数を減らすのは正当な判断であり減点ではない。第2の正解を1つでも作る方がはるかに悪い。
reasons は各誤答が「代入すると意味がどうズレるか」を20〜40字で1つずつ(=一意性の自己証明)。誤答と同じ個数・同じ順。
解説文は不要(生成しない)。"""

N3_PROMPT = """あなたはJLPT N3「言い換え類義(語レベル)」の作問者。公式N3形式=下線語と意味が最も近い"語"を4択から選ぶ。
{recipe}

各問題は 文(sentence)・下線語(underline)・仮の正解同義語(answer) が既にある。各問について:
(a) answer が下線語の真の同義か厳しく検証。ズレていれば正しい同義語へ修正し answerFixed=true。
    (実例: 「重視≒強調」は"重んじる"と"強く言う"でズレる→"重んじる"へ修正が正しい)
(b) 誤答を6個(無理なら5→4)。下線語と同一意味フィールド・同一品詞、うち1つは連想の罠。
    各誤答は【下線語とも、あなたが確定した正解とも】非同義であること。
(c) reasons: 各誤答の非同義理由を20〜40字で。誤答と同数・同順。
必ず入力と同じ id・同じ順で items を返す。全{n}問を返すこと(省略禁止)。
入力({n}問): {data}"""

N4_PROMPT = """あなたはJLPT N4「言い換え類義(文レベル)」の作問者。公式N4形式=文まるごとの言い換え(選択肢も文・一語だけ違う)。
{recipe}

各語(word=対象語, reading, meaning, もとの文 sentence, 仮同義 answer)について:
(a) stem: もとの文を使う(不自然なら最小限で直す)。漢字にはルビをかなで丸括弧付き(例 大抵(たいてい))。
(b) answer: stem と「だいたい同じ意味の文」= 対象語だけを真の同義表現に置換した文(他は変えない)。仮answerがズレていれば正しい同義に直し answerFixed=true。
    (実例: 「大抵≒いつも」は緩い(いつも=100%)→"だいたい"が正しく、"いつも"は誤答に降格)
(c) 誤答文を6つ(無理なら5→4): stem と1要素だけ違う・同一場面・同義でない文。同一品詞スロット、うち1つは連想の罠。
    各誤答文は【stemとも、あなたが確定したanswerとも】同義でないこと。全文にルビを付ける。
(d) reasons: 各誤答文が元の文と意味がどうズレるかを20〜40字で。誤答と同数・同順。
必ず入力と同じ id・同じ順で items を返す。全{n}問を返すこと(省略禁止)。
入力({n}語): {data}"""


def load(level):
    p = os.path.join(SRC, f"synonym_{level}.json")
    d = json.load(io.open(p, encoding="utf-8"))
    items = d if isinstance(d, list) else d["items"]
    vocab = {v["id"]: v for v in json.load(io.open(VOCAB, encoding="utf-8"))}
    out = []
    for it in items:
        vid = it["id"][3:]
        v = vocab.get(vid, {})
        out.append({
            "id": it["id"],
            "word": it.get("word", ""),
            "reading": v.get("reading", "") or v.get("kana", ""),
            "meaning": (v.get("en") or v.get("meaning") or "")[:60],
            "sentence": it.get("sentence", ""),
            "underline": it.get("underline", ""),
            "answer": it.get("answer", ""),
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", required=True, choices=["N3", "N4", "N5"])
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--count", type=int, default=150)
    ap.add_argument("--batch", type=int, default=30)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()

    allitems = load(a.level)
    sel = allitems[a.start:a.start + a.count]
    batches = [sel[i:i + a.batch] for i in range(0, len(sel), a.batch)]
    print(f"{a.level}: 在庫{len(allitems)} / 今回{len(sel)}問 (start={a.start}) / {len(batches)}バッチ")

    word_level = a.level == "N3"
    prompt_tpl = N3_PROMPT if word_level else N4_PROMPT
    item_props = (
        '{ id:{type:"string"}, answer:{type:"string"}, answerFixed:{type:"boolean"}, needsDrop:{type:"boolean"},'
        ' distractors:{type:"array",items:{type:"string"},minItems:3,maxItems:6},'
        ' reasons:{type:"array",items:{type:"string"},minItems:3,maxItems:6} }'
    )
    if not word_level:
        item_props = item_props.replace('id:{type:"string"},', 'id:{type:"string"}, stem:{type:"string"},')

    js = f'''export const meta = {{
  name: 'synonym-regen-{a.level.lower()}-{a.start}',
  description: '言い換え類義 {a.level} {len(sel)}問(start={a.start}) 再生成: Opus-high生成→独立反証→非一意ダミー差し替え',
  phases: [{{ title: 'Gen', detail: '{len(batches)}バッチ×Opus-high' }}, {{ title: 'Verify', detail: '独立反証: 第2の正解を暴く' }}, {{ title: 'Repair', detail: '非一意ダミーのみ差し替え' }}],
}}

const RECIPE = {json.dumps(RECIPE, ensure_ascii=False)}
const BATCHES = {json.dumps(batches, ensure_ascii=False)}

const GEN_SCHEMA = {{ type:'object', additionalProperties:false, required:['items'], properties:{{ items:{{ type:'array', items:{{
  type:'object', additionalProperties:false, required:['id','answer','distractors','reasons'],
  properties: {item_props} }} }} }} }}

const VERIFY_SCHEMA = {{ type:'object', additionalProperties:false, required:['results'], properties:{{ results:{{ type:'array', items:{{
  type:'object', additionalProperties:false, required:['id','validCount','verdict'],
  properties:{{ id:{{type:'string'}}, validCount:{{type:'integer'}}, validChoices:{{type:'array',items:{{type:'string'}}}},
    verdict:{{type:'string'}}, note:{{type:'string'}} }} }} }} }} }}

const genPrompt = (b, n) => `{prompt_tpl.replace("{recipe}", "${RECIPE}").replace("{n}", "${b.length}").replace("{data}", "${JSON.stringify(b)}")}`

const verifyPrompt = (items) => `あなたはJLPT言い換え({'語' if word_level else '文'}レベル)の一意性検査官(反証役)。目的は【第2の正解】を暴くこと。厳しく判定せよ。
{'各問は下線語(underline)と意味が最も近い語を選ぶ。answer と各 distractor を下線語の位置に代入し、同義が成り立つか判定。' if word_level else '各問は stem と「だいたい同じ意味の文」を選ぶ。answer と各 distractor が stem と同義文か判定。'}
少しでも同義が成り立つものは valid。基準は緩めに(=疑わしきは valid にして拾う)。
実際に見逃された例: 刷る/印刷する に対する「コピーする」、活気/活力 に対する「熱気」「エネルギー」。この水準の重なりは valid とせよ。
valid が2つ以上なら verdict='multi'(非一意=fail)。answerのみなら 'unique'。answerすら不成立なら 'bad_answer'。
各問 {{id, validCount, validChoices, verdict, note}} を返す。全${{items.length}}問を返すこと。
問題: ${{JSON.stringify(items)}}`

const repairPrompt = (bad) => `あなたはJLPT言い換えの誤答修理担当。以下は独立検査で【第2の正解】が見つかった問題。
各問の validChoices に挙がった選択肢(=正解になってしまう誤答)を【削除】し、同じ意味フィールド・同じ品詞で
【下線語とも正解とも明確に非同義】な語{'' if word_level else '文'}に差し替えよ。差し替え候補が思いつかないなら、無理に足さず
誤答を減らして(6→5→4)返してよい。第2の正解を作るより減らす方が正しい。
reasons も差し替え後の誤答に合わせて20〜40字で作り直す(誤答と同数・同順)。
必ず同じ id で items を返す。全${{bad.length}}問。
問題と検査結果: ${{JSON.stringify(bad)}}`

phase('Gen')
const out = await pipeline(
  BATCHES,
  (b, _orig, i) => agent(genPrompt(b), {{ label: `gen:{a.level}#${{i}}`, phase: 'Gen', model: 'opus', effort: 'high', schema: GEN_SCHEMA }}),
  async (gen, b, i) => {{
    if (!gen || !gen.items || !gen.items.length) return {{ items: [], results: [] }}
    const v = await agent(verifyPrompt(gen.items), {{ label: `verify:{a.level}#${{i}}`, phase: 'Verify', model: 'opus', effort: 'high', schema: VERIFY_SCHEMA }})
    const results = (v && v.results) || []
    const badIds = new Set(results.filter((r) => r.verdict !== 'unique').map((r) => r.id))
    if (!badIds.size) return {{ items: gen.items, results }}
    const bad = gen.items.filter((it) => badIds.has(it.id))
      .map((it) => ({{ ...it,検査: results.find((r) => r.id === it.id) }}))
    log(`{a.level} batch${{i}}: 非一意 ${{bad.length}}/${{gen.items.length}} 件を修理`)
    const fixed = await agent(repairPrompt(bad), {{ label: `repair:{a.level}#${{i}}`, phase: 'Repair', model: 'opus', effort: 'high', schema: GEN_SCHEMA }})
    const fixedById = new Map(((fixed && fixed.items) || []).map((it) => [it.id, it]))
    return {{ items: gen.items.map((it) => fixedById.get(it.id) || it), results }}
  }},
)

const items = out.filter(Boolean).flatMap((o) => o.items || [])
const results = out.filter(Boolean).flatMap((o) => o.results || [])
log(`{a.level} 完了: ${{items.length}}問 / 判定${{results.length}}件`)
return {{ level: '{a.level}', items, results }}
'''
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    # newline="\n" 必須: Windows既定の CRLF だと \r が混入し、Workflow の承認ダイアログが
    # 「制御文字を含む」として実行を拒否する(実測済み)。
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(js)
    with io.open(a.out, "rb") as f:
        assert b"\r" not in f.read(), "CRが混入している(Workflowが拒否する)"
    print(f"→ {os.path.abspath(a.out)}  ({len(js)} chars, LF確認済)")


if __name__ == "__main__":
    main()
