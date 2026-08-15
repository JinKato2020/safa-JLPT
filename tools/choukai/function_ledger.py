# -*- coding: utf-8 -*-
"""即時応答(sokuji)の機能(function)分布を集計＝層1の台帳。
場面を廃した後の多様性軸＝発話の機能。作問前に「薄い機能」を確認し、そこを厚く作る。
「厚すぎ(目安×1.5超)」「ゼロ」を警告。--add <dir> で新規草案(draft_{lv}.json)を足して集計も可。

使い方:
  python tools/choukai/function_ledger.py                 # 正本 sokuji_{lv}.json 一般帯を集計
  python tools/choukai/function_ledger.py --add <DRAFT>   # 草案 draft_{lv}.json(function付) を足して集計
"""
import sys, io, os, json, argparse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CJSON = os.path.join(ROOT, "content", "problems", "choukai")
TAX = ["依頼", "許可求め", "申し出", "誘い", "断り・辞退", "催促",
       "苦情・指摘", "確認", "報告・知らせ", "感想・共感", "お礼", "謝罪"]

def tally(lv, add_dir=None):
    d = json.load(open(os.path.join(CJSON, f"sokuji_{lv}.json"), encoding="utf-8"))
    funcs = [it.get("function", "") for it in d["items"] if int(it["id"].split("-")[-1]) <= 500]
    if add_dir:
        fp = os.path.join(add_dir, f"draft_{lv}.json")
        if os.path.exists(fp):
            funcs += [r.get("function", "") for r in json.load(open(fp, encoding="utf-8"))]
    return funcs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--add", help="draft_{lv}.json のあるディレクトリ")
    a = ap.parse_args()
    for lv in ["N5", "N4", "N3"]:
        funcs = tally(lv, a.add)
        n = len(funcs)
        if n == 0:
            print(f"{lv}: 一般帯0問"); continue
        cnt = {t: funcs.count(t) for t in TAX}
        other = [f for f in funcs if f not in TAX]
        target = n / len(TAX)
        heavy = [t for t, c in cnt.items() if c > target * 1.5]
        zero = [t for t, c in cnt.items() if c == 0]
        print(f"=== {lv} 一般帯{n}問 (目安 {target:.1f}/機能) ===")
        print("  " + " ".join(f"{t}{c}" for t, c in cnt.items()))
        if other: print(f"  ⚠タクソノミー外: {sorted(set(other))}")
        if heavy: print(f"  ⚠厚(目安×1.5超・足さない): {heavy}")
        if zero: print(f"  ⚠ゼロ(優先で足す): {zero}")
        if not (heavy or zero or other): print("  ✅バランス良好")

if __name__ == "__main__":
    main()
