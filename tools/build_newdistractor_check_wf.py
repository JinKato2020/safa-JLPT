# -*- coding: utf-8 -*-
"""ユーザーが手作りした用法の誤答(エラー単語.txt)を検査する workflow を組み立てる。

背景: 一意性監査で誤答が3個未満に落ちた32問について、ユーザーが誤答を手作りした。
これを【そのまま入れない】。理由:
- 手作りでも第2の正解は入る(私の目視でも「ねだんが優しい」「洋服が固い」等を検出済)
- ユーザーの明示要求「レベルなどに応じて、複雑な単語や文法があれば削除して」
- 誤字が実在する(「声をかれられて」「風邪をそろそろ直した」)

検査軸は3つ:
 (a) secondAnswer … その語の正しい用法になっている＝誤答として使えない(最重要)
 (b) levelIssue   … 問題のレベルを超える語彙/文法(N4問題にN3以上等)
 (c) langError    … 誤字・非文・不自然な日本語

独立2パス(バッチ構成を変える)の【和集合】。1パスでは26〜29%取りこぼす(2026-07-17実測)。
"""
import argparse
import io
import json
import os
import random
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "content", "problems", "moji_goi")

PROMPT = """あなたはJLPT「用法」の誤答検査官。日本語教育の専門家として厳しく判定せよ。

用法の問題=「対象語(word)の使い方として最もよいものはどれか」を選ぶ4択。
正解(answer)=その語の正しい用法の文。誤答=【その語では言わない】文(他の語になら言える)。
候補(cands)は誤答として使う予定の文。各候補を3軸で判定せよ。

(a) secondAnswer (最重要): その候補が【その語の用法として成立してしまう】か。
    成立するなら誤答に使えない(=第2の正解になり第4の選択肢が正解になってしまう)。
    ★語の【比喩的・拡張的な語義】も正規の用法である。物理的な語義だけで判断するな。
    実例(必ずこの水準を拾え):
      「優しい」の誤答「あの店はねだんが優しくて、学生でも買える」
        → 「お財布に優しい」は実在する正規用法 = secondAnswer=true
      「固い」の誤答「この洋服は固いので、着るのが大変です」
        → 生地がかたい は自然 = secondAnswer=true
      「柔らかい」の誤答「みそしるの味が柔らかい」
        → 「柔らかい味わい」は実在 = secondAnswer=true
    certainty='clear'(普通に言う) / 'borderline'(言えなくはない)。疑わしきは borderline で拾え。
    「その語では絶対に言わない(他の語なら言える)」＝良い誤答は secondAnswer=false。

(b) levelIssue: 問題のレベル(level)を超える語彙・文法を含むか。
    N4の問題ならN5/N4相当の語彙・文法で書かれているべき。N3の問題ならN5〜N3相当。
    超える例: 「〜てたまらない」(N3文法)をN4問題に使う / 「成績を収める」(N2語彙)をN4問題に使う。
    含むなら levelIssue=true とし、reason に該当語/文法を明記せよ。

(c) langError: 誤字・脱字・非文・日本語として不自然な点があるか。
    実例: 「声をかれられて」(→かけられて) / 「風邪を直した」(→治した)。
    あるなら langError=true とし、reason に修正案を書け。

必ず入力と同じ id・同じ cands の番号(i)で全件返すこと(省略禁止)。
入力: """


