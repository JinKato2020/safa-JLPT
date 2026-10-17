# -*- coding: utf-8 -*-
"""言い換え類義の【新規作問】workflow を組み立てる(未カバーの言い換え可能語に新問題を作る)。
build_synonym_wf.py(既存問の再生成)との違い: 入力は「語だけ」で、文・正解・誤答を新規に創る。

入力 = scratchpad/synonym_new/input_{level}.json (list of {vocabId, word, reading, meaning, syn})
使い方:
  python tools/build_synonym_new_wf.py --level N3 -o scratchpad/synonym_new/wf_N3.js
"""
import argparse, io, json, os, sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RECIPE = """【言い換え類義 作問レシピ(公式PDF分析)】
狙い: 語の意味の核を別の言い方で捉えられるか。文脈は語義を一義に固定する最小限。
正解の条件: 文に代入して意味が変わらない真の同義(あまった⇄のこった / むかい⇄まえ / 流行している⇄はやっている)。
誤答の型(公式の手口):
 1 同一意味フィールドで揃える(位置語なら位置語だけ/量なら量だけ)=分野で消せない。
 2 同一品詞・同一文型スロット=文法で消せない。
 3 連想の罠(near-miss)を必ず1つ: 対象語に連想で結びつくが同義でない(くさる→まずくなった=腐れば不味いが定義でない)。
 4 方向違い・程度違い(あまる↔ふえた/少なくなった)。
禁止: 荒唐無稽な分野違いダミー(易しすぎ)は絶対に入れない。個人名も禁止(役割ベース=先生/学生/店員/客)。国際的にボーダーレスに。

★★一意性(最重要)★★ 各誤答を「文に代入→意味が保たれるか」テストせよ。少しでも同義が成り立つ語は【第2の正解】=絶対に不可。
失敗例: 刷った→「印刷する」に対し誤答「コピーする」は成立=失格 / 活気→「活力」に対し誤答「熱気」「エネルギー」も成立=失格。
教訓: 【自分が選んだ正解の近縁語を誤答にするな】。誤答は「下線語とも正解とも非同義」であること。
★誤答の個数: 原則6個。一意な6個目が作れないなら5→4に減らせ(4択出題には誤答3個で足りる)。第2の正解を作るより減らす方が正しい。
 4個すら一意に作れない語は needsDrop=true(その語は言い換え問題に向かない=正直に落とす)。
reasons は各誤答が「代入すると意味がどうズレるか」を20〜40字で1つずつ(誤答と同数・同順)。解説文は生成しない。"""

N3_PROMPT = """あなたはJLPT N3「言い換え類義(語レベル)」の作問者。公式N3形式=文中の下線語と意味が最も近い"語"を4択から選ぶ。
{recipe}

各入力 {word=対象語, reading, meaning=英語ヒント, syn=仮の同義語(誤りうる)} について新規に作れ:
(a) sentence: 対象語を自然に使う短文を1つ創る。対象語をそのまま含め、その語を underline に入れる。ルビ不要(語レベル)。
(b) answer: 対象語の真の同義語1語。syn が真の同義でなければ正しい語に直し answerFixed=true(例 会う→"会見する"は誤り、"面会する"が正)。
(c) distractors: 誤答語を6個(無理なら5→4)。同一意味フィールド・同一品詞、うち1つは連想の罠。各誤答は【対象語とも確定正解とも】非同義。
(d) reasons: 各誤答の非同義理由を20〜40字で(誤答と同数・同順)。
必ず入力と同じ vocabId・同じ順で items を返す。全{n}問を返すこと(省略禁止)。
入力({n}語): {data}"""

