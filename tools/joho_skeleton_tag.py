# -*- coding: utf-8 -*-
"""情報検索(joho) 骨組みパラメータのタグ付け＋分布(census)＋番人(check)＝恒久ツール(2026-08-20)。
設計正本＝md/09_読解.md「★情報検索 骨組みパラメータ(4軸)」。ワンパターン化を機械で止めるための作問メタ。
聴解の tools/choukai/skeleton_tag.py と同じ思想（既存はいじらず"薄い型"を新規で足して薄める）。

対象＝content/problems/dokkai/joho_{N5,N4,N3}.json の各item に付与する `skeleton`(ネスト4軸):
  ① q_type        設問タイプ … 選ぶ/金額/時刻/対象者/正誤/手続き（設問文からregexで決定的）
  ② notice        注記お知らせ … あり/なし（締切・割引・定員などの但し書きを読ませるか）
  ③ scene         シチュエーション … 習い事/ツアー見学/施設案内/カレンダー回覧/募集/カタログ/窓口受付/イベント
  ④ figure_pattern 図表パターン … 表のみ/表+注記/プローズ/カード/2表以上（figure.blocks構造から決定的）

判定の分担:
  q_type・notice・figure_pattern = 決定的(regex/構造) → backfill で即付与（正確）
  scene = 話題の判断が要る → backfill はヘッダ語のヒューリスティックで暫定付与。
          外れは apply-map で {id:値} から上書き（新規作問時は最初から正しい値をJSONに書く）。

モード:
  backfill  … 全itemに skeleton を付与して書き戻す（既存タグは上書き。sceneは推定）
  apply-map scene <map.json> … scene を {id:値} のmapで上書き（値の妥当性を検査）
  census    … 各軸の現在の分布を表示（未付与=「(未)」で計上・薄い型を明示）
  check     … 番人。違反(欠落／最大シェア>MAX/正誤=0)でexit 1。作問はこれがOKになるまで薄い型を足す。
使い方:
  python tools/joho_skeleton_tag.py backfill
  python tools/joho_skeleton_tag.py census
  python tools/joho_skeleton_tag.py check
  python tools/joho_skeleton_tag.py apply-map scene map_scene.json
"""
import json, os, re, sys, collections

try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "content", "problems", "dokkai")
FILES = ["joho_N5", "joho_N4", "joho_N3"]

# ── TAXONOMY（md/09_読解.md と一致。apply-map/検査に使う）──
Q_TYPE = ["選ぶ", "金額", "時刻", "対象者", "正誤", "手続き"]
NOTICE = ["あり", "なし"]
SCENE = ["習い事", "ツアー見学", "施設案内", "カレンダー回覧", "募集", "カタログ", "窓口受付", "イベント"]
FIG_PAT = ["表のみ", "表+注記", "プローズ", "カード", "2表以上"]
# 材料型＝公式ガイドブックの素材区分。N3=広告・パンフレット／N4・N5=案内・お知らせ（＋実務でカレンダー等も可）。
MEDIUM = ["案内", "お知らせ", "広告", "パンフレット", "カレンダー", "時刻表", "料金表", "募集・申込"]
AXES = ["q_type", "notice", "scene", "figure_pattern", "medium"]
TAXO = {"q_type": Q_TYPE, "notice": NOTICE, "scene": SCENE, "figure_pattern": FIG_PAT, "medium": MEDIUM}
# 各レベルで必ず入れる材料型（公式準拠。番人で存在を強制）
REQ_MEDIUM = {"N5": ["案内", "お知らせ"], "N4": ["案内", "お知らせ"], "N3": ["広告", "パンフレット"]}
REQ_MEDIUM_MIN = 3   # 上記の各材料型を最低この数

# 番人の三本立て（一律%は N5 を不自然に難しくするので用途別に）:
MONO_MAX = 0.55      # ①偏り上限：q_type/figure_pattern で1つの値がこれ超え＝ワンパターン失格
MIN_KINDS = {"q_type": 4, "scene": 6, "figure_pattern": 3, "notice": 2, "medium": 3}  # ②各軸で存在する型の最低種類数
REQ_SEIGO = 5        # ③各レベルで「正誤(正しい記述)」の最低数（本番頻出なのに現状ゼロ）
MAX_SHARE = MONO_MAX  # census 表示の偏りフラグに流用
# ④字数（実効＝本文＋図のテキスト・ルビ除く）。公式目標(09_読解.md)。帯[0.8×,1.5×]を全item必ず守る。
CHARS = {"N5": 250, "N4": 400, "N3": 600}
CHAR_LO, CHAR_HI = 0.8, 1.5


