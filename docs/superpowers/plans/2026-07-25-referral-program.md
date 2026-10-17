# 紹介制度（リファラル）実装プラン — 2026-07-25

友だち紹介で「拡散した人」「新しく続けた人」の両方に **Pro 1週間** を配る。初速（登録の壁を作らない）と、確実さ（本当に続けた人だけ・不正を弾く）を両立する。

## 0. 確定事項（ユーザー決定済み）

- **報酬**: 新規が「継続トリガー」を引いた瞬間に、**拡散側＋1週間Pro／新規側＋1週間Pro**。
- **新規側の体験**: インストール直後から **1週間の無料お試しPro** がデフォルトで付く。トリガー報酬はその上に **2週目を上乗せ**（＝お試し→継続で切れ目なくPro）。
- **継続トリガー条件（確定）**: 利用開始から **14日以内** に、**別々の7日**、**各日1セット（約60問）以上**を学習。連続でなく**累計**。
- **本人特定の方針（確定）**: 使うのは登録不要（ローカルのまま）。**アカウント登録は報酬を受け取る導線でだけ**求める（ソフト誘導・現状の local-first 構成に一致）。

## 1. 前提・依存（重要）

- **Pro（サブスク／期限つき権利）はまだ未実装**（`src` に該当なし。points/wallet はあるが時間制のProではない）。
  - マネタイズは「アプリ完成が先」方針（`memory/priority-complete-app-before-monetize`）。したがって本プランは **Pro が載るタイミングで有効化** できる形にし、必要な最小土台（`entitlements.pro_until`）だけ先に定義する。
  - 紹介の付与＝**自前サーバー側フラグ（pro_until）**で行う。**App Store / Google Play の課金（サブスク）を経由しない**（審査事故を避ける）。
- クラウド同期＝Supabase 段階1実装済（`memory/jlpt-account-supabase`・東京）。テーブルは現状 `public.user_state` のみ（`docs/supabase/schema.sql`）。

## 2. 継続トリガーの実装フック（既存流用）

- 既存: `src/store/streak.ts` `applyStudyDay(streak, today)` が学習した日を `streak.history`（ISO日付配列・同日2回ノーカウント）へ蓄積。
- 追加: 「**各日1セット（約60問）以上**」を満たした日だけ数える必要があるため、**セット完了イベント**（`src/components/SessionSummary.tsx` / `LearnTestSession.tsx` が出す完了）で `qualifyingStudyDays`（適格学習日の集合）を別に持つ。
  - 判定: `install_date` を基準に、`qualifyingStudyDays` のうち `install_date <= d <= install_date+14日` の **distinct 日数 >= 7** で **トリガー成立**。
  - 「1セット＝約60問」の定義は既存の練習セット（`memory/practice-session-question-counts`＝計60問）に合わせる。1問だけ等の水増しを弾く。
- トリガー成立は**サーバーで確定**（クライアントの自己申告のみで報酬を出さない）。同期時に日付スタンプをサーバー側でも記録し、クライアント申告と突き合わせる。

## 3. データモデル（Supabase・`docs/supabase/schema.sql` に追加）

3テーブル＋RLS（各行は本人のみ read。付与・成立判定は Edge Function / service_role で書く）。

- **referral_codes**（コードの持ち主）
  - `code text primary key`（短い一意コード・例 8文字）、`owner_user_id uuid`（発行者）、`created_at`。
  - 1ユーザー1コード（発行時に採番）。
- **referrals**（誰が誰を紹介したか＝付与の台帳）
  - `id uuid pk`、`code text`（使われた紹介コード）、`referrer_user_id uuid`、`new_user_ref text`（新規の匿名端末ID／後でアカウントに昇格）、`status text`（`pending`/`qualified`/`rewarded`/`rejected`）、`install_at`、`qualified_at`、`created_at`。
  - **一意制約**: `new_user_ref` は1回だけ（1新規＝1紹介）。
- **entitlements**（Pro権利・報酬付与先）
  - `user_id uuid pk`、`pro_until timestamptz`、`updated_at`。
  - 付与＝`pro_until = max(now, pro_until) + interval '7 days'`（重ねがけは延長）。

## 4. 付与ロジック（Edge Function）

`docs/supabase/functions/` に `referral-qualify`（新設）を追加。

1. 新規クライアントがトリガー成立を報告（`code`, `new_user_ref`, 適格学習日の証跡）。
2. サーバーで検証:
   - コードが存在し、**自己紹介でない**（`owner_user_id` ≠ 新規の同一端末/課金/IPヒューリスティック）。
   - `new_user_ref` が未使用（二重取り防止）。
   - サーバー側の学習日記録と突き合わせて 7日成立を確認。
