import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseNewer, decideLoginSync } from './sync';
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

// --- decideLoginSync: ログイン時の統合(データ引き継ぎ) ---
test('再インストール(ディスク未復元)でリモートが在れば必ず restore=空でバックアップを上書きしない', () => {
  // 新規/再インストールは updatedAt が無く、時刻上は"今"に見えても restore を選ぶ(データ消失防止)。
  assert.equal(decideLoginSync(at(undefined), at(200), false), 'restore');
  // 旧バックアップで remote.updatedAt が 0 でも、ローカルがまっさらなら restore。
  assert.equal(decideLoginSync(at(undefined), at(undefined), false), 'restore');
});
test('リモートが無ければ push(初回バックアップ作成)', () => {
  assert.equal(decideLoginSync(at(undefined), null, false), 'push');
  assert.equal(decideLoginSync(at(300), null, true), 'push');
});
test('実データあり(ディスク復元済)は LWW', () => {
  assert.equal(decideLoginSync(at(300), at(200), true), 'push');    // ローカルが新しい
  assert.equal(decideLoginSync(at(100), at(200), true), 'restore'); // リモートが新しい
  assert.equal(decideLoginSync(at(200), at(200), true), 'push');    // 同値は既存(ローカル)優先
});
