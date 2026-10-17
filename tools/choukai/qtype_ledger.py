# -*- coding: utf-8 -*-
"""課題理解の「設問型の偏り」を機械点検する台帳（2026-08-13 追加）。

公式の課題理解は設問型がほぼ均等（手順/物/場所/数時/放送）。
アプリ既存は3レベルとも全部『まず何を』＝単調だった。
このツールで作問前後に型の偏りを可視化し、欠けた型を埋める（作問フロー §2「課題理解の設問型＋レベル差＝間接性」）。

使い方:
  python tools/choukai/qtype_ledger.py                # 正本(kadai_*.json)の型分布
  python tools/choukai/qtype_ledger.py --add <NEWDIR> # 正本＋新規(new_kadai_{N5,N4,N3}.json)を合算
  python tools/choukai/qtype_ledger.py --only <NEWDIR> # 新規だけ（正本を含めない）

出力: レベル別の①設問型分布 ②独話(放送系)件数 ③N3の直接ネタバレ警告(『まずは〜ください/ましょう』)。
※ふりがな入りの設問でも strip_furi で素にして判定。分かち書きの空白も除去。
"""
import os, sys, json, re, argparse
sys.stdout.reconfigure(encoding="utf-8")  # Windows cp932 の文字化け回避
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from merge_and_gate import strip_furi, LABEL  # 同じ素化・話者ラベル定義を共有
from collections import Counter

LEVELS = ["N5", "N4", "N3"]
# 設問型（公式の課題理解の型）
TYPES = ["手順", "物どれ", "何を", "場所", "数時", "その他"]


def qtype(q):
    q = strip_furi(q or "").replace(" ", "").replace("　", "")
    if not q:
        return "無"
    if ("まず何" in q) or ("すぐ何" in q) or ("この後すぐ" in q) or ("このあとすぐ" in q) or ("会場でまず" in q):
        return "手順"
    if re.search(r"どれ|どの", q):
        return "物どれ"
    if "どこ" in q:
        return "場所"
    if re.search(r"何時|何日|何番|何個|何枚|何人|何冊|何本|いくつ", q):
        return "数時"
    if "何を" in q:
        return "何を"
    return "その他"


# ポイント理解の「観点」（公式は なぜ/いつ/いくつ/気持ち/どれ を回す。気持ち＝感情問題は必須）
KANTEN = ["なぜ", "いつ", "いくつ", "気持ち", "どれ"]


def kanten(q):
    q = strip_furi(q or "").replace(" ", "").replace("　", "")
    if not q:
        return "無"
    # 気持ち・感情を最優先（「どうして心配」等は理由より感情として拾う）。
    # ⚠N5はひらがな設問（きもち/きぶん）＝漢字だけで判定すると取りこぼす（2026-08-14 実害）。
    if re.search(r"気持ち|きもち|気分|きぶん|どう思|どうおも|どう感じ|どうかんじ|心配|しんぱい|不安|うれし|嬉し|楽しみ|たのしみ|残念|ざんねん|怒|おこ|さび|寂し|安心|あんしん|困っ|こまっ|喜|よろこ", q):
        return "気持ち"
    # ⚠N5はひらがな設問（なんようび/なんじ/なんさつ/なんまい 等）＝漢字だけで判定すると取りこぼす（2026-08-14 実害）。
    if re.search(r"いつ|いつまで|何日|何曜|何時|なんにち|なんよう|なんじ|なんぷん", q):
        return "いつ"
    if re.search(r"いくつ|いくら|どのくらい|どれくらい"
                 r"|何個|何枚|何人|何回|何冊|何本|何部|何匹|何杯|何通|何台|何軒|何名|何品|何箱|何束"
                 r"|なんこ|なんまい|なんにん|なんかい|なんさつ|なんぼん|なんぶ|なんびき|なんばい|なんぷ"
                 r"|なんつう|なんだい|なんけん|なんめい|なんばこ", q):
        return "いくつ"
    if re.search(r"なぜ|どうして|理由", q):
        return "なぜ"
    return "どれ"  # どれ/どの/何を/どこ/何が 等＝観点「どれ」


def speaker_labels(script):
    # ふりがな入りラベル（女（おんな）1：等）も拾えるよう素化してから判定
    labs = set()
    for ln in strip_furi(script or "").split("\n"):
        ln = ln.strip()
        if ("：" in ln or ":" in ln) and LABEL.match(ln):
            lab = re.split(r"[：:]", ln, 1)[0].strip()
            if lab:
                labs.add(lab)
    return labs


# N3 の直接ネタバレ＝末尾付近で『まず[はも] … ください/ましょう』と正解を口で言う
TELL = re.compile(r"まず[はも]?[^。\n]{0,14}(ください|ましょう)")


