# -*- coding: utf-8 -*-
r"""発話表現の全置換ビルダー（旧40問を捨てて新40問に総入れ替え）＝恒久ツール。

なぜ hatsuwa_build と別か: hatsuwa_build は「既存問へ追記」なので既存全問と dedup する。
総入れ替え（旧を消して新規採番）だと、消す予定の旧問と誤検出する。本ツールは
**バッチ内だけで自己検証**（mora/かな漏れ/長さ均等/係/留守/状況・選択肢の近似重複）し、
機能・場面・弁別軸は classify_item で自動付与、攻略耐性(最長/依頼形/形分離)と位置分散を集計する。

ドラフト＝[{script, correct, distractors:[2], pos, n?}] の配列JSON（n省略時は 1..N を自動採番）。
使い方:
  PYTHONIOENCODING=utf-8 python tools/choukai/hatsuwa_replace.py <draft.json> N4          # 検証のみ
  PYTHONIOENCODING=utf-8 python tools/choukai/hatsuwa_replace.py <draft.json> N4 --write    # 合格なら hatsuwa_N4.json を総入れ替え
書込み後: gen_choukai_json.py --ids-file <全id> → rebuild.ts（音声全再生成＋マニフェスト）。
"""
import os, sys, re, json, copy, glob, argparse
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "問題", "tools"))
from merge_and_gate import body_mora, strip_furi
from hatsuwa_axes import _form, classify_item
from sokuji_sim import nearest
try:
    from tts_script import to_tts
except Exception:
    to_tts = None

LO, HI = 18, 47
MAXDIFF = 5
SIM_GATE = 0.58
CHSET_GATE = 0.70
REQ = {"依頼謙", "依頼", "依頼砕", "ください", "希望前置"}
T_LONG, T_REQ, T_SEP, T_SHARE = 0.35, 0.35, 0.65, 0.30
CJSON = os.path.join(ROOT, "content", "problems", "choukai")
_KAKARI = re.compile(r"(?<![関])係(?![長り])")
ACCENT_AVOID = {"留守": "出かけている間／出かけていた間 等"}


def norm(s):
    s = (s or "").replace("(", "（").replace(")", "）")
    s = s.replace("係員（かかりいん）", "スタッフ").replace("係（かかり）", "スタッフ").replace("係員", "スタッフ")
    return s


def sit_core(s):
    x = strip_furi(s)
    return re.sub(r"。?[^。]*何と言いますか。?\s*$", "", x)


def chset_core(ch):
    return " ".join(sorted(strip_furi(c) for c in ch))


def leak(t):
    if not to_tts:
        return False
    o = to_tts(t)
    return "（" in o or "）" in o


