// knowledgeBank から explain→explain.ja.json / explainNe→l10n/explain.ne.json を抽出し、
// core から両フィールドを除去。他8言語の空ファイルも雛形生成。冪等(再実行しても同じ結果)。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const examDir = join(here, '../src/data/exam');
const l10nDir = join(examDir, 'l10n');
if (!existsSync(l10nDir)) mkdirSync(l10nDir, { recursive: true });

const bank = JSON.parse(readFileSync(join(examDir, 'knowledgeBank.json'), 'utf8'));
const ja = {}, ne = {};
for (const b of bank) {
  if (typeof b.explain === 'string' && b.explain) ja[b.id] = b.explain;
  if (typeof b.explainNe === 'string' && b.explainNe) ne[b.id] = b.explainNe;
  delete b.explain; delete b.explainNe;
}
writeFileSync(join(examDir, 'explain.ja.json'), JSON.stringify(ja));
writeFileSync(join(l10nDir, 'explain.ne.json'), JSON.stringify(ne));
for (const lang of ['en', 'zh', 'ko', 'vi', 'th', 'id', 'my', 'bn']) {
  const p = join(l10nDir, `explain.${lang}.json`);
  if (!existsSync(p)) writeFileSync(p, JSON.stringify({}));
}
writeFileSync(join(examDir, 'knowledgeBank.json'), JSON.stringify(bank));
console.log(`ja=${Object.keys(ja).length} ne=${Object.keys(ne).length}; core stripped`);
