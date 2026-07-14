import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE } from '../state';
import { walletPoints, addPoints, awardOnce, canBuy, buy, equip, isOwned, isEquipped } from '../wallet';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

test('addPoints: 無上限は素直に加算', () => {
  assert.equal(walletPoints(addPoints(INITIAL_STATE, 50, NOW)), 50);
});

test('addPoints cap: 1日上限300を超えない', () => {
  let s = addPoints(INITIAL_STATE, 250, NOW, { cap: true });
  s = addPoints(s, 100, NOW, { cap: true });
  assert.equal(walletPoints(s), 300);
  assert.equal(s.dailyEarn?.amount, 300);
});

test('addPoints cap: 翌日はリセット', () => {
  let s = addPoints(INITIAL_STATE, 300, NOW, { cap: true });
  s = addPoints(s, 100, Date.UTC(2026, 0, 2, 12, 0, 0), { cap: true });
  assert.equal(walletPoints(s), 400);
});

test('awardOnce: 同じ節目キーは1回だけ', () => {
  let s = awardOnce(INITIAL_STATE, 'streak7', 50);
  s = awardOnce(s, 'streak7', 50);
  assert.equal(walletPoints(s), 50);
  assert.ok(s.claimedMilestones?.includes('streak7'));
});

test('buy: 残高十分で購入→所有＆減算、二重購入不可', () => {
  let s = addPoints(INITIAL_STATE, 600, NOW);
  const item = { id: 'frame_x', price: 500 };
  assert.equal(canBuy(s, item), true);
  s = buy(s, item, NOW);
  assert.equal(walletPoints(s), 100);
  assert.equal(isOwned(s, 'frame_x'), true);
  assert.equal(canBuy(s, item), false);
  s = buy(s, item, NOW);
  assert.equal(walletPoints(s), 100);
});

test('buy: 残高不足は不可', () => {
  const s = addPoints(INITIAL_STATE, 100, NOW);
  assert.equal(canBuy(s, { id: 'x', price: 500 }), false);
  assert.equal(walletPoints(buy(s, { id: 'x', price: 500 }, NOW)), 100);
});

test('equip: 所有品のみ・kind別スロット', () => {
  let s = buy(addPoints(INITIAL_STATE, 600, NOW), { id: 'hair_x', price: 500 }, NOW);
  s = equip(s, { id: 'hair_x', kind: 'hair' });
  assert.equal(s.equipped?.hair, 'hair_x');
  assert.equal(isEquipped(s, { id: 'hair_x', kind: 'hair' }), true);
  s = equip(s, { id: 'hair_y', kind: 'hair' }); // 未所有は装備されない
  assert.equal(s.equipped?.hair, 'hair_x');
});