def run(draft_path, lv, write):
    recs = json.load(open(draft_path, encoding="utf-8"))
    if isinstance(recs, dict):
        recs = recs.get("items", recs)
    d = json.load(open(os.path.join(CJSON, f"hatsuwa_{lv}.json"), encoding="utf-8"))
    tmpl = copy.deepcopy(d["items"][0])

    valid = []
    fatal = 0
    batch_sits = []
    batch_chs = []
    KI = Counter(); BA = Counter(); AX = Counter(); POS = Counter()
    hitLong = hitReq = formSep = 0

    for idx, r in enumerate(recs):
        n = int(r.get("n", idx + 1))
        script = norm(r["script"]); correct = norm(r["correct"])
        dist = [norm(x) for x in r["distractors"]]
        pos = int(r.get("pos", 0))
        ch = [None, None, None]; ch[pos] = correct
        di = 0
        for k in range(3):
            if k != pos:
                ch[k] = dist[di]; di += 1

        errs = []
        m = body_mora("hatsuwa", script)
        if not (LO <= m <= HI):
            errs.append(f"台本mora{m}帯外[{LO}-{HI}]")
        if len(set(ch)) != 3:
            errs.append("選択肢重複/欠")
        if any(leak(x) for x in [script] + ch):
            errs.append("かな漏れ")
        cm = [body_mora("sokuji", c) for c in ch]
        if max(cm) - min(cm) > MAXDIFF:
            errs.append(f"選択肢長さ差{max(cm)-min(cm)}>{MAXDIFF}")
        if pos not in (0, 1, 2):
            errs.append(f"pos={pos}不正")
        core = sit_core(script); chc = chset_core(ch)
        if batch_sits:
            ms, nb = nearest(core, batch_sits)
            if ms >= SIM_GATE:
                errs.append(f"状況重複{ms:.2f}~『{nb[:14]}』")
        if batch_chs:
            mc, nc = nearest(chc, batch_chs)
            if mc >= CHSET_GATE:
                errs.append(f"選択肢重複{mc:.2f}~『{nc[:16]}』")
        if any(_KAKARI.search(x) for x in [script] + ch):
            errs.append("係残存→スタッフ")
        for w, alt in ACCENT_AVOID.items():
            if any(w in strip_furi(x) for x in [script] + ch):
                errs.append(f"アクセント崩れ語「{w}」→{alt}")
        if errs:
            fatal += 1
            print(f"  ✗ {lv}-C-H-{n:04d}: {'  '.join(errs)}  mora={m}")
            continue

        batch_sits.append(core); batch_chs.append(chc)
        it = copy.deepcopy(tmpl)
        it["id"] = f"{lv}-C-H-{n:04d}"; it["level"] = lv
        it.pop("scenario", None)
        it["script"] = script; it["i18n"] = {}
        q = it["questions"][0]
        q["id"] = f"{it['id']}-q1"; q["q"] = ""; q["choices"] = ch; q["answerIndex"] = pos; q["i18n"] = {}
        f, s, a = classify_item(it)
        it["function"] = f; it["scene"] = s; it["axis"] = a
        KI[f] += 1; BA[s] += 1; AX[a] += 1; POS[pos + 1] += 1

        forms = [_form(c) for c in ch]
        if max(range(3), key=lambda k: cm[k]) == pos:
            hitLong += 1
        ri = [k for k, ff in enumerate(forms) if ff in REQ]
        if len(ri) == 1 and ri[0] == pos:
            hitReq += 1
        if forms[pos] not in [forms[k] for k in range(3) if k != pos]:
            formSep += 1
        valid.append(it)

    nn = len(valid)
    print(f"\n=== 検証 {lv}: 有効{nn}問 / 致命{fatal}件 ===")
    if nn:
        rl, rr, rs = hitLong / nn, hitReq / nn, formSep / nn
        sk, sb, sa = max(KI.values()) / nn, max(BA.values()) / nn, max(AX.values()) / nn
        print(f"  攻略耐性(低いほど良・33%基準)  最長{rl*100:.0f}%(≤{int(T_LONG*100)})  依頼形{rr*100:.0f}%(≤{int(T_REQ*100)})  形分離{rs*100:.0f}%(≤{int(T_SEP*100)})")
        print(f"  機能  最大{sk*100:.0f}% {dict(KI.most_common())}")
        print(f"  場面  最大{sb*100:.0f}% {dict(BA.most_common())}")
        print(f"  弁別軸 最大{sa*100:.0f}% {dict(AX.most_common())}")
        print(f"  正解位置 {dict(sorted(POS.items()))}")
        warns = []
        if rl > T_LONG: warns.append(f"最長{rl*100:.0f}%")
        if rr > T_REQ: warns.append(f"依頼形{rr*100:.0f}%")
        if rs > T_SEP: warns.append(f"形分離{rs*100:.0f}%")
        if sk > T_SHARE: warns.append(f"機能偏在{sk*100:.0f}%")
        if sb > T_SHARE: warns.append(f"場面偏在{sb*100:.0f}%")
        if sa > T_SHARE: warns.append(f"弁別軸偏在{sa*100:.0f}%")
        print("  " + ("⚠ " + " / ".join(warns) if warns else "✅攻略耐性・分散とも良好"))

    if write and valid and fatal == 0:
        d["items"] = valid
        json.dump(d, open(os.path.join(CJSON, f"hatsuwa_{lv}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, separators=(",", ":"))
        ids = [it["id"] for it in valid]
        print(f"\n{lv}: 総入れ替え {len(valid)}問 → hatsuwa_{lv}.json")
        print("ids: " + ",".join(ids))
    elif write:
        print("\n致命/空のため書込み中止")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("draft")
    ap.add_argument("level", choices=["N5", "N4", "N3"])
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    run(a.draft, a.level, a.write)
