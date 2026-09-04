// Supabase の管理ビューSQLを「SQL Editorに貼らずに」適用するスクリプト（依存ゼロ・Node18+のfetchのみ）。
//
// 使い方:
//   1) Supabase → 右上アカウント → Access Tokens で Personal Access Token を1つ作る
//   2) 鍵ファイル .env.local に次の1行を書く（リポジトリ外の「秘密の鍵」フォルダに保管＝公開されない）:
//        SUPABASE_PAT=sbp_xxxxxxxxxxxxxxxxxxxx
//      既定の読み先: C:\API 秘密の鍵\JLPT\.env.local（無ければリポジトリ直下 .env.local も可）
//      （任意）別プロジェクトなら同ファイルに SUPABASE_PROJECT_REF=xxxxx も追記
//      （任意）別の場所に置くなら環境変数 SUPABASE_PAT_FILE でパス指定も可
//   3) node tools/apply_views.mjs            ← 既定の2ファイルを適用
//      node tools/apply_views.mjs a.sql b.sql ← 指定ファイルだけ適用
//
// 仕組み: Management API の database/query（POST /v1/projects/{ref}/database/query）に
//         SQL全文を投げて実行する。ビューは drop→create ゆえ何度でも安全に再適用できる。
// ⚠ これは本番DBへの書き込み。ビュー(読み取り専用)だけを対象にすること。

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 鍵(SUPABASE_PAT)を読む。秘密はリポジトリ外の「秘密の鍵」フォルダに保管し、そこを最優先で読む。
// KEY=VALUE の素朴なパース。既存の process.env を優先。見つかった最初のファイルを採用。
function loadEnvLocal() {
  const candidates = [
    process.env.SUPABASE_PAT_FILE,               // 明示指定(任意・環境変数でパス上書き)
    'C:\\API 秘密の鍵\\JLPT\\.env.local',         // ★秘密の鍵フォルダ(リポジトリ外＝公開されない)
    resolve(ROOT, '.env.local'),                 // リポジトリ直下(フォールバック)
  ].filter(Boolean);
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return p;
  }
  return null;
}
loadEnvLocal();

const PAT = process.env.SUPABASE_PAT;
// 既定の project ref はダッシュボードのURL（nxovouiqelynryumjvyq.supabase.co）から。別プロジェクトは env で上書き。
const REF = process.env.SUPABASE_PROJECT_REF || 'nxovouiqelynryumjvyq';

if (!PAT) {
  console.error('✗ SUPABASE_PAT が未設定です。鍵ファイル(既定 C:\\API 秘密の鍵\\JLPT\\.env.local)に SUPABASE_PAT=... を書いてください。');
  console.error('  トークン作成: Supabase → 右上アカウント → Access Tokens（Database=Write）');
  process.exit(1);
}

// 適用対象（引数があればそれ、無ければ既定の2ファイル）。
const files = (process.argv.slice(2).length ? process.argv.slice(2) : [
  'docs/supabase/dashboard_views.sql',
  'docs/supabase/retention_monetization_views.sql',
]).map((f) => resolve(ROOT, f));

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 800)}`);
  return text;
}

let failed = 0;
for (const file of files) {
  const name = file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  if (!existsSync(file)) { console.error(`✗ 見つかりません: ${name}`); failed++; continue; }
  process.stdout.write(`▶ 適用中: ${name} … `);
  try {
    await runSql(readFileSync(file, 'utf8'));
    console.log('OK');
  } catch (e) {
    console.log('失敗');
    console.error(`  ${e.message}`);
    failed++;
  }
}

if (failed) { console.error(`\n${failed} 件失敗しました。`); process.exit(1); }
console.log(`\n✅ 全${files.length}ファイル適用完了（project=${REF}）。ダッシュボードを再取得すれば反映されます。`);
