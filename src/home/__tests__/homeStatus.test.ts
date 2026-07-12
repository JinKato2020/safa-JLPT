// homeStatus / studyHM の健全性(5区分・0-100クランプ・時間整形・空stateで落ちない)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeStatus, studyHM } from '../homeStatus';
import { INITIAL_STATE } from '../../store/state';

test('studyHM: 秒→時分', () => {
  assert.deepEqual(studyHM(0), { h: 0, m: 0 });
  assert.deepEqual(studyHM(59), { h: 0, m: 0 });
  assert.deepEqual(studyHM(90), { h: 0, m: 1 });
  assert.deepEqual(studyHM(3600), { h: 1, m: 0 });
  assert.deepEqual(studyHM(45030), { h: 12, m: 30 });
  assert.deepEqual(studyHM(-100), { h: 0, m: 0 });
});

test('homeStatus: 5区分・順序・0-100・空stateで落ちない', () => {
  const s = homeStatus(INITIAL_STATE, Date.UTC(2026, 0, 1));
  assert.equal(s.subjects.length, 5);
  assert.deepEqual(s.subjects.map((x) => x.key), ['kanji', 'vocab', 'grammar', 'dokkai', 'choukai']);
  for (const sub of s.subjects) assert.ok(sub.pct >= 0 && sub.pct <= 100);
  assert.ok(s.passPct >= 0 && s.passPct <= 100);
  assert.equal(typeof s.rankTitleKey, 'string');
  assert.equal(s.streakDays, 0);
  assert.equal(s.studySeconds, 0);
});
