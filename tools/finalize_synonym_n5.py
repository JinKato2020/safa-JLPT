# -*- coding: utf-8 -*-
"""N5言い換えの整形WF出力を content + sentenceFuri へ確定投入する。
番人 synonymFormat.test.ts のN5規則に合うものだけ採用(不合格はdrop・報告)。
使い方: python tools/finalize_synonym_n5.py <N5_reformat.output>
その後: rebuild → 出題数ガード(N5)更新 → テスト → update_synonym_coverage.py
"""
import json, os, re, sys, io
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CROSS = {"negation_cross", "perspective_cross"}
PATS = {"noun", "adj", "adv", "verb", "hypernym", "negation_cross", "perspective_cross"}


def load_items(path):
    d = json.loads(io.open(path, encoding="utf-8").read())
    r = d.get("result", d)
    if isinstance(r, str):
        r = json.loads(r)
    return r["items"]


def ok(it):
    reasons = []
    s, st, fu = it.get("sentence", ""), it.get("stem", ""), it.get("furi", "")
    ul, w, pat = it.get("underline", ""), it.get("word", ""), it.get("pattern", "")
    ans, ch = it.get("answer", ""), [c for c in (it.get("choices") or []) if c]
    if pat not in PATS: reasons.append(f"pattern:{pat}")
    if ul and ul not in s: reasons.append("underline not in sentence")
    if not (s and st and fu and ul and w and ans): reasons.append("missing field")
    if not re.search(r"\s", st): reasons.append("stem no spacing")
    if "（" in st or "（" in ans or any("（" in c for c in ch): reasons.append("fullwidth paren in stem/answer/choices")
    nd = len(ch)
    if pat in CROSS and nd != 3: reasons.append(f"cross needs 3 distractors, got {nd}")
    if pat not in CROSS and not (3 <= nd <= 5): reasons.append(f"noncross needs 3-5, got {nd}")
    if ans in ch: reasons.append("answer in choices")
    if len(set(ch)) != len(ch): reasons.append("dup distractor")
    return reasons


def main():
    path = sys.argv[1]
    items = load_items(path)
    fp = os.path.join(ROOT, "content/problems/moji_goi/synonym_N5.json")
    furip = os.path.join(ROOT, "src/data/dict/sentenceFuri.json")
    doc = json.load(io.open(fp, encoding="utf-8"))
    arr = doc["items"]
    furi = json.load(io.open(furip, encoding="utf-8"))
    have = {it.get("vocabId") for it in arr}
    nums = [int(m.group(1)) for it in arr if (m := re.search(r"-(\d+)$", it["id"]))]
    nxt = (max(nums) + 1) if nums else 1
    added = 0; dropped = []
    for it in items:
        vid = it.get("vocabId")
        if vid in have:
            continue
        bad = ok(it)
        if bad:
            dropped.append((vid, "; ".join(bad))); continue
        iid = f"N5-V-I-{nxt:04d}"
        arr.append({
            "id": iid, "vocabId": vid, "sentence": it["sentence"], "underline": it["underline"],
            "word": it["word"], "answer": it["answer"], "choices": it["choices"][:5],
            "verified": True, "stem": it["stem"], "pattern": it["pattern"],
        })
        furi[iid] = it["furi"]
        have.add(vid); nxt += 1; added += 1
    json.dump(doc, io.open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(furi, io.open(furip, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"N5 finalize: 追加{added} / drop{len(dropped)} / 合計{len(arr)}")
    for vid, why in dropped[:30]:
        print("  drop", vid, why)


if __name__ == "__main__":
    main()
