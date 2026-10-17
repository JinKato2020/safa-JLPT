# -*- coding: utf-8 -*-
"""言い換え類義の一意性【再】監査の結果を適用する。

方針(用法 Sub-Plan E と同一・ユーザー確定 2026-07-17):
- valid と判定された誤答(clear/borderline とも)を【削除する】。追加生成はしない。
- 誤答が3個以上残る問題は verified のまま維持。
- 3未満に落ちる問題は【変更せず】リストで報告する(ユーザーが手で作成 or 問題ごと落とす)。
- 複数パスの【和集合】。実測: 2パスの完全一致は88%だが、和集合68件のうち両方が指摘したのは
  44%だけ。1パスでは26〜29%を取りこぼす。損害が非対称(誤って消す=軽微・下限3で保護 /
  第2の正解を見逃す=バグ出荷)なので、どれか1パスでも valid なら削除する。

★選択肢は【番号(i)】で同定する。N4の選択肢はふりがな括弧を含み、テキスト照合は
  表記ゆれで空振りする(削除したつもりが削除されない)。
  i は choices の添字。build_synonym_verify_wf.py が enumerate(choices) で振ったもの。

使い方: python tools/apply_synonym_audit.py --run <runId> [--dry] [--report out.md]
"""
import argparse
import collections
import glob
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
                    "c--Users-jwpsa-Documents-desktop-claude-JLPT---")
FLOOR = 3  # 4択に必要な誤答の最小数


