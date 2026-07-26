# safa まいにちJLPT 匿名計測 Worker (Cloudflare)

到達度・区分別・新規枯渇・模試・行動イベントを匿名で受ける Cloudflare Worker + D1。
クライアント = `app/src/telemetry/telemetry.ts`(BASE = `https://t.safa-lang.com/jlpt/v1`)。

## 前提
- Cloudflare アカウント（safa-lang.com が既に Cloudflare ゾーン）。
- `npm i -g wrangler` ＋ `wrangler login`。

## デプロイ手順
```bash
cd cloudflare
# 1) D1 作成 → 出力された database_id を wrangler.toml に貼る
wrangler d1 create safa_jlpt_telemetry
# 2) スキーマ適用(本番)
wrangler d1 execute safa_jlpt_telemetry --remote --file=schema.sql
# 3) デプロイ
wrangler deploy
# 4) ルート(独自ドメイン t.safa-lang.com)
#    wrangler.toml の routes 行のコメントを外す or ダッシュボードで
#    Workers Routes に t.safa-lang.com/jlpt/* を割当 + DNS で t をプロキシ。
#    ※ workers.dev の既定URLで運用するなら telemetry.ts の BASE をそのURLに変更。
```

## 動作確認
```bash
curl -X POST https://t.safa-lang.com/jlpt/v1/snapshot \
  -H 'content-type: application/json' \
  -d '{"v":1,"anonId":"test-0001","app":"1.1.0","platform":"ios","level":"N4","day":"2026-06-24",
       "readiness":{"total":66,"moji_goi":78,"bunpou":72,"dokkai":69,"choukai":64},
       "learned":736,"streak":6,"remaining":{"moji_goi":120,"bunpou":15,"dokkai":2,"choukai":1},"exhausted":["dokkai","choukai"]}'
# => {"ok":true}
```

## 集計クエリ例（自分が見る）
```bash
# 区分別“枯渇”ユーザー割合(=どの区分の補充が急務か。コンテンツ十分性の実証)
wrangler d1 execute safa_jlpt_telemetry --remote --command \
 "SELECT level,
   ROUND(100.0*SUM(rem_dokkai<=3)/COUNT(*),1) AS dokkai_exhausted_pct,
   ROUND(100.0*SUM(rem_choukai<=3)/COUNT(*),1) AS choukai_exhausted_pct,
   COUNT(*) AS users
  FROM (SELECT * FROM snapshots GROUP BY anon_id HAVING MAX(day)) GROUP BY level"

# レベル別 平均到達度(最新スナップショット)
wrangler d1 execute safa_jlpt_telemetry --remote --command \
 "SELECT level, ROUND(AVG(r_total),1) avg_readiness, COUNT(*) n
  FROM (SELECT * FROM snapshots GROUP BY anon_id HAVING MAX(day)) GROUP BY level"

# 模試 合格圏到達/タイムオーバー率
wrangler d1 execute safa_jlpt_telemetry --remote --command \
 "SELECT level, COUNT(*) attempts, ROUND(AVG(pct),1) avg_pct, ROUND(100.0*SUM(timed_out)/COUNT(*),1) timeout_pct FROM mocks GROUP BY level"
```

## プライバシー
- 保存は匿名UUID＋集計値のみ。**IPは保存しない**（`req.cf.country` の粗い国コードのみ）。第三者提供なし。
- アプリ設定でオプトアウト可（送信停止）。ASCプライバシー表示=利用状況データ・非連結・追跡なし。
