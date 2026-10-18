// 【一元化の番人】有効Pro期限は「保存値(紹介/管理) と 学校ライセンス(メール導出)」の1本から合成される。
// これにより「所属は出るのにPro無し」が構造的に起きない(所属○ ⇔ 同じ license から導いたPro)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeProUntil, proStatus } from './entitlement';
import type { AppState } from '../store/state';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const stateWith = (proUntil: number): AppState =>
  ({ entitlements: { proUntil }, settings: {} } as unknown as AppState);

test('両方nullなら null=現状維持(未取得と失効を取り違えない)', () => {
  assert.equal(mergeProUntil(null, null), null);
});

test('学校ライセンスだけでも採用(所属○⇒Pro○の正本一致)', () => {
  assert.equal(mergeProUntil(null, NOW + 74 * DAY), NOW + 74 * DAY);
});

test('保存値だけ(紹介/管理)も採用', () => {
  assert.equal(mergeProUntil(NOW + 10 * DAY, null), NOW + 10 * DAY);
});

test('大きい方を採用(期間を短くしない)', () => {
  assert.equal(mergeProUntil(NOW + 10 * DAY, NOW + 74 * DAY), NOW + 74 * DAY);
  assert.equal(mergeProUntil(NOW + 80 * DAY, NOW + 74 * DAY), NOW + 80 * DAY);
});

test('失効(過去)は過去のまま=Proを落とせる', () => {
  assert.equal(mergeProUntil(null, NOW - DAY), NOW - DAY);
});

test('不変条件: 有効な学校ライセンス(残74日)があれば isPro=true', () => {
  const eff = mergeProUntil(null, NOW + 74 * DAY)!;
  assert.equal(proStatus(stateWith(eff), NOW).isPro, true);
});

test('不変条件: 失効後は isPro=false', () => {
  const eff = mergeProUntil(null, NOW - DAY)!;
  assert.equal(proStatus(stateWith(eff), NOW).isPro, false);
});
