# ビルド トラブルシューティング

## 概要

このドキュメントは、JLPT アプリの GitHub Actions 自動ビルドパイプラインが失敗した場合の対応方法を記載しています。

## 自動ビルドの仕組み

- **トリガー**: `main` ブランチへの push
- **実行場所**: GitHub Actions
- **ビルド番号**: コミット数 + 2000（例：コミット数 533 → Build v1.1.0(2533)）
- **対象プラットフォーム**: iOS（TestFlight）・Android（App Center）

## よくある失敗原因と対策

### 1. EAS_TOKEN が設定されていない

**症状**: ワークフローが "build skipped" で終了

**原因**: GitHub Secrets に `EAS_TOKEN` が設定されていない

**対策**:
```bash
# ローカルから EAS にログイン
eas login

# トークンを取得
eas secret create --scope project --name EAS_TOKEN --value $(eas tokens:get)

# GitHub のSettings → Secrets and variables → Actions → New repository secret
# Name: EAS_TOKEN
# Secret: <上記で取得したトークン>
```

### 2. app.json の整合性エラー

**症状**: "Validation failed: app.json is invalid JSON"

**原因**: 前回のビルドで app.json が破損した、またはコミット前に修正されていない

**対策**:
```bash
# ローカルで検証
npm run build:check

# ビルド前チェックを実行
node tools/validate-build.mjs

# 修正方法
git checkout app/app.json  # 最後のコミット版に戻す
git status                 # ワークツリーの確認
git add app/app.json
git commit -m "fix: restore app.json"
git push
```

### 3. TypeScript コンパイルエラー

**症状**: "TypeScript check failed" ステップで失敗

**対策**:
```bash
cd app
npm run tsc              # ローカルで型チェック
npm run tsc 2>&1 | head  # エラー箇所を確認
```

### 4. node_modules の不完全なインストール

**症状**: "Module not found" エラー

**対策**:
```bash
cd app
rm -rf node_modules package-lock.json
npm ci  # npm install ではなく npm ci（CI/CD用）
git add package-lock.json
git commit -m "chore: update dependencies"
git push
```

### 5. ビルド時間が超過（120分）

**症状**: "Job timeout"

**原因**: 
- Gradle の Lint が OOM（Out of Memory）
- 依存関係が多すぎる
- ネットワーク遅延

**対策**:
```bash
# ローカルでビルド時間を計測
time npm run build:data
time npm run tsc

# OOM の場合は jvmargs を増やす（app/build.gradle 等）
```

## ビルド失敗時の復旧手順

### 1. ステータス確認

```bash
npm run build:status
```

### 2. ログを確認

GitHub Actions: https://github.com/YOUR_REPO/actions

### 3. ローカルで検証

```bash
# ビルド前チェック
npm run build:check

# エラーがあれば修正
# 例：
npm run tsc
npm test
```

### 4. app.json をリセット

```bash
npm run build:rollback
```

### 5. 修正してプッシュ

```bash
git add app/app.json
git commit -m "fix: resolve build issues"
git push
```

### 6. ワークフローが再実行

- 自動で GitHub Actions が再起動
- `./github/workflows/build.yml` を確認

## ビルド成功時の確認

### iOS

- **確認先**: App Store Connect → TestFlight
- **ステータス**: 自動提出（auto-submit）が有効なら、レビュー待ちになっているはず
- **テスト方法**: iPad/iPhone の TestFlight アプリで確認

### Android

- **確認先**: Google Play Console → Closed Testing
- **ステータス**: 手動で App Center から Google Play へアップロードが必要
- **テスト方法**: テスター用デバイスで確認

## 手動ビルドの実行方法

GitHub Actions が使えない場合は、ローカルで手動ビルド：

```bash
cd app

# ビルド前チェック
npm run build:check

# 必要に応じて app.json をアップデート
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./app.json', 'utf8'));
pkg.expo.ios.buildNumber = '100';  # 任意の番号
pkg.expo.android.versionCode = 2100;
fs.writeFileSync('./app.json', JSON.stringify(pkg, null, 2));
"

# EAS でビルド
eas build --platform ios --profile production
eas build --platform android --profile production
```

## 設定ファイルの重要性

### eas.json

EAS CLI の設定ファイル。存在しない場合はビルド失敗。

```json
{
  "cli": {
    "version": ">= 8.0.0"
  },
  "build": {
    "production": {
      "autoIncrement": true
    }
  }
}
```

### app.json

Expo の基本設定。iOS buildNumber と Android versionCode は自動更新。

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.safa.jlpt",
      "buildNumber": "XXX"
    },
    "android": {
      "package": "com.safa.english",
      "versionCode": "2XXX"
    }
  }
}
```

## 緊急時の対応

### ビルド停止

```bash
# GitHub Actions の実行中ワークフローをキャンセル
# GitHub > Actions > 該当ワークフロー > Cancel
```

### リリース延期

```bash
# main ブランチへのプッシュを一時停止
git push --force-with-lease origin local-branch  # 別ブランチに退避
```

## 参考コマンド

```bash
# ビルド番号を確認
git rev-list --count HEAD
echo $(($(git rev-list --count HEAD) + 2000))

# app.json の buildNumber を確認
cat app/app.json | grep -A 5 '"ios"'

# EAS ビルド履歴を確認
eas build --status

# EAS にログイン
eas login

# プロジェクト情報を確認
eas project info
```

## サポート

問題が解決しない場合：

1. **EAS ドキュメント**: https://docs.expo.dev/eas/
2. **Expo クライアント**: https://github.com/expo/expo
3. **GitHub Actions**: https://github.com/actions

---

**最終更新**: 2026-07-21
