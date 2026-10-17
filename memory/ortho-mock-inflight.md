# 表記模試(orthography mock) inflight ＝ /clear耐性の詳細

## 現在地（2026-08-30・未コミット・未push）
表記の模試専用プール(初見・pool='mock')を新設。**目標 N5:80 / N4:60 / N3:60**（公式8/6/6×10）。
LLM(Opus)生成・**反証/修正エージェントなし・機械検証のみ**。対象語はかな下線＋他の漢字にルビ。

### 完了（リポジトリに永続化済み）＝**問題は完成 N5:80/N4:60/N3:60 の200問**
- **模試ファイル書出し済** ＝ `content/problems/moji_goi/mock/orthography_{N5,N4,N3}.json`（pool='mock'・id=`N{lv}-V-HM-####`）。**N5:80 / N4:60 / N3:60 完成**。実機検証OK（mockUnitIds=80/60/60）。
- **ふりがな** ＝ `src/data/dict/sentenceFuri.json` に付与済（対象語以外の漢字にルビ・キー=HM id）。
- ★教訓：検証の重複チェックは`mock/orthography_*.json`を除外（自分の書出しと自己衝突する）。`validate_ortho_mock.py`修正済。
- **コード結線 完了（未コミット）**：
  - `src/data/content/rehydrate.ts`＝`ORTHOGRAPHY_MOCK = bankItems(...,'orthography',ogMap,true)` 追加＋return。
  - `src/data/index.ts`＝`export const ORTHOGRAPHY_MOCK`。
  - `src/data/daimon.ts`＝import追加／`HAS_MOCK_POOL`に'orthography'／`OG_MOCK_MULTI`／`mockUnitIds`をorthography対応に一般化／`questionForUnit`のorthography分岐で`useMock`時OG_MOCK_MULTI。
  - MockScreenは`mockUnitIds`汎用呼び出しゆえ**編集不要**。
- **rebuild済(73files)・tsc0・実機検証OK**（mockUnitIds=80/60/59・questionForUnit(useMock)で天気→2×2クロス確認）。

### 残タスク（この順で）
1. **番人テスト**：build.ps1のテスト集合（validate/manifest/daimon4choices/rehydrate等）を流す。tsc0確認済。
3. **Excel（模試ストック）更新**：`tools/stock_excel.py` の `MOCK` dict（現状 漢字読みのみ）に**表記 N5:80/N4:60/N3:60 を追加**→`python tools/stock_report.py; python tools/stock_excel.py`。大問別まとめの表記行「模試問題数」が—→80/60/60、full_mock再計算。※Excelを閉じてから。
4. **①大問別まとめ**（複製シート・別件で保留）：表記N5 誤答内訳 3:587→3:849 の同期が**まだ**（Excelが開いていて未保存）。閉じたら `openpyxl` で1セル更新。
5. **push**（git commit + `git push origin main`）＝OTAで模試content配信。**build.ps1は使わない**（ユーザー指示は"push"）。**注意＝daimon.ts等コード変更はOTAでは実機反映されず次ビルドで有効**（それまで旧アプリは表記模試を出さない＝害はない、初見混入もrehydrate側でpool='mock'分離済ゆえ安全）。

## 選定・生成の材料（再現用）
- 語選定＝`scratchpad/ortho_mock_select.py`→`ortho_mock_sel.json`（頻出50%＋優良50%・数字漢字/つ助数詞/～除外）。補充＝`topup_select.py`→`batch_topup.json`(28)、`batch_n3x.json`(5)。
- 生成入力＝`batch_{N5a,N5b,N4a,N4b,N3a,N3b,topup,n3x}.json`／出力＝`gen_同名.json`。検証＝`validate_ortho_mock.py`（範囲判定は`kanjiJlptLevel.json.items`のN5-N3・BEYOND=範囲外）。組立＝`assemble_ortho_mock.py`。
- 型分布：N5=クロス24/カタカナ16/カテゴリ30/1字10・N4=偏旁18/カタカナ6/同音21/意味15・N3=同音30/偏旁18/意味12（＋補充でカタカナ寄りに微増）。
