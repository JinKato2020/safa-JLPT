# N5/N4/N3 漢字読み/表記 特殊語(助数詞・熟字訓)増作 in-flight（2026-08-24・正本）

## 目的
漢字読み/表記の真の母数(N5 148/N4 333/N3 1949)の未カバーは、ほぼ助数詞(〜円/〜時/〜枚…)と熟字訓・特殊読み(大人/明日/二十日/八百屋…)。JLPTで実際に出るのでユーザー指示「丁寧に作って」。四(し/よん)・何〜・御〜・〜君等の非一意/接辞はスキップ(理由記録)。

## 入力・出力
- 入力=`scratchpad/kanji_special/{b1,b2,b3}.json`（b1/b2=N5各30・b3=N4 20+N3 2=22）。各語=vocabId,word,reading,meaning,vocabLevel,testLevel,need_kr,need_hy,example。全82語。
- 出力=`scratchpad/kanji_special/out/{b1,b2,b3}.json`＝{kr:[...],hy:[...],skipped:[{vocabId,reason}]}。

## ✅ 完了（2026-08-24）助数詞・熟字訓を丁寧に増作
- Opus3体→機械検証(欠陥0/取り違え0)→**漢字読み+73・表記+72**採用。skip9=読み非一意(四/何〜/〜月/〜様/御〜/〜君/〜町/〜観/〜敗)。
- content append：kanji_read_N5 463→521(+58)/N4 522→537(+15)・orthography_N5 527→585(+58)/N4 524→538(+14)。i18n:{}。rebuild済・番人22/22緑。
- **真のカバー率 漢字読み/表記＝N5 99%(146/148)・N4 99%(331/333)・N3 100%(1944/1949)**。Excel I/J・全ID列更新。残りは全て上記skip9(読み非一意)＝実質満点。
- 在庫外(辞書/特殊語作問)。**未コミット・未ビルド**。scratchpad掃除済。

## 完了後の集約（本体）
1. out読込→検証（kr=誤読3・answer∉choices・underline∈sentence／hy=似漢字3・answer∉choices）。
2. content append：vocabLevelのファイルへ。ID kr=各級の現max+1・hy同様。i18n:{}。max=kanji_read_N5 K0463/orthography_N5 H0527/N4 kr K0522 hy H0524/N3 kr K1882 hy H1882（append前に再確認）。
3. rebuild.ts→番人（content整合＋vocabKanjiClass.test）→カバー率再計算→Excel I/J更新。
4. skippedは残す（真の母数から外すか要ユーザー判断）。**未コミット・未ビルド**。

## 品質規律（特殊対応）
- 助数詞（〜X）：数字を付けた文脈で。**読みが変化しない素直な数**を選ぶ（二冊=にさつ/二階=にかい/三枚=さんまい/五分=ごふん）。underline=漢字部（冊/階/枚/月）・answer=その読み。促音/連濁で変わる数(一/六/八/十)は避ける。
- 熟字訓（大人/明日/二十日/八百屋/時計/上手/下手/果物/部屋）：語まるごと漢字→answer=丸ごと読み・誤答は紛らわしい別読み。
- 通常（川/足/持つ/掛ける/丸い/回る）：標準。
- N5=全文ひらがな＋対象のみ漢字(kr)/かな(hy)・文節に半角スペース。答え一意・第2正解禁止。作れない語(四=し/よん・何〜・御〜・〜君等)はskip+理由。
