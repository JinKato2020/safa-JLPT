# -*- coding: utf-8 -*-
r"""聴解 模試プール(pool='mock')の内容大問(kadai/point/gaiyou)の機械ゲート。
- スキーマ完全一致・choices数・answerIndex=0・pool=mock・id書式/重複・questions[0].id=<id>-q1
- 本文モーラ帯＝load_bands(中央値±20%)を採用。**mock override**＝kadai_N5/N4/N3・point_N5/point_N4 は×1.1(inflight §3の+10%帯)。

使い方: python tools/choukai/mock_verify.py <file.json> <daimon> <level>
  例:   python tools/choukai/mock_verify.py scratchpad/.../out_kadai_A1.json kadai N5
"""
import sys, io, os, json, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from merge_and_gate import body_mora, load_bands

MOCK_X11 = {"kadai_N5", "kadai_N4", "kadai_N3", "point_N5", "point_N4"}  # +10%対象(inflight §3)
NCH = {"kadai": 4, "point": 4, "gaiyou": 4}
REC = {"K": "kadai", "P": "point", "G": "gaiyou"}

def mock_band(daimon, level):
    lo, hi = load_bands()[f"{daimon}_{level}"]
    if f"{daimon}_{level}" in MOCK_X11:
        lo, hi = round(lo * 1.1), round(hi * 1.1)
    return lo, hi

def main():
    fp, daimon, level = sys.argv[1], sys.argv[2], sys.argv[3]
    items = json.load(open(fp, encoding="utf-8"))
    lo, hi = mock_band(daimon, level)
    fatal = []
    moras = []
    ids = set()
    idpat = re.compile(rf"^{level}-C-[KPG]-0[0-9]{{3}}$")
    for it in items:
        iid = it.get("id", "?")
        # スキーマ
        for k in ("id", "level", "category", "type", "subtype", "title", "scenario", "pool", "script", "audio", "questions", "i18n"):
            if k not in it:
                fatal.append(f"{iid}: 欠フィールド {k}")
        if it.get("pool") != "mock": fatal.append(f"{iid}: pool!=mock ({it.get('pool')})")
        if it.get("level") != level: fatal.append(f"{iid}: level!={level}")
        if it.get("subtype") != daimon: fatal.append(f"{iid}: subtype!={daimon}")
        if it.get("category") != "choukai": fatal.append(f"{iid}: category!=choukai")
        if it.get("type") != "listening": fatal.append(f"{iid}: type!=listening")
        if it.get("audio") is not True: fatal.append(f"{iid}: audio!=true")
        if not idpat.match(iid): fatal.append(f"{iid}: id書式不正")
        if int(iid.split("-")[-1]) < 701: fatal.append(f"{iid}: 模試帯0701未満")
        if iid in ids: fatal.append(f"{iid}: id重複")
        ids.add(iid)
        qs = it.get("questions", [])
        if len(qs) != 1:
            fatal.append(f"{iid}: questions数!=1")
        else:
            q = qs[0]
            if q.get("id") != f"{iid}-q1": fatal.append(f"{iid}: q.id!=<id>-q1")
            ch = q.get("choices", [])
            if len(ch) != NCH[daimon]: fatal.append(f"{iid}: choices数={len(ch)}(要{NCH[daimon]})")
            if len(set(ch)) != len(ch): fatal.append(f"{iid}: choices重複")
            if q.get("answerIndex") != 0: fatal.append(f"{iid}: answerIndex!=0")
        # モーラ
        m = body_mora(daimon, it.get("script", ""))
        moras.append((iid, m))
        if not (lo <= m <= hi): fatal.append(f"{iid}: モーラ{m}が帯[{lo},{hi}]外")
        # 係残り
        if re.search(r"(?<![関])係(?![長り])", it.get("script", "")): fatal.append(f"{iid}: 係が残存")
    ms = sorted(m for _, m in moras)
    print(f"=== {os.path.basename(fp)}  {daimon} {level}  n={len(items)}  帯[{lo},{hi}] ===")
    if ms:
        print(f"モーラ: min={ms[0]} median={ms[len(ms)//2]} max={ms[-1]}")
    print(f"致命 {len(fatal)}件")
    for f in fatal[:60]:
        print("  ", f)

if __name__ == "__main__":
    main()
