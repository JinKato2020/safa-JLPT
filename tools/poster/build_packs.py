# -*- coding: utf-8 -*-
# ポスター朗読の配信パック(STORED zip)＋カタログを生成する。
#  設計＝元アプリ(聞いて話せる日本語) posterPackLoader.ts と同方式:
#   - poster-<lang>.zip は STORED(無圧縮)。エントリ名 "<theme>/audio/NN_<lang>.mp3" /
#     "<theme>/audio/title_<lang>.mp3" /(非JAのみ)"<theme>/poster_<lang>.webp"。JAは音声のみ。
#   - poster-catalog.json = { version, langs:{ <lang>:{url,bytes,version} } }
#  音声=24kHz mono に再エンコード(軽量化)。画像=WebP・幅WIDTH に縮小(軽量化・見た目維持)。
#  音声ソース: 全言語(ja含む)=多言語教材 _正規化/<BIG>/<themefolder>/(NN|title)_<lang>.mp3(検証済・全28テーマ×11言語)。
#  画像ソース: 多言語教材/01_日本語教材/05_アプリ用ポスター/<lang>/<themefolder>_plain_<lang>.png。
#  テーマ定義: poster_themes.THEMES(28テーマ)。
#  使い方: python tools/poster/build_packs.py [--width 1080] [--abr 48k]
import os, sys, io, json, subprocess, tempfile, shutil
import zipfile as zf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from poster_themes import THEMES
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = r"C:/Users/jwpsa/Documents/desktop/claude"
MAT = f"{ROOT}/多言語教材"
NORM = f"{MAT}/00_共通/音声/_正規化"
POSTERSRC = f"{MAT}/01_日本語教材/05_アプリ用ポスター"
OUT = f"{ROOT}/JLPTアプリ/tools/poster/_packs"
REL_BASE = "https://github.com/JinKato2020/safa-JLPT/releases/download/packs-poster/"

LANGS = ["ja", "bn", "en", "id", "ko", "my", "ne", "th", "vi", "zh", "zh2"]
VERSION = 1  # 初版。録り直しの度に +1(catalog全体+該当langも)。

WIDTH = 1080
ABR = "48k"
for i, a in enumerate(sys.argv):
    if a == "--width": WIDTH = int(sys.argv[i + 1])
    if a == "--abr": ABR = sys.argv[i + 1]

os.environ["PATH"] = r"C:/ffmpeg/bin" + os.pathsep + os.environ["PATH"]

def sh(args):
    r = subprocess.run(args, capture_output=True, encoding="utf-8", errors="ignore")
    if r.returncode != 0:
        raise SystemExit(f"[ffmpeg失敗] {' '.join(args)}\n{r.stderr[-400:]}")

def transcode_audio(src, dst):
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ar", "24000", "-ac", "1",
        "-c:a", "libmp3lame", "-b:a", ABR, dst])

def to_webp(src, dst):
    try:
        from PIL import Image
        im = Image.open(src).convert("RGB")
        if im.width > WIDTH:
            h = round(im.height * WIDTH / im.width)
            im = im.resize((WIDTH, h), Image.LANCZOS)
        im.save(dst, "WEBP", quality=80, method=6)
    except ImportError:
        sh(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", f"scale={WIDTH}:-1",
            "-c:v", "libwebp", "-quality", "80", dst])

def audio_count(folder):
    j = json.load(open(f"{MAT}/00_共通/語彙/{folder}/words.json", encoding="utf-8"))
    return len(j["words"])

def main():
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)
    catalog = {"version": VERSION, "langs": {}}
    tmp = tempfile.mkdtemp()
    miss = []
    try:
        for lang in LANGS:
            BIG = lang.upper()
            entries = []
            for slug, folder, _ja in THEMES:
                n = audio_count(folder)
                for key in ["title"] + [f"{i:02d}" for i in range(1, n + 1)]:
                    src = f"{NORM}/{BIG}/{folder}/{key}_{lang}.mp3"
                    if not os.path.exists(src):
                        if key == "title": continue  # title欠は許容
                        miss.append(f"{lang}/{folder}/{key}"); continue
                    dst = os.path.join(tmp, f"{lang}_{slug}_{key}.mp3")
                    transcode_audio(src, dst)
                    entries.append((f"{slug}/audio/{key}_{lang}.mp3", dst))
                if lang != "ja":
                    img = f"{POSTERSRC}/{lang}/{folder}_plain_{lang}.png"
                    if not os.path.exists(img):
                        miss.append(f"IMG {lang}/{folder}"); continue
                    dstw = os.path.join(tmp, f"{lang}_{slug}.webp")
                    to_webp(img, dstw)
                    entries.append((f"{slug}/poster_{lang}.webp", dstw))
            zpath = f"{OUT}/poster-{lang}.zip"
            with zf.ZipFile(zpath, "w", compression=zf.ZIP_STORED) as z:
                for arc, src in entries:
                    z.write(src, arc)
            b = os.path.getsize(zpath)
            catalog["langs"][lang] = {"url": f"{REL_BASE}poster-{lang}.zip", "bytes": b, "version": VERSION}
            print(f"poster-{lang}.zip  {len(entries)}エントリ  {b/1024:.0f} KB", flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    json.dump(catalog, open(f"{OUT}/poster-catalog.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    total = sum(v["bytes"] for v in catalog["langs"].values())
    print(f"--- catalog v{VERSION}・{len(THEMES)}テーマ・{len(LANGS)}言語・合計 {total/1024/1024:.2f} MB ---")
    if miss:
        print(f"[欠落 {len(miss)}件] 先頭: {miss[:8]}")
    print(f"出力: {OUT}")

if __name__ == "__main__":
    main()
