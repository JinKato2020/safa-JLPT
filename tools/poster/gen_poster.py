# -*- coding: utf-8 -*-
# ポスター朗読データ生成(JLPTアプリ用・聞いて話せる日本語 _gen_poster.py の移植)。
#   入力(素材): 多言語教材/01_日本語教材/05_アプリ用ポスター/<lang>/<NN_和名>_plain_<lang>.png (plain=広告なし・10言語)
#               多言語教材/00_共通/音声/<LANGDIR>/<NN_和名>/<MM>_<lang>.mp3 + title_<lang>.mp3 (11言語 ja+10)
#   出力(既定=データのみ): src/data/posterLessons.ts (box座標 + 音声/画像キー)。
#       値は配信キー(例 'family/audio/01_ja.mp3' / 'family/poster_en.png')。file://解決は src/data/posterAssets.ts。
#   box座標: ポスター画像のグレー枠(#e6e8ec)を検出(2列グリッド・解像度非依存)。plainでも検出可を実測確認済。
#
#   使い方:
#     python tools/poster/gen_poster.py                 # データのみ生成(可逆・pushなし)
#     python tools/poster/gen_poster.py --stage-assets  # 追加で音声再エンコード+画像コピーを staging へ(Pages配置用)
#
#   ※ --stage-assets は Pages へ上げる素材を tools/poster/_staging/ に用意するだけ(配置/pushはしない)。
import os, re, math, argparse, shutil, subprocess
import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GENBA = r"C:\Users\jwpsa\Documents\desktop\claude\多言語教材"
POSTER_SRC = os.path.join(GENBA, "01_日本語教材", "05_アプリ用ポスター")   # <lang>/<NN_和名>_plain_<lang>.png
AUDIO_SRC = os.path.join(GENBA, "00_共通", "音声")                          # <LANGDIR>/<NN_和名>/<MM>_<lang>.mp3
TS_OUT = os.path.join(REPO, "src", "data", "posterLessons.ts")
# Pages配信素材の置き先=repo直下 assets/poster/(build-jlpt.yml が _site/assets/poster へコピーして公開)。
#   assets/poster/<id>/poster_<lang>.png ・ assets/poster/<id>/audio/<NN>_<lang>.mp3 (配信キーと一致)。
STAGING = os.path.join(REPO, "assets", "poster")
FFMPEG = shutil.which("ffmpeg") or r"C:\ffmpeg\bin\ffmpeg.exe"

# 画像=10言語(ja版ポスターは無い=日本語+L1併記のため)。音声=ja+10。UIコードは en/ne へフォールバック。
LANGS = ["bn", "en", "id", "ko", "my", "ne", "th", "vi", "zh", "zh2"]
ALL_AUDIO = ["ja"] + LANGS
LANGDIR = {"ja": "JA", "bn": "BN", "en": "EN", "id": "ID", "ko": "KO", "my": "MY",
           "ne": "NE", "th": "TH", "vi": "VI", "zh": "ZH", "zh2": "ZH2"}
DETECT_L1 = "ne"   # box検出に使う代表言語(行レイアウトは全言語共通)

# パイロット: (id, 素材フォルダ名)。全31へ広げる時はここに追記するだけ。
import sys as _sys, json as _json
_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from poster_themes import THEMES as THEME_DEFS  # (slug, folder, ja_title)
THEMES = [(s, f) for s, f, _ in THEME_DEFS]
JA_TITLE = {s: jt for s, f, jt in THEME_DEFS}
GOI = os.path.join(GENBA, "00_共通", "語彙")
TITLE_FIELD = {"en": "enTitle", "ne": "npTitle", "bn": "bnTitle", "id": "idTitle", "ko": "koTitle",
               "my": "myTitle", "th": "thTitle", "vi": "viTitle", "zh": "zhTitle", "zh2": "zh2Title"}
def title_l1(lid, folder):
    j = _json.load(open(os.path.join(GOI, folder, "words.json"), encoding="utf-8"))
    d = {"ja": JA_TITLE[lid]}
    for l in LANGS:
        v = j.get(TITLE_FIELD[l])
        if v: d[l] = str(v).replace("<br>", " ").strip()
    return d

