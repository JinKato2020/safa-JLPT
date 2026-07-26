# -*- coding: utf-8 -*-
"""workflow が途中で落ちても、完了済みバッチのデータを journal.jsonl から救済する。

使い方:
  python tools/harvest_workflow.py <runId or journal.jsonl のパス> [-o 出力.json]

journal.jsonl には agent が1体完了するたびに {"type":"result", ...} が追記される。
= 完了したバッチは常にディスク上にある。ワークフローが落ちても失われない。
"""
import argparse
import glob
import io
import json
import os
import sys

# Windows コンソール(cp932)でも日本語・記号を落とさない
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJ = os.path.join(
    os.path.expanduser("~"),
    ".claude", "projects", "c--Users-jwpsa-Documents-desktop-claude-JLPT---",
)


def find_journal(arg):
    """runId でも直パスでも journal.jsonl を見つける。"""
    if os.path.isfile(arg):
        return arg
    hits = glob.glob(os.path.join(PROJ, "*", "subagents", "workflows", arg, "journal.jsonl"))
    if not hits:
        hits = glob.glob(os.path.join(PROJ, "*", "subagents", "workflows", f"*{arg}*", "journal.jsonl"))
    if not hits:
        sys.exit(f"journal.jsonl が見つかりません: {arg}")
    return sorted(hits, key=os.path.getmtime)[-1]


def harvest(journal_path):
    """完了済み agent の結果を全部集める。started だけの(=落ちた)ものは未完として報告。"""
    started, results = {}, {}
    with io.open(journal_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            key = row.get("key")
            if row.get("type") == "started":
                started[key] = row.get("agentId")
            elif row.get("type") == "result":
                results[key] = row.get("result")
    unfinished = [k for k in started if k not in results]
    return results, started, unfinished


def flatten_items(results):
    """各バッチの返り値から items/results を1本に連結し、id で重複排除。

    重複時は【後勝ち】。同じ id は gen → repair の順に現れるため、後に来た方＝修理済みが正しい。
    (先勝ちにすると修理前の非一意なダミーを拾ってしまう)
    """
    by_id, order, verdicts = {}, [], []
    for res in results.values():  # dict は挿入順 = journal の完了順
        if not isinstance(res, dict):
            continue
        for it in res.get("items") or []:
            if isinstance(it, dict) and it.get("id"):
                if it["id"] not in by_id:
                    order.append(it["id"])
                by_id[it["id"]] = it  # 後勝ち
        for v in res.get("results") or []:
            if isinstance(v, dict) and v.get("id"):
                verdicts.append(v)
    return [by_id[i] for i in order], verdicts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run", help="runId か journal.jsonl のパス")
    ap.add_argument("-o", "--out", help="救済データの出力先 JSON")
    args = ap.parse_args()

    jp = find_journal(args.run)
    results, started, unfinished = harvest(jp)
    items, verdicts = flatten_items(results)

    print(f"journal   : {jp}")
    print(f"agent起動 : {len(started)}  完了: {len(results)}  未完(=落ちた): {len(unfinished)}")
    print(f"救済items : {len(items)}  判定results: {len(verdicts)}")
    empty = [k for k, r in results.items() if isinstance(r, dict) and not (r.get("items") or r.get("results"))]
    if empty:
        print(f"⚠ 空を返した agent: {len(empty)} 体 (要調査: 入力undefined等)")

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with io.open(args.out, "w", encoding="utf-8") as f:
            json.dump({"items": items, "verdicts": verdicts}, f, ensure_ascii=False, indent=1)
        print(f"→ 救済データを書き出し: {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()
