import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  topPercentNormal, totalTopPercent, starsFromTop, relativePositionFor, isOfficialLevel,
} from './relativePosition';
import { OFFICIAL_TOP_PERCENT, OFFICIAL_SECTION_STATS } from '../data/officialStats';

test('平均点ちょうど=上位約50%', () => {
  const { mean, sd } = OFFICIAL_SECTION_STATS.N3.gengo!;
  assert.ok(Math.abs(topPercentNormal(mean, mean, sd) - 50) < 0.5);
});

test('高得点ほど上位%は小さい(単調)', () => {
  const { mean, sd } = OFFICIAL_SECTION_STATS.N3.choukai!;
  assert.ok(topPercentNormal(50, mean, sd) < topPercentNormal(30, mean, sd));
});

test('★の閾値(上位12%→5, 24%→4, 43%→3)', () => {
  assert.equal(starsFromTop(12), 5);
  assert.equal(starsFromTop(24), 4);
  assert.equal(starsFromTop(43), 3);
  assert.equal(starsFromTop(60), 2);
  assert.equal(starsFromTop(85), 1);
});

test('総合の上位%は分布表の端点と一致', () => {
  const tbl = OFFICIAL_TOP_PERCENT.N3;
  const top = tbl[0];   // 昇順の先頭(=最低点)
  const bottom = tbl[tbl.length - 1]; // 末尾(=満点)
  assert.equal(totalTopPercent('N3', top.score), top.top);
  assert.equal(totalTopPercent('N3', bottom.score), bottom.top);
});

test('総合の上位%は中間で補間される(単調減少)', () => {
  assert.ok(totalTopPercent('N3', 120) < totalTopPercent('N3', 90));
  // 95(N3合格点)付近は表の 90→95 の間で補間
  const at95 = totalTopPercent('N3', 95);
  assert.ok(at95 > 30 && at95 < 45);
});

test('N4/N5は2区分(gengo合算+choukai)・N3は3区分', () => {
  const n5 = relativePositionFor('N5', [
    { key: 'gengo', score: 80, max: 120 }, { key: 'choukai', score: 35, max: 60 },
  ], 115)!;
  assert.equal(n5.sections.length, 2);
  assert.ok(n5.total && n5.total.top > 0);

  const n3 = relativePositionFor('N3', [
    { key: 'gengo', score: 40, max: 60 }, { key: 'dokkai', score: 35, max: 60 }, { key: 'choukai', score: 45, max: 60 },
  ], 120)!;
  assert.equal(n3.sections.length, 3);
});

test('公式統計を持たないレベルはnull', () => {
  assert.equal(isOfficialLevel('JFT'), false);
  assert.equal(relativePositionFor('JFT', [], 0), null);
});
