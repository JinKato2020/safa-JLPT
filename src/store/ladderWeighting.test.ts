import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladderPassEntries } from './selectors';
import { INITIAL_STATE } from './state';
import { DAIMON_BLUEPRINT, DOKKAI_BLUEPRINT, CHOUKAI_BLUEPRINT } from '../data/examBlueprint';
import type { AppState } from './store';

const NOW = 1_700_000_000_000;
const at = (level: 'N5' | 'N4' | 'N3'): AppState => ({ ...INITIAL_STATE, settings: { ...INITIAL_STATE.settings, level } });
const sum = (m: Record<string, number>): number => Object.values(m).reduce((a, b) => a + b, 0);

// entries の並び: MOJI_DAIMON[kanji_read,orthography,context,synonym,usage] → BUNPOU[grammar_form,order,passage_grammar] → reading → listening
const MOJI = ['kanji_read', 'orthography', 'context', 'synonym', 'usage'] as const;
const BUNPOU = ['grammar_form', 'order', 'passage_grammar'] as const;

test('合格率エントリ: 各大問の重み n は本番出題数(DAIMON/DOKKAI/CHOUKAI_BLUEPRINT)と一致する(N3)', () => {
  const e = ladderPassEntries(at('N3'), NOW);
  const bp = DAIMON_BLUEPRINT.N3 as Record<string, number>;
  MOJI.forEach((d, i) => assert.equal(e[i].n, bp[d] ?? 0, `moji ${d}`));
  BUNPOU.forEach((d, i) => assert.equal(e[5 + i].n, bp[d] ?? 0, `bunpou ${d}`));
  assert.equal(e[8].n, sum(DOKKAI_BLUEPRINT.N3), 'reading');
  assert.equal(e[9].n, sum(CHOUKAI_BLUEPRINT.N3), 'listening');
});

test('合格率エントリ: N3の具体的出題数(用法5/文法形式13/文脈規定11/読解16/聴解28)＝旧n=6均等ではない', () => {
  const e = ladderPassEntries(at('N3'), NOW);
  assert.equal(e[2].n, 11, '文脈規定');
  assert.equal(e[4].n, 5, '用法');
  assert.equal(e[5].n, 13, '文法形式');
  assert.equal(e[8].n, 16, '読解');
  assert.equal(e[9].n, 28, '聴解');
});

test('合格率エントリ: N4も本番出題数で重み付け(文法形式15/読解10/聴解28)', () => {
  const e = ladderPassEntries(at('N4'), NOW);
  const bp = DAIMON_BLUEPRINT.N4 as Record<string, number>;
  assert.equal(e[5].n, bp.grammar_form, '文法形式');
  assert.equal(e[8].n, sum(DOKKAI_BLUEPRINT.N4), '読解');
  assert.equal(e[9].n, sum(CHOUKAI_BLUEPRINT.N4), '聴解');
});

test('合格率エントリ: N5に無い大問(用法)は n=0(出題数どおり寄与しない)', () => {
  const e = ladderPassEntries(at('N5'), NOW);
  assert.equal(e[4].n, 0, 'N5に用法大問は無い');
});
