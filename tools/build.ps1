<#
  まいにちJLPT ビルド ワンコマンド

    tools\build.ps1 -Message "feat(xxx): ..."      # コミットしてビルド
    tools\build.ps1 -NoCommit                       # コミット済み・ビルドだけ
    tools\build.ps1 -Message "..." -DryRun          # 検証まで（push も dispatch もしない）
    tools\build.ps1 -Message "..." -Platforms ios   # 既定は both
    tools\build.ps1 -Message "..." -NoWatch         # dispatch まで（監視しない＝既定の運用方針）

  やること: manifest再生成 → テスト+tsc → commit → push → Build番号算出 → dispatch → 監視(-NoWatch で省略)
  Build番号 = 2000 + commit数（push後に数える。ズレると各ジョブが黙って落ちる）
  ※アプリの実体はリポジトリ直下（submodule 撤去・独立化で app/ は廃止）。$APP=リポジトリルート。

  意図的に用意していない口:
    publish / track ... Play本番やApp Store公開は誤爆すると別アプリApp Cの配信面に触れる。
                        必要な時だけ手で gh workflow run を打つこと。
#>
[CmdletBinding()]
param(
  [string]$Message,
  [switch]$NoCommit,
  [switch]$DryRun,
  [switch]$NoWatch,
  [ValidateSet('both', 'ios', 'android')]
  [string]$Platforms = 'both'
)

$ErrorActionPreference = 'Stop'
# アプリの実体はリポジトリ直下（app/ は独立化で廃止）。build.ps1 は tools/ 配下なので親＝リポジトリルート。
$APP = Split-Path $PSScriptRoot -Parent

function Step($n, $t) { Write-Host "`n[$n] $t" -ForegroundColor Cyan }
function Die($m) { Write-Host "`n中止: $m" -ForegroundColor Red; exit 1 }

# ---- 1. 前提チェック -------------------------------------------------------
Step 1 '前提チェック'
if (-not (Test-Path (Join-Path $APP 'app.json'))) { Die "リポジトリルートに app.json が見つかりません: $APP" }
Set-Location $APP

$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') { Die "ブランチが main ではありません（現在: $branch）。この repo は content を main へ直接コミットする運用です。" }

gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Die 'gh にログインしていません。`gh auth login` を実行してください。' }

$dirty = git status --porcelain
if (-not $NoCommit -and $dirty -and -not $Message) {
  Die '未コミットの変更があります。-Message "..." でコミット文を渡すか、-NoCommit を付けてください。'
}
Write-Host "  branch=main / 未コミット $((($dirty | Measure-Object).Count)) 件"

# ---- 2. manifest 再生成 ----------------------------------------------------
# content を触っていなくても常に走らせる。忘れると OTA の sha256 照合が壊れるため。
Step 2 'content manifest 再生成'
node --import tsx tools/content/rebuild.ts | Out-Null
if ($LASTEXITCODE -ne 0) { Die 'rebuild.ts が失敗しました。' }
Write-Host '  _manifest.json / bundled.generated.ts を再生成'

# ---- 3. 検証 ---------------------------------------------------------------
# passageTransNe.test.ts は除外。翻訳保留中で赤のまま＝想定内（CIにテスト段は無いのでビルドは通る）。
Step 3 'テスト + tsc'
$tests = @(
  'src/data/exam/passageGrammar.test.ts'
  'src/data/passageGrammarWire.test.ts'
  'src/data/contextGate.test.ts'
  'src/data/daimon4choices.test.ts'
  'src/data/content/rehydrate.test.ts'
  'src/data/content/otaDiff.test.ts'
  'tools/content/manifest.test.ts'
  'tools/content/validate.test.ts'
)
$log = Join-Path ([System.IO.Path]::GetTempPath()) 'jlpt-build-test.log'
node --import tsx --test @tests > $log 2>&1
$testExit = $LASTEXITCODE
$summary = Get-Content $log | Where-Object { $_ -match '^. (tests|pass|fail) ' }
$summary | ForEach-Object { Write-Host "  $_" }
if ($testExit -ne 0) {
  Write-Host "`n落ちたテスト:" -ForegroundColor Red
  Get-Content $log | Where-Object { $_ -match '^\s*✖' } | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" }
  Die "テストが赤です。直してから再実行してください（全文: $log）"
}

npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Die 'tsc に型エラーがあります。' }
Write-Host '  tsc エラー0'

if ($DryRun) {
  $n = git rev-list --count origin/main
  Write-Host "`nDryRun のためここで終了。push も dispatch もしていません。" -ForegroundColor Yellow
  Write-Host "  push すれば Build 番号は $(2000 + [int]$n + $(if ($dirty -and -not $NoCommit) { 1 } else { 0 })) になる見込みです。"
  exit 0
}

# ---- 4. コミット -----------------------------------------------------------
Step 4 'コミット'
if ($NoCommit) {
  Write-Host '  -NoCommit のため飛ばします'
}
elseif (-not (git status --porcelain)) {
  Write-Host '  変更なし。飛ばします'
}
else {
  git add -A
  $full = "$Message`n`nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  git commit -q -m $full
  if ($LASTEXITCODE -ne 0) { Die 'commit に失敗しました。' }
  Write-Host "  $(git log --oneline -1)"
}

# ---- 5. push（これで Pages＝OTA配信 が自動起動する）------------------------
Step 5 'push（OTA配信も起動）'
git push -q origin main
if ($LASTEXITCODE -ne 0) { Die 'push に失敗しました。' }
Write-Host '  origin/main へ push 済み'

# ---- 6. Build 番号（push 後に数える）--------------------------------------
Step 6 'Build 番号'
$commits = git rev-list --count origin/main
$build = 2000 + [int]$commits
Write-Host "  commits=$commits -> Build $build"

# ---- 7. dispatch -----------------------------------------------------------
Step 7 "ビルド起動（platforms=$Platforms）"
gh workflow run build-jlpt.yml -f platforms=$Platforms -f build_number=$build
if ($LASTEXITCODE -ne 0) { Die 'dispatch に失敗しました。' }
Start-Sleep -Seconds 8
$runId = gh run list --workflow=build-jlpt.yml --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId'
if (-not $runId) { Die 'run-id を取得できませんでした。gh run list で確認してください。' }
Write-Host "  run $runId — https://github.com/JinKato2020/safa-JLPT/actions/runs/$runId"

if ($NoWatch) {
  $ver = (Get-Content app.json -Raw | ConvertFrom-Json).expo.version
  Write-Host "`nv$ver($build) dispatch 済み。-NoWatch のため監視しません（運用方針）。" -ForegroundColor Green
  exit 0
}

# ---- 8. 監視して報告 -------------------------------------------------------
Step 8 '監視（10〜30分かかります）'
gh run watch $runId --exit-status *> $null
$watchExit = $LASTEXITCODE

$ver = (Get-Content app.json -Raw | ConvertFrom-Json).expo.version
$jobs = gh run view $runId --json jobs -q '.jobs[] | "\(.name): \(.conclusion)"'
$pages = gh run list --workflow=build-jlpt.yml --event push --limit 1 --json conclusion -q '.[0].conclusion'

Write-Host ''
if ($watchExit -eq 0) {
  Write-Host "v$ver($build) 成功" -ForegroundColor Green
}
else {
  Write-Host "v$ver($build) 失敗" -ForegroundColor Red
}
$jobs | ForEach-Object { Write-Host "  $_" }
Write-Host "  OTA配信(Pages): $pages"
if ($watchExit -ne 0) {
  Write-Host "`n原因: gh run view $runId --log-failed" -ForegroundColor Yellow
  exit 1
}
