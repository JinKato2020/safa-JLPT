import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coachLines, pickLine } from './coachLines';
import type { HomeStatus } from './homeStatus';

// 恒等t(キー＋params展開)でセリフ生成の分岐を検証。
const t = (k: string, p?: Record<string, string | number>) =>
  p ? `${k}:${Object.values(p).join(',')}` : k;

const baseStatus = (over: Partial<HomeStatus> = {}): HomeStatus => ({
  passPct: 50,
  rankTitleKey: 'home.passTitle5',
  streakDays: 5,
  studySeconds: 0,
  subjects: [
    { key: 'kanji', labelKey: 'cards.kanji', color: '#000', pct: 80 },
    { key: 'vocab', labelKey: 'cards.vocab', color: '#000', pct: 20 },
    { key: 'grammar', labelKey: 'cards.grammar', color: '#000', pct: 60 },
  ],
  ...over,
});

test('必ず1つ以上返る', () => {
  assert.ok(coachLines(t, { status: baseStatus(), learned: 0 }).length >= 1);
});

test('継続3日以上でstreakセリフ', () => {
  const lines = coachLines(t, { status: baseStatus({ streakDays: 7 }), learned: 0 });
  assert.ok(lines.some((l) => l.startsWith('coach.streak:7')));
});

test('継続0日でstreak0セリフ', () => {
  const lines = coachLines(t, { status: baseStatus({ streakDays: 0 }), learned: 0 });
  assert.ok(lines.includes('coach.streak0'));
});

test('合格率70以上でpass_high', () => {
  const lines = coachLines(t, { status: baseStatus({ passPct: 85 }), learned: 0 });
  assert.ok(lines.includes('coach.pass_high'));
});

test('一番弱い分野を促す(最小pctのlabel)', () => {
  const lines = coachLines(t, { status: baseStatus(), learned: 0 });
  assert.ok(lines.some((l) => l === 'coach.weak:cards.vocab'));
});

test('覚えた語100以上でlearnedセリフ', () => {
  const lines = coachLines(t, { status: baseStatus(), learned: 250 });
  assert.ok(lines.some((l) => l.startsWith('coach.learned:250')));
});

test('pickLineはrng固定で決定的・範囲内', () => {
  const lines = ['a', 'b', 'c'];
  assert.equal(pickLine(lines, () => 0), 'a');
  assert.equal(pickLine(lines, () => 0.99), 'c');
  assert.equal(pickLine([], () => 0.5), '');
});
