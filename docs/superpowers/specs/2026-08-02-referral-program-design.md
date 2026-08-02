# 紹介制度（リファラル）設計書 — 2026-08-02

友だち紹介で「紹介した人（拡散側）」と「新しく続けた人（新規側）」の両方に **Pro 1週間** を配る。
初速（登録の壁を作らない）と、確実さ（本当に続けた人だけ・自己紹介 farming を弾く）を両立する。

本書は 2026-07-25 の確定設計＋実装プランを土台に、未決だった 3 パラメータを確定して設計書にまとめ直したもの。
実装手順は同日付の実装プラン（`docs/superpowers/plans/2026-08-02-referral-program.md`）へ。

## 1. 目的と成功基準

- **目的**: 既存ユーザーの口コミで新規を増やし、かつ「入れて終わり」でなく**続く新規**を増やす。
- **成功基準**:
  - 紹介経由の新規が「継続トリガー」に到達する率が測れる（＝質の指標）。
  - 自己紹介・再インストール farming で不正付与が発生しない（サーバー確定＋1新規1報酬）。
  - Pro 未実装の今、**設計・最小土台だけ先に用意**し、Pro が載った瞬間に有効化できる。

## 2. 確定した設計判断

| 項目 | 決定 |
|---|---|
| 報酬 | 新規がトリガー成立した瞬間、**拡散側＋1週間Pro／新規側＋1週間Pro** |
| 新規の初期体験 | インストール直後から**お試しPro 1週間**。トリガー報酬は**2週目を上乗せ**（切れ目なく継続） |
| 継続トリガー | 利用開始から**14日以内**に、**別々の7日**、**各日1セット（約60問）以上**を学習（連続でなく累計） |
| 本人特定 | ふだんは登録不要（local-first）。**報酬受取の導線でだけ**アカウントを軽く要求（ソフト誘導） |
| **拡散側の付与上限** | **当面は無制限**（成長優先）。上限は運用パラメータとしてフックだけ用意し、悪用が出たら後付け |
| **受取時のアカウント必須化** | **必須にしない（ソフト誘導）**。farming が出たら必須化に切替できる設計 |
| **コード配布方式** | MVP＝**手入力** → 本番＝**ディープリンク**（自動アトリビューション） |
| 付与の実体 | 自前サーバーフラグ `entitlements.pro_until`。**ストア課金（サブスク）は通さない**（審査事故回避） |

## 3. ユーザー体験

**新規側**: インストール→即お試しPro（`pro_until = install + 7日`）。14日以内に7日分続けると2週目のProが自動で足される（＝お試しが切れず継続）。受取にアカウントは不要だが、「記録を守るために登録しませんか」とソフトに誘導。

**拡散側**: 自分の紹介コード／リンクを共有。紹介した新規が“続いた”瞬間に通知「あなたの紹介で友だちが続けています！1週間Proプレゼント」＋Pro延長。

**導線（勧めたくなる瞬間に出す・優先度順）**:
1. **達成直後（最優先）**: 学習後のまとめ画面（`AfterStudyReward` / セット完了）に「友だちを誘って一緒に合格しよう。2人とも1週間Pro」→ 共有シート。
2. **ホーム常設カード**: 継続の文脈（`HomeScreen` / `StreakCard` 付近）に「友だち紹介」カード。
3. **ペイウォール**（Pro実装後）: 購入をためらう人に「友だちを誘えば1週間無料Pro」→ 離脱を紹介に変える。
4. **設定・プロフィール**（`ProfileScreen`）: 自分のコード表示＋シェアボタン（常設）。

## 4. 継続トリガーの定義と判定

- **適格学習日（qualifying day）** = その日に**1セット（約60問）以上**を完了した日。1問だけ等の水増しを弾く。「1セット＝約60問」は既存の練習セット定義に合わせる。
- **成立条件** = `install_date` を基準に、`install_date ≤ d ≤ install_date+14日` の範囲で、適格学習日の **distinct 日数 ≥ 7**。
- **判定はサーバーで確定**（クライアントの自己申告のみでは払わない）。同期時にサーバー側でも日付を記録し、クライアント申告と突き合わせる。
- 既存フック流用: 連続日は `src/store/streak.ts` の `applyStudyDay` / `streak.history`（同日2回ノーカウント）。「各日1セット以上」はセット完了イベントで**別集計** `qualifyingStudyDays` として持つ。

## 5. データモデル（Supabase・`docs/supabase/schema.sql` に追加）

現状は `public.user_state` のみ。以下3テーブル＋`entitlements` を追加。各行は本人のみ read（RLS）。付与・成立判定は Edge Function / service_role でのみ書く。

