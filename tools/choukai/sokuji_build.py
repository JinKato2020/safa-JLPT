# -*- coding: utf-8 -*-
"""即時応答(sokuji)の作問ビルド＝サブエージェント草案→正本追記の恒久ツール。

【なぜ専用ツールか】即時応答は audioChoices＝連結音声で選択肢を①②③の順に読む。
  正解が何番目に読まれるか(answerIndex)は「音声生成時の choices 配列順」に焼き込まれる
  ＝後から位置を変えるには音声再生成が必要。だから追記時に正解位置を①②③へ均等配分する。
  ※ merge_and_gate.py --apply は answerIndex=0(正解①)固定なので即時応答には使わない＝本ツールを使う。

【前回までの失敗＝本ツールで機械的に潰す】
  1 正解位置の偏り(旧40問は27/7/6) → ①②③を均等割当。
  2 モーラ帯外 → merge_and_gate.body_mora で N5 21-31 / N4 19-29 / N3 16-24 を機械判定。
  3 半角括弧 () → 全角（）へ正規化(FURI剥がし/モーラ/TTSが壊れる)。
  4 熟字訓の誤読・かな漏れ → to_tts でふりがな除去後に（）残り＝かな漏れを検出。
  5 完全一致の重複 → 既存 script と完全一致を弾く。

【2026-08-14 改修＝場面(scenario)廃止・機能(function)軸＋近似重複ゲート】
  即時応答は場面が聞こえないので、場面を多様性/重複の軸にしても意味がない。代わりに：
  - 層1: 草案は `function`(発話の機能・12分類)を必須タグに。偏りは function_ledger.py で点検。
  - 層2: `sokuji_sim.sim` で表面類似(文字bigram＋漢字熟語)を測り、既存/バッチと類似度≥SIM_GATEを却下
         ＝「言葉違いの実質コピー」を弾く。番人＝src/listening/sokujiSimilarity.test.ts。
  ※ 曖昧(場面依存で答えが割れる)の検品＝ブラインド・ソルバーは Excel でユーザーが実施(本ツール外)。

【ID帯規約】0001-0500=一般 / 0501-0700=枯渇プール / 0701-1000=模試専用。
  新規の一般問題は一般帯の続き番号 or 明示 n(空き番号) に割り当てる。帯制御＝src/listening/pool.ts。

入力: --draft <dir>  … dir 内の draft_{N5,N4,N3}.json(配列)。各レコード:
  {function, script, choices:[3], correct_text, answer_type(任意), n(任意=明示ID番号)}
使い方:
  python tools/choukai/sokuji_build.py --draft <WORK>            # 検証のみ(dry-run)
  python tools/choukai/sokuji_build.py --draft <WORK> --apply    # 検証OKなら正本へ追記
追記後: python 問題/tools/tts_script.py → python tools/choukai/tts_lint.py →
        python 問題/tools/gen_choukai_json.py --ids-file <新id> → node --import tsx tools/content/rebuild.ts
"""
import sys, io, os, re, json, copy, argparse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "問題", "tools"))
from merge_and_gate import body_mora, strip_furi
from sokuji_sim import nearest
try:
    from tts_script import to_tts
except Exception:
    to_tts = None

# モーラ帯(発話1文=script のみ・ふりがな除去後)。2026-08-15 公式即時応答の実測に再センタリング。
#   公式クリーン実測: N3 中央23/範囲16-32 ・ N4 中央26/範囲18-35 ・ N5 中央20/範囲14-26。
#   旧帯(N3 22-32/N5 21-31)は下限が公式中央値より上=公式に多い「短い切れの良い一言(16-20拍)」を排除し、
#   発話が長め(自作N3中央28)に寄っていた。公式に合わせ下限を下げ短い発話も許可(上限は据え置き〜微増)。
BAND = {"N5": (14, 27), "N4": (18, 33), "N3": (18, 32)}
GENERAL_MAX = 500  # 一般帯の上限。501-700=枯渇プール, 701-1000=模試専用。
SIM_GATE = 0.50    # 近似重複ゲート＝既存/バッチとの類似度がこれ以上なら却下(番人は0.55)。
# 機能タクソノミー(発話の意図)。草案の function はこの中から選ぶ。2026-08-15 公式の多彩さに合わせ拡張(12→15)。
#   謝罪・感想は「正解=適切な一反応/ダミー2つは言語的に外す(責める・賛成を並べない)」限定で復活=公式が実出題(34/36番)。
#   追加: 忠告・注意(公式N4「騒いだら怒られるよ」)/相談・意見求め(公式N3「何を差し上げたら?」)/伝聞・情報伝達(公式N3「雨だそうですよ」)。
TAXONOMY = {"依頼", "許可求め", "申し出", "誘い", "断り・辞退", "催促",
            "苦情・指摘", "確認", "報告・知らせ", "感想・共感", "お礼", "謝罪",
            "忠告・注意", "相談・意見求め", "伝聞・情報伝達"}
CJSON = os.path.join(ROOT, "content", "problems", "choukai")

def norm(s):  # 半角括弧→全角(ふりがなデリミタ)＋係→スタッフ(TTSがアクセントを外す・全大問共通ルール2026-08-16)
    s = (s or "").replace("(", "（").replace(")", "）")
    return s.replace("係員（かかりいん）", "スタッフ").replace("係（かかり）", "スタッフ").replace("係員", "スタッフ")

def load_master(lv):
    return json.load(open(os.path.join(CJSON, f"sokuji_{lv}.json"), encoding="utf-8"))

