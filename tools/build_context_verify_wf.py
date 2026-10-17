# -*- coding: utf-8 -*-
"""文脈規定の「未検証の既存問題をそのまま検査する」Workflowを生成する(作り直さない)。

狙い: content/problems/moji_goi/context_<LV>.json の verified が付いていない問題を、
本文・正解・誤答を一切書き換えずに点検し、合格したものだけ verified=true を付ける。
落ちたものは書き換えず「人手送り」リストへ回す(=既存データを壊さない)。

検査軸(各問):
 (a) answerBad   … 正解を空所に入れても不自然/非文/誤字 = 正解が壊れている
 (b) secondAnswer… 誤答を空所に入れると母語話者が自然に言ってしまう = 第2の正解(該当indexを列挙)
 (c) langError   … 問題文/語に誤字・非文・不自然
判定:
 - どれも無い(3つの誤答すべて確実に不正解・正解も自然) → verdict='ok'(合格=verified)
 - それ以外(第2の正解/正解破綻/誤字) → verdict='ng'(人手送り。誤答3個しか無いので1個落ちても3未満)

出力: Workflow形式の .mjs (Workflowツールで実行 → journal.jsonl と resume で途中救済が効く)。
使い方: python tools/build_context_verify_wf.py --level N4 --batch 40 -o scratchpad/context_verify/wf_verify_N4.mjs
"""
import argparse, io, json, os, sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PROMPT = """あなたはJLPT「文脈規定」の検査官。日本語教育の専門家として厳しく判定せよ。

文脈規定=文中の空所〔　〕に最もよく合う語を選ぶ4択。
answer=空所に入る正しい語。choices=空所に入れると不自然になるべき誤答(3個)。

各問(id)を次の軸で判定し、全件返せ(省略禁止):
(a) answerBad: 正解(answer)を空所に入れても不自然/非文/誤字がある=正解が壊れている(true/false)。
(b) secondAnswer: choices のうち、空所に入れると母語話者が自然に言ってしまう語(=第2の正解)があるか。
    ★比喩・慣用・拡張用法も自然なら第2の正解とみなす。疑わしきは拾え(borderlineもtrue扱い)。
    該当する誤答の index(0始まり)を badChoices に列挙(無ければ空配列)。
(c) langError: 問題文や語に誤字・脱字・非文・不自然があるか(true/false)。

判定 verdict:
  answerBad か langError が true、または badChoices が1個以上 → 'ng'
  どれも無い(3誤答すべて確実に不正解・正解も自然) → 'ok'
note には ng の理由を短く(okは空でよい)。
入力(問題の配列): """

SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["results"],
    "properties": {"results": {"type": "array", "items": {
        "type": "object", "additionalProperties": False,
        "required": ["id", "verdict", "badChoices"],
        "properties": {
            "id": {"type": "string"},
            "verdict": {"type": "string"},
            "answerBad": {"type": "boolean"},
            "secondAnswer": {"type": "boolean"},
            "langError": {"type": "boolean"},
            "badChoices": {"type": "array", "items": {"type": "integer"}},
            "note": {"type": "string"},
        }}}}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", required=True)
    ap.add_argument("--batch", type=int, default=40)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()

    src = os.path.join(ROOT, f"content/problems/moji_goi/context_{a.level}.json")
    d = json.load(io.open(src, encoding="utf-8"))
    unver = [x for x in d["items"] if x.get("verified") is not True]
    # 検査に渡すのは id・本文・正解・誤答だけ(最小)。書き換えはしない。
    items = [{"id": x["id"], "prompt": x["prompt"], "answer": x["answer"], "choices": x.get("choices", [])} for x in unver]
    jobs = [{"items": items[i:i + a.batch]} for i in range(0, len(items), a.batch)]

    print(f"対象: 未検証{len(items)}問 / バッチ{a.batch} → エージェント{len(jobs)}体 (Opus high・1パス=最小)")

    js = f'''export const meta = {{
  name: 'context-verify-{a.level}',
  description: '文脈規定{a.level} 未検証{len(items)}問をそのまま検査(第2の正解/正解破綻/誤字)。合格のみverified',
  phases: [{{ title: 'Check', detail: '{len(jobs)}バッチ×Opus-high' }}],
}}

const JOBS = {json.dumps(jobs, ensure_ascii=False)}
const S = {json.dumps(SCHEMA, ensure_ascii=False)}
const P = {json.dumps(PROMPT, ensure_ascii=False)}

phase('Check')
const out = await pipeline(
  JOBS,
  (j, _o, i) => agent(P + JSON.stringify(j.items),
    {{ label: `ctx:{a.level}#${{i}}`, phase: 'Check', model: 'opus', effort: 'high', schema: S }}),
)
const results = out.filter(Boolean).flatMap((o) => (o && o.results) || [])
log(`文脈規定{a.level}検査 完了: ${{results.length}}件の判定(未検証{len(items)}が満点)`)
return {{ level: '{a.level}', results }}
'''
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(js)
    with io.open(a.out, "rb") as f:
        assert b"\r" not in f.read(), "CRが混入している(Workflowが拒否する)"
    print(f"→ {os.path.abspath(a.out)} ({len(js)} chars, LF確認済)")


if __name__ == "__main__":
    main()
