import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daimonUnitIds, questionForUnit, learnCardFor } from '../data/daimon';
import { buildUnitQueue } from '../quiz/quiz';

for (const level of ['N5', 'N4', 'N3'] as const) {
  test(`first lesson ${level}: five distinct questions and learning cards resolve from the existing bank`, () => {
    const ids = buildUnitQueue(daimonUnitIds(level, 'context', 'learn'), {}, Date.now(), 5);
    assert.equal(ids.length, 5);
    assert.equal(new Set(ids).size, 5);
    for (const id of ids) {
      const q = questionForUnit(id);
      assert.ok(q, `question missing: ${id}`);
      assert.ok(learnCardFor(id, 'en'), `learning card missing: ${id}`);
    }
  });
}
