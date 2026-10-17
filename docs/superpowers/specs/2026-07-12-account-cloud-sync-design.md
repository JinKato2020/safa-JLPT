# アカウント作成＋クラウド同期 設計（Supabase・段階分割）

**作成日**: 2026-07-12
**対象**: まいにちJLPT（`app/`）
**目的**: 設定タブからアカウント（メール＋パスワード）を作成でき、学習データ（到達度・my単語帳・連続・成長・模試履歴・書き取り進捗・設定）を**クラウドに安全にバックアップ／別端末で復元**できるようにする。案内役＝桜の巫女キャラで作成を誘導する。

---

## 0. 前提・確定事項（ユーザー承認済みの方向）

- **バックエンド＝Supabase**（無料枠 Free / 東京リージョン `ap-northeast-1`）。
  - Project URL: `https://nxovouiqelynryumjvyq.supabase.co`
  - anon/publishable キー（公開して安全・RLSでデータ保護）: `sb_publishable_bfqPNA4Z83i87E99YLwUyQ_I5NFMC3v`
  - Security 設定: Data API=ON / 新テーブル自動公開=OFF / 自動RLS=ON。
- **認証方式**: 段階1＝メール＋パスワード。段階2＝Google／Apple サインイン。匿名連携は将来検討（段階外）。
- **スコープ**: アカウント作成＋進捗のクラウド同期（バックアップ／復元）まで。
- **誘導UI**: 桜の巫女キャラ（既存 `app/assets/mywords/guide_open.png` 等の世界観を流用）でアカウント作成のメリット（データを安全に保存・機種変更でも引き継げる）を提示。
- **国際ボーダーレス**: 文言に個人名を使わない（役割ベース）。

---

## 1. スコープと段階分割

本設計は3段階。**本タスク＝段階1のみ実装**。段階2・3は別ジョブ。

### 段階1（本タスク）＝ メール認証＋バックアップ/復元
- Supabaseクライアント初期化（セッションをAsyncStorageに永続）。
- メール＋パスワードで **サインアップ／ログイン／ログアウト**。
- ログイン中、`AppState` 全体を **last-write-wins（LWW）で1行のJSONブロブとしてクラウドに保存／復元**。
  - ログイン直後: リモートとローカルの `updatedAt` を比較し、新しい方を採用（リモート採用時は `HYDRATE`）。
  - 以降: ローカル状態が変わるたび（デバウンス）クラウドへ push。
- 設定タブに**アカウントカード**（未ログイン＝作成/ログイン導線＋桜巫女、ログイン中＝メール表示・最終同期・ログアウト）。
- **アカウント削除**（App Store要件）: 自分のデータ行削除＋認証ユーザー削除。認証ユーザー削除は service_role が要るため **Supabase Edge Function `delete-account`** 経由。
- プライバシーポリシー本文に「アカウント作成時にメールアドレスと学習データをSupabaseのサーバー（東京）に保存する」旨を追記。

### 段階2 ＝ Google／Apple サインイン
- `signInWithIdToken`（ネイティブ）。Google=Cloud ConsoleクライアントID、Apple=Services ID／鍵。iOS はアカウント作成を提供する場合 **Appleサインイン必須**（App Store審査要件）。

### 段階3 ＝ 2端末マージ＋自動同期の高度化
- ブロブLWWから**フィールド単位のマージ**（`items` は per-item の `lastSeen` で新しい方、`myList` は和集合、`streak.history` は和集合 等）へ。
- リアルタイム購読・オフラインキュー・競合UI。

---

## 2. 全体アーキテクチャ