def assign_positions(existing_counts, k):
    """既存の一般帯 answerIndex 分布に対し、新規 k 問を①②③へ「常に最少の位置」で割当て均す。"""
    c = dict(existing_counts)
    out = []
    for _ in range(k):
        t = min((0, 1, 2), key=lambda i: (c.get(i, 0), i))
        out.append(t); c[t] = c.get(t, 0) + 1
    return out

def build(draft_dir, apply):
    total_new = []
    problems = 0
    for lv in ["N5", "N4", "N3"]:
        fp = os.path.join(draft_dir, f"draft_{lv}.json")
        if not os.path.exists(fp):
            print(f"{lv}: draft_{lv}.json 無し→スキップ"); continue
        recs = json.load(open(fp, encoding="utf-8"))
        d = load_master(lv)
        tmpl = copy.deepcopy(d["items"][0])
        exist_scr = {strip_furi(it["script"]) for it in d["items"]}     # 完全一致用
        exist_scripts = [it["script"] for it in d["items"]]             # 近似類似用(全帯)
        gen_ids = sorted(int(it["id"].split("-")[-1]) for it in d["items"] if int(it["id"].split("-")[-1]) <= GENERAL_MAX)
        used = set(int(it["id"].split("-")[-1]) for it in d["items"])
        # 既存一般帯の正解位置分布(均等割当の初期値)
        pos_counts = {0: 0, 1: 0, 2: 0}
        for it in d["items"]:
            if int(it["id"].split("-")[-1]) <= GENERAL_MAX:
                pos_counts[it["questions"][0]["answerIndex"]] = pos_counts.get(it["questions"][0]["answerIndex"], 0) + 1
        lo, hi = BAND[lv]
        valid = []
        seen_batch = set()
        batch_scripts = []            # このバッチで採用済みの script(近似類似の対象に加える)
        nextid = 1  # 最小の空き番号から埋める(削除で空いた番号を再利用→帯を詰める。穴が無ければmax+1相当)
        for r in recs:
            script = norm(r["script"]); choices = [norm(c) for c in r["choices"]]; correct = norm(r["correct_text"])
            func = (r.get("function") or "").strip()
            errs = []
            if func not in TAXONOMY: errs.append(f"機能タグ不正/欠落='{func}'")
            if len(choices) != 3 or len(set(choices)) != 3: errs.append("選択肢3/重複")
            if correct not in choices: errs.append("correct_text不一致")
            m = body_mora("sokuji", script)
            if not (lo <= m <= hi): errs.append(f"mora={m}帯外[{lo}-{hi}]")
            bare = strip_furi(script)
            if bare in exist_scr: errs.append("既存重複(完全一致)")
            if bare in seen_batch: errs.append("バッチ内重複(完全一致)")
            seen_batch.add(bare)
            # 近似重複(層2)
            ms, nb = nearest(script, exist_scripts + batch_scripts)
            if ms >= SIM_GATE: errs.append(f"近似重複{ms:.2f}~『{strip_furi(nb)[:16]}』")
            # かな漏れ(to_tts後に（）残り)
            if to_tts:
                for t in [script] + choices:
                    o = to_tts(t)
                    if "（" in o or "）" in o: errs.append("かな漏れ")
            # ID割当(明示n or 一般帯続き番号)
            if r.get("n"):
                num = int(r["n"])
            else:
                while nextid in used: nextid += 1
                num = nextid; used.add(num)
            if num > GENERAL_MAX: errs.append(f"一般帯超過id={num}")
            fatal = [e for e in errs if "警告" not in e]
            if fatal:
                problems += 1
                print(f"  ✗ {lv}-{num:04d}: {'  '.join(errs)}"); continue
            valid.append((num, script, choices, correct, func, r.get("answer_type", ""), errs))
            batch_scripts.append(script)
        # 正解位置を一括で均等割当
        positions = assign_positions(pos_counts, len(valid))
        add = []
        for (num, script, choices, correct, func, atype, errs), t in zip(valid, positions):
            iid = f"{lv}-C-S-{num:04d}"
            dist = [c for c in choices if c != correct]
            newc = [None, None, None]; newc[t] = correct
            di = 0
            for k in range(3):
                if k != t: newc[k] = dist[di]; di += 1
            it = copy.deepcopy(tmpl)
            it.pop("scenario", None)
            it["id"] = iid; it["level"] = lv; it["function"] = func; it["answer_type"] = atype
            it["script"] = script; it["i18n"] = {}
            q = it["questions"][0]; q["id"] = f"{iid}-q1"; q["q"] = ""; q["choices"] = newc; q["answerIndex"] = t; q["i18n"] = {}
            add.append((it, num, t, func))
            total_new.append(iid)
        for it, num, t, func in add:
            print(f"  ✓ {it['id']} [{func}] 正解位置={t+1}")
        if apply and add:
            d["items"].extend(x[0] for x in add)
            json.dump(d, open(os.path.join(CJSON, f"sokuji_{lv}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            gcount = sum(1 for it in d["items"] if int(it["id"].split("-")[-1]) <= GENERAL_MAX)
            print(f"{lv}: +{len(add)}追記 → 一般帯計{gcount}問")
        fin = dict(pos_counts)
        for _, _, t, _ in add: fin[t] += 1
        print(f"{lv} 一般帯 正解位置分布(追記後想定): ①{fin[0]} ②{fin[1]} ③{fin[2]}")
    print(f"\n=== {'APPLIED' if apply else 'DRY-RUN(--applyで追記)'}  新規{len(total_new)}問  致命{problems}件 ===")
    if total_new and apply:
        print("新id: " + ",".join(total_new))
        print("次: tts_script.py → tts_lint.py → gen_choukai_json.py --ids-file → rebuild.ts")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--draft", required=True, help="draft_{N5,N4,N3}.json のあるディレクトリ")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    build(a.draft, a.apply)
