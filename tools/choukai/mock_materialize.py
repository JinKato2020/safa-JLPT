# -*- coding: utf-8 -*-
r"""聴解 模試プール materialize＝生成物(scratchpad)を content/problems/choukai/mock/ の正式schemaへ落とす。
- content大問(kadai/point/gaiyou): 既に最終item配列→top-level wrap({schema,daimon,level,languages,items})して書く。
- sokuji/hatsuwa: draft→item化。正解位置①②③を均等割当(sokuji)/pos踏襲(hatsuwa)。audio:true(mp3は後フェーズ)。
- 全角括弧正規化＋係→スタッフを再適用(defensive)。pool='mock'を保証。

使い方: python tools/choukai/mock_materialize.py <level> <workdir>
  workdir に mock_kadai_<lv>.json / mock_point_<lv>.json / out_hatsuwa.json / sokuji_draft/draft_<lv>.json があれば処理。
出力: content/problems/choukai/mock/<daimon>_<lv>.json
"""
import sys, io, os, json, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUTDIR = os.path.join(ROOT, "content", "problems", "choukai", "mock")
TITLE = {"kadai": "課題理解", "point": "ポイント理解", "gaiyou": "概要理解",
         "hatsuwa": "発話表現", "sokuji": "即時応答"}

def norm(s):
    s = (s or "").replace("(", "（").replace(")", "）")
    s = s.replace("係員（かかりいん）", "スタッフ").replace("係（かかり）", "スタッフ").replace("係員", "スタッフ")
    return s

def wrap(daimon, level, items):
    return {"schema": 1, "daimon": daimon, "level": level, "languages": ["ja"], "items": items}

def norm_item(it):
    it["script"] = norm(it.get("script", ""))
    for q in it.get("questions", []):
        if q.get("q"): q["q"] = norm(q["q"])
        q["choices"] = [norm(c) for c in q.get("choices", [])]
    it["pool"] = "mock"
    return it

def do_content(daimon, level, work):
    fp = os.path.join(work, f"mock_{daimon}_{level}.json")
    if not os.path.exists(fp): return None
    items = [norm_item(it) for it in json.load(open(fp, encoding="utf-8"))]
    out = os.path.join(OUTDIR, f"{daimon}_{level}.json")
    json.dump(wrap(daimon, level, items), open(out, "w", encoding="utf-8"), ensure_ascii=False)
    return out, len(items)

def balanced(n):
    return [i % 3 for i in range(n)]  # 0,1,2,0,1,2... 均等

def do_sokuji(level, work):
    fp = os.path.join(work, "sokuji_draft", f"draft_{level}.json")
    if not os.path.exists(fp): return None
    recs = json.load(open(fp, encoding="utf-8"))
    pos = balanced(len(recs))
    items = []
    for i, r in enumerate(recs):
        iid = f"{level}-C-S-{701+i:04d}"
        correct = norm(r["correct_text"])
        distr = [norm(c) for c in r["choices"] if norm(c) != correct]
        ai = pos[i]
        ch = list(distr)
        ch.insert(ai, correct)
        it = {"id": iid, "level": level, "category": "choukai", "type": "listening",
              "subtype": "sokuji", "qtype": "即時応答", "title": "即時応答",
              "script": norm(r["script"]), "audio": True, "audioChoices": True,
              "questions": [{"id": f"{iid}-q1", "q": "", "choices": ch, "answerIndex": ai, "i18n": {}}],
              "i18n": {}, "function": r.get("function", ""), "pool": "mock"}
        for k in ("uniqRisk", "uniqNote"):
            if r.get(k): it[k] = r[k]
        items.append(it)
    out = os.path.join(OUTDIR, f"sokuji_{level}.json")
    json.dump(wrap("sokuji", level, items), open(out, "w", encoding="utf-8"), ensure_ascii=False)
    return out, len(items)

def do_hatsuwa(level, work):
    fp = os.path.join(work, "out_hatsuwa.json")
    if not os.path.exists(fp): return None
    recs = json.load(open(fp, encoding="utf-8"))
    if isinstance(recs, dict): recs = recs.get("items", [])
    items = []
    for i, r in enumerate(recs):
        iid = f"{level}-C-H-{701+i:04d}"
        correct = norm(r["correct"])
        distr = [norm(c) for c in r["distractors"]]
        ai = int(r.get("pos", i % 3))
        ch = list(distr)
        ch.insert(ai, correct)
        it = {"id": iid, "level": level, "category": "choukai", "type": "listening",
              "subtype": "hatsuwa", "qtype": "発話表現", "title": "発話表現",
              "script": norm(r["script"]), "audio": True, "audioChoices": True,
              "questions": [{"id": f"{iid}-q1", "q": "", "choices": ch, "answerIndex": ai, "i18n": {}}],
              "i18n": {}, "function": r.get("function", ""), "scene": r.get("scene", ""),
              "axis": r.get("axis", ""), "pool": "mock"}
        for k in ("uniqRisk", "uniqNote"):
            if r.get(k): it[k] = r[k]
        items.append(it)
    out = os.path.join(OUTDIR, f"hatsuwa_{level}.json")
    json.dump(wrap("hatsuwa", level, items), open(out, "w", encoding="utf-8"), ensure_ascii=False)
    return out, len(items)

def main():
    level, work = sys.argv[1], sys.argv[2]
    os.makedirs(OUTDIR, exist_ok=True)
    results = []
    for daimon in ("kadai", "point", "gaiyou"):
        r = do_content(daimon, level, work)
        if r: results.append((daimon,) + r)
    r = do_sokuji(level, work)
    if r: results.append(("sokuji",) + r)
    r = do_hatsuwa(level, work)
    if r: results.append(("hatsuwa",) + r)
    for daimon, path, n in results:
        # answerIndex分布を確認(発話/即時)
        j = json.load(open(path, encoding="utf-8"))
        if daimon in ("sokuji", "hatsuwa"):
            from collections import Counter
            c = Counter(it["questions"][0]["answerIndex"] for it in j["items"])
            print(f"{daimon}_{level}: {n}問 → {path}  正解位置{dict(sorted(c.items()))}")
        else:
            print(f"{daimon}_{level}: {n}問 → {path}")

if __name__ == "__main__":
    main()