```
┌────────────────────────── アプリ（Expo/RN） ──────────────────────────┐
│  AppProvider (store.tsx)                                              │
│    reducer → AppState ──saveState()──▶ AsyncStorage (既存・不変)       │
│                    │                                                  │
│                    ├─ updatedAt を採番（下記 §4）                       │
│                    ▼                                                  │
│  SyncProvider (新規)  ── session(Supabase Auth) を購読                 │
│    - onLogin: pull → 比較 → 必要なら dispatch(HYDRATE)                 │
│    - onLocalChange(debounce): push(state)                            │
│                    │                                                  │
│  supabase client (config/supabase.ts, 新規) ── auth.storage=AsyncStorage │
└──────────────────────────────┬───────────────────────────────────────┘
                               ▼ HTTPS（anonキー＋ユーザーJWT）
┌──────────────────────── Supabase（東京） ───────────────────────────┐
│  auth.users（Supabase管理）                                          │
│  public.user_state  … user_id(PK,FK auth.users), state(jsonb),       │
│                       updated_at(timestamptz), client_updated_at(int8),│
│                       version(int)                                    │
│    RLS: user_id = auth.uid() のみ select/insert/update/delete        │
│  Edge Function: delete-account（service_roleで auth.admin.deleteUser）│
└──────────────────────────────────────────────────────────────────────┘
```

**設計原則**: 既存のローカル永続（AsyncStorage）は**唯一の即時真実として不変**。クラウド同期は「その上に載るバックアップ層」。オフラインでも従来どおり完全動作し、ログイン時のみクラウドに写す。

---

## 3. Supabase構成

### 3.1 テーブル `public.user_state`
| カラム | 型 | 説明 |
|---|---|---|
| `user_id` | `uuid` PK, `references auth.users(id) on delete cascade` | 所有者 |
| `state` | `jsonb not null` | `AppState` 全体のJSON |
| `client_updated_at` | `int8 not null` | クライアントの `updatedAt`（epoch ms）。LWW比較の基準 |
| `version` | `int not null default 1` | スキーマ版（`STATE_VERSION`）。将来のマイグレーション地点 |
| `updated_at` | `timestamptz not null default now()` | サーバ側更新時刻（監査用） |

### 3.2 RLS（4ポリシー）
`user_state` に対し、`auth.uid() = user_id` を条件に **select / insert / update / delete** を許可。他人の行は一切見えない・触れない。自動RLS=ONなので `alter table ... enable row level security` は自動。ポリシーはSQLで明示追加。

### 3.3 Auth設定（Supabaseダッシュボード）
- Email プロバイダ=ON。**「Confirm email」（確認メール必須）＝ON**（本人確認重視・ユーザー確定 2026-07-12）。
  - サインアップ後はすぐログイン状態にならない。確認メール内リンクを開いて本人確認 → その後アプリでメール＋パスワードでログイン。
  - `AccountScreen` はサインアップ成功時に「確認メールを送りました。メール内のリンクを開いてから、ログインしてください」を表示（ログインタブへ誘導）。
  - 確認リンクは Supabase ホストの確認ページで完結（アプリへのディープリンク復帰は段階1では不要）。Redirect URL は既定のまま。
- パスワード最小長=8。

### 3.4 Edge Function `delete-account`（段階1に含む）
- 認証済みリクエストを受け、`service_role` クライアントで `auth.admin.deleteUser(uid)` を実行（`user_state` 行は FK cascade で自動削除）。
- デプロイには Supabase CLI／アクセストークンが必要（ユーザー提供）。**デプロイ前でもアプリ側の「データ行削除＋ログアウト」までは動く**（認証ユーザーの完全削除だけ後追い可）。

### 3.5 適用方法
`docs/supabase/` に SQL（テーブル＋RLS）と Edge Function を置き、**手順書**を用意。ダッシュボードのSQL Editorに貼るだけで適用可能にする（CLI不要でテーブル・RLSは適用できる）。

---

## 4. `AppState` への最小追加：`updatedAt`

LWW比較の基準が現状の状態に無いため、**単調増加のタイムスタンプを1つ持たせる**。

- `AppState` に `updatedAt?: number`（epoch ms）を追加（旧stateには無い→ `0` 扱い）。
- 採番場所は **store.tsx の永続化 effect**：ローカル保存（`saveState`）の直前に `Date.now()` を刻む。reducer全アクションを触らずに済み、「状態が変わった＝保存が走る」タイミングと一致する。
  - 実装: `saveState` する直前に `state.updatedAt` を更新した派生値を作って保存し、次の描画にも反映させるため、専用アクション `TOUCH`（`updatedAt` セット）を1つ足すか、`saveState(withUpdatedAt(state))` で保存のみ更新（メモリ状態は次mutationで追随）。**採用＝保存専用スタンプ**（reducerに `HYDRATE` 以外の変更を加えない）。
