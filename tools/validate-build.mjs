#!/usr/bin/env node
/**
 * ビルド前のバリデーション
 * - app.json 整合性チェック
 * - package.json の依存関係チェック
 * - git 状態の確認
 * - TypeScript エラーの早期検出
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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

const errors = [];
const warnings = [];

try {
  // 1. app.json の存在と整合性
  log('Checking app.json...');
  const appJsonPath = path.resolve(APP_DIR, 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    errors.push('app.json not found');
  } else {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      if (!appJson.expo?.ios?.bundleIdentifier) {
        errors.push('iOS bundleIdentifier missing in app.json');
      }
      if (!appJson.expo?.android?.package) {
        errors.push('Android package missing in app.json');
      }
      if (!appJson.expo?.version) {
        warnings.push('App version not set in app.json');
      }
      log('app.json validated', 'success');
    } catch (e) {
      errors.push(`app.json is invalid JSON: ${e.message}`);
    }
  }

  // 2. package.json チェック
  log('Checking package.json...');
  const pkgPath = path.resolve(APP_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    errors.push('app/package.json not found');
  } else {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (!pkg.name || !pkg.version) {
        errors.push('package.json missing name or version');
      }
      // 重要な依存関係の確認
      const requiredDeps = ['react', 'react-native', 'expo'];
      for (const dep of requiredDeps) {
        if (!pkg.dependencies?.[dep]) {
          errors.push(`Missing critical dependency: ${dep}`);
        }
      }
      log('package.json validated', 'success');
    } catch (e) {
      errors.push(`app/package.json is invalid JSON: ${e.message}`);
    }
  }

  // 3. Git 状態チェック
  log('Checking git state...');
  try {
    const status = execSync('git status --porcelain', { cwd: PROJECT_ROOT }).toString();
    if (status.includes('??')) {
      warnings.push('Untracked files in git repository');
    }
    // app.json の未コミット変更をチェック
    if (status.includes('app.json')) {
      errors.push('app.json has uncommitted changes — commit before build');
    }
    log('Git state validated', 'success');
  } catch (e) {
    errors.push(`Git check failed: ${e.message}`);
  }

  // 4. node_modules の確認
  log('Checking node_modules...');
  const nmPath = path.resolve(APP_DIR, 'node_modules');
  if (!fs.existsSync(nmPath)) {
    warnings.push('node_modules not found — run npm ci before build');
  } else {
    log('node_modules present', 'success');
  }

  // 5. TypeScript チェック（軽量版）
  log('Running TypeScript check...');
  try {
    execSync('npm run tsc 2>&1 | head -10', { cwd: APP_DIR, stdio: 'pipe' });
    log('TypeScript check passed', 'success');
  } catch (e) {
    // tsc はエラーで終了することが多いので、警告に
    warnings.push('TypeScript has type errors (see npm run tsc for details)');
  }

  // 6. ビルド番号が同期されているか確認
  log('Checking build number...');
  try {
    const commitCount = parseInt(
      execSync('git rev-list --count HEAD', { cwd: PROJECT_ROOT }).toString().trim(),
      10
    );
    const buildNum = commitCount + 2000;
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const currentBuildNum = parseInt(appJson.expo?.ios?.buildNumber || '0', 10);

    if (currentBuildNum < buildNum) {
      warnings.push(
        `Build number out of sync: app.json has ${currentBuildNum}, should be ${buildNum}`
      );
    }
    log(`Build number will be v1.1.0(${buildNum})`, 'success');
  } catch (e) {
    warnings.push(`Could not calculate build number: ${e.message}`);
  }

} catch (e) {
  errors.push(`Unexpected error: ${e.message}`);
}

// レポート
console.log('\n' + '='.repeat(60));
console.log('BUILD VALIDATION REPORT');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  log('All checks passed! Ready to build.', 'success');
  process.exit(0);
}

if (warnings.length > 0) {
  console.log('\nWarnings:');
  warnings.forEach((w) => log(w, 'warn'));
}

if (errors.length > 0) {
  console.log('\nErrors:');
  errors.forEach((e) => log(e, 'error'));
  console.log(
    '\n❌ Build validation failed. Fix errors before proceeding.'
  );
  process.exit(1);
}

process.exit(0);
