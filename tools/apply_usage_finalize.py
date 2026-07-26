# -*- coding: utf-8 -*-
"""整形済みの用法32問を usage_*.json へ反映する(誤答3個未満で温存していた分)。

前提: build_usage_finalize_wf.py の契約(keepは不変・adoptは内容不変)を
validate_finalize.py で機械検証済み(違反0件)。読みも既存辞書と照合済み(誤り0件)。
"""
import argparse
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
FLOOR = 3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="wf_f9eab193-3f0")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    got = {}
    for l in io.open(os.path.join(PROJ, a.run, "journal.jsonl"), encoding="utf-8"):
        if l.strip():
            r = json.loads(l)
            if r.get("type") == "result":
                for x in (r.get("result") or {}).get("results") or []:
                    got[x["id"]] = x["distractors"]
    print(f"整形結果: {len(got)}問")

    applied, total = [], 0
    for lv in ("N4", "N3"):
        p = os.path.join(SRC, f"usage_{lv}.json")
        raw = json.load(io.open(p, encoding="utf-8"))
        items = raw if isinstance(raw, list) else raw["items"]
        changed = False
        for it in items:
            if not isinstance(it, dict) or it.get("verified"):
                continue
            d = got.get(it["id"])
            if d is None:
                continue
            total += 1
            assert len(d) >= FLOOR, f"{it['id']}: 誤答が{len(d)}個"
            assert len(set(d)) == len(d), f"{it['id']}: 誤答が重複"
            strip = lambda s: re.sub(r"[（(][^）)]*[）)]", "", s).replace(" ", "")
            assert all(strip(x) != strip(it["answer"]) for x in d), f"{it['id']}: 正解が誤答に混入"
            it["choices"] = [it["answer"]] + d
            it["verified"] = True
            applied.append(it["id"])
            changed = True
        if changed and not a.dry:
            with io.open(p, "w", encoding="utf-8", newline="\n") as f:
                json.dump(raw, f, ensure_ascii=False, indent=1)
                f.write("\n")
    print(f"  ✅ 反映: {len(applied)}問 (未確定だった{total}問のうち)")
    if a.dry:
        print("  --dry のため書き込みなし")

    # 反映後の全体像
    for lv in ("N4", "N3"):
        d = json.load(io.open(os.path.join(SRC, f"usage_{lv}.json"), encoding="utf-8"))
        its = [x for x in (d if isinstance(d, list) else d["items"]) if isinstance(x, dict)]
        v = [x for x in its if x.get("verified")]
        import collections
        c = collections.Counter(len(x["choices"]) - 1 for x in v)
        print(f"  {lv}: {len(v)}/{len(its)}問 確定  誤答個数 {dict(sorted(c.items()))}")


if __name__ == "__main__":
    main()
