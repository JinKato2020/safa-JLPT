# -*- coding: utf-8 -*-
"""synonym-new WF の出力(task .output)を content の言い換え類義問題へ確定投入する。
 - needsDrop=true は除外(言い換え問題に向かない語=正直に落とす)。
 - 既に synonym_{lv}.json に居る vocabId は重複投入しない。
 - ID は現行 max から連番。sentence-level(N5/N4)は stem を保持、word-level(N3)は stem 無し。
使い方(3級ぶんの .output を渡す。順不同・級はJSON内のlevelで判定):
  python tools/finalize_synonym_new.py <N5.output> <N4.output> <N3.output>
その後: node --import tsx tools/content/rebuild.ts → manifest → テスト → update_synonym_coverage.py
"""
import json, os, re, sys, io
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_result(path):
    d = json.loads(io.open(path, encoding="utf-8").read())
    r = d.get("result", d)
    if isinstance(r, str):
        r = json.loads(r)
    return r


def main():
    paths = sys.argv[1:]
    assert paths, "task .output ファイルを渡すこと"
    summary = []
    for p in paths:
        r = load_result(p)
        lv = r["level"]
        items = r["items"]
        word_level = lv == "N3"
        fp = os.path.join(ROOT, f"content/problems/moji_goi/synonym_{lv}.json")
        doc = json.load(io.open(fp, encoding="utf-8"))
        arr = doc["items"]
        have = {it.get("vocabId") for it in arr}
        nums = [int(m.group(1)) for it in arr if (m := re.search(r"-(\d+)$", it["id"]))]
        nxt = (max(nums) + 1) if nums else 1
        # 入力から word(辞書形)を引く
        inp = {x["vocabId"]: x for x in json.load(io.open(os.path.join(ROOT, f"scratchpad/synonym_new/input_{lv}.json"), encoding="utf-8"))}
        added = 0; dropped = 0; dup = 0
        for it in items:
            vid = it.get("vocabId")
            if it.get("needsDrop"):
                dropped += 1; continue
            if vid in have:
                dup += 1; continue
            distr = [d for d in (it.get("distractors") or []) if d]
            if len(distr) < 3 or not it.get("answer") or not it.get("sentence"):
                dropped += 1; continue
            word = (inp.get(vid, {}).get("word")) or it.get("underline", "")
            new = {
                "id": f"{lv}-V-I-{nxt:04d}",
                "vocabId": vid,
                "sentence": it["sentence"],
                "underline": it.get("underline", word),
                "word": word,
                "answer": it["answer"],
                "choices": distr[:6],
                "verified": True,
            }
            if not word_level:
                new["stem"] = it.get("stem", it["sentence"])
            arr.append(new); have.add(vid); nxt += 1; added += 1
        json.dump(doc, io.open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        summary.append(f"{lv}: 追加{added} / 除外{dropped} / 重複skip{dup} / 合計{len(arr)}")
    print("== finalize 完了 ==")
    for s in summary:
        print(" ", s)


if __name__ == "__main__":
    main()
