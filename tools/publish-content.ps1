<#
  まいにちJLPT コンテンツ配信（Cloudflare R2 / OTA）

    tools\publish-content.ps1 -Message "fix(読解): 選択肢の訳を修正"   # commit・push後、教材配信を起動
    tools\publish-content.ps1 -NoCommit                                  # commit済み・配信だけ
    tools\publish-content.ps1 -Message "..." -DryRun                     # 検証まで（push しない）

  使う場面: 問題の本文/設問/選択肢/解説やその翻訳＝content JSON を変えた時。
            端末は起動時に R2 の _manifest.json を見て差分DL→次回起動で反映（ビルド不要）。

  やること: manifest再生成 → content検証 → commit → push → 教材配信ワークフローを起動。
  ※UI文字列(src/i18n)・画面・ロジックを変えた時は、これではなく tools\build.ps1（ビルド）を使うこと。
#>
[CmdletBinding()]
param(
  [string]$Message,
  [switch]$NoCommit,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$APP = Split-Path $PSScriptRoot -Parent
function Step($n, $t) { Write-Host "`n[$n] $t" -ForegroundColor Cyan }
function Die($m) { Write-Host "`n中止: $m" -ForegroundColor Red; exit 1 }

Step 1 '前提チェック'
if (-not (Test-Path (Join-Path $APP 'app.json'))) { Die "リポジトリルートに app.json が見つかりません: $APP" }
Set-Location $APP
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') { Die "ブランチが main ではありません（現在: $branch）。" }
if (-not $DryRun) {
  gh auth status *> $null
  if ($LASTEXITCODE -ne 0) { Die 'gh にログインしていません。`gh auth login` を実行してください。' }
  if (-not $NoCommit -and (git diff --cached --name-only)) { Die '先にステージ済みの変更を整理してください。' }
  if (-not $NoCommit -and (git status --porcelain -- content/) -and -not $Message) {
    Die '教材に未コミットの変更があります。-Message "..." を渡してください。'
  }
}

# manifest 再生成（忘れると OTA の sha256 照合が古いまま＝新しい問題/翻訳が端末に届かない）
Step 2 'content manifest 再生成'
node --import tsx tools/content/rebuild.ts | Out-Null
if ($LASTEXITCODE -ne 0) { Die 'rebuild.ts が失敗しました。' }
Write-Host '  _manifest.json / bundled.generated.ts を再生成'

# content 検証（manifest整合・スキーマ・rehydrate）
Step 3 'content 検証'
$tests = @(
  'tools/content/manifest.test.ts'
  'tools/content/validate.test.ts'
  'src/data/content/rehydrate.test.ts'
  'src/data/content/otaDiff.test.ts'
  'src/data/content/explainTransPolicy.test.ts'
  'src/data/exam/passageTransNe.test.ts'
)
$log = Join-Path ([System.IO.Path]::GetTempPath()) 'jlpt-publish-test.log'
node --import tsx --test @tests > $log 2>&1
$testExit = $LASTEXITCODE
Get-Content $log | Where-Object { $_ -match '^. (tests|pass|fail) ' } | ForEach-Object { Write-Host "  $_" }
if ($testExit -ne 0) {
  Get-Content $log | Where-Object { $_ -match '^\s*✖' } | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Die "content 検証が赤です（全文: $log）"
}

if ($DryRun) { Write-Host "`nDryRun のため終了。push していません。" -ForegroundColor Yellow; exit 0 }

Step 4 'コミット'
if ($NoCommit) { Write-Host '  -NoCommit のため飛ばします' }
elseif (-not (git status --porcelain -- content/)) { Write-Host '  教材の変更なし。飛ばします' }
else {
  if (-not $Message) { Die '再生成で教材に差分が出ました。-Message "..." を渡してください。' }
  git add -- content/
  if ($LASTEXITCODE -ne 0) { Die '教材のステージに失敗しました。' }
  git commit -q -m $Message
  if ($LASTEXITCODE -ne 0) { Die 'commit に失敗しました。' }
  Write-Host "  $(git log --oneline -1)"
}

Step 5 'push'
git push -q origin main
if ($LASTEXITCODE -ne 0) { Die 'push に失敗しました。' }
Step 6 'R2教材配信を起動'
gh workflow run deploy-content-jlpt.yml --ref main
if ($LASTEXITCODE -ne 0) { Die '教材配信の起動に失敗しました。' }
Write-Host '  ワークフローの成功後、端末が起動時に差分を取得し、次回起動時に反映します。' -ForegroundColor Green
