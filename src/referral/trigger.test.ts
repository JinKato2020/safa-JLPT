import { test } from 'node:test'; import assert from 'node:assert/strict';
import { recordQualifyingDay, isTriggerMet } from './trigger';
const DAY = 86400000; const inst = Date.UTC(2026, 7, 1);
const d = (n: number) => new Date(inst + n*DAY).toISOString().slice(0,10);
test('recordQualifyingDay: 同日は重複しない', () => {
  let a: string[] = []; a = recordQualifyingDay(a, '2026-08-01'); a = recordQualifyingDay(a, '2026-08-01');
  assert.deepEqual(a, ['2026-08-01']);
});
test('isTriggerMet: 窓内で7日(累計)成立', () => {
  const days = [d(0),d(2),d(4),d(6),d(8),d(10),d(13)]; // 別々7日・14日以内
  assert.equal(isTriggerMet(inst, days, inst + 13*DAY), true);
});
test('isTriggerMet: 6日は未成立', () => {
  const days = [d(0),d(2),d(4),d(6),d(8),d(10)];
  assert.equal(isTriggerMet(inst, days, inst + 13*DAY), false);
});
test('isTriggerMet: 15日目に達成しても窓外は数えない', () => {
  const days = [d(0),d(2),d(4),d(6),d(8),d(10),d(15)]; // 最後は窓外
  assert.equal(isTriggerMet(inst, days, inst + 15*DAY), false);
});