def strip_furi(s):
    s = s or ""
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r"（[^（）]*）", "", s)
    return s.replace(" ", "").replace("　", "")


def load(name):
    p = os.path.join(DIR, name + ".json")
    with open(p, encoding="utf-8") as f:
        return p, json.load(f)


def save(p, d):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")


def collect_text(v):
    if isinstance(v, str): return v
    if isinstance(v, dict): return "".join(collect_text(x) for x in v.values())
    if isinstance(v, list): return "".join(collect_text(x) for x in v)
    return ""


# ── ① q_type（設問文から決定的）──
def q_type_of(q):
    q = strip_furi(q)
    if re.search(r"いくら|合計|金額|全部で|払", q): return "金額"
    if re.search(r"何時|いつ|何曜|までに来|何日", q): return "時刻"
    if re.search(r"誰|だれ|どの人|できる人|参加できるのは|対象", q): return "対象者"
    if re.search(r"正しい|合って|本当|合う説明|内容と", q): return "正誤"
    if re.search(r"何を|どうすれ|しなければ|方法|手続|どうやって", q): return "手続き"
    return "選ぶ"  # どれ/どの〜を選ぶ（既定＝条件照合）


# ── ② notice（独立した"注記ブロック"で条件を読み替えさせる型か）──
# あり＝figureに type=='notice' の但し書き枠があり、締切ルール/割引条件/資格などを表の外で読ませる（N3の難所型）。
# なし＝表/カードのセルだけで答えが決まる（本文条件＋図の値の照合のみ）。
# ※ notes[]/footer は全図に定型で入る※行なので判定に使わない（使うと全件"あり"に潰れる）。
def notice_of(fig):
    if not fig: return "なし"
    return "あり" if any(b.get("type") == "notice" for b in fig.get("blocks", [])) else "なし"


# ── ④ figure_pattern（blocks構造から決定的）──
def figure_pattern_of(fig):
    if not fig: return "表のみ"
    kinds = [b.get("type") for b in fig.get("blocks", [])]
    ntable = kinds.count("table")
    ncard = kinds.count("card")
    nnotice = kinds.count("notice")
    if ntable >= 2: return "2表以上"
    if ntable == 0 and nnotice >= 1 and ncard == 0: return "プローズ"  # 掲示文のみ（board系）
    if ncard >= 1 and ntable == 0: return "カード"
    if ntable == 1 and nnotice >= 1: return "表+注記"
    if ntable == 1: return "表のみ"
    if ncard >= 1: return "カード"
    return "プローズ"


# ── ③ scene（ヘッダ/タイトル語のヒューリスティック。外れは apply-map で上書き）──
SCENE_RULES = [
    ("募集", r"募集|アルバイト|求人|スタッフ|ボランティア|会員になり"),
    ("カタログ", r"カタログ|通販|送料|セール|お買い得|値段表|ショップ|フリマ|販売|お店の"),
    ("窓口受付", r"窓口|受付|手続き|申込書|届出|証明書|貸出カード|登録|カウンター"),
    ("施設案内", r"開館|利用案内|館内|施設|プール|ジム|温泉|フロア|利用時間|貸出|入館|入園|営業時間|案内図"),
    ("カレンダー回覧", r"カレンダー|ごみ|ゴミ|回覧|収集|ダイヤ|時刻表|バスの|運行"),
    ("イベント", r"フェスティバル|まつり|祭|大会|上映|コンサート|読み聞かせ|イベント|発表会|花火|展覧"),
    ("ツアー見学", r"ツアー|見学|散歩|散策|ウォーキング|鑑賞|スキー|キャンプ|撮影|ハイキング|遠足|探検|巡り|の旅"),
    ("習い事", r"教室|講座|クラス|レッスン|サロン|習い|教え|コース|セミナー|ワークショップ|勉強会|練習"),
]
def scene_of(it):
    fig = it.get("figure") or {}
    if fig.get("kind") == "floor_guide": return "施設案内"
    txt = strip_furi(collect_text(it.get("title", "")) + collect_text(fig.get("header", "")) + collect_text(fig.get("intro", "")))
    for name, pat in SCENE_RULES:
        if re.search(pat, txt): return name
    return "その他"  # 未分類＝census/checkで可視化（新規はapply-mapで正す）


