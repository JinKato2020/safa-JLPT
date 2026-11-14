import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, type AppState } from './state';
import { untouchedExamDaimons } from './selectors';
import { daimonUnitIds } from '../data/daimon';
import { readingIdsBySub } from '../data';

const at = (level: 'N5' | 'N4' | 'N3', items: AppState['items'] = {}, extra: Partial<AppState['settings']> = {}): AppState =>
  ({ ...INITIAL_STATE, settings: { ...INITIAL_STATE.settings, level, ...extra }, items });

test('new learner: every exam-tab daimon is untouched, in exam-tab order', () => {
  const n5 = untouchedExamDaimons(at('N5')).map((d) => d.key);
  assert.equal(n5[0], 'kanji_read');
  assert.ok(!n5.includes('usage'), 'N5 has no usage daimon');
  assert.ok(n5.includes('dokkai_naiyou_tan') && n5.includes('choukai_sokuji'));
  assert.ok(untouchedExamDaimons(at('N4')).some((d) => d.key === 'usage'));
  for (const d of untouchedExamDaimons(at('N3'))) assert.match(d.labelKey, /^(mock\.dai_|study\.l?sub_)/);
});

test('answering one question of a daimon removes it; JFT is out of scope', () => {
  const kid = daimonUnitIds('N4', 'kanji_read')[0];
  const rid = readingIdsBySub('N4', true).naiyou_tan![0];
  const st = { [kid]: INITIAL_STATE.items[kid] ?? ({ seen: 1 } as never), [rid]: { seen: 1 } as never };
  const keys = untouchedExamDaimons(at('N4', st)).map((d) => d.key);
  assert.ok(!keys.includes('kanji_read') && !keys.includes('dokkai_naiyou_tan'));
  assert.ok(keys.includes('orthography'));
  assert.deepEqual(untouchedExamDaimons(at('N4', {}, { targetExam: 'jft' } as never)), []);
});
