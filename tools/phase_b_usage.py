# -*- coding: utf-8 -*-
"""Phase B(用法のみ): 旧バンクから用法を削除し、幽霊ファイルを消す。

ユーザー確定 2026-07-17:「古い問題は削除・新しい問題だけにリセット。安全に実行できる usage だけに適用」

背景: 同じ問題が2ファイルに二重に存在し、アプリ(rehydrate.ts)は旧バンクだけを読んでいた。
そのため用法の一意性監査303問が1問もアプリに届いていなかった(N4=98問/N3=122問が食い違い)。

なぜ usage だけか:
  usage        … 分割ファイルの欠落は level/daimon だけ。ヘッダから復元できる＝無害。監査成果もここ。
  grammar_form … 分割ファイルが pointId を落としている(262/262)。採用すると saveRef が壊れ学習記録が保存されない。
  order        … pointId に加え ambiguous(複数正解296問の除外印)も落ちている。
  → grammar_form/order は旧バンクを正本のまま、幽霊ファイルだけ削除して罠を消す。
    移行するなら先に tools/content/schema.ts の neutral に pointId/ambiguous を足して再生成すること。
"""
import argparse
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "app", "content", "problems")
GHOSTS = [os.path.join(C, "bunpou", f"{d}_{lv}.json")
          for d in ("grammar_form", "order") for lv in ("N5", "N4", "N3")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    # 1. 旧バンクから用法を削除(分割ファイルに同じidが揃っていることを確認してから)
    split = set()
    for lv in ("N4", "N3"):
        d = json.load(io.open(os.path.join(C, "moji_goi", f"usage_{lv}.json"), encoding="utf-8"))
        split |= {x["id"] for x in d["items"]}
    removed = 0
    for lv in ("N5", "N4", "N3"):
        p = os.path.join(C, "bunpou", f"knowledgebank_{lv}.json")
        d = json.load(io.open(p, encoding="utf-8"))
        keep = [x for x in d["items"] if x.get("daimon") != "usage"]
        drop = [x for x in d["items"] if x.get("daimon") == "usage"]
        if not drop:
            print(f"  {lv}: 用法なし(削除不要)")
            continue
        lost = {x["id"] for x in drop} - split
        assert not lost, f"{lv}: 分割ファイルに無い用法を消そうとしている: {sorted(lost)[:5]}"
        removed += len(drop)
        d["items"] = keep
        print(f"  {lv}: 用法 {len(drop)}問を旧バンクから削除 (分割ファイルに全idを確認済) → 残り{len(keep)}問")
        if not a.dry:
            with io.open(p, "w", encoding="utf-8", newline="\n") as f:
                json.dump(d, f, ensure_ascii=False, indent=1)
                f.write("\n")

    # 2. 幽霊ファイルを削除(読まれないのに存在し、編集しても無反映になる罠)
    print()
    for g in GHOSTS:
        if not os.path.exists(g):
            continue
        n = len(json.load(io.open(g, encoding="utf-8"))["items"])
        print(f"  幽霊ファイル削除: {os.path.relpath(g, ROOT)} ({n}問・旧バンクに同じ問題が存在)")
        if not a.dry:
            os.remove(g)
    print(f"\n用法 {removed}問を旧バンクから削除 / 幽霊ファイル {len(GHOSTS)}個を削除")
    if a.dry:
        print("--dry のため変更なし")
    else:
        print("→ 次: cd app && node --import tsx tools/content/rebuild.ts (manifest+barrel再生成)")


if __name__ == "__main__":
    main()