- HYDRATE（リモート採用／ローカル復元）時は `updatedAt` をそのまま保持。

> これにより「どちらが新しいか」をブロブ全体で判定できる。段階3のフィールド単位マージでも土台として使える。

---

## 5. クライアント構成

### 5.1 依存追加
- `@supabase/supabase-js`（最新v2。新publishableキー対応）
- `react-native-url-polyfill`（RNで `URL` を補完。`index.ts` 先頭で `import 'react-native-url-polyfill/auto'`）
- セッション永続は既存の `@react-native-async-storage/async-storage` を流用。

### 5.2 `app/src/config/supabase.ts`（新規）
- URL＋anonキーで `createClient`。`auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }`。
- RN推奨: `AppState`(RN)の `active/background` で `supabase.auth.startAutoRefresh()/stopAutoRefresh()`。
- キーは公開安全だが、**設定を1モジュールに集約**（将来env化しやすく）。

### 5.3 `app/src/auth/`（新規モジュール群）
- `authClient.ts`: `signUp/signIn/signOut/getSession/onAuthStateChange/deleteAccount` の薄いラッパ（Supabase APIを直接UIから触らせない）。
- `sync.ts`: `pullState(userId)`／`pushState(userId, state)`／`chooseNewer(local, remote)`（**純関数・テスト対象**）。
- `SyncProvider.tsx`: セッション購読＋pull/pushの副作用を担うProvider。`store.tsx` の下にネスト。

### 5.4 同期ロジック（純関数で切り出しテスト）
- `chooseNewer(local: AppState, remote: AppState | null): { adopt: 'local'|'remote' }`
  - remoteが無い → local（初回はpush）。
  - `remote.updatedAt > local.updatedAt` → remote 採用。それ以外 → local。
- push はデバウンス（例 3秒）＋ログイン中のみ。失敗しても致命でない（次回で回復。ローカルは常に保持）。

---

## 6. UI

### 6.1 設定タブ アカウントカード（`ProfileScreen` 先頭に追加）
- **未ログイン**: 桜巫女の小アイコン＋見出し「アカウントを作成してデータを守る」＋サブ「機種変更しても学習の記録を引き継げます」＋ボタン「アカウントを作成／ログイン」→ `AccountScreen` へ。
- **ログイン中**: メールアドレス（一部マスク可）＋「最終同期: 〜」＋「ログアウト」＋「アカウントを削除」。

### 6.2 `AccountScreen`（新規・単一モーダル or スタック画面）
- 桜巫女ヒーロー＋一言（既存 `mywordsArt` の世界観・`BlinkingGuide` の瞬きは流用可、必須ではない）。
- タブ切替「新規作成／ログイン」。メール＋パスワード入力、送信ボタン、エラー表示（`authClient` のエラーを日本語化）。
- **新規作成成功時**（確認メールON）: セッションは張られない。「確認メールを送りました。リンクを開いてからログインしてください」を表示し、ログインタブへ促す。
- **ログイン成功時**: セッション確立→自動でpull/push→カードがログイン状態へ。
- **文言は i18n**（ja/en/ne を用意、他はjaフォールバック）。個人名を使わない。

### 6.3 ナビゲーション
- ルートスタックに `Account` を追加（既存のモーダル/スタック構成に合わせる。`MyWords` と同様の追加方式）。ナビ型に1画面追加のみ。

---

## 7. アカウント削除・プライバシー（App Store要件）

- **アプリ内から**「アカウントを削除」できる導線を段階1で用意（Apple審査必須）。
  - 押下→確認→`deleteAccount()`（Edge Function 呼び出し）→ローカルもサインアウト。
  - Edge Function 未デプロイ時のフォールバック: `user_state` 行を削除＋サインアウト（認証ユーザーの完全削除は後追い）。実装は関数呼び出しが失敗したら行削除にフォールバック。
