import test from 'node:test';
import assert from 'node:assert/strict';
import { studyChoiceState } from './studyChoiceState';

test('模試: 正解を選んでも確定前は中立表示で、選び直せる', () => {
  assert.deepEqual([0, 1, 2, 3].map(i => studyChoiceState(i, 2, 2, false)), ['idle', 'idle', 'selected', 'idle']);
  assert.deepEqual([0, 1, 2, 3].map(i => studyChoiceState(i, 0, 2, false)), ['selected', 'idle', 'idle', 'idle']);
});

test('採点後: 正解と選んだ誤答のみを区別する', () => {
  assert.deepEqual([0, 1, 2, 3].map(i => studyChoiceState(i, 0, 2, true)), ['wrong', 'idle', 'correct', 'idle']);
  assert.equal(studyChoiceState(2, 2, 2, true), 'correct');
});

test('聴解の3択も未回答時には正解を示さない', () => {
  assert.deepEqual([0, 1, 2].map(i => studyChoiceState(i, null, 1, false)), ['idle', 'idle', 'idle']);
});

test('答えを渡していない画面は正誤を推定しない', () => {
  assert.equal(studyChoiceState(0, 0, undefined, true), 'selected');
  assert.equal(studyChoiceState(1, 0, undefined, true), 'idle');
});
