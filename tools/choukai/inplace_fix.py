# -*- coding: utf-8 -*-
r"""聴解 発話/即時応答の「既存ID 現場修正」ツール＝恒久（2026-08-21）。

【なぜ専用か】hatsuwa_build/sokuji_build は「追記」、hatsuwa_replace は「全入れ替え」。
攻略耐性の赤（発話=台本重複・即時=最長偏り）を潰すには、赤の該当IDだけを**同じidのまま**
書き換えて（音声も同idを再生成）他を触らない＝本ツール。idが変わらない＝audioファイル名も不変。

対象2種：
  hatsuwa … 状況文(script)＋選択肢を丸ごと差し替え（多様化）。gate=mora18-47/選択肢差≤5/かな漏れ/
            係/留守/状況sim<0.58・選択肢セットsim<0.70（自idを除く同レベル全問と比較）。機能/場面/軸は自動再分類。
  sokuji  … 指定した選択肢の**本文だけ**差し替え（正解本文は据え置き＝正解位置不変）。
            狙い＝正解を最長でなくす。gate=選択肢3distinct/かな漏れ/正解が最長でない（argmax-first≠正解）。

patch JSON:
  hatsuwa: [{"id":"N5-C-H-0096","script":"…","correct":"…","distractors":["…","…"],"pos":2}]
  sokuji : [{"id":"N4-C-S-0007","edits":{"2":"…新しい選択肢本文…"}}]   # キー=選択肢index(文字列可)

使い方:
  python tools/choukai/inplace_fix.py hatsuwa <patch.json>            # 検証のみ
  python tools/choukai/inplace_fix.py hatsuwa <patch.json> --write    # 全idが合格なら書込み
  python tools/choukai/inplace_fix.py sokuji  <patch.json> [--write]
書込み後: 変更id一覧を <patch>.ids.txt に出力 →
  gen_choukai_json.py --ids-file <ids> → rebuild.ts → daimon_solvability --xlsx → OTA(publish-content.ps1)
※ 再生成前に memory/choukai_gen_done.txt から変更idを除く（済スキップ回避）。本ツール --write が自動で除去する。
"""
import sys, io, os, re, json, copy, glob, argparse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "問題", "tools"))
from merge_and_gate import body_mora, strip_furi, body_text
from hatsuwa_axes import classify_item
from sokuji_sim import nearest
try:
    from tts_script import to_tts
except Exception:
    to_tts = None

CJSON = os.path.join(ROOT, "content", "problems", "choukai")
LO, HI, MAXDIFF = 18, 47, 5
SIM_GATE, CHSET_GATE = 0.58, 0.70
_KAKARI = re.compile(r"(?<![関])係(?![長り])")
ACCENT_AVOID = {"留守": "出かけている間 等"}
DONE = os.path.join(ROOT, "memory", "choukai_gen_done.txt")


def norm(s):
    s = (s or "").replace("(", "（").replace(")", "）")
    return s.replace("係員（かかりいん）", "スタッフ").replace("係（かかり）", "スタッフ").replace("係員", "スタッフ")


def leak(t):
    if not to_tts:
        return False
    o = to_tts(t)
    return "（" in o or "）" in o


def sit_core(s):
    x = strip_furi(s)
    return re.sub(r"。?[^。]*何と言いますか。?\s*$", "", x)


def chset_core(ch):
    return " ".join(sorted(strip_furi(c) for c in ch))


def file_for(iid):
    lv, _, code = iid.split("-")[0], None, iid.split("-")[2]
    sub = {"H": "hatsuwa", "S": "sokuji"}[code]
    return os.path.join(CJSON, f"{sub}_{lv}.json"), lv


def load_pool(lv, code, exclude_id):
    """同レベル・同大問の他の全item（自idは除外）。"""
    sub = {"H": "hatsuwa", "S": "sokuji"}[code]
    d = json.load(open(os.path.join(CJSON, f"{sub}_{lv}.json"), encoding="utf-8"))
    return [it for it in d["items"] if it["id"] != exclude_id]