NN_PROMPT = """あなたはJLPT {lvl}「言い換え類義(文レベル)」の作問者。公式{lvl}形式=文まるごとの言い換え(選択肢も文・一語だけ違う)。
{recipe}

各入力 {word=対象語, reading, meaning=英語ヒント, syn=仮の同義語(誤りうる)} について新規に作れ:
(a) stem: 対象語を自然に使う短文を1つ創る(対象語を含む)。漢字にはルビをかなで丸括弧付き(例 大抵(たいてい))。sentence は stem と同一文字列でよい。underline=対象語。
(b) answer: stem の対象語だけを真の同義表現に置換した文(他は変えない・全文ルビ)。syn がズレていれば正しい同義に直し answerFixed=true。
(c) distractors: 誤答文を6つ(無理なら5→4)。stem と1要素だけ違う・同一場面・同義でない文(全文ルビ)。同一品詞スロット、うち1つは連想の罠。各誤答文は【stemとも確定answerとも】非同義。
(d) reasons: 各誤答文が元の文と意味がどうズレるかを20〜40字で(誤答と同数・同順)。
必ず入力と同じ vocabId・同じ順で items を返す。全{n}問を返すこと(省略禁止)。
入力({n}語): {data}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", required=True, choices=["N3", "N4", "N5"])
    ap.add_argument("--batch", type=int, default=50)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()
    lv = a.level
    src = json.load(io.open(os.path.join(ROOT, f"scratchpad/synonym_new/input_{lv}.json"), encoding="utf-8"))
    batches = [src[i:i + a.batch] for i in range(0, len(src), a.batch)]
    word_level = lv == "N3"
    tpl = N3_PROMPT if word_level else NN_PROMPT.replace("{lvl}", lv)
    print(f"{lv}: {len(src)}語 / {len(batches)}バッチ(batch={a.batch}) / {'語レベル' if word_level else '文レベル'}")

    item_props = ('{ vocabId:{type:"string"}, answer:{type:"string"}, answerFixed:{type:"boolean"}, needsDrop:{type:"boolean"},'
                  ' sentence:{type:"string"}, underline:{type:"string"},'
                  ' distractors:{type:"array",items:{type:"string"},minItems:3,maxItems:6},'
                  ' reasons:{type:"array",items:{type:"string"},minItems:3,maxItems:6} }')
    if not word_level:
        item_props = item_props.replace('sentence:{type:"string"},', 'sentence:{type:"string"}, stem:{type:"string"},')
    req = "['vocabId','answer','sentence','underline','distractors','reasons']"

    js = f'''export const meta = {{
  name: 'synonym-new-{lv.lower()}',
  description: '言い換え類義 {lv} 新規作問 {len(src)}語(未カバーの言い換え可能語): Opus-high生成→独立反証→非一意ダミー修理',
  phases: [{{ title: 'Gen', detail: '{len(batches)}バッチ×Opus-high 新規作問' }}, {{ title: 'Verify', detail: '独立反証: 第2の正解を暴く' }}, {{ title: 'Repair', detail: '非一意ダミーのみ差し替え' }}],
}}

const RECIPE = {json.dumps(RECIPE, ensure_ascii=False)}
const BATCHES = {json.dumps(batches, ensure_ascii=False)}

const GEN_SCHEMA = {{ type:'object', additionalProperties:false, required:['items'], properties:{{ items:{{ type:'array', items:{{
  type:'object', additionalProperties:false, required:{req},
  properties: {item_props} }} }} }} }}

const VERIFY_SCHEMA = {{ type:'object', additionalProperties:false, required:['results'], properties:{{ results:{{ type:'array', items:{{
  type:'object', additionalProperties:false, required:['vocabId','validCount','verdict'],
  properties:{{ vocabId:{{type:'string'}}, validCount:{{type:'integer'}}, validChoices:{{type:'array',items:{{type:'string'}}}},
    verdict:{{type:'string'}}, note:{{type:'string'}} }} }} }} }} }}

const genPrompt = (b) => `{tpl.replace("{recipe}", "${RECIPE}").replace("{n}", "${b.length}").replace("{data}", "${JSON.stringify(b)}")}`

const verifyPrompt = (items) => `あなたはJLPT言い換え({'語' if word_level else '文'}レベル)の一意性検査官(反証役)。目的は【第2の正解】を暴くこと。
{'各問は下線語(underline)と意味が最も近い語を選ぶ。answer と各 distractor を下線語の位置に代入し同義が成り立つか判定。' if word_level else '各問は stem と「だいたい同じ意味の文」を選ぶ。answer と各 distractor が stem と同義文か判定。'}
少しでも同義が成り立つものは valid(疑わしきは valid にして拾う)。刷る/印刷する に対する「コピーする」水準の重なりは valid とせよ。
valid が2つ以上なら verdict='multi'(非一意=fail)。answerのみなら 'unique'。answerすら不成立なら 'bad_answer'。
各問 {{vocabId, validCount, validChoices, verdict, note}} を返す。全${{items.length}}問。
問題: ${{JSON.stringify(items)}}`

const repairPrompt = (bad) => `あなたはJLPT言い換えの誤答修理担当。以下は独立検査で【第2の正解】が見つかった問題。
各問の validChoices(=正解になってしまう誤答)を【削除】し、同じ意味フィールド・同じ品詞で【下線語とも正解とも明確に非同義】な{'語' if word_level else '文'}に差し替えよ。
思いつかなければ無理に足さず誤答を減らして(6→5→4)返せ。第2の正解を作るより減らす方が正しい。reasons も作り直す(誤答と同数・同順)。
必ず同じ vocabId で items を返す。全${{bad.length}}問。
問題と検査結果: ${{JSON.stringify(bad)}}`

phase('Gen')
const out = await pipeline(
  BATCHES,
  (b) => agent(genPrompt(b), {{ label: `gen:{lv}`, phase: 'Gen', model: 'opus', effort: 'high', schema: GEN_SCHEMA }}),
  async (gen, b, i) => {{
    if (!gen || !gen.items || !gen.items.length) return {{ items: [], results: [] }}
    const v = await agent(verifyPrompt(gen.items), {{ label: `verify:{lv}#${{i}}`, phase: 'Verify', model: 'opus', effort: 'high', schema: VERIFY_SCHEMA }})
    const results = (v && v.results) || []
    const badIds = new Set(results.filter((r) => r.verdict !== 'unique').map((r) => r.vocabId))
    if (!badIds.size) return {{ items: gen.items, results }}
    const bad = gen.items.filter((it) => badIds.has(it.vocabId)).map((it) => ({{ ...it, 検査: results.find((r) => r.vocabId === it.vocabId) }}))
    log(`{lv} batch${{i}}: 非一意 ${{bad.length}}/${{gen.items.length}} 件を修理`)
    const fixed = await agent(repairPrompt(bad), {{ label: `repair:{lv}#${{i}}`, phase: 'Repair', model: 'opus', effort: 'high', schema: GEN_SCHEMA }})
    const fixedById = new Map(((fixed && fixed.items) || []).map((it) => [it.vocabId, it]))
    return {{ items: gen.items.map((it) => fixedById.get(it.vocabId) || it), results }}
  }},
)
const items = out.filter(Boolean).flatMap((o) => o.items || [])
const results = out.filter(Boolean).flatMap((o) => o.results || [])
log(`{lv} 完了: ${{items.length}}問 / 判定${{results.length}}件`)
return {{ level: '{lv}', items, results }}
'''
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(js)
    with io.open(a.out, "rb") as f:
        assert b"\r" not in f.read(), "CR混入(Workflowが拒否)"
    print(f"→ {os.path.abspath(a.out)}  ({len(js)} chars, LF確認済)")


if __name__ == "__main__":
    main()
