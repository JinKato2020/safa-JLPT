---
name: question-illustration
description: JLPT問題用イラストの画像生成AIプロンプトを作る規約(英語を1次ソース→日本語併記・性別明示・赤ほっぺ禁止・シンプル)。「イラスト指示」「イラストプロンプト」「問題文イラスト」「発話表現の絵」「絵4択」等で使う。
---

# 問題文イラスト プロンプト規約（画像生成AI用）

JLPT問題のイラスト(聴解=発話表現の場面/課題理解・ポイント理解の絵4択、読解=情報検索の図表 等)を、画像生成AI(既定 **Imagen 4 Fast**)が**問題の意図を正確に理解して描ける**ように、プロンプトを設計するための規約。

## 0. 最重要原則
- **英語が1次ソース**。画像生成AIは**英語プロンプトを読む**。だから**先に「プロンプトとして有利な英語」を作り**、**そのあと日本語に訳す**。Excel等には**英語(1次)＋日本語(訳)の両方**を保存する。
- 目的は「絵の上手さ」ではなく、**問題の“決め手”が一目で伝わること**。設問の正誤が依存する視覚要素(例: 空席・杖・割れたペン・開いたかばん・足りない資料 等)を必ず描かせる。

## 1. 守るルール(全イラスト共通)
1. **意図の正確な描画**: 設問の核になる「決め手要素」を英語プロンプトに明示する。見た人が「どういう状況か」を推測できる絵にする。
2. **最低限・シンプル**: 問題の意図が分かる**最小限の情報量**にする。必要な人物・物＋シンプルな背景だけ。**複雑・密度の濃い・ごちゃごちゃした絵は作らない**。
3. **画風**: `flat vector illustration, Japanese language textbook style, clean thin even black outlines, soft flat colors, plain white background`。
4. **禁止(必ず否定で明記)**: `no text, no letters, no numbers, no speech bubbles` ／ **`no blush, no red cheeks, no rosy cheeks`(赤ほっぺ禁止)**。
5. **対話・発話は性別を明示**: 聴解はイラストと音声(TTSの声)を一致させる必要があるので、**登場人物の性別を英語プロンプトで明示**する(例: a young man / an elderly woman)。話者→相手の性別はExcel F列(話者列)と一致させる。
6. **人数を固定**: `exactly two people` のように人数を指定(余計な通行人等を出さない)。
7. **矢印は不要**(雰囲気・構図で誰が話すか分かるようにする)。吹き出しも描かない(性別/状況は絵で表現)。
8. **表情・姿勢で意図を出す**: 答えの台詞・状況から、その人物の心情(申し訳なさそう/うれしそう/心配して 等)を表情・ポーズで表す(ただし文字は書かない)。

## 1.5 【最重要原則】「瞬間・寸前・未完の動作・因果」は“静止した物理配置”に翻訳する
画像生成AIは**静止した物体・位置・開閉状態は得意**だが、**過程・因果・「〜しそう/〜の寸前/これから起きる」は苦手**で、放っておくと**終了状態(=起きた後)か無難な状態に倒れる**。例: 「財布が落ちそう」→ AIは「財布が地面に落ちた／鞄は閉じている」を描いてしまう。

対策(プロンプトの書き方):
- **動詞(falling / about to / trying to)で書かない。観察できる静止配置で書く**: 位置・向き・開閉・接触・距離。
  - 例(落ちそう): ❌ `a wallet falling toward the ground` → ✅ `the shoulder bag is WIDE OPEN at the top; a wallet is half-out, tilting at the open mouth of the bag, still touching the bag; the wallet has NOT fallen; the ground below is clear and empty (no wallet on the ground)`
- **決め手の状態を二値・位置で固定**する: open/closed, half-out, tilting, at the edge, touching, in front of / behind, on the ground vs in the bag, before vs after。
- **誤解されやすい“完了状態”を否定で排除**する: `has NOT fallen yet`, `nothing on the ground`, `do not draw <the finished result>`。
- **因果は「原因＝見える形」で描かせる**: 「鞄が開いている“から”落ちそう」なら、まず「鞄が大きく開いている」を確実に描かせる(原因の物理状態を明示)。
- 生成後チェックに「**決め手の“瞬間”が保たれているか(終了状態になっていないか)**」を必ず入れ、ズレたら配置記述を強めて再生成。
- **エスカレーション(重要)**: text-to-image(Imagen)は否定・微細配置・吹き出し除去を**1〜2回で守れないことが多い**。粘らず**編集モデル `gemini-2.5-flash-image`(Nano Banana)で局所修正**する。元画像＋「吹き出しを消す/この鞄を開いて財布を半分出す/地面を空にする」等の**ピンポイント編集指示**は、テキスト生成のやり直しより確実。それでも微細描写が出ないなら Imagen 4 Ultra も検討。

