// 面マスタリー: 実行 node --import tsx --test src/review/facetMastery.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordFacet, getFacet, facetEffectiveP, type MasterySlice } from './facetMastery.ts';
import type { FacetTarget } from './facetMap.ts';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const readT: FacetTarget[] = [{ itemId: 'w1', facet: 'read', weight: 1 }];
const reinforceT: FacetTarget[] = [{ itemId: 'w1', facet: 'mean', weight: 0.85 }];

test('認識面: 正解で p が上がり dueAt が未来へ・reps が進む', () => {
  const m = recordFacet({}, readT, true, 'practice', NOW);
  const s = getFacet(m, 'w1', 'read')!;
  assert.ok(s.p > 0, 'p>0');
  assert.ok(s.dueAt > NOW, 'dueAt は未来');
  assert.equal(s.reps, 1, 'reps=1');
});

test('認識面: 不正解で SRS がリセット(reps=0)し翌日以降に再出題', () => {
  const m1 = recordFacet({}, readT, true, 'practice', NOW);
  const m2 = recordFacet(m1, readT, false, 'practice', NOW + DAY);
  const s = getFacet(m2, 'w1', 'read')!;
  assert.equal(s.reps, 0, '不正解で reps リセット');
});

test('補強面: 正解時のみ底上げ・weight を薄めるので認識より p が低い', () => {
  // 新規は evidence=0 で重みが相殺され p=1 になる(区別が出ない)ので、先に誤答で evidence を作ってから比較する。
  const prior = recordFacet({}, [{ itemId: 'w1', facet: 'mean', weight: 1 }], false, 'practice', NOW); // p=0, evidence=3
  const rec = recordFacet(prior, [{ itemId: 'w1', facet: 'mean', weight: 1 }], true, 'practice', NOW);
  const rein = recordFacet(prior, reinforceT, true, 'practice', NOW);
  const pRec = getFacet(rec, 'w1', 'mean')!.p;
  const pRein = getFacet(rein, 'w1', 'mean')!.p;
  assert.ok(pRein > 0 && pRein < pRec, `補強p(${pRein}) < 認識p(${pRec})`);
});

test('補強面: 失敗は据え置き(認識面を下げない)', () => {
  const m1 = recordFacet({}, [{ itemId: 'w1', facet: 'mean', weight: 1 }], true, 'practice', NOW); // 認識で上げる
  const before = getFacet(m1, 'w1', 'mean')!;
  const m2 = recordFacet(m1, reinforceT, false, 'practice', NOW + DAY); // 補強を失敗
  const after = getFacet(m2, 'w1', 'mean')!;
  assert.deepEqual(after, before, '補強失敗で面は不変');
});

test('補強面: 未習で失敗しても面を作らない', () => {
  const m = recordFacet({}, reinforceT, false, 'practice', NOW);
  assert.equal(getFacet(m, 'w1', 'mean'), undefined, '面は生成されない');
});

test('mock 信号は practice より重い(累積エビデンスが大きい)', () => {
  // 新規正解では p は両方1(重み相殺)。差が出るのはエビデンス量: practice=3 / mock=5。
  const p1 = recordFacet({}, readT, true, 'practice', NOW);
  const p2 = recordFacet({}, readT, true, 'mock', NOW);
  assert.ok(getFacet(p2, 'w1', 'read')!.evidence > getFacet(p1, 'w1', 'read')!.evidence, 'mock evidence>practice');
});

test('facetEffectiveP: 未習は null・学習後は減衰込みの値', () => {
  assert.equal(facetEffectiveP({}, 'w1', 'read', NOW), null);
  const m = recordFacet({}, readT, true, 'practice', NOW);
  const later = facetEffectiveP(m, 'w1', 'read', NOW + 30 * DAY);
  assert.ok(later !== null && later > 0 && later < getFacet(m, 'w1', 'read')!.p, '減衰して下がる');
});

test('不変性: 入力の MasterySlice を破壊しない', () => {
  const m0: MasterySlice = {};
  const m1 = recordFacet(m0, readT, true, 'practice', NOW);
  assert.notEqual(m1, m0, '新オブジェクト');
  assert.deepEqual(m0, {}, '元は空のまま');
});
