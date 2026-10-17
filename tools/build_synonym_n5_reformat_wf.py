# -*- coding: utf-8 -*-
"""既に生成済みのN5言い換え問題(内容はOK)を、N5の正しい保存形式へ整形する workflow を作る。
内容(本文・正解・誤答)は変えず、形式だけ直す:
  - sentence(分かち書き・ルビ無)/stem(分かち書き・半角ルビ)/furi(分かち書き・全角ルビ)を同期
  - underline=対象語が本文にそのまま現れる表層形 / word=辞書形
  - pattern を付与(noun/adj/adv/verb/hypernym/negation_cross/perspective_cross)
  - 誤答数: *_cross は正確に3個 / それ以外は3〜5個 に整える(reasonsも同数・同順)
入力 = N5 の task .output(生成WFの返り値)。
使い方: python tools/build_synonym_n5_reformat_wf.py <N5.output> -o scratchpad/synonym_new/wf_N5_reformat.js
"""
import argparse, io, json, os, sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_items(path):
    d = json.loads(io.open(path, encoding="utf-8").read())
    r = d.get("result", d)
    if isinstance(r, str):
        r = json.loads(r)
    return r["items"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("output")
    ap.add_argument("--batch", type=int, default=49)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()
    inp = {x["vocabId"]: x for x in json.load(io.open(os.path.join(ROOT, "scratchpad/synonym_new/input_N5.json"), encoding="utf-8"))}
    raw = []
    for it in load_items(a.output):
        if it.get("needsDrop"):
            continue
        d = [x for x in (it.get("distractors") or []) if x]
        if len(d) < 3 or not it.get("answer") or not it.get("sentence"):
            continue
        v = inp.get(it["vocabId"], {})
        raw.append({
            "vocabId": it["vocabId"],
            "word": v.get("word", it.get("underline", "")),
            "reading": v.get("reading", ""),
            "meaning": v.get("meaning", ""),
            "sentence_ruby": it.get("stem") or it.get("sentence"),  # 半角ルビ付き(分かち書き無)
            "answer": it["answer"],
            "distractors": d,
            "reasons": it.get("reasons") or [],
        })
    batches = [raw[i:i + a.batch] for i in range(0, len(raw), a.batch)]
    print(f"N5 reformat: {len(raw)}問 / {len(batches)}バッチ")

    RULES = """あなたはJLPT N5「言い換え類義(文レベル)」の整形担当。渡すのは既に内容確定済みの問題。
【厳守】本文・正解・誤答の"意味内容"は変えない。形式だけN5の正しい保存形へ直す。
各入力 {vocabId, word=辞書形, reading, meaning, sentence_ruby=半角ルビ付き本文, answer, distractors, reasons} について出力せよ:
1) sentence: sentence_ruby からルビを外し、N5らしい【分かち書き】(文節ごとに半角スペース)にした本文。漢字はそのまま。例「この 教室は 明るいです。」
2) stem: sentence と同じ分かち書きで、漢字に【半角カッコ】ルビを付けた形。例「この 教室(きょうしつ)は 明(あか)るいです。」全角カッコ（）は禁止。
3) furi: stem と同じだが【全角カッコ】ルビ。例「この 教室（きょうしつ）は 明（あか）るいです。」
4) word: 辞書形(入力の word)。 underline: 対象語が sentence に【そのまま現れる表層形】(sentence の部分文字列であること。活用していれば活用形のまま。例 sentenceが「…会いました」なら underline=「会い」)。
5) pattern: 次から1つ。noun/adj/adv/verb=対象語の品詞。negation_cross=正解が『反対語＋ない』等の否定で言い換える型(例 暖かい⇄寒くない, 開いている⇄閉まっていない)。perspective_cross=視点を変える言い換え。hypernym=上位語での言い換え。
6) answer: 分かち書き＋半角ルビ(意味は変えない。必要なら分かち書き/ルビだけ整える)。
7) choices: 誤答。**pattern が _cross(negation_cross/perspective_cross)なら正確に3個**、それ以外は3〜5個。多い場合は最も良い誤答を残し、あとは捨てる(意味は変えない)。各誤答は分かち書き＋半角ルビ。
8) reasons: choices と同数・同順に整える(捨てた誤答の理由も捨てる)。
必ず入力と同じ vocabId・同じ順で items を返す。全{n}問。
入力: {data}"""

    schema_props = ('{ vocabId:{type:"string"}, sentence:{type:"string"}, stem:{type:"string"}, furi:{type:"string"},'
                    ' word:{type:"string"}, underline:{type:"string"}, pattern:{type:"string"}, answer:{type:"string"},'
                    ' choices:{type:"array",items:{type:"string"},minItems:3,maxItems:5},'
                    ' reasons:{type:"array",items:{type:"string"},minItems:3,maxItems:5} }')

    js = f'''export const meta = {{
  name: 'synonym-n5-reformat',
  description: 'N5言い換え {len(raw)}問を正しい保存形式へ整形(内容不変・分かち書き/ルビ/pattern/下線)',
  phases: [{{ title: 'Reformat', detail: '{len(batches)}バッチ×Opus' }}],
}}
const BATCHES = {json.dumps(batches, ensure_ascii=False)}
const SCHEMA = {{ type:'object', additionalProperties:false, required:['items'], properties:{{ items:{{ type:'array', items:{{
  type:'object', additionalProperties:false, required:['vocabId','sentence','stem','furi','word','underline','pattern','answer','choices','reasons'],
  properties: {schema_props} }} }} }} }}
const prompt = (b) => `{RULES.replace("{n}", "${b.length}").replace("{data}", "${JSON.stringify(b)}")}`
phase('Reformat')
const out = await parallel(BATCHES.map((b, i) => () => agent(prompt(b), {{ label: `reformat:N5#${{i}}`, phase: 'Reformat', model: 'opus', effort: 'high', schema: SCHEMA }})))
const items = out.filter(Boolean).flatMap((o) => (o && o.items) || [])
log(`N5 reformat 完了: ${{items.length}}問`)
return {{ level: 'N5', items }}
'''
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(js)
    with io.open(a.out, "rb") as f:
        assert b"\r" not in f.read()
    print(f"→ {os.path.abspath(a.out)} ({len(js)} chars)")


if __name__ == "__main__":
    main()