# テーマ名の各言語訳(一覧表示用)。ja + 10言語。パイロット3テーマ分(高信頼の基本語)。
TITLE_L1 = {
    "family": {"ja": "家族", "bn": "পরিবার", "en": "Family", "id": "Keluarga", "ko": "가족",
               "my": "မိသားစု", "ne": "परिवार", "th": "ครอบครัว", "vi": "Gia đình", "zh": "家庭", "zh2": "家庭"},
    "body":   {"ja": "体", "bn": "শরীর", "en": "Body", "id": "Tubuh", "ko": "몸",
               "my": "ခန္ဓာကိုယ်", "ne": "शरीर", "th": "ร่างกาย", "vi": "Cơ thể", "zh": "身体", "zh2": "身體"},
    "food":   {"ja": "食べ物", "bn": "খাবার", "en": "Food", "id": "Makanan", "ko": "음식",
               "my": "အစားအစာ", "ne": "खाना", "th": "อาหาร", "vi": "Thức ăn", "zh": "食物", "zh2": "食物"},
}
TITLE_ORDER = ["ja"] + LANGS

def poster_path(folder, lang):
    return os.path.join(POSTER_SRC, lang, f"{folder}_plain_{lang}.png")

def cell_count(folder):
    j = _json.load(open(os.path.join(GOI, folder, "words.json"), encoding="utf-8"))
    return len(j["words"])

# --- box検出(グレー枠#e6e8ec の横罫線を左カード幅で拾い、適応しきいで丁度2R本にする) ---
COLF = [(56 / 2480, 1214 / 2480), (1264 / 2480, 2422 / 2480)]  # 左右2列のx範囲(画像幅比・基準2480px)
def cols_for(W):
    return [(round(a * W), round(b * W)) for a, b in COLF]

def _group_lines(frac, H, th, top, bot, gap):
    lines = [y for y in range(top, H - bot) if frac[y] > th]
    g = []
    for v in lines:
        if g and v - g[-1][-1] <= gap: g[-1].append(v)
        else: g.append([v])
    return [sum(x) // len(x) for x in g]

def detect_rows(folder, R):
    png = poster_path(folder, DETECT_L1)
    a = np.asarray(Image.open(png).convert("RGB")).astype(int)
    H, W = a.shape[0], a.shape[1]
    col = cols_for(W)
    Rc, Gc, Bc = a[..., 0], a[..., 1], a[..., 2]
    border = (np.abs(Rc - 230) < 14) & (np.abs(Gc - 232) < 14) & (np.abs(Bc - 236) < 14)
    frac = border[:, col[0][0]:col[0][1]].mean(axis=1)
    top = round(110 * H / 1754); bot = round(12 * H / 1754); gap = max(2, round(5 * W / 2480))
    chosen = None
    for i in range(26):
        th = round(0.30 + 0.02 * i, 2)
        c = _group_lines(frac, H, th, top, bot, gap)
        if len(c) == 2 * R: chosen = c; break
        if chosen is None and len(c) >= 2 * R: chosen = c[:2 * R]
    if chosen is None:
        raise RuntimeError(f"{folder}: 横罫線を 2R={2*R} 本にできず(W={W} H={H})")
    return [(chosen[2 * k], chosen[2 * k + 1]) for k in range(R)], W, H

def boxes(n, folder):
    R = math.ceil(n / 2)
    rows, W, H = detect_rows(folder, R)
    col = cols_for(W)
    out = []
    for i in range(n):
        ci, ri = (0, i) if i < R else (1, i - R)
        x, x2 = col[ci]; top, bot = rows[ri]
        out.append({"i": i, "x": x, "y": top, "w": x2 - x, "h": bot - top})
    return out, W, H

def enc32k(src, dst):
    if os.path.exists(dst): return
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src,
                        "-ar", "24000", "-ac", "1", "-b:a", "32k", "-map_metadata", "-1",
                        "-af", "apad=pad_dur=0.25", dst], capture_output=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError("ffmpeg fail " + src + " " + r.stderr.decode("utf-8", "replace")[:200])

