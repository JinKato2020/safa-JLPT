# -*- coding: utf-8 -*-
r"""発話表現(hatsuwa)の作問ビルド＋攻略耐性ゲート＝恒久ツール。

【なぜ専用ツールか】発話表現は audioChoices＝連結音声で選択肢を①②③の順に読む＝正解位置が
  音声生成時の choices 配列順に焼き込まれる（後から変えるには音声再生成）。だから追記時に位置を確定する。
  さらに旧作は「形・長さの手がかり」で理解せず解けた（最長を選ぶで73%的中）＝本番の実力を測れない穴。
  公式は手がかりを消しているので、本ツールが機械で「攻略耐性」を測り、しきい値未満のバッチを弾く。

【ゲート（致命＝追記不可）】
  1 台本モーラ帯 18-47（body_mora('hatsuwa')・公式N3実測 24-47）。
  2 選択肢は3つ・重複なし・かな漏れ無し（to_tts後に（）残り）。
  3 選択肢の長さ均等：3つのモーラ差 ≤ MAXDIFF(=5)＝「最長＝正解」を無効化。
  4 pos は 0/1/2。
【ゲート（バッチ集計＝警告／--strict で致命）】＝攻略耐性（低いほど良い・ランダム33%）
  - 「最長を選ぶ」的中 ≤ 35% / 「依頼形を選ぶ」的中 ≤ 35% / 形で分離可 ≤ 65%
  - 機能・場面の最大シェア ≤ 30%（偏在防止）
  - 正解位置①②③が概ね均等

ドラフト＝{function,scene,axis,script,correct,distractors:[2],pos} の配列JSON（キー items でも可）。
使い方:
  python tools/choukai/hatsuwa_build.py <draft.json> N3            # 検証のみ
  python tools/choukai/hatsuwa_build.py <draft.json> N3 --apply    # 合格なら正本 hatsuwa_N3.json へ採番追記
  （--strict で攻略耐性/分散の閾値超過も致命に）
追記後: gen_choukai_json.py --ids-file <新id> → rebuild.ts（即時応答と同じ後工程）。
"""
import sys, io, os, re, json, copy, glob, argparse
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "問題", "tools"))
from merge_and_gate import body_mora, strip_furi
from hatsuwa_axes import classify_item
from sokuji_sim import nearest
try:
    from tts_script import to_tts
except Exception:
    to_tts = None

LO, HI = 18, 47          # 台本モーラ帯
MAXDIFF = 5              # 選択肢の長さ差の上限（均等化）
GENERAL_MAX = 500        # 一般帯
SIM_GATE = 0.58          # 状況文の近似重複ゲート（似た場面の量産を防ぐ）
CHSET_GATE = 0.70        # 選択肢セットの近似重複ゲート（名詞だけ差し替えた実質コピーを防ぐ＝状況文が違っても選択肢が同型なら却下）
REQ = {"依頼謙", "依頼", "依頼砕", "ください", "希望前置"}
CJSON = os.path.join(ROOT, "content", "problems", "choukai")
# 攻略耐性しきい値
T_LONG, T_REQ, T_SEP = 0.35, 0.35, 0.65
T_SHARE = 0.30
# 係＝AI音声でアクセントが崩れる（ユーザー厳命 2026-08-16）→スタッフへ自動変換。関係/係長/係りは除外。
_KAKARI_RESID = re.compile(r"(?<![関])係(?![長り])")
# アクセント崩れ語＝AI(Gemini TTS)がアクセントを外す語。自動変換できない(文脈依存)ので言い換え必須＝致命。
# 係はnormで自動変換するので別扱い。追加語は同種の崩れを見つけ次第ここへ（[[choukai-kakari-ban-and-dedup-common]]）。
ACCENT_AVOID = {"留守": "出かけている間／出かけていた間 等"}


def norm(s):
    s = (s or "").replace("(", "（").replace(")", "）")
    s = s.replace("係員（かかりいん）", "スタッフ").replace("係（かかり）", "スタッフ")
    s = s.replace("係員", "スタッフ")
    return s


def sit_core(s):
    """状況文の核（ふりがな除去＋末尾『(誰々に…)何と言いますか。』の定型を除去）＝類似判定用。"""
    x = strip_furi(s)
    x = re.sub(r"。?[^。]*何と言いますか。?\s*$", "", x)
    return x


def chset_core(choices):
    """選択肢セットの核＝ふりがな除去して並べ替え結合（順不同で同型コピーを検出）。"""
    return " ".join(sorted(strip_furi(c) for c in choices))


def leak(t):
    if not to_tts:
        return False
    o = to_tts(t)
    return "（" in o or "）" in o


def _form(c):
    # hatsuwa_axes._form と同義（依頼形判定用）
    from hatsuwa_axes import _form as f
    return f(c)


