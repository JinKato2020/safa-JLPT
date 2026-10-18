// 予想得点μの観測ベース縮小式(2026-10-18)の番人。少数の学習でも実力が速く反映されること＋
// 「母数が巨大な級で10問正解してもμがほぼ動かない(旧式)」の回帰を防ぐ。
// 実行: node --import tsx --test src/store/predictedScoreResponsive.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladderPassEntries } from './selectors';
import { INITIAL_STATE } from './state';
import { newItemState, recordQuiz, type ItemState } from '../engine/engine';
import { daimonUnitIds } from '../data/daimon';
import type { AppState } from './state';

const NOW = 1_700_000_000_000;
const strong = (): ItemState => recordQuiz(newItemState(NOW), true, NOW); // p≈1

// 指定idに強い習得をseedしたN3 state。
const withStrong = (ids: string[]): AppState => {
  const items: Record<string, ItemState> = {};
  for (const id of ids) items[id] = strong();
  return { ...INITIAL_STATE, items, mastery: {}, settings: { ...INITIAL_STATE.settings, level: 'N3' } };
};

// entries: MOJI(5) → BUNPOU[grammar_form,order,passage_grammar] → reading → listening。grammar_form=index 5。
const grammarMu = (s: AppState): number => ladderPassEntries(s, NOW)[5].mu;

const GRAMMAR_IDS = daimonUnitIds('N3', 'grammar_form');

test('未着手の文法μは当てずっぽう下限0.25', () => {
  const s: AppState = { ...INITIAL_STATE, items: {}, mastery: {}, settings: { ...INITIAL_STATE.settings, level: 'N3' } };
  assert.equal(grammarMu(s), 0.25);
});

test('20項目だけ強い習得でも文法μは実力に速く反応する(>0.6・旧カバー率式より大きい)', () => {
  const seed = GRAMMAR_IDS.slice(0, 20);
  const mu = grammarMu(withStrong(seed));
  assert.ok(mu > 0.6, `20項目習得でμが実力反映(>0.6): ${mu}`);
  // 旧式(未着手=0.25で全プール平均)の値。母数が大きいほど0.25付近に張り付く。
  const oldMu = (20 * 1.0 + (GRAMMAR_IDS.length - 20) * 0.25) / GRAMMAR_IDS.length;
  assert.ok(mu > oldMu + 0.1, `新式は旧式(${oldMu.toFixed(3)})より明確に高い: ${mu.toFixed(3)}`);
});

test('学習量が増えるとμは単調に上がる(5→20→50項目)', () => {
  const mu5 = grammarMu(withStrong(GRAMMAR_IDS.slice(0, 5)));
  const mu20 = grammarMu(withStrong(GRAMMAR_IDS.slice(0, 20)));
  const mu50 = grammarMu(withStrong(GRAMMAR_IDS.slice(0, Math.min(50, GRAMMAR_IDS.length))));
  assert.ok(mu5 < mu20 && mu20 <= mu50, `単調増加: ${mu5.toFixed(3)} < ${mu20.toFixed(3)} <= ${mu50.toFixed(3)}`);
  assert.ok(mu5 > 0.25, `5項目でも下限より上=控えめだが反応あり: ${mu5.toFixed(3)}`);
});