def load_targets():
    """3個未満で温存された用法32問＋ユーザーの手作り誤答を突き合わせる。"""
    norm = lambda s: re.sub(r"[（(][^）)]*[）)]", "", s).replace(" ", "").replace("　", "").strip()
    txt = io.open(os.path.join(ROOT, "エラー単語.txt"), encoding="utf-8").read()
    blocks, cur = [], None
    for ln in txt.splitlines():
        s = ln.strip()
        if not s:
            continue
        if s.startswith("★正解:"):
            cur = {"answer": s[len("★正解:"):].strip(), "lines": []}
            blocks.append(cur)
        elif cur is not None:
            cur["lines"].append(s)

    data = {}
    for lv in ("N4", "N3"):
        d = json.load(io.open(os.path.join(SRC, f"usage_{lv}.json"), encoding="utf-8"))
        for x in (d if isinstance(d, list) else d["items"]):
            if isinstance(x, dict) and not x.get("verified"):
                data[x["answer"].strip()] = (lv, x)

    out = []
    for b in blocks:
        lv, it = data[b["answer"]]
        cands = []
        for ln in b["lines"]:
            if "これは削除" in ln:  # ユーザーが明示的に落とした既存誤答
                continue
            cands.append(ln)
        out.append({"id": it["id"], "level": lv, "word": re.sub(r"[（(][^）)]*[）)]", "", it["stem"]),
                    "answer": b["answer"],
                    "cands": [{"i": i, "t": t} for i, t in enumerate(cands)]})
    return out


def chunk(xs, n):
    return [xs[i:i + n] for i in range(0, len(xs), n)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()

    items = load_targets()
    n = sum(len(x["cands"]) for x in items)

    def shuffled(xs):
        ys = list(xs)
        random.Random(20260717).shuffle(ys)
        return ys

    jobs = []
    for tag, src in (("A", items), ("B", shuffled(items))):
        for b in chunk(src, a.batch):
            jobs.append({"pass": tag, "items": b})

    def neighbours(tag):
        m = {}
        for j in jobs:
            if j["pass"] != tag:
                continue
            ids = [x["id"] for x in j["items"]]
            for i in ids:
                m[i] = frozenset(ids) - {i}
        return m
    na, nb = neighbours("A"), neighbours("B")
    same = [i for i in na if na[i] == nb.get(i)]
    assert not same, f"パスBの隣人が変わっていない: {len(same)}件"

    print(f"対象: {len(items)}問 / 検査する誤答候補 {n}個")
    print(f"独立2パス × {len(jobs) // 2}バッチ = {len(jobs)}体 (Opus high)")

    js = f'''export const meta = {{
  name: 'usage-newdistractor-check',
  description: 'ユーザー手作りの用法誤答{n}個を検査(第2の正解/レベル超過/誤字)・独立2パス和集合',
  phases: [{{ title: 'Check', detail: '{len(jobs)}バッチ×Opus-high' }}],
}}

const JOBS = {json.dumps(jobs, ensure_ascii=False)}

const S = {{ type:'object', additionalProperties:false, required:['results'], properties:{{ results:{{ type:'array', items:{{
  type:'object', additionalProperties:false, required:['id','cands'],
  properties:{{
    id:{{type:'string'}},
    cands:{{ type:'array', items:{{ type:'object', additionalProperties:false,
      required:['i','secondAnswer','levelIssue','langError'],
      properties:{{
        i:{{type:'integer'}},
        secondAnswer:{{type:'boolean'}},
        certainty:{{type:'string'}},
        levelIssue:{{type:'boolean'}},
        langError:{{type:'boolean'}},
        reason:{{type:'string'}}
      }} }} }}
  }} }} }} }} }}

const P = {json.dumps(PROMPT, ensure_ascii=False)}

phase('Check')
const out = await pipeline(
  JOBS,
  (j, _o, i) => agent(P + JSON.stringify(j.items),
    {{ label: `check:${{j.pass}}#${{i}}`, phase: 'Check', model: 'opus', effort: 'high', schema: S }}),
)
const results = out.filter(Boolean).flatMap((o) => (o && o.results) || [])
log(`手作り誤答の検査 完了: ${{results.length}}件の判定({len(items)}問×2パス={len(items) * 2}が満点)`)
return {{ results }}
'''
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(js)
    with io.open(a.out, "rb") as f:
        assert b"\r" not in f.read(), "CRが混入している(Workflowが拒否する)"
    print(f"→ {os.path.abspath(a.out)} ({len(js)} chars, LF確認済)")


if __name__ == "__main__":
    main()
