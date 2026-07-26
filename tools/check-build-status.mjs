#!/usr/bin/env node
/**
 * ビルドステータスチェック
 * - GitHub Actions ワークフローの状態を監視
 * - ビルド完了時にレポートを表示
 * - エラー時に詳細をログ
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.resolve(PROJECT_ROOT, 'app');

const log = (msg, level = 'info') => {
  const prefix = {
    info: '🔍',
    success: '✅',
    warn: '⚠️ ',
    error: '❌',
  }[level];
  console.log(`${prefix} ${msg}`);
};

try {
  // アプリバージョンとビルド番号を取得
  const appJson = JSON.parse(fs.readFileSync(path.resolve(APP_DIR, 'app.json'), 'utf8'));
  const appVersion = appJson.expo?.version || 'unknown';
  const iosBuildNum = appJson.expo?.ios?.buildNumber || 'not set';
  const androidVersionCode = appJson.expo?.android?.versionCode || 'not set';

  // Git コミット情報を取得
  let commitSha = 'unknown';
  let commitMessage = 'unknown';
  let commitCount = 'unknown';

  try {
    commitSha = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT })
      .toString()
      .trim();
    commitMessage = execSync('git log -1 --pretty=%B', { cwd: PROJECT_ROOT })
      .toString()
      .trim();
    commitCount = execSync('git rev-list --count HEAD', { cwd: PROJECT_ROOT })
      .toString()
      .trim();
  } catch (e) {
    log(`Git info unavailable: ${e.message}`, 'warn');
  }

  // GitHub Actions ワークフロー実行情報を取得（GitHub CLI 利用時）
  let workflowStatus = 'not available';
  let workflowUrl = 'not available';

  try {
    // gh CLI が利用可能な場合
    const runs = execSync('gh run list --workflow build.yml --limit 1 --json status,url', {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    })
      .toString()
      .trim();

    if (runs) {
      const run = JSON.parse(runs)[0];
      workflowStatus = run.status || 'unknown';
      workflowUrl = run.url || 'not available';
    }
  } catch (e) {
    // GitHub CLI が使えない場合はスキップ
  }

  // レポート表示
  console.log('\n' + '='.repeat(60));
  console.log('BUILD STATUS REPORT');
  console.log('='.repeat(60));

  console.log('\n📦 Version Information:');
  console.log(`  App Version: ${appVersion}`);
  console.log(`  iOS Build Number: ${iosBuildNum}`);
  console.log(`  Android Version Code: ${androidVersionCode}`);

  console.log('\n🔗 Git Information:');
  console.log(`  Commit: ${commitSha}`);
  console.log(`  Commit Count: ${commitCount}`);
  console.log(`  Message: ${commitMessage.substring(0, 60)}${commitMessage.length > 60 ? '...' : ''}`);

  console.log('\n⚙️  Workflow Status:');
  console.log(`  Status: ${workflowStatus}`);
  if (workflowUrl !== 'not available') {
    console.log(`  URL: ${workflowUrl}`);
  }

  // ビルド前チェック
  console.log('\n✓ Pre-Build Checks:');

  const checks = {
    'app.json exists': fs.existsSync(path.resolve(APP_DIR, 'app.json')),
    'package.json exists': fs.existsSync(path.resolve(APP_DIR, 'package.json')),
    'node_modules installed': fs.existsSync(path.resolve(APP_DIR, 'node_modules')),
    '.github/workflows/build.yml exists': fs.existsSync(
      path.resolve(PROJECT_ROOT, '.github/workflows/build.yml')
    ),
  };

  for (const [check, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✅' : '❌'} ${check}`);
  }

  // 次のステップ
  console.log('\n📋 Next Steps:');
  const nextSteps = [
    'Ensure EAS_TOKEN is set in GitHub Secrets (Settings > Secrets and variables > Actions)',
    'Check eas.json configuration exists and is valid',
    'Verify iOS provisioning profile and Android keystore are configured in EAS',
    'Monitor workflow at: https://github.com/YOUR_REPO/actions',
  ];

  nextSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });

  console.log('\n' + '='.repeat(60) + '\n');

  process.exit(0);
} catch (e) {
  log(`Build status check failed: ${e.message}`, 'error');
  process.exit(1);
}