- **referral_codes**: `code text pk`（短い一意コード・例8文字）／`owner_user_id uuid`／`created_at`。1ユーザー1コード（発行時採番）。
- **referrals**（付与台帳）: `id uuid pk`／`code text`／`referrer_user_id uuid`／`new_user_ref text`（新規の匿名端末ID・後でアカウントへ昇格）／`status text`（`pending`/`qualified`/`rewarded`/`rejected`）／`install_at`／`qualified_at`／`created_at`。**一意制約**: `new_user_ref` は1回だけ（1新規＝1紹介）。
- **entitlements**（Pro権利）: `user_id uuid pk`／`pro_until timestamptz`／`updated_at`。付与＝`pro_until = max(now, pro_until) + interval '7 days'`（重ねがけ＝延長）。

## 6. 付与ロジック（Edge Function `referral-qualify`）

1. 新規クライアントがトリガー成立を報告（`code`, `new_user_ref`, 適格学習日の証跡）。
2. サーバー検証:
   - コードが存在し、**自己紹介でない**（`owner_user_id` ≠ 新規の同一端末/課金/IP ヒューリスティック）。
   - `new_user_ref` が未使用（二重取り防止）。
   - サーバー側の学習日記録と突き合わせ、**7日成立**を確認。
3. 成立なら:
   - `referrals.status = qualified`。
   - **拡散側**: `entitlements(referrer).pro_until += 7日` ＋ 通知。
   - **新規側**: `entitlements(new_user).pro_until += 7日`（お試し切れの後に2週目が続く）。
   - `status = rewarded`。
4. **冪等**（同じ `new_user_ref` の再報告は無視）。
5. **付与上限**: 当面は無制限。将来のために、拡散側の累計付与回数を数えるカラム/集計だけ用意しておき、しきい値は環境変数で後付け可能にする（今回は上限を課さない）。

## 7. 不正対策

- 自己紹介ブロック（同一端末／同一課金アカウント／IP ヒューリスティック）。
- `new_user_ref` 一意＝1新規1報酬。トリガーはサーバー確定（クライアント自己申告のみで払わない）。
- 再インストールでお試しを繰り返す farming への保険＝**受取導線でアカウントを軽く要求（ソフト誘導）**。悪用が顕在化したら**必須化**へ切替（設計上フラグ1つで変更可）。

## 8. ストア（App Store / Google Play）注意

- 「友だちを誘うと両者が機能を無料で使える」型は一般に可（Dropbox 方式）。
- **現金配布・レビュー投稿を条件にするのは不可**。1週間Pro（アプリ機能）はOK。
- 付与は自前フラグ（§2）で、ストア課金を通さない。

## 9. 依存・前提

- **Pro（時間制サブスク）は未実装**。本設計は Pro が載るタイミングで有効化できる形にし、最小土台 `entitlements.pro_until` ＋ クライアント `isPro`（`pro_until > now`）だけ先に定義する。
- マネタイズは「アプリ完成が先」方針（`memory/priority-complete-app-before-monetize`）。着手時期はその判断次第。
- クラウド同期＝Supabase 段階1実装済（`memory/jlpt-account-supabase`・東京）。

## 10. フェーズ（実装は別プラン）

- **フェーズ0（前提）**: `entitlements.pro_until` と `isPro`。お試し1週間＝インストール時に `pro_until = install+7日`。
- **フェーズ1（MVP）**: `referral_codes`/`referrals` ＋ コード発行・手入力・トリガー判定（streak 流用）＋ `referral-qualify` Function ＋ 達成直後と設定の導線。
- **フェーズ2（本番）**: ディープリンク自動アトリビューション、ペイウォール導線、通知、付与上限などの運用パラメータ。

## 11. 未決・将来（当面は触らない）

- 付与上限の具体値（当面無制限。運用で判断）。
- 受取時アカウント必須化（当面しない。farming が出たら）。
- ディープリンク基盤（Universal Links / App Links ＋ 遅延ディープリンク）は本番フェーズで。

## 参照

- 継続: `src/store/streak.ts`、`src/home/StreakCard.tsx`
- セット完了/学習後: `src/components/AfterStudyReward.tsx`、`src/components/LearnTestSession.tsx`
- 導線候補: `src/screens/HomeScreen.tsx`、`src/screens/ProfileScreen.tsx`
- 認証: `src/auth/`
- Supabase: `docs/supabase/schema.sql`（現状 `user_state` のみ）、`docs/supabase/functions/`
- 方針: `memory/jlpt-account-supabase` / `memory/priority-complete-app-before-monetize` / `memory/referral-program-design`
