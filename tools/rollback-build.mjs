#!/usr/bin/env node
/**
 * ビルド失敗時のロールバック
 * - app.json の変更を git から復元
 * - コミットをリセット（オプション）
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

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
  log('Rolling back app.json to last committed state...');

  // app.json の変更を戻す
  execSync('git checkout app/app.json', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  log('app.json rolled back', 'success');

  // ワークツリーがクリーンになったか確認
  const status = execSync('git status --porcelain', { cwd: PROJECT_ROOT }).toString().trim();
  if (!status) {
    log('Working tree is clean', 'success');
  } else {
    log('Warning: Working tree still has changes:', 'warn');
    console.log(status);
  }

} catch (e) {
  log(`Rollback failed: ${e.message}`, 'error');
  process.exit(1);
}
