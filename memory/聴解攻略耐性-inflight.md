# 聴解 攻略耐性の是正（/clear耐性）— 2026-08-21 着手・有料作業まだゼロ

## ユーザー指示（是正して緑化したい・該当問題を再生成）
在庫Excel「聴解攻略耐性分析」シートの赤を緑に：
1. **即時応答 N4「最長を選ぶ的中」52%（赤・基準33）** → 緑＝基準+15以内（≤48%）、できれば40%前後へ。正解が最長選択肢の割合を下げる。
2. **発話表現 台本重複(≥.60)**：**N5=24 / N4=8 / N3=4**（赤・合格=0）→ 各0へ。同一大問×レベル内で台本が0.60以上似ている問題を作り直して多様化。

## 指標の定義（tools/choukai/daimon_solvability.py）
- **最長を選ぶ的中%**＝正解が最長選択肢(モーラ最長)の割合。基準=100/選択肢数(3択→33)。合格=基準+15以内。表示シャッフルでも文長不変ゆえ攻略の手がかり。
- **台本重複(≥.60)**＝`cores[i]`(=strip_furi(body_text('hatsuwa',script)))が他のcoreに対し`nearest()`類似≥0.60な問題の数。DUP_SCRIPT=0.60。
- 分析実行：`PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python tools/choukai/daimon_solvability.py`（--xlsxで在庫Excel更新）。現状=発話N3重複4/N4重複8/N5重複24・即時N4最長52%。

## 再生成の道具（要確認して使う）
- 発話：`tools/choukai/hatsuwa_build.py`（攻略耐性設計・[[choukai-kakari-ban-and-dedup-common]]）。作問フロー正本=`md/聴解_作問フロー.md`。
- 即時：`tools/choukai/sokuji_build.py`（正解位置は音声焼込み・均等[[sokuji-answer-position-balanced]]）。
- 音声：Gemini2.5Flash TTS（**有料**）。[[tts-no-retry-single-call]]（リトライ厳禁・range(1)固定）。番号選択=audioChoices・正解位置は音声に焼込み。
- ID帯規約=[[listening-id-band-convention]]。作問フロー=[[choukai-authoring-flow]]。

## 該当ID列挙ヘルパー（作りかけ・要修正）
- `tools/choukai/_offenders_helper`（未完）。`from sokuji_sim import nearest` の**返り値の順序が (sim, idx) か (idx, sim) か要確認**（`idx<i`比較で `str<int` TypeError が出た＝2要素目がindexでない可能性）。`nearest()`のシグネチャをReadしてから列挙し直す。
- やること：①発話N3/N4/N5の重複クラスタ(id~id sim)を列挙②即時N4の「正解=最長」問題ID＋各選択肢モーラを列挙 → 何本作り直すか確定。

## コスト（D1厳守・無断課金しない）
- 発話 台本重複 計36問＋即時N4 最長是正 ~30問 ⇒ 再生成に伴う**再TTSの本数を確定してから円換算見積り**を提示→承認後に実行。過去実測 ~¥0.9〜4/クリップ（Gemini2.5Flash）。¥1000未満でも本数と概算を先に提示する。
- **手順**：offender確定→再生成方針(発話=台本多様化／即時=正解の最長性を崩す＝正解を短く or 誤答を長く)→**見積り提示・承認**→作問→ゲート緑(daimon_solvability)→TTS(1コール)→rebuild→_manifest→在庫Excel再生成(daimon_solvability --xlsx)→配信はOTA(publish-content.ps1・ビルド不要)。

