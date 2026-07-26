# 課金Phase1 走行中メモ（inflight）

- 目的: iOS課金(RevenueCat)のサンドボックス購入テスト
- 走行中run: iOSビルド **2576** — https://github.com/JinKato2020/safa-JLPT/actions/runs/30208489401
  - platforms=ios / submit=true（TestFlight提出まで）
- 済: 公開キー貼付(appl_/goog_)・GATING_ENABLED=true・iOS商品(jlpt_pro_yearly/monthly)・Entitlement pro・Offering default(current)にAnnual/Monthly紐付け
- ビルド2576=成功/TestFlight提出済み。端末は2576確認済み。
- 詰まり: Paywallに商品が出ない=有料アプリ契約が未締結だった。対処中:
  - 法人情報更新✅ / 契約署名✅(=ユーザ情報を保留中) / 銀行口座(楽天)登録=処理中 / 納税フォーム(証明書・W-8BEN)提出✅
  - サンドボックステスター jw.psalms34.8+sbx@gmail.com 作成済み(日本)
- 待ち: 銀行処理完了→契約「有効(Active)」化(数時間〜1営業日)→Apple商品反映(さらに数時間)→Paywallに¥3000/¥400
- 次の一手:
  1. https://appstoreconnect.apple.com/business の「有料アプリ契約」が有効化したら、Paywallで価格が出るか
  2. 出たらサンドボックス購入→無制限化→「購入を復元」確認
  3. OKなら Android(Google Play)商品作成→RevenueCat Google Play側にProduct追加→both運用へ
- 保留(テストに影響なし): W-8BENの租税条約9/10(0%)は後日新フォームで出し直し可 / DSA(EUトレーダー)後回し
- 未了: Android課金(Google Play商品未作成)・Phase2広告(AdMob未着手)