def load_audit(run, script):
    """journal を読み、id ごとに全パスの判定を【和集合】でまとめる。

    journal には label が入らないため、バッチの id 集合でスクリプトの JOBS と
    照合してパスを特定する(パスA/Bは隣人が全問異なるので集合は一意に対応する)。
    """
    jobs = json.loads(re.search(r"^const JOBS = (.*)$", io.open(script, encoding="utf-8").read(), re.M).group(1))
    key2pass = {frozenset(x["id"] for x in j["items"]): j["pass"] for j in jobs}
    assert len(key2pass) == len(jobs), "バッチの id 集合が衝突している(パスを特定できない)"

    hits = glob.glob(os.path.join(PROJ, "*", "subagents", "workflows", run, "journal.jsonl"))
    if not hits:
        sys.exit(f"journal が見つかりません: {run}")
    merged, passes = {}, collections.Counter()
    for line in io.open(hits[0], encoding="utf-8"):
        if not line.strip():
            continue
        r = json.loads(line)
        if r.get("type") != "result":
            continue
        rs = (r.get("result") or {}).get("results") or []
        tag = key2pass.get(frozenset(x["id"] for x in rs))
        if tag is None:
            print(f"  ⚠ 照合できないバッチ({len(rs)}問) — 判定を捨てる")
            continue
        passes[tag] += 1
        for x in rs:
            m = merged.setdefault(x["id"], {"id": x["id"], "kill": {}, "votes": 0, "answerOk": True})
            m["votes"] += 1
            if not x.get("answerOk", True):
                m["answerOk"] = False
                m["answerWhy"] = x.get("answerWhy", "")
            for v in x["valid"]:
                prev = m["kill"].get(v["i"])
                # 同じ選択肢が複数パスで挙がったら、より強い certainty を残す
                if prev is None or (prev["certainty"] == "borderline" and v["certainty"] == "clear"):
                    m["kill"][v["i"]] = v
    print(f"照合できたバッチ: パス別 {dict(passes)}")
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--script", required=True, help="走行に使った workflow スクリプト(JOBS の照合用)")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--report", help="3未満に落ちた問題の報告先(markdown)")
    a = ap.parse_args()

    audit = load_audit(a.run, a.script)
    votes = collections.Counter(m["votes"] for m in audit.values())
    print(f"監査済み: {len(audit)}問 | 判定回数の分布(問題数): {dict(sorted(votes.items()))}")
    thin = [k for k, m in audit.items() if m["votes"] < 2]
    if thin:
        print(f"  ⚠ 1回しか判定されていない問題: {len(thin)}問 (取りこぼしの可能性) {thin[:5]}")
    bad_ans = [m for m in audit.values() if not m["answerOk"]]
    if bad_ans:
        print(f"  ⚠ 正解自体が不成立と判定: {len(bad_ans)}問 {[m['id'] for m in bad_ans][:5]}")

    applied, under, untouched, total, killed_n = [], [], [], 0, 0
    for lv in ("N4", "N3"):
        p = os.path.join(SRC, f"synonym_{lv}.json")
        raw = json.load(io.open(p, encoding="utf-8"))
        items = raw if isinstance(raw, list) else raw["items"]
        changed = False
        for it in items:
            if not isinstance(it, dict) or not it.get("verified"):
                continue
            total += 1
            au = audit.get(it["id"])
            if au is None:
                untouched.append(it["id"])
                continue
            kill = set(au["kill"])  # 全パスの和集合(choices の添字)
            assert all(0 <= i < len(it["choices"]) for i in kill), f"{it['id']}: 添字が範囲外"
            survivors = [c for i, c in enumerate(it["choices"]) if i not in kill]
            if len(survivors) < FLOOR:
                under.append({"id": it["id"], "level": lv, "word": it["word"],
                              "sentence": it.get("stem") or it["sentence"], "answer": it["answer"],
                              "survivors": survivors, "votes": au["votes"],
                              "killed": [(it["choices"][i], v) for i, v in sorted(au["kill"].items())]})
                continue
            killed_n += len(kill)
            it["choices"] = survivors
            assert len(it["choices"]) >= FLOOR, f"{it['id']}: 誤答不足"
            assert it["answer"] not in it["choices"], f"{it['id']}: 正解が誤答に混入"
            assert len(set(it["choices"])) == len(it["choices"]), f"{it['id']}: 誤答が重複"
            applied.append(it["id"])
            changed = True
        if changed and not a.dry:
            with io.open(p, "w", encoding="utf-8", newline="\n") as f:
                json.dump(raw, f, ensure_ascii=False, indent=1)
                f.write("\n")

    print(f"\n言い換え verified {total}問")
    print(f"  ✅ 確定(誤答3個以上残った)      : {len(applied)}問 / 削除した誤答 {killed_n}個")
    print(f"  ⚠ 誤答3未満 → 手作り待ち(未変更): {len(under)}問")
    if untouched:
        print(f"  ⏳ 監査できていない(未変更)     : {len(untouched)}問 {untouched[:5]}")
    if a.dry:
        print("  --dry のため書き込みなし")

    if a.report and under:
        with io.open(a.report, "w", encoding="utf-8", newline="\n") as f:
            f.write("# 言い換え類義: 誤答が3個未満に落ちた問題（誤答の作成が必要）\n\n")
            f.write("> 独立2パスの和集合で「言い換えとして成立してしまう（＝第2の正解）」誤答を削除した結果、\n")
            f.write("> 4択に必要な誤答3個を確保できなくなった問題。**データは未変更のまま**です。\n")
            f.write("> 誤答を作成いただくか、問題ごと落とす判断をお願いします。\n\n")
            for u in under:
                f.write(f"## {u['id']}（{u['level']}）語＝**{u['word']}**\n\n")
                f.write(f"- 問題文: {u['sentence']}\n")
                f.write(f"- ★正解: {u['answer']}\n")
                f.write(f"- 生き残った誤答: **{len(u['survivors'])}個**（3個必要）\n")
                for s in u["survivors"]:
                    f.write(f"    - ○ {s}\n")
                f.write(f"- 削除対象（言い換えとして成立してしまう）: {len(u['killed'])}個\n")
                for text, k in u["killed"]:
                    f.write(f"    - ✗[{k['certainty']}] {text}\n")
                    f.write(f"        - {k['why']}\n")
                f.write("\n")
        print(f"→ 報告書: {os.path.abspath(a.report)}")


if __name__ == "__main__":
    main()
