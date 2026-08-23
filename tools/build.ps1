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
  [switch]$Force,
  [switch]$Approved,           # ★勝手にBuild厳禁ゲート。ユーザーが明示的に「ビルドして」と言った時だけ付ける。
  [switch]$Major,              # バージョンをメジャー更新（中央+1・末尾を1へ）。既定はマイナー更新（末尾+1）。
  [ValidateSet('both', 'ios', 'android')]
  [string]$Platforms = 'both'
)

$ErrorActionPreference = 'Stop'
# アプリの実体はリポジトリ直下（app/ は独立化で廃止）。build.ps1 は tools/ 配下なので親＝リポジトリルート。
$APP = Split-Path $PSScriptRoot -Parent
# 1日のTestFlightアップロード上限ガード用の台帳（public repo に入れない＝~/.claude 配下・全セッション共有）。
$DISPATCH_LEDGER = Join-Path $env:USERPROFILE '.claude\jlpt-build-dispatch.jsonl'
$IOS_DAILY_CAP = 8

function Step($n, $t) { Write-Host "`n[$n] $t" -ForegroundColor Cyan }
function Die($m) { Write-Host "`n中止: $m" -ForegroundColor Red; exit 1 }

# ---- 0. 勝手にBuild厳禁ゲート（ユーザー厳命 2026-08-20・永久ルール）--------
# ユーザーが明示的に「ビルドして」と言った時だけ Claude は -Approved を付ける。
# 付いていなければ push も dispatch もせずここで中止（＝AIが自己判断で本番ビルドを流す事故を構造で封じる）。
# DryRun は push/dispatch しない検証専用なので承認不要。
if (-not $DryRun -and -not $Approved -and $env:JLPT_BUILD_OK -ne '1') {
  Die @'
このビルドは承認されていません（勝手にBuild厳禁・ユーザー厳命の永久ルール）。
ユーザーが明示的に「ビルドして」と言った時だけ実行できます。
  検証だけ   : -DryRun（push も dispatch もしない）
  承認して実行: -Approved を付ける（例: tools\build.ps1 -NoWatch -Approved -Message "..."）
Claude はユーザーの明示指示なしに -Approved を付けないこと。
'@
}

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

# 1日のTestFlightアップロード上限ガード（Apple error 90382 の再発防止・2026-08-10 実害: iOS7回で当日提出不可に）。
# iOSを含む dispatch(both/ios)を1日 $IOS_DAILY_CAP 回まで。超える時は本当に必要なら -Force で明示的に上書き。
# ここ(コミット/push 前)で止めるので、当てても作業ツリーは汚れない。
if (-not $DryRun -and $Platforms -ne 'android') {
  $today = (Get-Date).ToString('yyyy-MM-dd')
  $iosToday = 0
  if (Test-Path $DISPATCH_LEDGER) {
    $iosToday = @(Get-Content $DISPATCH_LEDGER | Where-Object { $_ -match "`"date`":`"$today`"" -and $_ -match '"ios":true' }).Count
  }
  if ($iosToday -ge $IOS_DAILY_CAP) {
    if (-not $Force) {
      Die "今日すでに iOS を $iosToday 回ビルド済み。これ以上上げると Apple の1日アップロード上限(error 90382 = Upload limit reached)に当たり、当日は提出できなくなります。修正はためて明日まとめるのが安全です。どうしても必要なら -Force を付けて再実行してください。"
    }
    Write-Host "  ⚠ 今日 $($iosToday + 1) 回目の iOS ビルド。-Force 指定のため続行しますが 90382 の恐れあり。" -ForegroundColor Yellow
  }
  else {
    Write-Host "  1日ガード: iOS 本日 $iosToday/$IOS_DAILY_CAP 回"
  }
}

# ---- 1.5 バージョン自動更新（版番号スキーム・ユーザー厳命 2026-08-21）--------
# marketing version(app.json expo.version)を自動で上げる＝記憶頼みにしない。
# 既定＝マイナー更新（末尾+1・例 1.1.1→1.1.2）／ -Major＝メジャー更新（中央+1・末尾を1へ・例 1.1.x→1.2.1）。
# minor/major の判断（=-Major を付けるか）だけが人の仕事。Build番号(2000+commit)は別系統で自動。
# DryRun は commit しないので app.json を汚さないようスキップ。
if (-not $DryRun) {
  Step '1.5' 'バージョン自動更新'
  $appJson = Join-Path $APP 'app.json'
  $raw = Get-Content $appJson -Raw
  $rx = [regex]'("version":\s*")(\d+)\.(\d+)\.(\d+)(")'
  $m = $rx.Match($raw)
  if (-not $m.Success) { Die 'app.json の version(x.y.z) を認識できませんでした。' }
  $maj = [int]$m.Groups[2].Value; $min = [int]$m.Groups[3].Value; $pat = [int]$m.Groups[4].Value
  $old = "$maj.$min.$pat"
  if ($Major) { $min++; $pat = 1 } else { $pat++ }
  $newver = "$maj.$min.$pat"
  $raw = $rx.Replace($raw, "`${1}$newver`${5}", 1)
  Set-Content $appJson -Value $raw -NoNewline -Encoding utf8
  Write-Host "  version $old -> $newver （$(if ($Major) { 'メジャー' } else { 'マイナー' })更新）"
}

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
  'src/data/bunshouGrammarBalance.test.ts'
  'src/data/contextGate.test.ts'
  'src/data/daimon4choices.test.ts'
  'src/data/content/rehydrate.test.ts'
  'src/data/content/otaDiff.test.ts'
  'tools/content/manifest.test.ts'
  'tools/content/validate.test.ts'
  'src/store/kanjiCoverage.test.ts'
  'src/kanji/kanjiRecognition.test.ts'
  'src/data/skeletonBalance.test.ts'
  'src/data/johoSkeletonBalance.test.ts'
  'src/data/johoSolvability.test.ts'
  'src/data/johoAnswerSources.test.ts'
  'src/data/iikaePossible.test.ts'
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

# 1日ガード用の台帳へ記録（iOSを含む=both/ios を ios:true で残す。翌日リセットは日付で自然に）。
try {
  $iosFlag = if ($Platforms -eq 'android') { 'false' } else { 'true' }
  Add-Content -Path $DISPATCH_LEDGER -Encoding utf8 -Value "{`"date`":`"$((Get-Date).ToString('yyyy-MM-dd'))`",`"build`":$build,`"platforms`":`"$Platforms`",`"ios`":$iosFlag,`"run`":`"$runId`"}"
} catch { Write-Host "  (台帳記録は失敗しましたが続行) $($_.Exception.Message)" -ForegroundColor DarkYellow }

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
