import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coreKeyFor, streakShelf, pickLine, seasonOf, timeBandOf,
  pickCore, composeVoice, pickFragment, sentenceCount,
  CORE_LINES, FLAVOR_SEASON, FLAVOR_TIME, FRAGMENTS, type Line, type Occasion,
} from './voice';

test('streakShelf: 引く回数に比例した5棚(a1-3 / b4-30 / c1..90 / c2..365 / c3)', () => {
  assert.equal(streakShelf(1), 'a');
  assert.equal(streakShelf(3), 'a');
  assert.equal(streakShelf(4), 'b');
  assert.equal(streakShelf(30), 'b');
  assert.equal(streakShelf(31), 'c1');
  assert.equal(streakShelf(90), 'c1');
  assert.equal(streakShelf(91), 'c2');
  assert.equal(streakShelf(365), 'c2');
  assert.equal(streakShelf(366), 'c3');
});

test('daily 後払い棚のフォールバック: c2/c3 未執筆なら c1 の台詞を返す', () => {
  // c2(91-365)/c3(366-) はまだ書いていない → 下位棚 c1 のIDが返る
  assert.match(pickCore({ kind: 'daily', streakDays: 200 }, 0)?.id ?? '', /^daily\.c1\./);
  assert.match(pickCore({ kind: 'daily', streakDays: 400 }, 0)?.id ?? '', /^daily\.c1\./);
  assert.match(pickCore({ kind: 'daily', streakDays: 2 }, 0)?.id ?? '', /^daily\.a\./);
});

test('coreKeyFor: 機会からキーを組む(中立のみ)', () => {
  assert.equal(coreKeyFor({ kind: 'daily', streakDays: 40 }), 'daily:c1');
  assert.equal(coreKeyFor({ kind: 'session_end' }), 'session_end');
  assert.equal(coreKeyFor({ kind: 'streak_mark' }), 'streak_mark');
  assert.equal(coreKeyFor({ kind: 'word_graduate' }), 'word_graduate');
  assert.equal(coreKeyFor({ kind: 'first' }), 'first');
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
  // 昼夜境界(daylight.tsと一致): 17時は昼・18時から夜・5時は夜・6時は朝
  assert.equal(timeBandOf(new Date(2026, 0, 1, 17).getTime()), 'noon');
  assert.equal(timeBandOf(new Date(2026, 0, 1, 18).getTime()), 'night');
  assert.equal(timeBandOf(new Date(2026, 0, 1, 5).getTime()), 'night');
  assert.equal(timeBandOf(new Date(2026, 0, 1, 6).getTime()), 'morning');
});

test('pickCore: streak棚から正しいプールを引く', () => {
  assert.equal(pickCore({ kind: 'daily', streakDays: 1 }, 0)?.id, 'daily.a.1');
  assert.equal(pickCore({ kind: 'session_end' }, 0)?.id, 'session_end.1');
});

test('composeVoice: full=1文coreにflavor付与・short=coreのみ・2文coreにはflavor付けない', () => {
  const spring = new Date(2026, 3, 1, 8).getTime();
  const full = composeVoice({ occasion: { kind: 'daily', streakDays: 1 }, variant: 'full', now: spring, seed: 0 });
  assert.equal(full.ids.length, 2);
  assert.ok(full.text.startsWith('今日も来てくれたんだね。'));

  const short = composeVoice({ occasion: { kind: 'daily', streakDays: 1 }, variant: 'short', now: spring, seed: 0 });
  assert.equal(short.ids.length, 1);

  // daily:b の先頭は既に2文 → full でも flavor を付けない(最大2文を守る)
  const two = composeVoice({ occasion: { kind: 'daily', streakDays: 5 }, variant: 'full', now: spring, seed: 0 });
  assert.equal(two.ids.length, 1);
  assert.equal(sentenceCount(two.text), 2);
});

test('composeVoice: coreが空でも全除外は無視して1本返る(UIは空を出さない)', () => {
  const r = composeVoice({ occasion: { kind: 'daily', streakDays: 1 } as Occasion, now: 0, seed: 0, recent: CORE_LINES['daily:a'].map((l) => l.id) });
  assert.ok(r.text.length > 0); // 全除外でも除外無視で1本返る(=空にならない)
});

test('pickFragment: 反復回避で連載のかけらを返す', () => {
  assert.equal(pickFragment(0)?.id, 'frag.1');
  assert.equal(pickFragment(0, ['frag.1'])?.id, 'frag.2');
});

// ── 配分(発火頻度に比例): 在庫が頻度の高い方へ寄っているか
test('在庫配分(引く回数に比例): daily a4/b14/c1_18・flavor 季32+時18/fragment20/session12/word8', () => {
  assert.equal(CORE_LINES['daily:a'].length, 4);   // 3回しか引かない
  assert.equal(CORE_LINES['daily:b'].length, 14);  // 27回引く
  assert.equal(CORE_LINES['daily:c1'].length, 18); // 無限区間の入口
  assert.equal(CORE_LINES['daily:c2'], undefined); // 後払い(未執筆)
  assert.equal(CORE_LINES['daily:c3'], undefined); // 後払い(未執筆)
  assert.equal(Object.values(FLAVOR_SEASON).flat().length, 32); // 4季×8=同時使用8
  assert.equal(Object.values(FLAVOR_TIME).flat().length, 18);   // 3帯×6
  assert.equal(FRAGMENTS.length, 20);
  assert.equal(CORE_LINES['session_end'].length, 12);
  assert.equal(CORE_LINES['word_graduate'].length, 8);
  assert.equal(CORE_LINES['streak_mark'].length, 4);
});

test('中立のみ: 願い依存の棚(comeback/exam/result/milestone)は残っていない', () => {
  for (const k of Object.keys(CORE_LINES)) {
    assert.ok(!/^(comeback|exam|result|milestone)/.test(k), `願い依存棚が残存: ${k}`);
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