3. 成立なら:
   - `referrals.status = qualified`。
   - **拡散側**: `entitlements(referrer_user_id).pro_until += 7日` ＋ 通知「あなたの紹介で友だちが続けています！1週間Proプレゼント」。
   - **新規側**: `entitlements(new_user).pro_until += 7日`（＝お試し切れの後に2週目が続く）。
   - `status = rewarded`。
4. 冪等（同じ `new_user_ref` の再報告は無視）。

## 5. 導線（どこから・どう誘導するか）

「人に勧めたくなる瞬間」に出すのが鉄則。優先度順：

1. **達成の直後（最優先）**: セット完了画面 `src/components/SessionSummary.tsx` に「友だちを誘って一緒に合格しよう。2人とも1週間Pro」→ 共有シート。
2. **ホーム常設カード**: `src/screens/HomeScreen.tsx` / `src/home/StreakCard.tsx` の近くに「友だち紹介」カード（継続の文脈と相性が良い）。
3. **ペイウォール（Pro案内）**: Pro実装時、購入をためらう人に「友だちを誘えば1週間無料でPro」→ 離脱を紹介に変える。
4. **設定・プロフィール**: `src/screens/ProfileScreen.tsx` に自分のコード表示＋シェアボタン（いつでも呼べる）。

共有は共有シートで、文面＋リンクを用意して LINE / X / Instagram へ。

## 6. コードの受け渡し（新規の初回）

- **MVP（インフラ最小）**: 拡散リンク先ページ or 共有文にコードを表示 → 新規は初回起動時に**手入力**。
- **本番**: iOS Universal Links / Android App Links（＋遅延ディープリンク）でインストール後に**自動でコードが入る**。

## 7. 不正対策

- 自己紹介ブロック（同一端末／同一課金アカウント／IPヒューリスティック）。
- `new_user_ref` 一意＝1新規1報酬。トリガーはサーバー確定（クライアント自己申告のみで払わない）。
- 再インストールでお試しを繰り返す farming への保険＝**トリガー報酬（週2）を受け取る導線でアカウントを軽く要求**（ソフト誘導。悪用が出たら必須化）。
- 付与は「重ねがけ＝延長」で、無限増殖しない上限は §9 で決める。

## 8. App Store / Google Play 注意

- 「友だちを誘うと両者が機能を無料で使える」型は一般に可（Dropbox方式）。
- **現金配布・レビュー投稿を条件にするのは不可**。1週間Pro（アプリ機能）はOK。
- 付与は自前フラグ（§1）で、ストア課金を通さない。

## 9. 残パラメータ（実装前に決める・当面デフォルト）

- **拡散側の付与上限**: デフォルト＝**無制限で開始**（成長優先）。様子を見て月/累計の上限を後付け。
- **新規が報酬受取時にアカウント必須か**: デフォルト＝**必須にしない（ソフト誘導）**。悪用が出たら必須化。
- **コード配布方式**: MVP＝手入力 → 本番＝ディープリンク。

## 10. 実装フェーズ

- **フェーズ0（前提）**: `entitlements.pro_until` とクライアントの `isPro`（`pro_until > now`）を最小実装。お試し1週間＝インストール時に `pro_until = install+7日`。
- **フェーズ1（MVP）**: `referral_codes`/`referrals` テーブル＋コード発行・手入力・トリガー判定（既存 streak 流用）＋ `referral-qualify` Function ＋ 達成直後と設定の導線。
- **フェーズ2（本番）**: ディープリンクで自動アトリビューション、ペイウォール導線、通知、上限などの運用パラメータ。

## 参照（実ファイル）

- 継続: `src/store/streak.ts`（`applyStudyDay` / `streak.history`）、`src/home/StreakCard.tsx`
- セット完了: `src/components/SessionSummary.tsx` / `src/components/LearnTestSession.tsx`
- 導線候補: `src/screens/HomeScreen.tsx` / `src/screens/ProfileScreen.tsx`
- 認証: `src/auth/authClient.ts` / `src/auth/oauth.ts`
- Supabase: `docs/supabase/schema.sql`（現状 `user_state` のみ）/ `docs/supabase/functions/`
- 方針: `memory/jlpt-account-supabase` / `memory/priority-complete-app-before-monetize` / `memory/practice-session-question-counts`
