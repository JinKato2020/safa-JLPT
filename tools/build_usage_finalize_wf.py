# -*- coding: utf-8 -*-
"""用法32問の誤答を最終形(データの表記スタイル)に整える workflow を組み立てる。

ユーザー確定 2026-07-17:
- 第2の正解の検査は厳しすぎた(「疑わしきはvalid」に振ったため)。今後は使わない。
- ただし round1 で検出した secondAnswer は落とす(元の一意性監査と独立2回の一致がある)。
- round2 の4個(優しい/こする×2/送る)は【検査を覆してユーザーが採用】。内容を変えない。
- 誤字・レベル超過は修正する(ユーザー指示「あなたがやって」)。

表記スタイル(既存データで実測):
- 文節ごとに半角スペースで分かち書き   例: 「かぜは もう すっかり 治（なお）りました。」
- 【全ての漢字】に全角括弧のふりがな。表示側 rubyGate がレベルで出し分けるのでデータは全付け。
- 機械(MeCab)生成は往復テストで一致22%・読み精度78%＝使えない(私（わたくし）等)。
  よってOpusに書かせ、MeCabとの食い違いを後段で点検する。
"""
import argparse
import collections
import importlib.util
import io
import json
import os
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "content", "problems", "moji_goi")
PROJ = os.path.join(os.path.expanduser("~"), ".claude", "projects",
                    "c--Users-jwpsa-Documents-desktop-claude-JLPT---",
                    "725249d9-5887-4086-8f9c-9cd37280a80c", "subagents", "workflows")
R1, R2 = "wf_723ea8f5-23c", "wf_afde773b-bd2"
# ユーザーが検査を覆して採用した4個(round2)。内容を変えず整形だけする。
ADOPT = {
    "このラーメンはスープが優しいから、あまり美味しくないです。",
    "歯ブラシで毎日しっかり歯をこすってください。",
    "バックしていたら、電柱に車をこすられました。",
    "電車を待つ間、スマホを見て時間を送りました。",
}

PROMPT = """あなたはJLPT教材の表記整形と校正の専門家。用法問題の誤答を【データの表記スタイル】に整える。

■ 表記スタイル(厳守・既存データの実例)
  「かぜは もう すっかり 治（なお）りました。」
  「今年（ことし）の 冬（ふゆ）は 去年（きょねん）より すっかり 寒（さむ）いです。」
  「旅行（りょこう）の 間（あいだ）、犬（いぬ）を 友（とも）だちに 預（あず）けた。」
 1. 文節ごとに【半角スペース】で分かち書き(自立語＋付属語=1文節)。読点の後にスペースは入れない。
 2. 【全ての漢字】に全角括弧のふりがな。漢字部分だけを括弧の直前に置き、送り仮名は括弧の外
    (例: 治（なお）りました / 寒（さむ）いです / 預（あず）けた)。
 3. 読みは文脈上正しいものを選ぶ(私→わたし、日本語→にほんご 等)。熟語は熟語のまま
    (日本語（にほんご）であって 日本（にっぽん）語（ご） ではない)。
 4. 文末は「。」。

■ 入力の各誤答の扱い(kind で指示)
  kind='keep'  … 既に整形済み。【一字一句そのまま】返す。
  kind='adopt' … ユーザーが採用を決めた文。【内容を変えず】表記スタイルにするだけ。
                 「不自然だ」と感じても書き換えるな。整形のみ。
  kind='fix'   … why に書かれた欠陥を直してから整形する。
                 ★直す時も【その語の誤用である】性質を壊さないこと。
                   誤答とは「その語では言わない文(他の語になら言える)」。
                   直した結果その語の正しい用法になってしまったら失敗。
                 ★レベル超過の指摘があれば、問題のレベル(level)以下の語彙に置き換える。

必ず入力と同じ id・同じ個数・同じ順で返すこと。出力は整形済みの文字列の配列。
入力: """


def journal(run):
    for l in io.open(os.path.join(PROJ, run, "journal.jsonl"), encoding="utf-8"):
        if l.strip():
            r = json.loads(l)
            if r.get("type") == "result":
                yield (r.get("result") or {}).get("results") or []


def fold(run):
    """id→i→判定(和集合)。"""
    out = collections.defaultdict(lambda: collections.defaultdict(
        lambda: {"sa": False, "li": False, "le": False, "why": []}))
    for rs in journal(run):
        for x in rs:
            for c in x["cands"]:
                d = out[x["id"]][c["i"]]
                d["sa"] = d["sa"] or bool(c.get("secondAnswer"))
                d["li"] = d["li"] or bool(c.get("levelIssue"))
                d["le"] = d["le"] or bool(c.get("langError"))
                if c.get("reason") and (c.get("levelIssue") or c.get("langError")):
                    d["why"].append(c["reason"])
    return out


