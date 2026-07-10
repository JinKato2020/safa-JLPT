import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferPos, pickSimilar, Candidate } from './distractor.ts';

test('inferPos detects verbs by "to " prefix', () => {
  assert.equal(inferPos('to eat'), 'verb');
  assert.equal(inferPos('dog'), 'other');
  assert.equal(inferPos('a school'), 'other');
});

const pool: Candidate<string>[] = [
  { key: 'dog', bucket: 'other', item: 'dog' },
  { key: 'cat', bucket: 'other', item: 'cat' },
  { key: 'bird', bucket: 'other', item: 'bird' },
  { key: 'to run', bucket: 'verb', item: 'to run' },
  { key: 'to eat', bucket: 'verb', item: 'to eat' },
];

test('pickSimilar excludes the correct key and returns n', () => {
  const out = pickSimilar('dog', 'other', pool, 2, 1);
  assert.equal(out.length, 2);
  assert.ok(!out.includes('dog'));
});

test('pickSimilar prefers same bucket (nouns get nouns, not verbs)', () => {
  const out = pickSimilar('dog', 'other', pool, 2, 1);
  for (const o of out) assert.ok(['cat', 'bird'].includes(o), `got ${o}`);
});

test('pickSimilar is deterministic for a given seed', () => {
  assert.deepEqual(pickSimilar('dog', 'other', pool, 2, 7), pickSimilar('dog', 'other', pool, 2, 7));
});

test('falls back to other buckets when same-bucket is insufficient', () => {
  const out = pickSimilar('to eat', 'verb', pool, 3, 1); // verbは他に1つ→残り2は他バケツ
  assert.equal(out.length, 3);
  assert.ok(!out.includes('to eat'));
});
