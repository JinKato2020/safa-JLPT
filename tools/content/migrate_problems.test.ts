// app/tools/content/migrate_problems.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toItem, groupToFiles } from './migrate_problems.ts';
import { DAIMON_SPEC } from './schema.ts';

const ctxSpec = DAIMON_SPEC.find((d) => d.daimon === 'context')!;
const synSpec = DAIMON_SPEC.find((d) => d.daimon === 'synonym')!;

test('toItem: neutralコピー＋ja/ne explain', () => {
  const it = toItem({ id: 'cx:n4-v-1', level: 'N4', prompt: 'p', question: 'q', answer: 'a', choices: ['a', 'b', 'c'], explain: 'J', explainNe: 'N' }, ctxSpec);
  assert.equal(it.id, 'cx:n4-v-1');
  assert.equal(it.prompt, 'p');
  assert.equal(it.i18n.ja.explain, 'J');
  assert.equal(it.i18n.ne.explain, 'N');
  assert.equal((it as any).explain, undefined); // トップにexplainを残さない
});
test('toItem: synonym は reason→explain', () => {
  const it = toItem({ id: 'sy:n5-v-1', level: 'N5', sentence: 's', underline: 'u', word: 'w', answer: 'a', choices: ['a', 'b'], reason: 'J', reasonNe: 'N' }, synSpec);
  assert.equal(it.i18n.ja.explain, 'J');
  assert.equal(it.i18n.ne.explain, 'N');
});
test('groupToFiles: level別に分割・件数保持', () => {
  const raw = [{ id: 'cx:n4-v-1', level: 'N4', prompt: 'p', question: 'q', answer: 'a', choices: ['a'], explain: 'x', explainNe: 'y' },
    { id: 'cx:n5-v-1', level: 'N5', prompt: 'p', question: 'q', answer: 'a', choices: ['a'], explain: 'x', explainNe: 'y' }];
  const files = groupToFiles(raw, ctxSpec);
  assert.equal(files.length, 2);
  assert.deepEqual(files.map((f) => f.level).sort(), ['N4', 'N5']);
  assert.equal(files.find((f) => f.level === 'N4')!.items.length, 1);
});
