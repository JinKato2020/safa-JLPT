# 変更分だけOTA配信する仕組み（実装リファレンス）

別セッション向け。「問題文・翻訳など content を変えたらビルド無しで端末に届く」仕組みの全体像と実ファイル。
一次情報はコード。この文書と食い違ったらコードが正。

## 0. 一行でいうと
**content/ の各ファイルの sha256 を manifest に書き出しておき、端末はリモート manifest と自分の sha を突き合わせて「sha が変わった/新規のファイルだけ」DLする。** 差分判定の本体は sha 比較の純関数1個（`diffManifest`）。

## 1. 配信境界（これがOTAかビルドかの分かれ目）
- **OTA（ビルド不要）**＝ `content/**/*.json`（問題の本文・設問・選択肢・解説・その母語訳）。
- **ビルド必要**＝ UI文字列 `src/i18n`・画面・ロジック。
- 詳細メモリ＝ `[[content-ota-vs-ui-build]]`。

## 2. ビルド／配信側（tools/content/, tools/publish-content.ps1）

### 正本
- `content/**/*.json` が唯一の正本（大問×レベル=1ファイル: `content/problems/<section>/<daimon>_<level>.json` 等）。

### 再生成ツール = `tools\content\rebuild.ts`
`content/` を歩いて **2つ**を生成する（手編集→これを実行→push が運用）:
1. **`content/_manifest.json`** … `tools\content\manifest.ts` の `buildManifest()` で、各ファイルに `{sha256, bytes, count}` を付与。ヘッダに `schema / contentVersion / languages / daimonLabels`。**これが差分配信の心臓**。
2. **`src\data\content\bundled.generated.ts`** … content の全JSONを static import する barrel（`BUNDLED` マップ）。**アプリ同梱の baseline**（＝オフラインでも動く土台）。手編集禁止（自動生成）。

### 公開 = `tools\publish-content.ps1`
手順: manifest再生成 → content検証テスト → **`content/` だけ**を commit（memory等の巻き込み防止）→ `main` へ push → GitHub Actions の Pages配信が自動起動。**ネイティブビルドは dispatch しない。**
- オプション: `-Message "..."`（commit+配信）／`-NoCommit`（配信だけ）／`-DryRun`（検証まで）。
- 配信先ホスト = `https://jlpt.safa-lang.com/content/`（下記 BASE と一致）。

### 落とし穴（重要）
content を編集したら **必ず rebuild で `_manifest.json` を作り直す**。忘れると sha が古いまま＝新しい問題/翻訳が端末に永久に届かない。番人・詳細＝ `[[ota-manifest-regen-or-stale]]`。

## 3. 端末（クライアント）側

### ファイル
- `src\data\content\ota.ts` … DL本体・キャッシュ・バンドルタグ管理。
- `src\data\content\otaDiff.ts` … 差分の純関数（RN非依存＝テスト可）。
- `src\data\content\rehydrate.ts` … content(新フォーマット)→旧shape(*BANK等)へ再構成。
- `src\data\content\source.ts` … 注入されたキャッシュの保持（`setContentFiles`/`getContentFiles`）。
- `src\BootGate.tsx` / `App.tsx` … 起動時の結線。

### 定数（ota.ts）
- `BASE = 'https://jlpt.safa-lang.com/content/'`
- キャッシュ = `FileSystem.cacheDirectory + 'content/'`。ローカル名は `encodeURIComponent(path)`。
- `_shas.json` … OTAでDL済みファイルの sha 台帳。
- `_bundle.tag` … 後述バンドルタグ。
- **SDK54の罠**: import は必ず `expo-file-system/legacy`（新API default importは無反応）。詳細 `[[expo-fs-legacy-sdk54]]`。

### 差分判定（心臓・1関数）
`diffManifest(remote, cachedShas)` = `remote.files` のうち `cachedShas[path] !== sha256` のパスだけ返す（変更＋新規）。

### 端末が持つ sha は3層
1. **bundled**（同梱 baseline）＝ `content/_manifest.json` を import。
2. **cachedShas**（`_shas.json`）＝ OTAでDL済み。
3. **effectiveShas** ＝ bundled に、バンドルタグ一致時のみ cachedShas を重ねたもの。これを「端末が既に持っている物」として diff の基準にする。→ **同梱済みファイルを更新扱いして無駄DLするのを防ぐ**。

### 流れ
- `syncContent()`（起動時・背景・無言。`App.tsx:340-345` の useEffect で呼ぶ。2026-09-17でサイレント化）:
  1. リモート `_manifest.json` を取得（タイムアウト8s）。
  2. `diffManifest(remote, effectiveShas)` で todo 算出。
  3. 変更ファイルを**逐次**DL（15s＋1回リトライ）→ `cacheDir` に保存 → sha を記録。**10件ごとに `_shas.json` 保存**（途中で切れても次回は残りだけ＝無限ループ防止）。
  4. オフライン/失敗は無害（0を返すだけ）。
- `loadCachedFiles()`（起動ゲート `BootGate.tsx` が `data/index` 読込より前に呼ぶ）: キャッシュ済みを path→parsed で読み、`setContentFiles` で注入。`data\index.ts` の import 時に `rehydrateBanks` が in-memory バンクへ合流。

### 適用タイミング＝「次回起動」
syncContent は**今回の起動で背景DL**するだけ。実際に画面へ出るのは **loadCachedFiles が読む次の起動**。→ 配信後、利用者には**2回目のアプリ起動**で反映。

### バンドルタグのガード（多端末・アプリ更新の事故防止）
`bundleTag()` = 同梱全ファイルの sha から算出するハッシュ。`_bundle.tag` に保存。
- アプリ（バイナリ）を更新すると同梱 content が変わる→タグ不一致→**古いOTAキャッシュを破棄して作り直す**。
- 目的: 新バイナリが積んだ新コンテンツを、古いOTAキャッシュが隠す事故を防ぐ（例: 文法の母語訳が英語のまま出る）。

## 4. 既知の陳腐化コメント（引っかからないため）
`BootGate.tsx:15` に「自動(裏)DLは廃止=設定の手動更新のみ」という**古いコメント**が残るが、実挙動は `App.tsx:340-345` の**起動時サイレント背景DL**が正（2026-09-17変更）。コードが正本。

## 5. 関連メモリ
`[[ota-manifest-regen-or-stale]]` / `[[content-ota-vs-ui-build]]` / `[[content-file-org-pages-ota]]` / `[[merge-pages-into-build-workflow]]` / `[[expo-fs-legacy-sdk54]]`
