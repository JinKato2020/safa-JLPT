---
name: web-mockups
description: まいにちJLPTの画面を英語HTMLモック→スクショ→透過3D iPhone PNGにして webスクショ/ へ出力(旧版は old/ へ退避)。「web用スクショ作って」「3Dモック更新」「ストアやLP用のスマホ画像」等で使う。
---

# web-mockups — Web用 英語スクショ → 透過3D iPhone

まいにちJLPT の各画面を **英語のHTMLモック**で再現 → Chrome headless でスクショ → **背景透明・角度一定の 3D iPhone PNG** にして `webスクショ/` へ出力する。webサイト/LP/ストア説明への埋め込み用。

## 出力する画面 (7枚)
ユーザー指定の構成。`webスクショ/_html/<screen>.html` が各画面の英語モック。
- `home1` 到達度＋AIコーチ ／ `home2` 成長＋今日のオススメ ／ `home3` 継続＋バッジ
- `study` 学習タブ ／ `test` テストタブ ／ `dict` 辞書 ／ `settings` 設定

## 実行
```bash
cd webスクショ && bash build-mockups.sh
```
→ `webスクショ/<screen>_3d.png`（974×1986前後・透過・角度一定）。既存の `*_3d.png` は `webスクショ/old/` へ退避（同名は `_1,_2…` 連番）。

## 手順の中身（build-mockups.sh）
1. 既存 `*_3d.png` を `old/` へ退避。
2. 各 `_html/<screen>.html` を Chrome headless で **393×852 @3x** フラット撮影。
3. CSS 3D フレーム（`perspective(2100px) rotateY(-24deg) rotateX(4deg)`・端末枠/ダイナミックアイランド/グレア）に流し込み、**`--default-background-color=00000000` で透過撮影**。
4. 透明余白をトリムして `webスクショ/` へ保存。

## ⚠️ 重要な注意（ハマりどころ）
- **Chrome は `--screenshot` の相対パス＝exe ディレクトリ基準で書込拒否**になる。**出力は必ず Windows 絶対パス**（英字の `%LOCALAPPDATA%\Temp\safa_mock` 等）。日本語パス直下へは書けない→一時作業はAppData配下。
- 入力HTMLは **file パス（日本語可）** でOK。`img src` は相対（HTMLと同階層）で解決。
- 既存ブラウザに奪われないよう **`--user-data-dir`（一時）** を必ず付ける。
- **角度は固定**（gpt-image-1生成と違いブレない）。角度/枠を変えるなら `frame_html()` の transform を編集。

## 画面を更新するとき（最重要：古いまま撮らない）
撮影前に**必ず現行UIへ更新**する：
1. **バッジ画像を最新化**：`cp app/assets/badges/gorgeous_pass_*.png app/assets/badges/gorgeous_cover_*.png webスクショ/_html/`（_html内は前回コピーで古くなりがち）。
2. **HTML本文を現行レイアウトに合わせる**（例：合格バッジは**大リング中央**＋称号、20/40/60目盛り＋合格LINE、区分別小リング、合格率推移、カバー率は半バー＋宝石メダル＋段名…）。CSSは既存 `home1.html` を雛形に。
3. その後 `bash build-mockups.sh`。

## 引き継ぎ
出力は web セッション(app_website)が `safa-lang.com` のLP等に使用。最新の出力は `webスクショ/*_3d.png`、旧版は `webスクショ/old/`。
