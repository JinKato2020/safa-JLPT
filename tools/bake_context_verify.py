# -*- coding: utf-8 -*-
"""context-verify ワークフローの判定を焼き込む(作り直さない検査の反映)。

入力: Workflow の transcript ディレクトリ(journal.jsonl を含む)。
処理:
 - journal.jsonl から各エージェントの返り値({results:[{id,verdict,badChoices,note}...]})を回収(和集合・idで重複排除)。
 - verdict=='ok' の問題 → context_<LV>.json の該当 item に verified=true を付ける(他の欄は一切触らない)。
 - それ以外(ng/未判定) → 「人手送り」md に理由つきで列挙(問題は書き換えない=データを壊さない)。
使い方:
  python tools/bake_context_verify.py --level N4 --transcript "<...>/wf_XXXX" [--write]
既定はドライラン(集計だけ表示)。--write で実際に書き込む。
"""
import argparse, io, json, os, sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _walk(obj):
    """ネスト構造から {id, verdict} を持つ dict を全部拾う(journalの包み方に依存しない)。"""
    if isinstance(obj, dict):
        if "id" in obj and "verdict" in obj:
            yield obj
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v)


def collect(transcript):
    """journal.jsonl(無ければ agent-*.jsonl)から判定を回収。id→判定(最後勝ち)。"""
    found = {}
    paths = []
    jl = os.path.join(transcript, "journal.jsonl")
    if os.path.exists(jl):
        paths.append(jl)
    for name in sorted(os.listdir(transcript)) if os.path.isdir(transcript) else []:
        if name.startswith("agent-") and name.endswith(".jsonl"):
            paths.append(os.path.join(transcript, name))
    for p in paths:
        for ln in io.open(p, encoding="utf-8"):
            ln = ln.strip()
            if not ln:
                continue
            try:
                obj = json.loads(ln)
            except Exception:
                continue
            for r in _walk(obj):
                found[r["id"]] = r  # 同idは後勝ち
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", required=True)
    ap.add_argument("--transcript", required=True)
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()

    verdicts = collect(a.transcript)
    src = os.path.join(ROOT, f"content/problems/moji_goi/context_{a.level}.json")
    d = json.load(io.open(src, encoding="utf-8"))
    unver = [x for x in d["items"] if x.get("verified") is not True]
    unver_ids = {x["id"] for x in unver}

    ok, ng, missing = [], [], []
    for x in unver:
        r = verdicts.get(x["id"])
        if r is None:
            missing.append(x["id"])
        elif r.get("verdict") == "ok":
            ok.append(x["id"])
        else:
            ng.append((x["id"], x["answer"], x["prompt"], r.get("badChoices") or [], r.get("note", "")))

    print(f"[{a.level}] 未検証{len(unver)}問 / 判定回収{len(verdicts)}件")
    print(f"  合格(verified付与予定) {len(ok)} / 人手送り {len(ng)} / 判定なし(未回収) {len(missing)}")
    if missing:
        print(f"  ※判定なし{len(missing)}件は resume で回収するか、次パスへ")

    if not a.write:
        print("  (ドライラン。--write で書き込み)")
        return

    ok_set = set(ok)
    n = 0
    for e in d["items"]:
        if e["id"] in ok_set and e.get("verified") is not True:
            e["verified"] = True
            n += 1
    with io.open(src, "w", encoding="utf-8", newline="\n") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    print(f"  → {src} に verified=true を {n}問 付与")

    md = os.path.join(ROOT, f"文脈規定_{a.level}_人手が必要な問題.md")
    L = [f"# 文脈規定 {a.level} 人手が必要な問題（検査で ng・{len(ng)}件）", ""]
    for id_, ans, prompt, bad, note in ng:
        L.append(f"- `{id_}` 正解**{ans}**｜{prompt}")
        if bad:
            L.append(f"    - 第2の正解の疑い(誤答index): {bad}")
        if note:
            L.append(f"    - {note}")
    io.open(md, "w", encoding="utf-8", newline="\n").write("\n".join(L) + "\n")
    print(f"  → {md} に人手送り {len(ng)}件")


if __name__ == "__main__":
    main()
