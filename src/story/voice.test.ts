import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWish } from './wish';
import {
  coreKey, pickLine, seasonOf, timeBandOf, pickCore, composeVoice, pickFragment, sentenceCount,
  CORE_LINES, FLAVOR_SEASON, FLAVOR_TIME, FRAGMENTS, type Line,
} from './voice';

const wish = (k: Parameters<typeof makeWish>[0]) => makeWish(k, 0);

test('coreKey: 願い依存4状態は願いでキー分岐・custom/later/未設定は neutral', () => {
  assert.equal(coreKey('return', wish('family')), 'return:family');
  assert.equal(coreKey('exam_eve', wish('self')), 'exam_eve:self');
  assert.equal(coreKey('return', wish('custom')), 'return:_'); // customは専用台詞なし
  assert.equal(coreKey('return', wish('later')), 'return:_');
  assert.equal(coreKey('return', undefined), 'return:_');
  assert.equal(coreKey('daily', wish('family')), 'daily'); // 願い非依存は願いを無視
});

test('pickLine: 反復回避で直近IDを除外・全除外なら無視・seedで選ぶ', () => {
  const c: Line[] = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }];
  assert.equal(pickLine(c, 0)?.id, 'a');
  assert.equal(pickLine(c, 0.99)?.id, 'c');
  assert.equal(pickLine(c, 0, ['a'])?.id, 'b');        // aを除外→先頭はb
  assert.equal(pickLine(c, 0, ['a', 'b', 'c'])?.id, 'a'); // 全除外→除外無視で先頭
  assert.equal(pickLine([], 0), null);
});

test('seasonOf/timeBandOf: ローカル月/時で判定', () => {
  assert.equal(seasonOf(new Date(2026, 3, 15).getTime()), 'spring'); // 4月
  assert.equal(seasonOf(new Date(2026, 6, 15).getTime()), 'summer'); // 7月
  assert.equal(seasonOf(new Date(2026, 9, 15).getTime()), 'autumn'); // 10月
  assert.equal(seasonOf(new Date(2026, 0, 15).getTime()), 'winter'); // 1月
  assert.equal(timeBandOf(new Date(2026, 0, 1, 8).getTime()), 'morning');
  assert.equal(timeBandOf(new Date(2026, 0, 1, 13).getTime()), 'noon');
  assert.equal(timeBandOf(new Date(2026, 0, 1, 21).getTime()), 'night');
});

test('pickCore: 願い別の専用台詞を返す', () => {
  assert.equal(pickCore('return', wish('family'), 0)?.id, 'return.family.1');
  assert.equal(pickCore('exam_eve', wish('study'), 0)?.text, '学ぶために始めたね。いってらっしゃい。');
});

test('composeVoice: full=1文coreにflavor付与・short=coreのみ・2文coreにはflavor付けない', () => {
  const spring = new Date(2026, 3, 1, 8).getTime(); // 春の朝
  const full = composeVoice({ state: 'daily', variant: 'full', now: spring, seed: 0 });
  assert.equal(full.ids.length, 2);            // core + flavor
  assert.ok(full.text.startsWith('今日も来てくれたんだね。'));

  const short = composeVoice({ state: 'daily', variant: 'short', now: spring, seed: 0 });
  assert.equal(short.ids.length, 1);
  assert.equal(short.text, '今日も来てくれたんだね。');

  // return:family は既に2文 → full でも flavor を付けない(最大2文を守る)
  const two = composeVoice({ state: 'return', wish: wish('family'), variant: 'full', now: spring, seed: 0 });
  assert.equal(two.ids.length, 1);
  assert.equal(sentenceCount(two.text), 2);
});

test('composeVoice: coreが空なら空文字(UIは出さない)', () => {
  // @ts-expect-error 未知状態のフォールバック確認
  const r = composeVoice({ state: 'unknown', now: 0, seed: 0 });
  assert.equal(r.text, '');
  assert.equal(r.ids.length, 0);
});

test('pickFragment: 反復回避で連載のかけらを返す', () => {
  assert.equal(pickFragment(0)?.id, 'frag.1');
  assert.equal(pickFragment(0, ['frag.1'])?.id, 'frag.2');
});

// ── 口調シート整合性(全台詞に機械強制): 24字以内・最大2文・絵文字なし・ID一意
test('口調シート: 全台詞が24字以内・最大2文・絵文字なし', () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const all: Line[] = [
    ...Object.values(CORE_LINES).flat(),
    ...Object.values(FLAVOR_SEASON).flat(),
    ...Object.values(FLAVOR_TIME).flat(),
    ...FRAGMENTS,
  ];
  const ids = new Set<string>();
  for (const l of all) {
    assert.ok(l.text.length <= 24, `24字超過: ${l.id} "${l.text}"(${l.text.length})`);
    assert.ok(sentenceCount(l.text) <= 2, `3文以上: ${l.id} "${l.text}"`);
    assert.ok(!emoji.test(l.text), `絵文字: ${l.id} "${l.text}"`);
    assert.ok(!ids.has(l.id), `ID重複: ${l.id}`);
    ids.add(l.id);
  }
});

test('願い依存4状態は neutral＋6願いの台詞をすべて持つ', () => {
  for (const st of ['return', 'exam_eve', 'pass', 'fail']) {
    for (const w of ['_', 'work_live', 'study', 'talk', 'family', 'like', 'self']) {
      const key = `${st}:${w}`;
      assert.ok((CORE_LINES[key]?.length ?? 0) >= 1, `台詞欠落: ${key}`);
    }
  }
});
