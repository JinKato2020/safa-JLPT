import { test } from 'node:test';
import assert from 'node:assert/strict';
import reading from '../data/exam/reading.json';
import { readingToSet, gradeSet, type SetQuestion } from './passageSet';

test('readingToSet は passage+questions を保持', () => {
  const p = (reading as any[])[0];
  const set = readingToSet(p);
  assert.equal(set.kind, 'reading');
  assert.equal(set.passages.length, 1);
  assert.equal(set.passages[0].body, p.body);
  assert.equal(set.questions.length, p.questions.length);
  assert.equal(set.questions[0].id, p.questions[0].id);
  assert.equal(set.questions[0].answerIndex, p.questions[0].answerIndex);
});

test('gradeSet: 未回答ありは allAnswered=false', () => {
  const qs: SetQuestion[] = [{ id: 'a', choices: ['x','y'], answerIndex: 0 }, { id: 'b', choices: ['x','y'], answerIndex: 1 }];
  const g = gradeSet([0, null], qs);
  assert.equal(g.allAnswered, false);
});

test('gradeSet: 全回答で採点', () => {
  const qs: SetQuestion[] = [{ id: 'a', choices: ['x','y'], answerIndex: 0 }, { id: 'b', choices: ['x','y'], answerIndex: 1 }];
  const g = gradeSet([0, 0], qs);
  assert.equal(g.allAnswered, true);
  assert.deepEqual(g.correct, [true, false]);
  assert.equal(g.correctCount, 1);
});
