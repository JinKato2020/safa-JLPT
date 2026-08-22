# 段階B 漢字認識テスト新設 -inflight（/clear耐性）

## 目的・確定スコープ（ユーザー選択A・2026-08-22）
段階Bのうち **①認識テスト新設 ＋ ③カバー率をread/write/mean/listenへ拡張(作れない面除外) ＋ ④番人** を今回実装。
**②聞き取り→listen面接続＋訓読み優先/同音除外は次パス**（音声/repsに触るため分離）。設計正本＝`04_漢字ID紐づけと漢字マスタリー_設計書.pdf`、経緯＝メモリ[[kanji-mastery-stage-b-pending]]。

## 実装計画（このパス）
1. `src/kanji/kanjiRecognition.ts`（純関数ビルダー）＝字を単独提示→意味/読み4択。文脈文なし。answerId=`${char}#krecog_mean` / `#krecog_read`。
   - 意味Q＝meaningClear(kanjiFacets)な字だけ。誤答=同レベル他字の意味(重複除外)。
   - 読みQ＝訓優先(hasKun)→無ければ音。誤答に答えと同音(=同じ読み文字列)を入れない。
2. `src/screens/KanjiRecognitionScreen.tsx`（音声なし・ListeningQuizScreen流用の骨格＝テストのみ＋AfterStudyReward）。
3. `src/review/facetMap.ts` facetsForUnit に `krecog_mean→mean(w1)` / `krecog_read→read(w1)`。
4. `src/store/selectors.ts` coverageBars: `KANJI_FACETS=['read','write','mean','listen']`＋作れない面除外(mean は meaningClear のみ・他は常時可)。import kanjiFacets.json。
5. i18n ja/en/ne 同時（parity番人）＝KubunCardボタン＋認識画面文言。
6. `src/components/KubunCard.tsx` 漢字kubunに「漢字テスト(認識)」導線を追加。
7. ナビ登録＝`navigation/types.ts` に `KanjiRecognition`＋App.tsxにScreen。
8. 番人＝`src/store/kanjiCoverage.test.ts` 追記(mean/read認識で加点・校=mean除外)＋`src/kanji/kanjiRecognition.test.ts`(答=誤答外・on専用字は同音誤答なし)。build.ps1へ後者登録。

## 検証
tsc0 / kanjiCoverage・kanjiRecognition・parity 緑 / build用テスト緑。UI変更ゆえ反映に要ビルド（指示待ち）。

## 状態＝✅実装完了(未コミット・未ビルド・2026-08-22)
**新規**＝`src/kanji/kanjiRecognition.ts`(純関数ビルダー)／`src/screens/KanjiRecognitionScreen.tsx`(音声なしテスト画面)／`src/kanji/kanjiRecognition.test.ts`(番人・build.ps1登録済)。
**編集**＝`src/review/facetMap.ts`(krecog_mean→mean/krecog_read→read・weight1認識面)／`src/store/selectors.ts`(KANJI_FACETS=read/write/mean/listen＋mean は meaningClear のみ・kanjiFacets import)／`src/store/kanjiCoverage.test.ts`(mean/read加点・校=mean除外の3テスト追記)／`src/navigation/types.ts`＋`App.tsx`(KanjiRecognition画面登録)／`src/components/KubunCard.tsx`(漢字kubunに「漢字テスト」導線・最初から解禁0%・順=リスト→漢字テスト→聞取5%→書取10%)／i18n ja/en/ne(cards.kanji_recognition・krecog.prompt_mean/read/empty・surgical挿入で他行不変)。
**設計判断(実装時)**＝読みQは訓読み優先だが1モーラ訓stem(食=た/会=あ/人=り)は紛らわしいので音へ退避／読みの誤答は答えと同種(音/訓)で字種を揃え字種で割れない／誤答から「答えと同音」「その字の全読み」を除外(二重正解防止)。認識結果はcharのmean/read面へ計上(mastery keyはchar・state.itemsの`字#krecog_*`はSRS/touched集計のみで既存listening/flashcardと同型)。
**既存データへの影響なし**＝mean/listenは従来データ皆無ゆえ現ユーザーのカバー率は認識テスト実施まで不変(回帰なし)。
**検証**＝tsc0／kanjiRecognition・kanjiCoverage・parity・review系 計45テスト緑。
**残(次パス)**＝段階B②聞き取り→listen面接続(現状answerId=kanji.json id で facet空・charへ付け替え要)＋訓優先/同音除外を聞き取りにも適用。UI変更ゆえ端末反映に要ビルド(指示待ち)。
