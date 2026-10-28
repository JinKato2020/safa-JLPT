import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedProfileSnapshotKey } from './profileSnapshot';
import { INITIAL_STATE } from '../store/state';

const complete = { ...INITIAL_STATE.settings, onboarded: true, nickname: 'Rina',
  avatar: 'f_girl1', personality: 'akarui', moodMsg: 'ganbaru' };

test('waits for all committed onboarding fields, including a nonblank name', () => {
  assert.equal(completedProfileSnapshotKey(INITIAL_STATE.settings, null), null);
  for (const key of ['nickname', 'avatar', 'personality', 'moodMsg'] as const) {
    assert.equal(completedProfileSnapshotKey({ ...complete, [key]: undefined }, null), null);
  }
  assert.equal(completedProfileSnapshotKey({ ...complete, nickname: '  ' }, null), null);
  assert.equal(completedProfileSnapshotKey({ ...complete, onboarded: false }, null), null);
  assert.ok(completedProfileSnapshotKey(complete, null));
});

test('unchanged profile stays stable; login, restore and profile edits trigger a fresh sample', () => {
  const before = completedProfileSnapshotKey(complete, null);
  assert.equal(completedProfileSnapshotKey({ ...complete }, null), before);
  assert.notEqual(completedProfileSnapshotKey(complete, 'account-a'), before);
  assert.notEqual(completedProfileSnapshotKey(complete, 'account-a'), completedProfileSnapshotKey(complete, 'account-b'));
  for (const key of ['nickname', 'avatar', 'personality', 'moodMsg'] as const) {
    assert.notEqual(completedProfileSnapshotKey({ ...complete, [key]: 'restored-value' }, null), before);
  }
});
