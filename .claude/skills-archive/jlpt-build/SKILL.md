---
name: jlpt-build
description: 「ビルドして」＝まいにちJLPT を iOS TestFlight / Android へビルド提出する手順(build-jlpt workflow・Build番号=2000+commits・content manifest再生成・公開リリースは既定オフ)。content/**.json を編集してアプリへ反映する時にも使う。
---

# まいにちJLPT ビルド手順

## Overview
「ビルドして」を1手順で完遂する。**git root = `app/`**（親フォルダ`JLPTアプリ`はgitではない）。ビルド基盤 = GitHub Actions **`build-jlpt.yml`**（Pages配信＋iOS/Android を1ワークフローに統合）。

## 既定（厳守・逸脱しない）
- **「ビルドして」= iOS+Android 同時ビルド → TestFlight 提出まで**（`submit`既定true）。
- **公開リリース（App Store / Play production）は、ユーザーの明示指示なしに絶対に実行しない。**
- **Android の Play 公開（`publish`）は既定OFF＝合図時のみ。** ONにするとApp C(com.safe.english＝別アプリ)の配信面に触れる（[[android-appc-closedtest]]）。
- **Build番号 = `2000 + commit数`**（iOS/Android 同一値）。dispatchで渡す番号がrunnerの`2000+commit数`とズレると各ジョブが黙って落ちる。→ **必ずpush後の実測commit数で確定する**。

## 手順（この順・app/ で実行）
> **通常は `tools\build.ps1 -Message "..."` を実行すれば下の1〜8が全部走る**（`-NoCommit`＝コミット済み時 / `-DryRun`＝検証だけ / `-Platforms ios|android`）。テストが赤ならcommit前に止まる。`publish`の口は意図的に無い。
> 下の手順本体は残す＝スクリプトが壊れた時と、特殊なビルド（publish等）を手で打つ時に使う。

1. **コンテンツ(`content/**.json`)を1つでも編集したら、必ず再生成**：
   `node --import tsx tools/content/rebuild.ts`
   → `content/_manifest.json`(各ファイルのsha256/bytes/count) と `src/data/content/bundled.generated.ts` を再生成。**忘れるとOTAのsha256照合が壊れる**（Pages配信はcontentを丸ごとcpするだけで再生成しない）。
2. **検証**：`node --import tsx --test <関連テスト>`（最低 `src/data/contextGate.test.ts src/data/daimon4choices.test.ts src/data/content/rehydrate.test.ts src/data/content/otaDiff.test.ts tools/content/manifest.test.ts tools/content/validate.test.ts`）＋ `npx tsc --noEmit`。全green を確認（[[verify-runtime-not-just-build]]：ビルド緑≠実行時安全）。
3. **コミット**（**mainブランチ**・app/内のみ。この repo は content を main へ直接コミットする運用＝別ブランチを切らない。`md/`等 app/外のドキュメントは repo 外なので含めない）。
   - `git add` 対象＝**編集したcontentファイル＋再生成物2つ**：例
     `git add content/problems/moji_goi/context_N5.json content/_manifest.json src/data/content/bundled.generated.ts <他の変更>`
   - メッセージ末尾に `Co-Authored-By: Claude ...`。
4. **push**：`git push origin main` → **deploy-pages が自動起動**（＝コンテンツOTA配信。既存ユーザーへ届く経路）。
5. **Build番号確定**：`N=$(git rev-list --count origin/main); BUILD=$((2000+N))`
6. **dispatch**：`gh workflow run build-jlpt.yml -f platforms=both -f build_number=$BUILD`
7. **run-id取得**（dispatchは番号を返さない。数秒待って取る）：
   `sleep 6; RUN=$(gh run list --workflow=build-jlpt.yml --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId')`
8. **監視して報告**：`gh run watch $RUN --exit-status`（背景可）。**成否をBuild番号付きで報告**（例:「v1.1.0(2520) 成功・TestFlight提出済」）。run-name先頭にも番号が出る（例 `2520 — まいにちJLPT both ビルド`）。job別の成否は `gh run view $RUN --json jobs` で確認（build-ios / build-android / deploy-pages）。

## 失敗したら
- **テスト/tsc が赤**：コミットせず先に直す（[[verify-runtime-not-just-build]]）。`checkManifest`赤＝rebuild.ts忘れ。
- **dispatch即落ち**：`build_number`が`2000+commit数`とズレている。push後の`git rev-list --count origin/main`で取り直す。
- **build-android 失敗**：まず `gh run view $RUN --log-failed`。定番の真因＝Lint OOM（[[android-build-oom-lint]]）。
- **build-ios 失敗**：証明書/プロビジョニング/ASC APIキーのSecrets、または expo-updates 設定漏れ（prebuild後の Expo.plist）を疑う。

## dispatch 入力（`gh workflow run build-jlpt.yml -f ...`）
| 入力 | 既定 | 意味 |
|---|---|---|
| `platforms` | `both` | both / ios / android。「ビルドして」= both |
| `build_number` | 空=job内計算 | **必ず`2000+commit数`を渡す**（run-name先頭に出す・ズレ検知のため） |
| `submit` | `true` | iOS: ビルド後 TestFlight 提出 |
| `aab` | false | Android: Play提出用AABも生成（約2倍遅い。実機テストだけならOFF） |
| `publish` | **false** | Android: Playへ自動アップロード。**⚠合図時のみ**（App Cの配信面に触れる） |
| `track` | internal | publish時のトラック。production=本番は合図後のみ |

## Common Mistakes（この順で疑う）
- **git rootを間違える**：`app/`が正。`JLPTアプリ`直下は「not a git repository」。
- **rebuild.ts忘れ**：content編集後に走らせないと`_manifest.json`のsha256が古く、OTAが壊れる。`checkManifest`テストで検出できる。
- **build_numberズレ**：push前の数や推測で渡すと落ちる。**push後の`git rev-list --count origin/main`**で。
- **publish=trueを勝手に付ける**：別アプリApp Cの配信を壊す。合図があるまで付けない。
- **公開リリースの自走**：TestFlight/内部テストまでが既定。App Store/Play productionは必ず確認。
- push自体はビルドを起動しない（**Pages配信のみ**）。native ビルドは**dispatchが必須**。

## 参考
- バージョン：`app/app.json` の `expo.version`（現1.1.0）。iOS `buildNumber`/Android `versionCode` はビルド番号系で管理（起点2000の理由=App C既存versionCode超えが必須）。
- ASC操作（メタデータ/スクショ/テキストpush）は別ワークフロー `asc-*.yml`。
- Secrets（iOS証明書/ASC APIキー/Androidキーストア/Playサービスアカウント）はrepoに設定済み。
- Androidの実配信＝[[android-appc-closedtest]]／コンテンツOTA設計＝[[content-file-org-pages-ota]]。
