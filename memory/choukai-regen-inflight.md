# 聴解 音声9本 再生成（inflight）

## 目的
ユーザーが「おかしい」と判定した聴解音声9本を再生成（scriptは既存のまま音声のみ再合成）。
サイズ異常が裏付け: N5-C-K-0068=10.9MB / N5-C-K-0117=10.4MB（長すぎ）、N4-C-K-0012=893KB（短すぎ）。

## 対象ID
N3-C-K-0147, N3-C-K-0715(mock), N4-C-P-0108, N4-C-K-0012, N4-C-K-0150,
N5-C-K-0064, N5-C-K-0068, N5-C-K-0117, N5-C-P-0062

## 手順（済/走行中）
- choukai_gen_done.txt から9IDを除去済（済スキップ回避）
- ids-file: scratchpad/regen_ids.txt
- 実行: python 問題/tools/gen_choukai_json.py --ids-file <ids>（バックグラウンド）
- 出力: assets/audio/{id}.mp3 上書き。ログ=memory/choukai_gen_log.txt

## 次の一手
1. 完了後、9本のファイルサイズが正常域(概ね1-3MB)に戻ったか確認。まだ異常なら script 側を疑う。
2. 実費(Gemini TTS)を円で報告（D2）。
3. OTA配信・在庫反映はユーザー指示があれば。
