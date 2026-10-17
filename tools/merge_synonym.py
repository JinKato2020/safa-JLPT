# -*- coding: utf-8 -*-
"""検証済みの言い換えデータを content/problems/moji_goi/synonym_<lv>.json へ投入する。

- N3(語レベル): answer/choices を差し替え、verified を立てる。sentence/underline/word は元のまま。
- N4(文レベル): stem(提示文)を足し、answer/choices を「文」に差し替え、verified を立てる。
  sentence/underline/word は出典として残す(stem がある問題では出題に使われない)。
- 未検証の問題は触らない(verified が付かない = ゲートで出題されない)。

使い方: python tools/merge_synonym.py --level N3 --data <救済json> [--dry]
"""
import argparse
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", required=True, choices=["N3", "N4", "N5"])
    ap.add_argument("--data", required=True, help="harvest済みの検証データ(items入り)")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    target = os.path.join(ROOT, "app", "content", "problems", "moji_goi", f"synonym_{a.level}.json")
    raw = json.load(io.open(target, encoding="utf-8"))
    is_list = isinstance(raw, list)
    items = raw if is_list else raw["items"]
    by_id = {x["id"]: x for x in items}

    gen = {g["id"]: g for g in json.load(io.open(a.data, encoding="utf-8"))["items"]}
    word_level = a.level == "N3"

    applied, missing = 0, []
    for gid, g in gen.items():
        t = by_id.get(gid)
        if t is None:
            missing.append(gid)
            continue
        d = list(g["distractors"])
        # 不変条件: 正解が誤答に混入しない・4択が組める
        assert g["answer"] not in d, f"{gid}: 正解が誤答に混入"
        assert len(d) >= 3, f"{gid}: 誤答が3個未満で4択が組めない"
        assert len(set(d)) == len(d), f"{gid}: 誤答が重複"
        t["answer"] = g["answer"]
        t["choices"] = d
        t["verified"] = True
        if not word_level:
            assert g.get("stem"), f"{gid}: 文レベルなのに stem が無い"
            t["stem"] = g["stem"]
        applied += 1

    print(f"{a.level}: 投入 {applied}件 / 在庫 {len(items)}件 (未投入={len(items) - applied})")
    if missing:
        print(f"  ⚠ 在庫に無いid: {len(missing)}件 {missing[:5]}")
    ver = sum(1 for x in items if x.get("verified"))
    print(f"  verified合計: {ver}件 (= ゲート通過して出題される数)")

    if a.dry:
        print("  --dry のため書き込みなし")
        return
    with io.open(target, "w", encoding="utf-8", newline="\n") as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"→ {target}")


if __name__ == "__main__":
    main()
