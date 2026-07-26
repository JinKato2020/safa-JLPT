# -*- coding: utf-8 -*-
"""旧バンク(knowledgebank_*.json)を解体し、全大問を「大問×レベル=1ファイル」へ揃える。

ユーザー確定 2026-07-17:「文章の文法を削除後に、大問を3つに分割」「旧バンクはバックアップして保存」
→ 実測の結果、分割が要るのは【2大問】だけだった(context も死蔵だったため)。

旧バンク3,066問の内訳と、実行時に daimonUnitIds を呼んで確かめた実際の出題:
  grammar_form    786問 → 出題される(786) ✅ 分割する
  order           785問 → 出題される(489。296は ambiguous で恒久除外) ✅ 分割する
  context         653問 → 出題【0】。文脈規定は moji_goi/context_*.json(3398)からのみ出題 ❌ 削除
  passage_grammar 842問 → 出題【0】。セット形式 passage_grammar_*.json(120セット)へ移行済 ❌ 削除
※ daimon.ts のコメント「context/grammar_form は item系＋バンク併用」は実装と食い違っていた。
  実際は context=item系のみ・grammar_form=バンクのみ。

バックアップ: バックアップ/旧知識バンク_2026-07-17/ (3ファイル・3066問)
"""
import argparse
import collections
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "app", "content", "problems")
BACKUP = os.path.join(ROOT, "バックアップ", "旧知識バンク_2026-07-17")
LEVELS = ("N5", "N4", "N3")
SPLIT = {"grammar_form": "bunpou", "order": "bunpou"}   # 分割して残す
DROP = ("context", "passage_grammar")                    # 死蔵＝削除
# BankUnit(data/daimon.ts) が要るフィールド。level/daimon はヘッダへ。
NEUTRAL = {
    "grammar_form": ["stem", "question", "answer", "choices", "pointId"],
    "order": ["stem", "question", "answer", "choices", "pointId", "ambiguous"],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    assert os.path.isdir(BACKUP), f"バックアップが無い: {BACKUP}"
    nb = sum(len(json.load(io.open(os.path.join(BACKUP, f"knowledgebank_{lv}.json"), encoding="utf-8"))["items"])
             for lv in LEVELS)
    print(f"バックアップ確認: {BACKUP} ({nb}問)\n")

    made, dropped = [], collections.Counter()
    for lv in LEVELS:
        p = os.path.join(C, "bunpou", f"knowledgebank_{lv}.json")
        d = json.load(io.open(p, encoding="utf-8"))
        by = collections.defaultdict(list)
        for x in d["items"]:
            by[x.get("daimon")].append(x)

        for dm in DROP:
            dropped[dm] += len(by.get(dm, []))

        for dm, folder in SPLIT.items():
            rows = by.get(dm, [])
            if not rows:
                continue
            items = []
            for r in rows:
                it = {"id": r["id"]}
                for k in NEUTRAL[dm]:
                    if r.get(k) is not None:
                        it[k] = r[k]
                it["i18n"] = r.get("i18n") or {}
                items.append(it)
            out = {"schema": 1, "daimon": dm, "level": lv, "languages": ["ja", "ne"], "items": items}
            op = os.path.join(C, folder, f"{dm}_{lv}.json")
            # 欠落チェック: 元にあったフィールドを落としていないか。
            # ※ null の項目は書かない(pointId:null が68件ある。undefined と同じ扱いで
            #   saveRefForBank の `bank.pointId && ...` は変わらない)。
            for r, it in zip(rows, items):
                for k, v in r.items():
                    if k in ("level", "daimon", "i18n"):
                        continue  # level/daimon=ヘッダへ / i18n=そのまま
                    if v is None:
                        assert k not in it, f"{r['id']}: null を書き出している"
                        continue
                    assert k in it, f"{r['id']}: フィールド {k} を落としている"
                    assert it[k] == v, f"{r['id']}: フィールド {k} の値が変わった"
            made.append((os.path.relpath(op, ROOT), len(items),
                         sum(1 for i in items if i.get("pointId")),
                         sum(1 for i in items if i.get("ambiguous"))))
            if not a.dry:
                with io.open(op, "w", encoding="utf-8", newline="\n") as f:
                    json.dump(out, f, ensure_ascii=False, indent=1)
                    f.write("\n")

        # 旧バンクは空になるはず → ファイルごと削除
        rest = [x for x in d["items"] if x.get("daimon") not in DROP and x.get("daimon") not in SPLIT]
        assert not rest, f"{lv}: 想定外の大問が残っている: {collections.Counter(x.get('daimon') for x in rest)}"
        print(f"  {lv}: {len(d['items'])}問 = 分割{sum(len(by.get(k, [])) for k in SPLIT)} + 削除{sum(len(by.get(k, [])) for k in DROP)} → 旧バンクは空")
        if not a.dry:
            os.remove(p)

    print(f"\n作った分割ファイル:")
    for rel, n, pid, amb in made:
        print(f"  {rel:44} {n:4}問  pointId={pid:4}  ambiguous={amb}")
    print(f"\n削除した死蔵: {dict(dropped)} = {sum(dropped.values())}問 (実行時に既に出題対象外)")
    print(f"削除した旧バンク: knowledgebank_N5/N4/N3.json")
    if a.dry:
        print("\n--dry のため変更なし")
    else:
        print("\n→ 次: rehydrate.ts から knowledgebank 経路を外す → rebuild.ts → テスト → 実行時検証")


if __name__ == "__main__":
    main()
