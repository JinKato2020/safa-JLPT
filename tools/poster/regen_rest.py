# -*- coding: utf-8 -*-
# 残りポスターテーマ(family/body/food以外・図形除く)の非JA音声を最新words.json順で再生成。
#  en/bn/vi/zh/ko=Google Chirp3-HD(有料) / ne=edge(無料)。ja/id/my/th/zh2は既存_正規化を採用(対象外)。
#  出力=多言語教材/00_共通/音声/_正規化/<BIG>/<theme>/。subprocessでunicodeテーマ名を安全に渡す。
import os, subprocess, sys
MAT = r"C:/Users/jwpsa/Documents/desktop/claude/多言語教材"
GOI = f"{MAT}/00_共通/語彙"
POS = f"{MAT}/01_日本語教材/05_アプリ用ポスター"
DONE = {"01_家族", "03_体", "05_食べ物"}
FIGS = {"02_数字", "04_色と形", "13_時曜日"}  # 図形系=標準ポスターなし
themes = [d for d in sorted(os.listdir(GOI))
          if os.path.exists(f"{GOI}/{d}/words.json") and d not in DONE and d not in FIGS
          and os.path.exists(f"{POS}/en/{d}_plain_en.png")]
os.environ["PATH"] = r"C:/ffmpeg/bin" + os.pathsep + os.environ["PATH"]
print(f"対象 {len(themes)}テーマ: {themes}", flush=True)

def run(script, lang):
    r = subprocess.run([sys.executable, f"00_共通/tools/{script}", lang, *themes],
                       cwd=MAT, encoding="utf-8", errors="replace")
    print(f"=== {script} {lang} rc={r.returncode} ===", flush=True)

for L in ["en", "bn", "vi", "zh", "ko"]:
    run("gen_tts_chirp.py", L)
run("gen_tts_edge.py", "ne")
print("=== REGEN REST DONE ===", flush=True)
