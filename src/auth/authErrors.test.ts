import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapAuthError } from './authErrors';

test('登録済み', () => {
  assert.equal(mapAuthError('User already registered'), 'account.err_taken');
});
test('資格情報不正', () => {
  assert.equal(mapAuthError('Invalid login credentials'), 'account.err_invalid');
});
test('メール未確認', () => {
  assert.equal(mapAuthError('Email not confirmed'), 'account.err_unconfirmed');
});
test('弱いパスワード', () => {
  assert.equal(mapAuthError('Password should be at least 8 characters'), 'account.err_weak_pw');
});
test('ネットワーク', () => {
  assert.equal(mapAuthError('Network request failed'), 'account.err_network');
});
test('未知/未定義は汎用', () => {
  assert.equal(mapAuthError(undefined), 'account.err_invalid');
  assert.equal(mapAuthError('something weird'), 'account.err_invalid');
});