- プライバシーポリシー（`profile.privacyBody` i18n）に保存先・保存内容・削除方法を明記。

---

## 8. i18n

`app/src/i18n/ja.json`（＋en/ne）に追加（jaフォールバックで他言語可）:
- `account.title` / `account.tab_signup` / `account.tab_login` / `account.email` / `account.password`
- `account.cta_create` / `account.cta_login` / `account.logout` / `account.delete` / `account.delete_confirm`
- `account.benefit_title` / `account.benefit_sub` / `account.synced_at`
- `account.err_invalid` / `account.err_taken` / `account.err_network` / `account.err_weak_pw`
- `account.confirm_sent`（確認メール送信の案内）/ `account.confirm_hint`
- `profile.account_section`（設定タブ見出し）

---

## 9. テスト（`node --import tsx --test`。新規は package.json の test に追加）

- `app/src/auth/sync.test.ts`:
  - `chooseNewer`: remoteなし→local／remote新→remote／local新→local／同値→local。
  - `updatedAt` を持たない旧state（undefined→0扱い）でも壊れない。
- 状態envelopeの `withUpdatedAt` 純関数（保存スタンプ）のテスト。
- ネットワーク・Supabase実呼び出しはユニットテスト対象外（純関数のみ検証。UI/実通信は手動＋実機）。
- 既存テストを壊さない（現状 all pass を維持）。`tsc` 緑。

---

## 10. セキュリティ注意

- 埋め込むのは **anon/publishable キーのみ**（公開安全）。**`service_role` は絶対にアプリへ入れない**（Edge Function内のサーバ環境変数のみ）。
- RLSが唯一のデータ境界。全操作で `auth.uid() = user_id` を必須にする（テーブル作成SQLに含める）。
- ログ・テレメトリにメールアドレスやトークンを出さない。

---

## 11. 本タスク（段階1）成果物一覧

**新規**
- `app/src/config/supabase.ts`
- `app/src/auth/authClient.ts` / `sync.ts` / `SyncProvider.tsx` / `sync.test.ts`
- `app/src/screens/AccountScreen.tsx`
- `docs/supabase/schema.sql`（テーブル＋RLS）/ `docs/supabase/delete-account/`（Edge Function）/ `docs/supabase/README.md`（適用手順）

**変更**
- `app/src/store/state.ts`（`AppState.updatedAt?` 追加＋`withUpdatedAt` 純関数）
- `app/src/store/store.tsx`（保存時スタンプ／`SyncProvider` 連携点）
- `app/index.ts`（`react-native-url-polyfill/auto` import）
- `app/App.tsx`（`SyncProvider` を `AppProvider` 配下に、`Account` ルート追加）
- `app/src/screens/ProfileScreen.tsx`（アカウントカード）
- `app/src/i18n/ja.json` / `en.json` / `ne.json`（`account.*` 追加＋privacy本文追記）
- `app/package.json`（依存＋test にファイル追加）

**段階1で「動くところ」**: メール作成/ログイン/ログアウト、クラウドへ状態push、別端末でpull復元、アカウント削除（Edge Function or 行削除フォールバック）。

---

## 12. リスク・留意

- **確認メールON**（確定）。本人確認は堅いが、サインアップ→確認→ログインの2ステップになる。`AccountScreen` の案内文でつまずかせないこと。Supabase無料枠の送信メールは自ドメイン未設定だと到達性・レート制限に難あり→本番前に SMTP（送信ドメイン）設定を検討。
- **LWWブロブ**は2端末を並行して使うと後勝ちで一方の更新が消え得る。段階1は「1端末＋機種変引き継ぎ」を主眼とし、並行編集の完全マージは段階3。UIで「最終同期」を見せて認識可能にする。
- Edge Functionデプロイにはユーザーの Supabase アクセストークン/CLI が必要。未提供でも段階1の他機能は動く。
</content>
</invoke>
