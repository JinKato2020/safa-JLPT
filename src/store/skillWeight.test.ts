import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillWeight } from './selectors';
import { bankLevelOf } from '../data/daimon';

test('前提: 用法バンクidの級はデータから引ける', () => {
  assert.equal(bankLevelOf('usg3-001'), 'N3');
  assert.equal(bankLevelOf('usg4-001'), 'N4');
});

test('skillWeight: usg-(用法)は接頭辞でなくデータの級で重み付け(N3=1.7 / N4=1.3)', () => {
  // VOCAB_FREQ に usg- は無い→頻度補正mod=1。base だけが出る。
  assert.equal(skillWeight('usg3-001'), 1.7); // N3 base
  assert.equal(skillWeight('usg4-001'), 1.3); // N4 base
});

test('skillWeight: kb-(既存バンク)も従来どおりデータの級で重み付け', () => {
  const lv = bankLevelOf('kb-000421'); // N4(bankId.testで実在確認済)
  assert.equal(lv, 'N4');
  assert.equal(skillWeight('kb-000421'), 1.3);
});
