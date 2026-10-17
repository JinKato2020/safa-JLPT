import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillWeight } from './selectors';
import { bankLevelOf } from '../data/daimon';

test('前提: 用法バンクidの級はデータから引ける', () => {
  assert.equal(bankLevelOf('N3-V-Y-0001'), 'N3');
  assert.equal(bankLevelOf('N4-V-Y-0001'), 'N4');
});

test('skillWeight: 用法(V-Y)はデータの級で重み付け(N3=1.7 / N4=1.3)', () => {
  // VOCAB_FREQ に用法idは無い→頻度補正mod=1。base だけが出る。
  assert.equal(skillWeight('N3-V-Y-0001'), 1.7); // N3 base
  assert.equal(skillWeight('N4-V-Y-0001'), 1.3); // N4 base
});

test('skillWeight: 文法バンク(G-B)も従来どおりデータの級で重み付け', () => {
  const lv = bankLevelOf('N4-G-B-0001'); // N4(bankId.testで実在確認済)
  assert.equal(lv, 'N4');
  assert.equal(skillWeight('N4-G-B-0001'), 1.3);
});