# ── ⑤ medium（材料型。ヘッダ/kindのヒューリスティック。基本は作問時に直書き）──
MEDIUM_RULES = [
    ("パンフレット", r"パンフレット|ガイドブック|リーフレット"),
    ("広告", r"広告|セール|お買い得|特価|キャンペーン|限定|大売出し|チラシ"),
    ("カレンダー", r"カレンダー|ごみ|ゴミ|収集|回覧|予定表"),
    ("時刻表", r"時刻表|ダイヤ|発車|運行|バスの|列車の"),
    ("料金表", r"料金表|料金一覧|入場料|利用料|入園料|値段表|価格表"),
    ("募集・申込", r"募集|求人|申込書|申込用紙|受付|エントリー"),
    ("お知らせ", r"お知らせ|おしらせ|ご案内(?!図)"),
]
def medium_of(it):
    fig = it.get("figure") or {}
    if fig.get("kind") == "pamphlet": return "パンフレット"
    txt = strip_furi(collect_text(it.get("title", "")) + collect_text(fig.get("header", "")) + collect_text(fig.get("intro", "")))
    for name, pat in MEDIUM_RULES:
        if re.search(pat, txt): return name
    return "案内"  # 既定＝案内（N4/N5素材の中心）


def backfill():
    n = 0
    for name in FILES:
        p, d = load(name)
        for it in d["items"]:
            q = it["questions"][0]["q"]
            fig = it.get("figure")
            prev = it.get("skeleton") or {}
            it["skeleton"] = {
                "q_type": q_type_of(q),                       # 決定的（常に上書き）
                "notice": notice_of(fig),                     # 決定的
                "figure_pattern": figure_pattern_of(fig),     # 決定的
                # scene/medium は作問時の直書きを尊重（無ければ推定）
                "scene": prev.get("scene") or scene_of(it),
                "medium": prev.get("medium") or medium_of(it),
            }
            n += 1
        save(p, d)
    print(f"[backfill] {n}問に skeleton(5軸) を付与（q_type/notice/figure_patternは決定的・scene/mediumは既存優先＋推定）")


def apply_map(field, mapfile):
    if field not in AXES:
        print("apply-map の field は " + "/".join(AXES) + " のみ"); sys.exit(2)
    allowed = set(TAXO[field])
    with open(mapfile, encoding="utf-8") as f:
        m = json.load(f)
    bad = sorted(set(m.values()) - allowed)
    if bad:
        print(f"⚠不正な値(TAXONOMY外)={bad}\n許可={sorted(allowed)}"); sys.exit(2)
    applied = 0
    for name in FILES:
        p, d = load(name)
        for it in d["items"]:
            if it["id"] in m:
                it.setdefault("skeleton", {})[field] = m[it["id"]]; applied += 1
        save(p, d)
    print(f"[apply-map {field}] 上書き={applied}")


def _counter(items, field):
    return collections.Counter((it.get("skeleton") or {}).get(field, "(未)") for it in items)


def eff_chars(it):
    """実効字数＝body＋figure の全テキストからルビ・空白を除いた文字数（figure_check.py と同じ数え方）。"""
    txt = collect_text(it.get("body", "")) + collect_text(it.get("figure"))
    return len(re.sub(r"\s", "", strip_furi(txt)))


