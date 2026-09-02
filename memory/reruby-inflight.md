# 再ルビ inflight（聴解・読解の無ルビ本文123件）

## ✅✅ 完了・OTA配信済み（2026-09-02）＝この件クローズ
- **配信済み**＝commit `c4dcdb1d`（content 8ファイル＋`_manifest.json`）→push→Pages OTA run 33569158301。content検証17/17緑。
- **掃除済み**（F3）＝`tools/reruby/` の rows.json/rows_index.json/wf_reruby_*.mjs/split_wf.py/results*.json/targets.txt/__pycache__ を削除。**再利用コア `reruby_prepare.py`・`reruby_apply.py` は温存**（joho再ルビを後で回す場合に流用可＝下記「joho」節参照）。
- 以降は履歴。joho(情報検索110件・意図的無ルビ)を後で対象化するなら §注意 の手順。

## ✅ 適用完了（2026-09-02）・残＝OTA配信（outward・承認待ち）→ 上で配信済み
- **2分割Workflow 両run完了・0エラー**（p1 run `wf_aae872d7-f13` 7体1014テキスト / p2 run `wf_ca4bb48b-f81` 5体711テキスト）。生成器＝`tools/reruby/split_wf.py`（720KB単体は512KB制限超のため分割）。
- **結果統合＆apply 完了**＝`tools/reruby/results.json`（1725件・missing0/extra0）→ `python tools/reruby/reruby_apply.py`＝**検算OK1725/失敗0/未着0**。対象123件の本文フィールド全て無ルビ0に。
- **書式チューニング済**＝applyがindent1/LFで全文再直列化し churn 発生（sokuji_N5は元minified→pretty化、他はCRLF→LF）。**各ファイルを元の書式（minified or CRLF/LF indent=1）へ再直列化**し、diff を実変更のみ（raw==real）に圧縮。8ファイル全て JSON parse OK・item数不変。
- **★残＝OTA配信（未実施・outward・ユーザーの「流していい」待ち）**＝`tools\publish-content.ps1`（`_manifest.json` 再生成→push＝OTA）。**usage_N3.json(消しゴム修正)＋再ルビ7ファイルをまとめて1回**で配信予定。★publish/push/buildはoutward＝勝手にやらない。
- **配信後の掃除（F3）**＝`tools/reruby/` の rows.json/rows_index.json/wf_reruby_p{1,2}.mjs/wf_reruby_furi.mjs(未使用巨大単体)/split_wf.py/results*.json/targets.txt/__pycache__ を用済み後に駆除。

---
状態＝**準備完了・実行待ち**（2026-09-02）。ユーザー指示「MAXプランだから費用はかからないはず。次のクリア後に実行したい。準備して」。

## 何をするか
聴解・読解で「本文が丸ごと無ルビ」の設問 **123件**（joho除く）に、ふりがな（ルビ）を付け直す。
- 方式＝既存の確立パイプラインと同型（[[sentence-furigana-needs-llm]]／`tools/gen_usage_furigana_wf.py`）＝**MeCab下書き→Opusが校正**。
- 実行はClaude Codeの**Workflowツール**（Opus×12体）＝**MAXプランのクォータ**で回る（API課金$は発生しない）。
- ルビ規則＝自級と同じ漢字/自級より上の漢字に付ける（実運用は既存の完全ルビ済itemに合わせ**全漢字にルビ**・CLAUDE.md §2）。

## 対象の内訳（123件・joho=情報検索110件は意図的無ルビで対象外＝ユーザー決定）
- dokkai/naiyou_chu_N3 53 / choubun_N3 19 / naiyou_chu_N4 15 / naiyou_tan_N3 7 / naiyou_tan_N4 1
- choukai/sokuji_N5 23 / point_N3 5
- ID一覧＝`tools/reruby/targets.txt`（123件）

## 実行手順（この順で）
1. **準備物は生成済み**（やり直す時のみ `python tools/reruby/reruby_prepare.py`）:
   - `tools/reruby/rows.json`（1725テキスト＝{id, loc, prompt=素の本文, draft=MeCab下書き}）
   - `tools/reruby/rows_index.json`（itemId→ファイル）
   - `tools/reruby/wf_reruby_furi.mjs`（**12バッチ**・各≦12000下書き文字のOpus校正ワークフロー）
2. **Workflow実行**＝`Workflow({ scriptPath: "tools/reruby/wf_reruby_furi.mjs" })`。
   - 完了通知が来たら結果（`return { items:[{id:"itemId||loc", furi}] }`）を1つのJSONに保存。
   - 例: `tools/reruby/results.json` に `{"items":[...]}` を書く。
3. **書き戻し**＝`python tools/reruby/reruby_apply.py tools/reruby/results.json`
   - 検算＝furiから漢字直後の（かな）を剥がした文字列が prompt と1字も違わない事。**NGは書き戻さない**（`apply_fails.txt`）。
   - 結果未着（`apply_missing.txt`）が有れば、その id だけ再Workflowで補完→再apply。
4. **配信**＝`tools\publish-content.ps1 -Message "feat(聴解/読解): 無ルビ本文123件に再ルビ"`（manifest再生成→OTA）。
   - ★publish/push/buildは**outward=別承認**（勝手にやらない）。content編集だけならOTA、UIビルド不要（[[content-ota-vs-ui-build]]／[[ota-manifest-regen-or-stale]]）。
5. **検証**＝`python scratchpad/scan.py`（無ければ再作成）or ruby再スキャンで無ルビ item が123→0近くに減った事を確認。

## 注意
- `loc` の意味＝`script/body/passage/text/stem`＝そのフィールド、`q{n}`＝questions[n].q、`qs{n}`＝stem、`c{q}_{i}`＝questions[q].choices[i]。
- prompt は既存ルビを剥がした素の本文（部分ルビ item も素に戻して再付与）。draft は改行保持済み（半角スペースを稀に落とすが hint なので無害・検算は prompt基準）。
- joho を後で対象化する場合＝`reruby_prepare.py` の `'/joho' in rel` 除外を外して再prepare。
- 未使用に終わったら `tools/reruby/` の rows.json/wf_*.mjs/results.json 等の作業物は用済み後に掃除（F3）。
