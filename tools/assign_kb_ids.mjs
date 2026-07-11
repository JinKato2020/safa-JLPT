// knowledgeBank 各エントリへ永続の連番 id(kb-NNNNNN) を配列順で付与し、旧 bk:<lv>:<daimon>:<idx> → 新 id の
// 移行マップを出力する。冪等: 既に id があるエントリはその id を保持し、新規のみ採番。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bankPath = join(here, '../src/data/exam/knowledgeBank.json');
const migPath = join(here, '../src/data/exam/kbIdMigration.json');

const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
let maxN = 0;
for (const b of bank) {
  if (typeof b.id === 'string' && /^kb-\d{6}$/.test(b.id)) maxN = Math.max(maxN, Number(b.id.slice(3)));
}
const migration = {};
for (let i = 0; i < bank.length; i++) {
  const b = bank[i];
  if (!(typeof b.id === 'string' && /^kb-\d{6}$/.test(b.id))) {
    b.id = `kb-${String(++maxN).padStart(6, '0')}`;
  }
  migration[`bk:${b.level}:${b.daimon}:${i}`] = b.id;
}
// id を先頭キーに（読みやすさ）: 各エントリを id 起点で再構築
const reordered = bank.map((b) => {
  const { id, ...rest } = b;
  return { id, ...rest };
});
writeFileSync(bankPath, JSON.stringify(reordered));
writeFileSync(migPath, JSON.stringify(migration));
console.log(`assigned ids to ${bank.length} entries; migration keys=${Object.keys(migration).length}`);
