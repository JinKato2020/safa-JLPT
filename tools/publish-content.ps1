<#
  まいにちJLPT コンテンツ配信（ビルドなし・GitHubからOTAダウンロード方式）

    tools\publish-content.ps1 -Message "fix(読解): 選択肢の訳を修正"   # commit してPages配信
    tools\publish-content.ps1 -NoCommit                                  # commit済み・配信だけ
    tools\publish-content.ps1 -Message "..." -DryRun                     # 検証まで（push しない）

  使う場面: 問題の本文/設問/選択肢/解説やその翻訳＝content JSON を変えた時。
            端末は起動時に GitHub Pages の _manifest.json を見て差分DL→次回起動で反映（ビルド不要）。

  やること: manifest再生成 → content検証 → commit → push（Pages=OTA配信が自動起動）。ネイティブビルドは dispatch しない。
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
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Die 'gh にログインしていません。`gh auth login` を実行してください。' }
$dirty = git status --porcelain
if (-not $NoCommit -and $dirty -and -not $Message) {
  Die '未コミットの変更があります。-Message "..." を渡すか -NoCommit を付けてください。'
}
Write-Host "  branch=main / 未コミット $((($dirty | Measure-Object).Count)) 件"

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
elseif (-not (git status --porcelain)) { Write-Host '  変更なし。飛ばします' }
else {
  git add content/                                     # content配信は content/ だけをコミット(memory等の巻き込み防止)
  if (-not (git diff --cached --name-only)) { Die 'content/ にステージ対象がありません。content 以外の変更は build.ps1 か手動commitで。' }
  git commit -q -m "$Message`n`nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  if ($LASTEXITCODE -ne 0) { Die 'commit に失敗しました。' }
  Write-Host "  $(git log --oneline -1)"
}

Step 5 'push（Pages=OTA配信が自動起動）'
git push -q origin main
if ($LASTEXITCODE -ne 0) { Die 'push に失敗しました。' }
$pagesRun = gh run list --workflow=build-jlpt.yml --event push --limit 1 --json databaseId -q '.[0].databaseId' 2>$null
Write-Host "  origin/main へ push 済み。Pages配信 run: https://github.com/JinKato2020/safa-JLPT/actions/runs/$pagesRun" -ForegroundColor Green
Write-Host "  端末は次回起動時に GitHub から差分DL→そのまた次の起動で反映（ビルド不要）。" -ForegroundColor Green
