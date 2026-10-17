import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory } from './inventory.ts';
import { newFacetState, FacetState, Facet } from './mastery.ts';
import { buildDaimonExpectations, estimatePassRate, StoreGet } from './readiness.ts';

const INV = buildInventory();
const emptyGet: StoreGet = () => undefined;

// 全アイテム×面を「習得済み(m=1, 受容済)」にする store。
function masteredGet(): StoreGet {
  const s: FacetState = { ...newFacetState(0), m: 1, intervalDays: 30, evidence: 20 };
  return () => s;
}

test('daimon expectations include reading+listening and cover the 8 inventory daimons', () => {
  const ds = buildDaimonExpectations('N3', emptyGet, INV, 0);
  const keys = ds.map(d => d.daimon);
  assert.ok(keys.includes('reading') && keys.includes('listening'));
  assert.ok(keys.includes('kanji_reading') && keys.includes('grammar_form'));
});

test('empty store -> every daimon mu is the guess floor 0.25', () => {
  const ds = buildDaimonExpectations('N3', emptyGet, INV, 0);
  for (const d of ds) assert.ok(Math.abs(d.mu - 0.25) < 1e-9, `${d.daimon}=${d.mu}`);
});

test('mastered gengo/reading/listening -> mu high on those daimons', () => {
  const ds = buildDaimonExpectations('N3', masteredGet(), INV, 0, { reading: 0.9, listening: 0.9 });
  const kr = ds.find(d => d.daimon === 'kanji_reading')!;
  assert.ok(kr.mu > 0.9, `kanji_reading mu=${kr.mu}`);
});

test('pass rate rises from ~0 (empty) to high (all mastered + strong 読解聴解)', () => {
  const low = estimatePassRate('N3', emptyGet, INV, 0, {}, 2000, 5);
  const high = estimatePassRate('N3', masteredGet(), INV, 0, { reading: 0.9, listening: 0.9 }, 2000, 5);
  assert.ok(low < 0.05, `low=${low}`);
  assert.ok(high > 0.9, `high=${high}`);
});