def census():
    for field in AXES:
        print(f"\n=== {field} ===")
        taxo = TAXO[field]
        for name in FILES:
            _, d = load(name)
            items = d["items"]; n = len(items)
            c = _counter(items, field)
            top = c.most_common(1)[0]
            miss = c.get("(未)", 0)
            order = taxo + [k for k in c if k not in taxo and k != "(未)"]
            dist = " ".join(f"{k}{c[k]}" for k in order if c.get(k))
            flag = "  ⚠偏り" if top[0] != "(未)" and top[1] / n > MAX_SHARE else ""
            guide = max(1, round(n / len(taxo)))
            thin = [f"{k}({c.get(k,0)})" for k in taxo if c.get(k, 0) < guide]
            print(f"  {name:9} n={n:3} 最大={top[0]}:{round(top[1]/n*100)}%{flag}")
            print(f"      {dist}")
            print(f"      薄い型(目安{guide}/型未満)= {' '.join(thin) or '—'}")
    print("\n=== 字数(実効・ルビ除く) ===")
    for name in FILES:
        _, d = load(name)
        items = d["items"]; lv = name.split("_")[-1]
        ec = [eff_chars(it) for it in items]
        tgt = CHARS[lv]; lo, hi = int(tgt * CHAR_LO), int(tgt * CHAR_HI)
        med = sorted(ec)[len(ec) // 2] if ec else 0
        ob = sum(1 for x in ec if x < lo or x > hi)
        print(f"  {name:9} 中央={med} (min{min(ec)}/max{max(ec)}) 目標{tgt}[{lo}-{hi}] 帯外={ob}")


def check():
    problems = []
    for name in FILES:
        _, d = load(name)
        items = d["items"]; n = len(items)
        # 未付与（全軸）
        for field in AXES:
            miss = _counter(items, field).get("(未)", 0)
            if miss:
                problems.append(f"{name}.{field}: 未付与{miss}件（backfill漏れ＝作問がメタ抜けで増える穴）")
        # ① 偏り上限（q_type / figure_pattern）
        for field in ("q_type", "figure_pattern"):
            c = _counter(items, field)
            k, v = c.most_common(1)[0]
            if k != "(未)" and v / n > MONO_MAX:
                problems.append(f"{name}.{field}: 偏り『{k}』{round(v/n*100)}%>{int(MONO_MAX*100)}%（薄い型を新規で足す）")
        # ② 各軸の型の種類数の下限（バラツキ＝作問が全型に触れているか）
        for field, need in MIN_KINDS.items():
            kinds = [k for k in _counter(items, field) if k not in ("(未)", "その他")]
            if len(kinds) < need:
                problems.append(f"{name}.{field}: 型が{len(kinds)}種<{need}種（{'/'.join(TAXO[field])} を満遍なく）")
        # scene 未分類は不可（新規はapply-mapで正す）
        other = _counter(items, "scene").get("その他", 0)
        if other:
            problems.append(f"{name}.scene: 未分類『その他』{other}件（apply-mapで正しいsceneへ）")
        # ③ 正誤(内容一致)は各レベル必須数（本番頻出なのに現状ゼロ）
        seigo = _counter(items, "q_type").get("正誤", 0)
        if seigo < REQ_SEIGO:
            problems.append(f"{name}.q_type: 「正誤(正しい記述)」{seigo}<{REQ_SEIGO}（本番頻出＝必須）")
        # ④ 材料型（公式準拠）: N3=広告/パンフレット・N4/N5=案内/お知らせ を各レベル必須数
        lv = name.split("_")[-1]
        mc = _counter(items, "medium")
        for med in REQ_MEDIUM.get(lv, []):
            if mc.get(med, 0) < REQ_MEDIUM_MIN:
                problems.append(f"{name}.medium: 公式素材『{med}』{mc.get(med,0)}<{REQ_MEDIUM_MIN}（{lv}の必須材料）")
        # ⑤字数（実効）は全itemが公式帯[0.8×,1.5×]内＝激短/冗長を止める（必ず守る）
        tgt = CHARS[lv]; lo, hi = int(tgt * CHAR_LO), int(tgt * CHAR_HI)
        short = [(it["id"], eff_chars(it)) for it in items if eff_chars(it) < lo]
        long_ = [(it["id"], eff_chars(it)) for it in items if eff_chars(it) > hi]
        if short:
            problems.append(f"{name}.字数: 短すぎ{len(short)}件(<{lo}) 例:" + " ".join(f"{i}={c}" for i, c in short[:4]))
        if long_:
            problems.append(f"{name}.字数: 長すぎ{len(long_)}件(>{hi}) 例:" + " ".join(f"{i}={c}" for i, c in long_[:4]))
        # notice は比率不問。MIN_KINDS(=2)で あり/なし の両在を担保（N4/N5は注記型が0＝ここに足す）
    if problems:
        print("❌ 情報検索 骨組み番人 NG:")
        for p in problems: print("  -", p)
        sys.exit(1)
    print(f"✅ 情報検索 骨組み番人 OK（欠落なし・偏り≤{int(MONO_MAX*100)}%・型数下限クリア・正誤≥{REQ_SEIGO}・scene分類済・notice両在）")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "census"
    if mode == "backfill": backfill()
    elif mode == "apply-map": apply_map(sys.argv[2], sys.argv[3])
    elif mode == "census": census()
    elif mode == "check": check()
    else: print(__doc__)


if __name__ == "__main__":
    main()