## 1.6 イラストが担う情報量 ＝「音声ナレーションがあるか」で変える
- **発話表現・課題理解・ポイント理解**は、音声(ナレーション/会話)が状況の精密な意味を語る。→ **イラストは“要点(誰が・誰に・何をしている)”が伝われば十分**。微細な決め手(財布が半分出ている等)は音声が補うので、絵で完璧に出せなくても可。
- **絵4択(課題理解/ポイント理解の選択肢)**は、**絵そのものが答え**。→ 各選択肢を**曖昧さなく精密に描き分ける**(ここは妥協しない。必要なら編集モデルで仕上げる)。

応用例(他問にも効く):
- 「電車が来る寸前」→ `a train is arriving, its front just entering the platform from the left edge, doors still closed` (来た後/停車後にしない)。
- 「コップが倒れそう」→ `a cup tilted at the very edge of the table, still upright but leaning, not yet spilled; the table surface is dry`。
- 「ドアを開けようとしている」→ `a hand on the door handle, door still closed`。

## 1.7 描けない時は“設問側”を描ける状態に作り替える(問題×イラストの共同設計)
イラストが必須の問題で、決め手が描きにくい(寸前/過程/否定)なら、**問題の状況・正解の発話を“描ける静止/完了状態”に作り替える**のが効率的(画像と粘るより安く速い)。
- 例: 「財布が落ち**そう**(寸前=描きにくい)」→「財布を落と**した**(完了=描きやすい: 地面に財布、後ろの人が指さして気づかせる)」。**正解の発話も**『あ、財布、落としましたよ』に変える。
- **条件**: 問題の自然さ・**テストする機能(ここでは“相手に気づかせる声かけ”)が保たれること**。完了状態でも同じ機能を試せるなら作り替えてよい(むしろ「落としましたよ」は発話表現として自然)。
- **作り替えない場合**: その“寸前/過程”自体が設問の核(例: 危険を未然に防ぐ判断・順序の途中を問う)なら、状況は変えず §1.5/エスカレーションで対処。
- **新規作成にも適用**: イラスト前提の問題(発話表現/絵4択)は、**最初から“描ける状況”で発想する**(完了状態・静的配置・はっきりした物/行動)。問題作成とイラスト設計は同時に考える。

## 2. 出力フォーマット(Excelのイラスト/備考 列)
1セルに**英語(1次)→日本語(訳)**の順で両方を入れる:
```
EN: <英語プロンプト(1次ソース=画像AIが読む)>
JA: <上の日本語訳(人間レビュー用)>
```
- ファイル名が決まっている場合は先頭に `イラスト: <ID>.png ｜` を付ける。

## 3. 英語プロンプトの骨子(この順で書くと通りやすい)
`[style] + [negatives] + [person count & genders] + [situation showing the decisive cue] + [simple background] + [expressions/poses]`

例(発話表現 N3-C-H-001 電車で席をゆずる・女→女):
> EN: Flat vector illustration, Japanese language textbook style, clean thin even black outlines, soft flat colors, plain white background. No text, no letters, no speech bubbles. No blush, no red cheeks. Minimal and simple, only what is needed. Exactly two people, both female. Inside a train, a young woman sitting on a seat gestures with one open hand toward the empty seat next to her, offering it kindly to an elderly woman who stands in front of her holding a walking cane. Simple train interior with a seat and a window. Calm, kind expression.
> JA: フラットなベクターイラスト、日本語教科書風、細く均一な黒い輪郭線、柔らかいフラット色、真っ白な背景。文字・吹き出しなし。赤ほっぺなし。必要最小限でシンプル。登場人物はちょうど2人、両方とも女性。電車内で、座席に座った若い女性が、目の前に立つ杖を持った高齢の女性に、片手を開いて隣の空席をすすめている。背景は電車内(座席と窓)だけ。穏やかで親切な表情。

## 4. 区分別メモ
- **発話表現(聴解 問題4)**: 1場面1枚。矢印で示さず、構図で「話す人」が中心と分かるように。性別必須。
- **課題理解/ポイント理解の絵4択(N5/N4)**: 1問につき**4枚**。各選択肢を**同じ画風・同じ人物**で、行動/物だけ変える(一貫性重視)。背景は共通でシンプルに。差分が一目で分かるように。
- **読解 情報検索の図表**: 案内/料金表/時間割等。**文字が要る図表は画像AIでなく作図(表組み)で作る**(画像AIは文字が崩れるため)。

## 5. 生成・運用
- 既定モデル=**Imagen 4 Fast**(API)。安価・線画フラットが教科書調に最適。指示順守を上げたい時は Imagen 4 Ultra / Gemini 2.5 Flash Image。
- 生成→**決め手・性別・人数・赤ほっぺ無し**をチェック→欠けたら作り直し。
- 保存: `問題/イラスト/<level>/<区分フォルダ>/<ID>.png`。比較・下絵は `問題/イラスト/モデル比較/`(後で掃除)。
- 費用は #8(使用後にモデル名＋実費を報告)。1枚数円。

## 6. 由来
2026-06-29 ユーザー指示で策定。要点: **英語1次→日本語訳**／意図を正確に／対話は性別明示／赤ほっぺ禁止／最低限シンプル(複雑な絵にしない)。