def build():
    sc1 = io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_wf1.js"), encoding="utf-8").read() \
        if False else None
    # round1/round2 の入力(候補文)を journal と同じ順序で復元するため、走行スクリプトから読む
    sp = os.path.join(os.path.expanduser("~"), "AppData", "Local", "Temp", "claude",
                      "c--Users-jwpsa-Documents-desktop-claude-JLPT---",
                      "725249d9-5887-4086-8f9c-9cd37280a80c", "scratchpad")
    items1 = {}
    for j in json.loads(re.search(r"^const JOBS = (.*)$",
                                  io.open(os.path.join(sp, "newdistractor_check.js"), encoding="utf-8").read(), re.M).group(1)):
        for x in j["items"]:
            items1[x["id"]] = x
    items2 = {x["id"]: x for x in json.load(io.open(os.path.join(sp, "new4.json"), encoding="utf-8"))}
    f1, f2 = fold(R1), fold(R2)

    spec = importlib.util.spec_from_file_location("a", os.path.join(ROOT, "tools", "apply_usage_audit.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    audit = m.load_audit(["wf_eb718d4b-760", "wf_e0659a14-e85"])

    data = {}
    for lv in ("N4", "N3"):
        d = json.load(io.open(os.path.join(SRC, f"usage_{lv}.json"), encoding="utf-8"))
        for x in (d if isinstance(d, list) else d["items"]):
            if isinstance(x, dict) and not x.get("verified"):
                data[x["id"]] = (lv, x)

    blocks, cur = [], None
    for ln in io.open(os.path.join(ROOT, "エラー単語.txt"), encoding="utf-8").read().splitlines():
        s = ln.strip()
        if not s:
            continue
        if s.startswith("★正解:"):
            cur = {"answer": s[len("★正解:"):].strip(), "lines": []}
            blocks.append(cur)
        elif cur is not None:
            cur["lines"].append(s)
    byans = {b["answer"]: b for b in blocks}

    out = []
    for pid, (lv, it) in data.items():
        b = byans[it["answer"].strip()]
        kill = set(audit[pid]["kill"]) if pid in audit else set()
        drop_user = {l for l in b["lines"] if "これは削除" in l}
        keep = [c for c in it["choices"]
                if c != it["answer"] and c not in kill
                and not any(c.strip() in d for d in drop_user)]
        cands = [{"t": c, "kind": "keep"} for c in keep]
        for src, items in ((f1, items1), (f2, items2)):
            if pid not in items:
                continue
            for c in items[pid]["cands"]:
                d = src[pid][c["i"]]
                t = c["t"]
                if t in ADOPT:
                    cands.append({"t": t, "kind": "adopt"})
                elif d["sa"]:
                    continue  # 第2の正解=落とす
                elif d["li"] or d["le"]:
                    cands.append({"t": t, "kind": "fix", "why": " / ".join(dict.fromkeys(d["why"]))[:400]})
                else:
                    cands.append({"t": t, "kind": "fix", "why": "欠陥なし。表記スタイルに整形するだけ。"})
        out.append({"id": pid, "level": lv, "word": re.sub(r"[（(][^）)]*[）)]", "", it["stem"]),
                    "answer": it["answer"], "cands": cands})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()
    items = build()
    short = [(x["word"], len(x["cands"])) for x in items if len(x["cands"]) < 3]
    print(f"対象 {len(items)}問 / 最終誤答 計{sum(len(x['cands']) for x in items)}個")
    print(f"  keep={sum(1 for x in items for c in x['cands'] if c['kind']=='keep')} "
          f"adopt={sum(1 for x in items for c in x['cands'] if c['kind']=='adopt')} "
          f"fix={sum(1 for x in items for c in x['cands'] if c['kind']=='fix')}")
    assert not short, f"誤答が3個未満の問題がある: {short}"
    print("  ✅ 全問が誤答3個以上")

    batches = [items[i:i + a.batch] for i in range(0, len(items), a.batch)]
    js = """export const meta = {
  name: 'usage-finalize-distractors',
  description: '用法32問の誤答を最終形へ(誤字/レベル超過を修正・分かち書き+全漢字ふりがな)',
  phases: [{ title: 'Finalize', detail: '__N__バッチ×Opus-high' }],
}

const BATCHES = __B__

const S = { type:'object', additionalProperties:false, required:['results'], properties:{ results:{ type:'array', items:{
  type:'object', additionalProperties:false, required:['id','distractors'],
  properties:{ id:{type:'string'}, distractors:{ type:'array', items:{type:'string'} } } } } } }

const P = __P__

phase('Finalize')
const out = await pipeline(BATCHES,
  (b, _o, i) => agent(P + JSON.stringify(b),
    { label: 'finalize#' + i, phase: 'Finalize', model: 'opus', effort: 'high', schema: S }))
const results = out.filter(Boolean).flatMap((o) => (o && o.results) || [])
log('用法の最終整形 完了: ' + results.length + '問')
return { results }
"""
    js = (js.replace("__N__", str(len(batches)))
            .replace("__B__", json.dumps(batches, ensure_ascii=False))
            .replace("__P__", json.dumps(PROMPT, ensure_ascii=False)))
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(js)
    with io.open(a.out, "rb") as f:
        raw = f.read()
        assert b"\r" not in raw, "CRが混入している"
        assert b"`" not in raw, "バッククォートが残っている"
    print(f"→ {os.path.abspath(a.out)} ({len(js)} chars) / {len(batches)}体")


if __name__ == "__main__":
    main()