def fix_hatsuwa(patch, write):
    by_file = {}
    changed = []
    fatal = 0
    for r in patch:
        iid = r["id"]; lv = iid.split("-")[0]
        fp = os.path.join(CJSON, f"hatsuwa_{lv}.json")
        d = by_file.setdefault(fp, json.load(open(fp, encoding="utf-8")))
        it = next((x for x in d["items"] if x["id"] == iid), None)
        if it is None:
            print(f"  ✗ {iid}: 見つからない"); fatal += 1; continue
        script = norm(r["script"]); correct = norm(r["correct"]); dist = [norm(x) for x in r["distractors"]]
        pos = int(r["pos"])
        ch = [None, None, None]; ch[pos] = correct; di = 0
        for k in range(3):
            if k != pos:
                ch[k] = dist[di]; di += 1
        errs = []
        m = body_mora("hatsuwa", script)
        if not (LO <= m <= HI): errs.append(f"台本mora{m}帯外[{LO}-{HI}]")
        if len(set(ch)) != 3: errs.append("選択肢重複/欠")
        if any(leak(x) for x in [script] + ch): errs.append("かな漏れ")
        cm = [body_mora("sokuji", c) for c in ch]
        if max(cm) - min(cm) > MAXDIFF: errs.append(f"選択肢長さ差{max(cm)-min(cm)}>{MAXDIFF}")
        if pos not in (0, 1, 2): errs.append(f"pos={pos}不正")
        if any(_KAKARI.search(x) for x in [script] + ch): errs.append("係残存→スタッフ")
        for w, alt in ACCENT_AVOID.items():
            if any(w in strip_furi(x) for x in [script] + ch): errs.append(f"アクセント崩れ語「{w}」→{alt}")
        pool = [x for x in d["items"] if x["id"] != iid]
        psits = [sit_core(x["script"]) for x in pool]
        pchs = [chset_core(x["questions"][0]["choices"]) for x in pool]
        core = sit_core(script); chc = chset_core(ch)
        ms, nb = nearest(core, psits)
        if ms >= SIM_GATE: errs.append(f"状況重複{ms:.2f}~『{nb[:16]}』")
        mc, nc = nearest(chc, pchs)
        if mc >= CHSET_GATE: errs.append(f"選択肢セット重複{mc:.2f}~『{nc[:18]}』")
        if strip_furi(script) in {strip_furi(x["script"]) for x in pool}: errs.append("台本完全一致")
        if errs:
            print(f"  ✗ {iid}: {'  '.join(errs)}"); fatal += 1; continue
        # 反映（メモリ上）＋自動再分類
        it["script"] = script; it["i18n"] = {}
        q = it["questions"][0]; q["choices"] = ch; q["answerIndex"] = pos; q["i18n"] = {}
        f, s, a = classify_item(it)
        it["function"] = f; it["scene"] = s; it["axis"] = a
        print(f"  ✓ {iid} mora{m} sim{ms:.2f} 最長{'正' if max(range(3),key=lambda k:cm[k])==pos else '誤'} [{f}/{s}/{a}]")
        changed.append(iid)
    return by_file, changed, fatal


def fix_sokuji(patch, write):
    by_file = {}
    changed = []
    fatal = 0
    for r in patch:
        iid = r["id"]; lv = iid.split("-")[0]
        fp = os.path.join(CJSON, f"sokuji_{lv}.json")
        d = by_file.setdefault(fp, json.load(open(fp, encoding="utf-8")))
        it = next((x for x in d["items"] if x["id"] == iid), None)
        if it is None:
            print(f"  ✗ {iid}: 見つからない"); fatal += 1; continue
        q = it["questions"][0]; ch = list(q["choices"]); ai = q["answerIndex"]
        for k, v in r["edits"].items():
            ch[int(k)] = norm(v)
        errs = []
        if len(set(ch)) != 3: errs.append("選択肢重複/欠")
        if any(leak(x) for x in ch): errs.append("かな漏れ")
        cm = [body_mora("sokuji", c) for c in ch]
        if max(range(3), key=lambda k: cm[k]) == ai:
            errs.append(f"正解が依然最長 mora={cm} ai={ai}")
        if errs:
            print(f"  ✗ {iid}: {'  '.join(errs)}"); fatal += 1; continue
        q["choices"] = ch
        print(f"  ✓ {iid} mora={cm} ai={ai}(={cm[ai]}) 最長=誤")
        changed.append(iid)
    return by_file, changed, fatal


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", choices=["hatsuwa", "sokuji"])
    ap.add_argument("patch")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    patch = json.load(open(a.patch, encoding="utf-8"))
    if isinstance(patch, dict):
        patch = patch.get("items", patch)
    by_file, changed, fatal = (fix_hatsuwa if a.kind == "hatsuwa" else fix_sokuji)(patch, a.write)
    print(f"\n=== {a.kind}: 変更{len(changed)} / 致命{fatal} ===")
    if a.write and fatal == 0 and changed:
        for fp, d in by_file.items():
            json.dump(d, open(fp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        idsf = a.patch + ".ids.txt"
        open(idsf, "w", encoding="utf-8").write("\n".join(changed) + "\n")
        # 済スキップ回避＝done台帳から変更idを除去
        if os.path.exists(DONE):
            keep = [l for l in open(DONE, encoding="utf-8") if l.strip() and l.strip() not in set(changed)]
            open(DONE, "w", encoding="utf-8").writelines(keep)
        print(f"書込み {len(by_file)}ファイル。id一覧→{idsf}（done台帳から{len(changed)}件除去済）")
        print(f"次: gen_choukai_json.py --ids-file {idsf} → rebuild.ts → daimon_solvability --xlsx → OTA")
    elif a.write:
        print("致命ありのため書込み中止")


if __name__ == "__main__":
    main()