def stage_assets(lessons):
    """Pages配置用の素材を tools/poster/_staging/<id>/ に用意(画像コピー+音声32k再エンコード)。pushはしない。"""
    tasks = []
    for ls in lessons:
        lid, folder, n = ls["id"], ls["folder"], ls["n"]
        d = os.path.join(STAGING, lid); ad = os.path.join(d, "audio")
        os.makedirs(ad, exist_ok=True)
        for L in LANGS:
            shutil.copyfile(poster_path(folder, L), os.path.join(d, f"poster_{L}.png"))
        for L in ALL_AUDIO:
            for k in range(1, n + 1):
                tasks.append((os.path.join(AUDIO_SRC, LANGDIR[L], folder, f"{k:02d}_{L}.mp3"),
                              os.path.join(ad, f"{k:02d}_{L}.mp3")))
            ts = os.path.join(AUDIO_SRC, LANGDIR[L], folder, f"title_{L}.mp3")
            if os.path.exists(ts):
                tasks.append((ts, os.path.join(ad, f"title_{L}.mp3")))
    print(f"音声再エンコード {len(tasks)}件(32k/24kHz mono +0.25s pad)...", flush=True)
    for s, dd in tasks:
        enc32k(s, dd)
    print(f"staging 完了: {STAGING}")

def build_lessons():
    lessons = []
    for lid, folder in THEMES:
        if not os.path.exists(poster_path(folder, DETECT_L1)):
            raise SystemExit(f"[素材なし] {lid}/{folder}: {poster_path(folder, DETECT_L1)} が見つからない")
        n = cell_count(folder)
        bx, W, H = boxes(n, folder)
        lessons.append({"id": lid, "folder": folder, "title": re.sub(r"^\d+_", "", folder),
                        "boxes": bx, "n": n, "W": W, "H": H})
        print(f"  {lid}: {n}cells +title, boxes検出OK ({W}x{H})", flush=True)
    return lessons

def emit_ts(lessons):
    L = [
        "// 自動生成 (tools/poster/gen_poster.py)。素材=多言語教材/01_日本語教材/05_アプリ用ポスター(plain・10言語) + 00_共通/音声(ja+10)。",
        "// box=ポスター画像のグレー枠から実カード枠を検出。値は配信キー(例 'family/audio/01_ja.mp3')。file://解決は src/data/posterAssets.ts。",
        "export type PosterCard = { i: number; box: { x: number; y: number; w: number; h: number }; ja: string; l1: Record<string, string> };",
        "export type PosterLesson = { id: string; title: string; titleL1: Record<string, string>; imageL1: Record<string, string>; titleAudio?: { ja: string; l1: Record<string, string> }; posterW: number; posterH: number; cards: PosterCard[] };",
        "",
        "export const POSTER_LESSONS: PosterLesson[] = [",
    ]
    for ls in lessons:
        lid = ls["id"]
        img = ", ".join([f"{l}:'{lid}/poster_{l}.webp'" for l in LANGS])
        tl1 = ", ".join([f"{l}:'{lid}/audio/title_{l}.mp3'" for l in LANGS])
        tl = title_l1(lid, ls['folder'])
        tlstr = ", ".join([f"{k}:'{tl[k]}'" for k in TITLE_ORDER if k in tl])
        L.append(f" {{ id:'{lid}', title:'{ls['title']}', titleL1:{{ {tlstr} }}, posterW:{ls['W']}, posterH:{ls['H']},")
        L.append(f"   imageL1:{{ {img} }},")
        L.append(f"   titleAudio:{{ ja:'{lid}/audio/title_ja.mp3', l1:{{ {tl1} }} }},")
        L.append("   cards:[")
        for b in ls["boxes"]:
            k = b["i"] + 1
            ja = f"'{lid}/audio/{k:02d}_ja.mp3'"
            l1 = ", ".join([f"{l}:'{lid}/audio/{k:02d}_{l}.mp3'" for l in LANGS])
            L.append(f"   {{ i:{b['i']}, box:{{x:{b['x']},y:{b['y']},w:{b['w']},h:{b['h']}}}, ja:{ja}, l1:{{ {l1} }} }},")
        L.append("   ] },")
    L.append("];")
    os.makedirs(os.path.dirname(TS_OUT), exist_ok=True)
    with open(TS_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")
    print("posterLessons.ts 生成:", TS_OUT)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage-assets", action="store_true", help="Pages配置用の素材(画像+32k音声)を _staging に用意")
    args = ap.parse_args()
    lessons = build_lessons()
    emit_ts(lessons)
    if args.stage_assets:
        stage_assets(lessons)

if __name__ == "__main__":
    main()
