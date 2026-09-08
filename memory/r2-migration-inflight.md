# R2移設 inflight（username痕跡ゼロ・配信をjlpt.safa-lang.comへ統一）

決定日: 2026-09-08 / 目的: GitHub username(jinkato2020/JinKato2020)の露出を消す＋配信を1系統に統一

## 決定事項（ユーザー承認済）
- 独自ドメイン = **jlpt.safa-lang.com**（safa-lang.com のサブドメイン。既存の法務パス safa-lang.com/jlpt/ とは別ホストで衝突しない）
- 方式 = **丸ごとR2へ移設**（GitHub Pages/Release から R2 へ。username痕跡ゼロを狙う）。理由=システムを1系統に単純化。
- 法務ページ（safa-lang.com/jlpt/…）は別セッション管理＝**今回は触らない**。

## 移設対象（現状の配信元→R2へ）
- 音声 assets/audio 643M / 問題 content 93M（_manifest.json 要再生成）/ 辞書 dict 3M / 挿絵 assets/hatsuwa 672K / 招待 web/invite・紹介 web/r
- ポスター poster-<lang>.zip×11 ≈73M（今 GitHub Release packs-poster → R2へ）
- 合計 約810MB → R2無料枠10GB内（¥0見込み・実行前に現行pricing裏取り）

## 差し替えるコード（URL定数）
- src/data/audioBase.ts(AUDIO_BASE_URL) / src/data/dict/dictRemote.ts(DICT_BASE_URL) / src/data/content/ota.ts(BASE)
- src/data/listeningImage.ts(ILLUST_BASE_URL) / src/screens/ShareCardScreen.tsx(REF_BASE) / src/screens/KotobaTownScreen.tsx(招待url)
- src/data/posterAssets.ts(POSTER_CATALOG_URL) / tools/poster/build_packs.py(REL_BASE)
- App.tsx(deep-link prefixes) / web/invite・web/r の og:image / src/data/audioBase.test.ts
- 配信フロー: build-jlpt.yml の deploy-pages と tools/publish-content.ps1 を「R2 upload」に付け替え

## 進捗（2026-09-08）
- ✅ R2バケット `jlpt-assets`(APAC)作成＋独自ドメイン `jlpt.safa-lang.com` Active
- ✅ R2 APIトークン発行済（アクセスキー d2552de5…／※移設後に削除推奨）
- ✅ rclone(v1.75.1)を scratchpad に配置・config も scratchpad（repoに置かない）
- ✅ 本番アップロード完了: assets/audio・assets/hatsuwa・dict・content(目録再生成後)・invite・r = 7,201オブジェクト/720.5MiB。無料枠内=¥0
- ✅ 配信確認: mp3=audio/mpeg / json / html / png すべて200・正しいCT
- ✅ R2はindex自動配信しない→招待/紹介URLは `…/invite/index.html` `…/r/index.html` に変更済
- ✅ アプリURL定数7ファイル＋App.tsx prefix＋web/invite・web/r og:image 差し替え。tsc0・audio test pass
- rclone実体: scratchpad\rclone-v1.75.1-windows-amd64\rclone.exe ／ config: scratchpad\rclone.conf ／ remote名 `r2:jlpt-assets`

## 残（次の一手）
1. ✅【ポスター】完了: build_packs.py REL_BASE と posterAssets.ts POSTER_CATALOG_URL を jlpt.safa-lang.com/poster/ へ／_packs(11zip)をR2 poster/ へアップ／catalog URL書換(github0/R2 11)。catalog=200 json・ja.zip=200 zip一致。出荷コードの旧URL残り0・tsc0
2. ✅【配信フロー=CI自動配信を採用】build-jlpt.yml deploy-pages に「Sync _site to Cloudflare R2」ステップ追加済。git push で github.io と R2 の両方へ。サブツリー毎 sync（poster/ は触らない）＋ルートHTMLは copy。secrets 未設定なら黙ってスキップ（ジョブ落ちない）。
   - 【ユーザー要作業】GitHub リポジトリ JinKato2020/safa-JLPT に Actions secret 3つ登録:
     R2_ACCESS_KEY_ID = d2552de56015bac554fe5d42122d7f1c
     R2_SECRET_ACCESS_KEY = （発行済シークレット）
     R2_ENDPOINT = https://37405f28673fcc75c547e3e97d9bc7bb.r2.cloudflarestorage.com
   - ※このトークンは削除しない＝配信キーとして常用。漏れた時だけローテート。
3. ✅【ビルド dispatch 済 2026-09-08】v1.1.45(Build 2917)・both・commit 30fde1bc・run https://github.com/JinKato2020/safa-JLPT/actions/runs/34216325036 。secrets 3つ登録済でpush→deploy-pagesのR2同期ステップが**初回起動**（未検証＝次に確認するとよい。ただしデータは既にrcloneで投入済＝app動作はR2で担保される）。-NoWatch。本日iOS 1/8。
4. 【残】全ユーザーが新アプリ更新後に github.io / GitHub Release 退役 → username痕跡ゼロ完成。CI R2同期の初回成否を一度確認（run 34216325036 の "Sync _site to Cloudflare R2" ステップ）。secretsが正しければ緑。

## 現在の作業ツリー（未コミット）
- 変更: src/data/{audioBase,dict/dictRemote,content/ota,listeningImage,posterAssets}.ts, src/data/audioBase.test.ts, src/screens/{ShareCardScreen,KotobaTownScreen}.tsx, App.tsx, web/{invite,r}/index.html, tools/poster/build_packs.py, .github/workflows/build-jlpt.yml, content/_manifest.json（再生成）, tools/poster/_packs/poster-catalog.json（URL書換）
- 私からは commit/push/build しない（ユーザー合図制）。

## 注意
- confirm.html(Supabase Site URL登録済 = jinkato2020.github.io/safa-JLPT/confirm.html)を移すなら Supabase設定も要修正（外部・要ユーザー）。対象外にして現状維持も可。
- 古い github.io は当面残せば既存インストール済アプリ＆配布済リンクが生き続ける（切るのは全ユーザー更新後）。
