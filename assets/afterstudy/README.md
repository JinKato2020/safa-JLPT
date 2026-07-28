# 学習後画面の画像置き場（季節連動）

単語ドリル(単語タブ)を1回終えたときに、上部へ**大きく**出すイラストです。
**今の季節に合う絵**を優先表示します（春→`spring.png`／夏→`summer.png`／秋→`autumn.png`／冬→`winter.png`）。

## いま入っている画像
- `spring.png` `summer.png` `autumn.png` `winter.png`（桜＋柴犬の四季・各622×622）

## 増やす・差し替える
1. 画像をこのフォルダに入れる（PNG/JPG・横長〜正方形推奨）。
2. `src/data/afterStudyArt.ts` の `BY_SEASON` に require を足す:
   ```ts
   summer: [SUMMER, require('../../assets/afterstudy/summer2.png')], // 夏に2枚目→夏の中でランダム
   ```
   （追記は私（Claude）に頼んでもOK。「afterstudy に○○を入れた」と言ってください）

## メモ
- 同じ季節に複数入れると、その季節の中でランダムに変わります。
- 季節に画像が無ければ、全体からランダムにフォールバックします。
- 画像は**アプリ同梱**（バンドル）。増やしすぎると容量が増えるので、季節あたり数枚まで目安。
