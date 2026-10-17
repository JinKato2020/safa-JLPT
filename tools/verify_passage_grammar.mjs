// 文章の文法セット(passageGrammar.json)の構造検証。生成後/統合後に実行。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../src/data/exam');
const sets = JSON.parse(readFileSync(join(dir, 'passageGrammar.json'), 'utf8'));
const gids = new Set(JSON.parse(readFileSync(join(dir, '../shared/grammar.json'), 'utf8')).map((g) => g.id));
const errs = [];
const byLv = {};
const seenSetId = new Set();
for (const s of sets) {
  byLv[s.level] = (byLv[s.level] || 0) + 1;
  if (seenSetId.has(s.id)) errs.push(`${s.id}: セットid重複`);
  seenSetId.add(s.id);
  if (s.kind !== 'passage_grammar') errs.push(`${s.id}: kind`);
  if (!Array.isArray(s.passages) || s.passages.length < 1) errs.push(`${s.id}: passages`);
  if (s.level === 'N5' && s.passages.length !== 2) errs.push(`${s.id}: N5は2文`);
  if ((s.level === 'N3' || s.level === 'N4') && s.passages.length !== 1) errs.push(`${s.id}: N3/N4は1文`);
  if (s.questions.length !== 5) errs.push(`${s.id}: 設問数 ${s.questions.length}≠5`);
  const bodyAll = s.passages.map((p) => p.body).join('\n');
  for (const q of s.questions) {
    if (!bodyAll.includes(`【${q.blankNo}】`)) errs.push(`${s.id}:${q.blankNo} 本文に空欄なし`);
    if (!Array.isArray(q.choices) || q.choices.length !== 4) errs.push(`${s.id}:${q.blankNo} 選択肢4個でない`);
    if (!(q.answerIndex >= 0 && q.answerIndex < (q.choices || []).length)) errs.push(`${s.id}:${q.blankNo} answerIndex`);
    if (new Set(q.choices).size !== (q.choices || []).length) errs.push(`${s.id}:${q.blankNo} 選択肢重複`);
    if (q.pointId && !gids.has(q.pointId)) errs.push(`${s.id}:${q.blankNo} pointId未解決 ${q.pointId}`);
    if (!q.pointId) errs.push(`${s.id}:${q.blankNo} pointId無し`);
  }
  const ids = s.questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) errs.push(`${s.id}: 設問id重複`);
  const blanks = s.questions.map((q) => q.blankNo);
  if (new Set(blanks).size !== blanks.length) errs.push(`${s.id}: blankNo重複`);
}
console.log('セット数:', sets.length, '級別:', byLv);
if (errs.length) { console.error('NG', errs.length, errs.slice(0, 30)); process.exit(1); }
console.log('OK: all sets valid');
