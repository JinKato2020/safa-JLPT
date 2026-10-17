// 級別漢字リストの単体テスト。実行: node --import tsx --test src/kakitori/list.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kanjiListFor, kanjiInfo } from './list.ts';

test('級別件数(実測)', () => {
  assert.equal(kanjiListFor('N5').length, 79);
  assert.equal(kanjiListFor('N4').length, 166);
  assert.equal(kanjiListFor('N3').length, 367);
});
test('各級は一意', () => {
  for (const lv of ['N5', 'N4', 'N3'] as const) {
    const a = kanjiListFor(lv);
    assert.equal(new Set(a).size, a.length);
  }
});
test('既知字を含む', () => {
  assert.ok(kanjiListFor('N5').includes('日'));
  assert.ok(kanjiListFor('N5').includes('木'));
});
test('kanjiInfoは読み/意味を返す', () => {
  const info = kanjiInfo('一');
  assert.ok(info);
  assert.equal(info?.char, '一');
  assert.ok((info?.meaning ?? '').length > 0);
});
