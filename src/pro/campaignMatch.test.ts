// matchesCampaign の番人（純粋関数・ネイティブ依存なし）。
//   実行: node --import tsx --test src/pro/campaignMatch.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesCampaign } from './campaignMatch';

test('地域一致で対象', () => {
  assert.equal(matchesCampaign(['TW'], 'TW'), true);
});

test('地域不一致は対象外', () => {
  assert.equal(matchesCampaign(['TW'], 'JP'), false);
});

test("'ALL' は全世界＝どの地域でも対象", () => {
  assert.equal(matchesCampaign(['ALL'], 'JP'), true);
  assert.equal(matchesCampaign(['ALL'], 'TW'), true);
});

test("'ALL' は地域不明('')でも対象（拡散優先）", () => {
  assert.equal(matchesCampaign(['ALL'], ''), true);
});

test("'ALL' 無しで地域不明は対象外（誤爆防止）", () => {
  assert.equal(matchesCampaign(['TW', 'HK'], ''), false);
});

test('空リストは常に対象外（キャンペーン終了）', () => {
  assert.equal(matchesCampaign([], 'TW'), false);
  assert.equal(matchesCampaign([], ''), false);
});

test("'ALL' と個別地域の混在でも全世界が優先", () => {
  assert.equal(matchesCampaign(['TW', 'ALL'], 'JP'), true);
});
