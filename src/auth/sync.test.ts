import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseNewer } from './sync';
import { INITIAL_STATE, type AppState } from '../store/state';

const at = (ts?: number): AppState => ({ ...INITIAL_STATE, updatedAt: ts });

test('remote が無ければ local', () => {
  assert.equal(chooseNewer(at(100), null), 'local');
});
test('remote が新しければ remote', () => {
  assert.equal(chooseNewer(at(100), at(200)), 'remote');
});
test('local が新しければ local', () => {
  assert.equal(chooseNewer(at(300), at(200)), 'local');
});
test('同値は local(既存を優先)', () => {
  assert.equal(chooseNewer(at(200), at(200)), 'local');
});
test('updatedAt 未定義は 0 扱い', () => {
  assert.equal(chooseNewer(at(undefined), at(1)), 'remote');
  assert.equal(chooseNewer(at(undefined), at(undefined)), 'local');
});
