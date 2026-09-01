# 日本語学習者の町 機能追加（inflight・2026-09-01）

会話画面ではないので run なし。手動実装。ユーザー確定事項:
1. 会話画面の一番下に「相手の単語帳を見せてもらう」ボタン。友だち=本物(サーバー拡張)／仮想NPC=レベル相応の見本を自動生成。設定は既定ON＋OFFスイッチ(アカウント画面)。
2. 会話画面の一番下に「メッセージを送る」を全員に表示。知らない人(NPC)=既定文のみ(自由入力なし)＝ローカル演出で「送りました」。友だち=従来どおり自由文も可。
3. 町の登場: NPCは同じレベルのみランダム。友だちは例外で全レベル必ず登場。町ボタン(友だち一覧シート)に「友だちを表示/非表示」トグル。友だちは一覧タップで会話と同じステータス＋単語帳を見られる。
4. 友だちが上限(MAX_WALK=8)超過→シャッフルしてランダム登場。

## 実装チェックリスト
- [ ] src/store/state.ts: Settings に shareWords?(既定ON=!==false) と townShowFriends?(既定ON) 追加
- [ ] src/plaza/friendsClient.ts: FriendProfile に words?:SaveRef[] / share_words?:boolean。friendPublish に p_words(jsonb)/p_share_words 追加
- [ ] docs/supabase/friends.sql: 列 words jsonb / share_words bool 追加＋friend_publish/town_inviter/town_members 3関数を drop&再作成＋grant更新 ← **ユーザーが手実行**
- [ ] src/plaza/friendResidents.ts: friendToLearner に words/shareWords をマップ
- [ ] src/plaza/virtualLearners.ts: VirtualLearner に words?/shareWords? 追加
- [ ] src/screens/KotobaTownScreen.tsx:
      - NPCをユーザーlevelで絞る(shuffledPool)
      - 友だちshow/hideトグル(membersシート)＋residents除外
      - 友だち超過シャッフル(publish effect)
      - メッセージボタンを全員表示・NPCは既定文のみ(msgモーダルでTextInput/自由送信を友だち限定に)
      - 会話下部に単語帳ボタン＋単語帳ビューモーダル(friend=talk.words / NPC=生成見本)
      - NPC見本生成(level→VOCAB/KANJI/GRAMMAR から id ハッシュで決定的サンプル)
- [ ] src/screens/AccountScreen.tsx: プロフィールカードに shareWords トグル(Switch)＋Switch import
- [ ] i18n ja/en/ne: town.words_btn/words_title/words_empty/show_friends、account.k_share_words 等（parity.test必須）
- [ ] friendPublish 呼び出し(KotobaTown useEffect)に words=myList / shareWords 追加

## 状況（2026-09-01 実装完了）
全チェック済。tsc 0エラー / parity 4/4 / NPC見本 refs全解決(29-32件)・決定的。
**未完=サーバー**: docs/supabase/friends.sql をユーザーが Supabase SQL Editor で再実行する必要あり。
未実行のままアプリを更新すると friend_publish が新引数(p_words/p_share_words)を送り、旧関数に一致せず publish が失敗する(会話は動くが自分のプロフィール更新が止まる)。→ **SQL先行が必須**。

## ビルド（2026-09-01）
- **分離ビルド実施**：私の変更14ファイル＋app.json のみを commit `772c0cad`（v1.1.27→**1.1.28**）。聴解mockは巻き込まず未コミットのまま残置。
- push 済み → **Build 2890 / both / run 33445414906** dispatch 済み（監視せず＝運用方針）。1日iOS 1/8。
- **⚠ stash@{0}「choukai-mock-wip-hold」= 聴解作業の冗長バックアップ**。作業ツリーに聴解一式は完全復元済み（13 mock JSON・bundle import 全解決・tsc0 確認済）なので、次セッションで内容一致を確認のうえ `git stash drop stash@{0}` してよい（消しても作業ツリーが正）。

## 次の一手
1. **friends.sql を Supabase SQL Editor で再実行（先行必須）**。未実行だと friend_publish が失敗し自分のプロフィール公開が止まる。
2. TestFlight で Build 2890 の処理完了を確認 → 町の新機能を実機テスト。
3. 確認できたら stash@{0} を drop・この inflight を削除。