## ✅完了（2026-08-21・コミット`843f1df7`・OTA配信済）
- **全緑化＋配信まで完了**：発話台本重複 N5/N4/N3=**0**・即時N4最長=**40%**（daimon_solvability --xlsx反映済）。
- **音声48本再生成＝48/48成功・失敗0・実費 Gemini2.5Flash $0.19≒¥28**（D2報告済）。
- **コミット`843f1df7`（content 5ファイル＋assets/audio 48mp3＋inplace_fix.py）→push→OTA配信**（Pages run`32487325472` in_progress・ビルド無し）。content検証13/13緑。
- **audio配信の要点（次回の注意）**：音声は`AUDIO_BASE_URL=…github.io/safa-JLPT/assets/audio/`＝Pages配信。**publish-content.ps1は`git add content/`のみ**で`assets/audio`を拾わない→音声変更時は**手動commitで assets/audio も含める**（今回はそうした）。
- 残（今回対象外の既存事項）：発話の帯外(mora)・即時N3/N5の選択肢重複2＝帯導入前/別件。ユーザー判断。

## 進捗（2026-08-21・作問=完了/緑・音声生成へ）
- **作問・ゲート完了＝全赤が緑**：daimon_solvability実測＝発話台本重複 N5 24→**0**・N4 8→**0**・N3 4→**0**／即時N4最長 52%→**40%**（緑線≤48%・理想40%を的中）。
- **やり方**：新規恒久ツール `tools/choukai/inplace_fix.py`（既存IDを同idのまま現場修正＝audioファイル名不変・他問不変）。発話=状況文＋選択肢を丸ごと多様化して差し替え（機能/場面/軸は自動再分類・自idを除く同レベル全問とsim<0.58・選択肢セット<0.70）。即時=**正解本文は据え置き**で誘惑肢1つを自然に延長し「正解＝最長」を崩す（正解位置不変）。
- **パッチ正本**（scratchpad・再実行可）：発話18問=`…scratchpad/patch_hatsuwa.json`（id一覧=`patch_hatsuwa.json.ids.txt`）／即時30問=`…scratchpad/patch_sokuji.json`（同`.ids.txt`）。**content JSONへ--write適用済**（sokuji_N4＋hatsuwa_N5/N4/N3）。done台帳から48id除去済。
- **今の状態＝テキストは新・音声は旧のズレ（未配信＝OTAもビルドもしていない安全域）**。次＝**TTS承認→再生成48本**。
- **TTS見積り（D1）**：計**48本**（発話18＋即時30）。各=gen_hs（本文1＋選択肢3＝TTS4コール・STT無し）。過去実測 発話475本=$2.84＝約¥0.9/本。**概算 ≈ $0.3＝約¥45（高めに見ても¥200未満）**。Gemini2.5Flash・[[tts-no-retry-single-call]]。
- **品質チェック済（2026-08-21・ユーザー要請）＝作問フロー2本(`md/聴解_作問フロー.md`§即時/§発話・`md/聴解_音声作成フロー.md`)に照合**：①発話18＝全問一意（状況に合う発話1つ・ダミーは授受向き/時制/語彙で言語的に外す＝公式流「手がかり消し」・同形ダミー活用）・係/留守0・漢数字・選択肢長さ差≤5・攻略耐性緑。②即時30＝正解本文/位置は不変・誘惑肢1つを自然延長しただけ＝一意性不変。③`tts_script.py`台帳更新済＋`tts_lint.py`＝**新規誤読なし**（`何と`警告は全600発話に出る既存の偽陽性＝`何（なん）と`表記は既存200問と同一・音声は正常）。
- **承認後の手順**：`gen_choukai_json.py --ids-file <両.ids.txt>` →（tts_lintは任意）→ `rebuild.ts`（_manifest+bundled再生成）→ `daimon_solvability --xlsx`（在庫Excel「聴解攻略耐性分析」再生成）→ **OTA配信 `publish-content.ps1`（ビルド不要）**。

## 前タスク（完了・参考）
- N3文章の文法50問化＋一意性修正4件＝コミット`dfb27481`・**OTA配信済**(Pages run 32476998760)・カバー率シート更新済(update_coverage_grammar.py新設)。ビルドは2832(N4新50+N3新20)。