def load_bank():
    out = {lv: [] for lv in LEVELS}
    base = os.path.join(ROOT, "content", "problems", "choukai")
    for lv in LEVELS:
        f = os.path.join(base, f"kadai_{lv}.json")
        if not os.path.exists(f):
            continue
        d = json.load(open(f, encoding="utf-8"))
        for it in d.get("items", []):
            qs = it.get("questions", [{}])
            q = qs[0].get("q", "") if qs else ""
            out[lv].append({"id": it["id"], "q": q, "script": it.get("script", "")})
    return out


def _load_combined(d, daimon, want_script):
    # 正本と同じ結合ファイル new_<daimon>.json（全レベル1ファイル・各recに level）を読む。
    out = {lv: [] for lv in LEVELS}
    f = os.path.join(d, f"new_{daimon}.json")
    if not os.path.exists(f):
        return out
    j = json.load(open(f, encoding="utf-8"))
    recs = j if isinstance(j, list) else j.get("items", j.get("records", []))
    for r in recs:
        lv = r.get("level")
        if lv not in out:
            continue
        rec = {"id": r.get("id", ""), "q": r.get("question", r.get("q", ""))}
        if want_script:
            rec["script"] = r.get("script", "")
        out[lv].append(rec)
    return out


def load_new(d):
    return _load_combined(d, "kadai", want_script=True)


def load_point_bank():
    out = {lv: [] for lv in LEVELS}
    base = os.path.join(ROOT, "content", "problems", "choukai")
    for lv in LEVELS:
        f = os.path.join(base, f"point_{lv}.json")
        if not os.path.exists(f):
            continue
        d = json.load(open(f, encoding="utf-8"))
        for it in d.get("items", []):
            qs = it.get("questions", [{}])
            q = qs[0].get("q", "") if qs else ""
            out[lv].append({"id": it["id"], "q": q})
    return out


def load_point_new(d):
    return _load_combined(d, "point", want_script=False)


def merge(a, b):
    return {lv: a.get(lv, []) + b.get(lv, []) for lv in LEVELS}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--add", help="正本に加えて集計する新規ディレクトリ")
    ap.add_argument("--only", help="新規ディレクトリだけ集計（正本を含めない）")
    args = ap.parse_args()

    if args.only:
        data = load_new(args.only)
        pdata = load_point_new(args.only)
        src = f"新規のみ {args.only}"
    elif args.add:
        data = merge(load_bank(), load_new(args.add))
        pdata = merge(load_point_bank(), load_point_new(args.add))
        src = f"正本＋新規 {args.add}"
    else:
        data = load_bank()
        pdata = load_point_bank()
        src = "正本(kadai_*/point_*.json)"

    print(f"=== 課題理解 設問型の分布 [{src}] ===")
    for lv in LEVELS:
        recs = data[lv]
        if not recs:
            continue
        tc = Counter(qtype(r["q"]) for r in recs)
        mono = sum(1 for r in recs if len(speaker_labels(r["script"])) <= 1)
        n = len(recs)
        top = tc.most_common(1)[0] if tc else ("-", 0)
        skew = " ⚠手順偏重" if top[0] == "手順" and top[1] >= n * 0.6 else ""
        dist = " ".join(f"{k}:{tc.get(k,0)}" for k in TYPES if tc.get(k, 0))
        print(f"{lv} 計{n} | {dist} | 独話(放送系){mono}{skew}")
        # N3 の直接ネタバレ警告
        if lv == "N3":
            tells = [r["id"] for r in recs if TELL.search(strip_furi(r["script"] or ""))]
            if tells:
                print(f"   ⚠N3 直接ネタバレ『まずは〜ください/ましょう』 {len(tells)}件: " + " ".join(tells[:20]))
    print("目安＝手順3〜4割・残り(物/場所/数時/放送)を均等。N3は直接ネタバレ0が理想。")

    # ポイント理解の観点の分布（なぜ/いつ/いくつ/気持ち/どれ）
    print(f"\n=== ポイント理解 観点の分布 [{src}] ===")
    for lv in LEVELS:
        recs = pdata.get(lv, [])
        if not recs:
            continue
        kc = Counter(kanten(r["q"]) for r in recs)
        n = len(recs)
        dist = " ".join(f"{k}:{kc.get(k,0)}" for k in KANTEN if kc.get(k, 0))
        warns = []
        if kc.get("なぜ", 0) >= n * 0.4:
            warns.append("⚠なぜ偏重(>40%)")
        if kc.get("気持ち", 0) == 0:
            warns.append("⚠気持ち観点0(感情問題が無い)")
        tail = ("  " + " ".join(warns)) if warns else ""
        print(f"{lv} 計{n} | {dist}{tail}")
    print("目安＝5観点(なぜ/いつ/いくつ/気持ち/どれ)をほぼ均等・気持ちを必ず数問・なぜは最大3〜4割。")


if __name__ == "__main__":
    main()