def build(draft_path, lv, apply, strict):
    recs = json.load(open(draft_path, encoding="utf-8"))
    if isinstance(recs, dict):
        recs = recs.get("items", [])
    d = json.load(open(os.path.join(CJSON, f"hatsuwa_{lv}.json"), encoding="utf-8"))
    tmpl = copy.deepcopy(d["items"][0])
    exist_scr = {strip_furi(it["script"]) for it in d["items"]}
    exist_sits = [sit_core(it["script"]) for it in d["items"]]   # 状況文の近似重複対象（既存全問）
    exist_chs = [chset_core(it["questions"][0]["choices"]) for it in d["items"]]  # 選択肢セットの近似重複対象
    batch_sits = []                                              # このバッチで採用済みの状況核
    batch_chs = []
    used = set(int(it["id"].split("-")[-1]) for it in d["items"])
    valid = []
    fatal = 0
    KI = Counter(); BA = Counter(); POS = Counter()
    hitLong = hitReq = formSep = 0
    nextid = 1
    for r in recs:
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
            errs.append(f"選択肢長さ差{max(cm)-min(cm)}>({MAXDIFF})")
        if pos not in (0, 1, 2):
            errs.append(f"pos={pos}不正")
        if strip_furi(script) in exist_scr:
            errs.append("既存台本と重複")
        # 近似重複（似た問題の量産を防ぐ・同一レベル内）＝状況文＋選択肢セットの両方
        core = sit_core(script); chc = chset_core(ch)
        ms, nb = nearest(core, exist_sits + batch_sits) if (exist_sits or batch_sits) else (0.0, "")
        if ms >= SIM_GATE:
            errs.append(f"状況重複{ms:.2f}~『{nb[:14]}』")
        mc, nc = nearest(chc, exist_chs + batch_chs) if (exist_chs or batch_chs) else (0.0, "")
        if mc >= CHSET_GATE:
            errs.append(f"選択肢セット重複{mc:.2f}~『{nc[:16]}』")
        # 係の残存（norm で変換しきれない場合）
        if any(_KAKARI_RESID.search(x) for x in [script] + ch):
            errs.append("係が残存→スタッフ等へ言い換え")
        # アクセント崩れ語（留守 等）＝言い換え必須
        for w, alt in ACCENT_AVOID.items():
            if any(w in strip_furi(x) for x in [script] + ch):
                errs.append(f"アクセント崩れ語「{w}」→{alt}へ言い換え")
        # ID
        if r.get("n"):
            num = int(r["n"])
        else:
            while nextid in used:
                nextid += 1
            num = nextid; used.add(num)
        if num > GENERAL_MAX:
            errs.append(f"一般帯超過id={num}")
        if errs:
            fatal += 1
            print(f"  ✗ {lv}-C-H-{num:04d}: {'  '.join(errs)}")
            continue
        # 集計
        batch_sits.append(core); batch_chs.append(chc)
        f, s, a = (r.get("function"), r.get("scene"), r.get("axis"))
        KI[f] += 1; BA[s] += 1; POS[pos + 1] += 1
        forms = [_form(c) for c in ch]
        if max(range(3), key=lambda k: cm[k]) == pos:
            hitLong += 1
        reqidx = [k for k, ff in enumerate(forms) if ff in REQ]
        if len(reqidx) == 1 and reqidx[0] == pos:
            hitReq += 1
        if forms[pos] not in [forms[k] for k in range(3) if k != pos]:
            formSep += 1
        valid.append((num, ch, pos, f, s, a, script, correct))

    n = len(valid)
    print(f"\n=== 検証 {lv}: 有効{n}問 / 致命{fatal}件 ===")
    if n:
        share_ki = max(KI.values()) / n
        share_ba = max(BA.values()) / n
        rl, rr, rs = hitLong / n, hitReq / n, formSep / n
        print(f"  分散  機能最大{share_ki*100:.0f}% {dict(KI.most_common())}")
        print(f"        場面最大{share_ba*100:.0f}% {dict(BA.most_common())}")
        print(f"        正解位置 {dict(sorted(POS.items()))}")
        print(f"  攻略耐性(低いほど良・ランダム33%)  最長{rl*100:.0f}%(≤{int(T_LONG*100)})  依頼形{rr*100:.0f}%(≤{int(T_REQ*100)})  形分離{rs*100:.0f}%(≤{int(T_SEP*100)})")
        warns = []
        if rl > T_LONG: warns.append(f"最長{rl*100:.0f}%超過")
        if rr > T_REQ: warns.append(f"依頼形{rr*100:.0f}%超過")
        if rs > T_SEP: warns.append(f"形分離{rs*100:.0f}%超過")
        if share_ki > T_SHARE: warns.append(f"機能偏在{share_ki*100:.0f}%")
        if share_ba > T_SHARE: warns.append(f"場面偏在{share_ba*100:.0f}%")
        if warns:
            print("  ⚠攻略耐性/分散: " + " / ".join(warns))
            if strict:
                print("  → --strict のため致命扱い（追記中止）")
                fatal += len(warns)
        else:
            print("  ✅攻略耐性・分散とも良好")

    if apply and valid and fatal == 0:
        add = []
        for num, ch, pos, f, s, a, script, correct in valid:
            iid = f"{lv}-C-H-{num:04d}"
            it = copy.deepcopy(tmpl)
            it["id"] = iid; it["level"] = lv
            it["function"] = f; it["scene"] = s; it["axis"] = a
            it["script"] = script; it["i18n"] = {}
            it.pop("scenario", None)
            q = it["questions"][0]
            q["id"] = f"{iid}-q1"; q["q"] = ""; q["choices"] = ch; q["answerIndex"] = pos; q["i18n"] = {}
            add.append(it)
        d["items"].extend(add)
        json.dump(d, open(os.path.join(CJSON, f"hatsuwa_{lv}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, separators=(",", ":"))
        ids = [it["id"] for it in add]
        print(f"\n{lv}: +{len(add)}追記 → 計{len(d['items'])}問")
        print("新id: " + ",".join(ids))
        print("次: gen_choukai_json.py --ids-file <新id> → rebuild.ts")
    elif apply:
        print("\n致命ありのため追記中止（修正して再実行）")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("draft")
    ap.add_argument("level", choices=["N5", "N4", "N3"])
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()
    build(a.draft, a.level, a.apply, a.strict)
