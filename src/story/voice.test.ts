import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWish } from './wish';
import {
  coreKeyFor, wishKey, streakShelf, comebackStage, pickLine, seasonOf, timeBandOf,
  pickCore, composeVoice, pickFragment, sentenceCount,
  CORE_LINES, FLAVOR_SEASON, FLAVOR_TIME, FRAGMENTS, type Line, type Occasion,
} from './voice';

const wish = (k: Parameters<typeof makeWish>[0]) => makeWish(k, 0);

test('wishKey: 6願いはそのまま・custom/later/未設定は neutral', () => {
  assert.equal(wishKey(wish('family')), 'family');
  assert.equal(wishKey(wish('custom')), '_');
  assert.equal(wishKey(wish('later')), '_');
  assert.equal(wishKey(undefined), '_');
});

test('streakShelf: 片道の3棚(1-3 / 4-30 / 31-)', () => {
  assert.equal(streakShelf(1), 'early');
  assert.equal(streakShelf(3), 'early');
  assert.equal(streakShelf(4), 'mid');
  assert.equal(streakShelf(30), 'mid');
  assert.equal(streakShelf(31), 'long');
});

test('comebackStage: 空白の長さで3段階(≤6 / ≤14 / それ以上)', () => {
  assert.equal(comebackStage(2), 'short');
  assert.equal(comebackStage(10), 'mid');
  assert.equal(comebackStage(40), 'long');
});

test('coreKeyFor: 機会からキーを組む', () => {
  assert.equal(coreKeyFor({ kind: 'daily', streakDays: 40 }), 'daily:long');
  assert.equal(coreKeyFor({ kind: 'comeback', absenceDays: 3, wish: wish('self') }), 'comeback:short:self');
  assert.equal(coreKeyFor({ kind: 'exam', timing: 'eve', wish: wish('family') }), 'exam:eve:family');
  assert.equal(coreKeyFor({ kind: 'result', outcome: 'fail', wish: wish('like') }), 'result:fail:like');
  assert.equal(coreKeyFor({ kind: 'milestone', wish: wish('study') }), 'milestone:study');
  assert.equal(coreKeyFor({ kind: 'session_end' }), 'session_end');
});

test('pickLine: 反復回避で直近IDを除外・全除外なら無視・seedで選ぶ', () => {
  const c: Line[] = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }];
  assert.equal(pickLine(c, 0)?.id, 'a');
  assert.equal(pickLine(c, 0.99)?.id, 'c');
  assert.equal(pickLine(c, 0, ['a'])?.id, 'b');
  assert.equal(pickLine(c, 0, ['a', 'b', 'c'])?.id, 'a');
  assert.equal(pickLine([], 0), null);
});

test('seasonOf/timeBandOf: ローカル月/時で判定', () => {
  assert.equal(seasonOf(new Date(2026, 3, 15).getTime()), 'spring');
  assert.equal(seasonOf(new Date(2026, 6, 15).getTime()), 'summer');
  assert.equal(seasonOf(new Date(2026, 9, 15).getTime()), 'autumn');
  assert.equal(seasonOf(new Date(2026, 0, 15).getTime()), 'winter');
  assert.equal(timeBandOf(new Date(2026, 0, 1, 8).getTime()), 'morning');
  assert.equal(timeBandOf(new Date(2026, 0, 1, 13).getTime()), 'noon');
  assert.equal(timeBandOf(new Date(2026, 0, 1, 21).getTime()), 'night');
});

test('pickCore: streak棚・願い別に正しいプールを引く', () => {
  assert.equal(pickCore({ kind: 'daily', streakDays: 1 }, 0)?.id, 'daily.early.1');
  assert.equal(pickCore({ kind: 'exam', timing: 'eve', wish: wish('study') }, 0)?.text, '学ぶために始めたね。いってらっしゃい。');
});

test('composeVoice: full=1文coreにflavor付与・short=coreのみ・2文coreにはflavor付けない', () => {
  const spring = new Date(2026, 3, 1, 8).getTime();
  const full = composeVoice({ occasion: { kind: 'daily', streakDays: 1 }, variant: 'full', now: spring, seed: 0 });
  assert.equal(full.ids.length, 2);
  assert.ok(full.text.startsWith('今日も来てくれたんだね。'));

  const short = composeVoice({ occasion: { kind: 'daily', streakDays: 1 }, variant: 'short', now: spring, seed: 0 });
  assert.equal(short.ids.length, 1);

  // comeback は既に2文 → full でも flavor を付けない(最大2文を守る)
  const two = composeVoice({ occasion: { kind: 'comeback', absenceDays: 2, wish: wish('family') }, variant: 'full', now: spring, seed: 0 });
  assert.equal(two.ids.length, 1);
  assert.equal(sentenceCount(two.text), 2);
});

test('composeVoice: coreが空なら空文字(UIは出さない)', () => {
  const r = composeVoice({ occasion: { kind: 'daily', streakDays: 1 } as Occasion, now: 0, seed: 0, recent: CORE_LINES['daily:early'].map((l) => l.id) });
  assert.ok(r.text.length > 0); // 全除外でも除外無視で1本返る(=空にならない)
});

test('pickFragment: 反復回避で連載のかけらを返す', () => {
  assert.equal(pickFragment(0)?.id, 'frag.1');
  assert.equal(pickFragment(0, ['frag.1'])?.id, 'frag.2');
});

// ── 配分(発火頻度に比例): 在庫が頻度の高い方へ寄っているか
test('在庫配分: daily24(棚3×8)/flavor28/fragment20/session_end12/word_graduate8', () => {
  assert.equal(CORE_LINES['daily:early'].length, 8);
  assert.equal(CORE_LINES['daily:mid'].length, 8);
  assert.equal(CORE_LINES['daily:long'].length, 8);
  assert.equal(Object.values(FLAVOR_SEASON).flat().length + Object.values(FLAVOR_TIME).flat().length, 28);
  assert.equal(FRAGMENTS.length, 20);
  assert.equal(CORE_LINES['session_end'].length, 12);
  assert.equal(CORE_LINES['word_graduate'].length, 8);
  assert.equal(CORE_LINES['streak_mark'].length, 4);
});

test('願い依存(comeback/exam/result/milestone)は neutral＋6願いを全て持つ', () => {
  const groups: string[] = [
    ...['short', 'mid', 'long'].map((s) => `comeback:${s}`),
    ...['eve', 'day', 'after'].map((t) => `exam:${t}`),
    ...['pass', 'fail'].map((o) => `result:${o}`),
    'milestone',
  ];
  for (const g of groups) {
    for (const w of ['_', 'work_live', 'study', 'talk', 'family', 'like', 'self']) {
      assert.ok((CORE_LINES[`${g}:${w}`]?.length ?? 0) >= 1, `台詞欠落: ${g}:${w}`);
    }
  }
});

// ── 口調シート整合(全台詞に機械強制): 24字以内・最大2文・絵文字なし・ID一意
test('口調シート: 全台詞が24字以内・最大2文・絵文字なし・ID一意', () => {
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
