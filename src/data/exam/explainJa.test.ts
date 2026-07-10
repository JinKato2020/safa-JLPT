import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainJa, resolveExplain } from './explainJa';
import bank from './knowledgeBank.json';

const firstId = (bank as { id: string }[])[0].id;

test('explainJa は同梱mapから解説を返す', () => {
  assert.equal(typeof explainJa(firstId), 'string');
  assert.ok((explainJa(firstId) as string).length > 0);
});

test('resolveExplain は langMap優先・無ければjaフォールバック', () => {
  assert.equal(resolveExplain(firstId, { [firstId]: 'OVERRIDE' }), 'OVERRIDE');
  assert.equal(resolveExplain(firstId, undefined), explainJa(firstId));
  assert.equal(resolveExplain(firstId, {}), explainJa(firstId)); // 欠落→ja
});

test('core から explain フィールドが除去されている', () => {
  const b = (bank as Record<string, unknown>[])[0];
  assert.equal('explain' in b, false);
  assert.equal('explainNe' in b, false);
});
