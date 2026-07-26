# -*- coding: utf-8 -*-
"""用法の一意性監査(Sub-Plan E)の結果を適用する。

方針(ユーザー確定 2026-07-17):
- 反証役が valid と判定した誤答(clear/borderline とも)を【削除する】。追加生成はしない
  (追加しない＝新しい第2の正解が構造的に入らない。言い換えの修理段は4件の新バグを作った)。
- 誤答が3個以上残る問題は自動で確定(verified)。
- 3未満に落ちる問題は【変更せず】リストで報告する(ユーザーが誤答を手で作成 or 問題ごと落とす判断)。
  ＝中途半端に壊した状態で残さない。

★複数runの【和集合】を取る(多数決ではない)。
  監査は再現性が約70%しかない(同一問題を2回判定させると30%で結果が食い違う=実測)。
  損害が非対称: 良い誤答を誤って消す=軽微(下限3で保護) / 本物の第2の正解を見逃す=重大(バグ出荷)。
  よって「どれか1回でも valid と言われたら削除」＝取りこぼしを最小化する。

使い方: python tools/apply_usage_audit.py --run <runId> [<runId2> ...] [--dry]
"""
import argparse
import collections
import glob
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "content", "problems", "moji_goi")
PROJ = os.path.join(os.path.expanduser("~"), ".claude", "projects",
                    "c--Users-jwpsa-Documents-desktop-claude-JLPT---")
FLOOR = 3  # 4択に必要な誤答の最小数


def load_audit(runs):
    """複数runの判定を id ごとに【和集合】でまとめる。votes=その問題が何回判定されたか。"""
    merged = {}
    for run in runs:
        hits = glob.glob(os.path.join(PROJ, "*", "subagents", "workflows", run, "journal.jsonl"))
        if not hits:
            sys.exit(f"journal が見つかりません: {run}")
        with io.open(hits[0], encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                r = json.loads(line)
                if r.get("type") != "result":
                    continue
                for x in (r.get("result") or {}).get("results") or []:
                    m = merged.setdefault(x["id"], {"id": x["id"], "kill": {}, "votes": 0})
                    m["votes"] += 1
                    for v in x["valid"]:
                        # 同じ選択肢が複数回挙がったら、より強い certainty を残す
                        prev = m["kill"].get(v["text"])
                        if prev is None or (prev["certainty"] == "borderline" and v["certainty"] == "clear"):
                            m["kill"][v["text"]] = v
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True, nargs="+", help="runId(複数可・和集合を取る)")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--report", help="3未満に落ちた問題の報告先(markdown)")
    a = ap.parse_args()

    audit = load_audit(a.run)
    votes = collections.Counter(m["votes"] for m in audit.values())
    print(f"監査run: {len(a.run)}本 | 判定回数の分布(問題数): {dict(sorted(votes.items()))}")
    thin = [k for k, m in audit.items() if m["votes"] < 2]
    if thin:
        print(f"  ⚠ 1回しか判定されていない問題: {len(thin)}問 (取りこぼしの可能性) {thin[:5]}")
    applied, under, untouched, total = [], [], [], 0

    for lv in ("N4", "N3"):
        p = os.path.join(SRC, f"usage_{lv}.json")
        raw = json.load(io.open(p, encoding="utf-8"))
        items = raw if isinstance(raw, list) else raw["items"]
        changed = False
        for it in items:
            if not isinstance(it, dict):
                continue
            total += 1
            au = audit.get(it["id"])
            if au is None:
                untouched.append(it["id"])  # 監査できていない = 触らない
                continue
            kill = set(au["kill"])  # 全runの和集合
            survivors = [c for c in it["choices"] if c != it["answer"] and c not in kill]
            if len(survivors) < FLOOR:
                # 中途半端に壊さない。元のまま残してユーザーへ報告する。
                under.append({"id": it["id"], "level": lv, "word": it["stem"], "answer": it["answer"],
                              "survivors": survivors, "votes": au["votes"],
                              "killed": list(au["kill"].values())})
                continue
            it["choices"] = [it["answer"]] + survivors
            it["verified"] = True
            assert len([c for c in it["choices"] if c != it["answer"]]) >= FLOOR, f"{it['id']}: 誤答不足"
            assert it["choices"].count(it["answer"]) == 1, f"{it['id']}: 正解が重複"
            applied.append(it["id"])
            changed = True
        if changed and not a.dry:
            with io.open(p, "w", encoding="utf-8", newline="\n") as f:
                json.dump(raw, f, ensure_ascii=False, indent=1)
                f.write("\n")

    print(f"用法 {total}問 / 監査済み {len(audit)}問")
    print(f"  ✅ 自動確定(誤答3個以上残った)  : {len(applied)}問")
    print(f"  ⚠ 誤答3未満 → 手作り待ち(未変更): {len(under)}問")
    print(f"  ⏳ 監査できていない(未変更)     : {len(untouched)}問 {untouched[:5]}")
    if a.dry:
        print("  --dry のため書き込みなし")

    if a.report and under:
        with io.open(a.report, "w", encoding="utf-8", newline="\n") as f:
            f.write("# 用法: 誤答が3個未満に落ちた問題（誤答の作成が必要）\n\n")
            f.write("> 一意性監査で「その語の正しい用法として成立してしまう」誤答を削除した結果、\n")
            f.write("> 4択に必要な誤答3個を確保できなくなった問題。**データは未変更のまま**です。\n")
            f.write("> 誤答を作成いただくか、問題ごと落とす判断をお願いします。\n\n")
            for u in under:
                f.write(f"## {u['id']}（{u['level']}）語＝**{u['word']}**\n\n")
                f.write(f"- ★正解: {u['answer']}\n")
                f.write(f"- 生き残った誤答: **{len(u['survivors'])}個**（3個必要）\n")
                for s in u["survivors"]:
                    f.write(f"    - ○ {s}\n")
                f.write(f"- 削除対象（その語の正用として成立してしまう）: {len(u['killed'])}個\n")
                for k in u["killed"]:
                    f.write(f"    - ✗[{k['certainty']}] {k['text']}\n")
                    f.write(f"        - {k['why']}\n")
                f.write("\n")
        print(f"→ 報告書: {os.path.abspath(a.report)}")


if __name__ == "__main__":
    main()
