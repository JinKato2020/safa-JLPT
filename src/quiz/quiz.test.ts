// 診断クイズ出題ロジックの単体テスト。実行: node --import tsx --test src/quiz/quiz.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasKanji, makeQuestion, buildQueue, reinsertForRelearn, dueStats, sample, type Rng } from './quiz.ts';
import type { VocabItem, GrammarItem, StudyItem } from '../data/index.ts';
import { newItemState, type ItemState } from '../engine/engine.ts';

const T0 = 1_700_000_000_000;

// 決定的な疑似乱数(テスト再現用)
function mulberry32(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vocab(id: string, word: string, reading: string, meaning: string): VocabItem {
  return { id, level: 'N4', category: 'moji_goi', type: 'vocab', word, reading, meaning, tags: [] };
}

const VPOOL: VocabItem[] = [
  vocab('v1', '会う', 'あう', 'to meet, to see'),
  vocab('v2', '書く', 'かく', 'to write'),
  vocab('v3', '読む', 'よむ', 'to read'),
  vocab('v4', '見る', 'みる', 'to see, to look'),
  vocab('v5', 'ありがとう', 'ありがとう', 'thank you'),
];

test('hasKanji: 漢字を含むか判定', () => {
  assert.equal(hasKanji('会う'), true);
  assert.equal(hasKanji('ありがとう'), false);
});

// 形式集合(多様化の確認)
function formatsOf(item: StudyItem, pool: StudyItem[], n = 40): Set<string> {
  const set = new Set<string>();
  for (let s = 1; s <= n; s++) set.add(makeQuestion(item, pool, mulberry32(s)).format);
  return set;
}

test('makeQuestion: どの形式でも整形式(4択・重複なし・正解index有効)', () => {
  for (const item of VPOOL) {
    for (let s = 1; s <= 20; s++) {
      const q = makeQuestion(item, VPOOL, mulberry32(s));
      assert.equal(q.choices.length, 4, item.word);
      assert.equal(new Set(q.choices).size, 4, '重複なし: ' + item.word);
      assert.ok(q.choices.includes(q.choices[q.answerIndex]), '正解indexが有効');
    }
  }
});

test('makeQuestion(漢字語): 複数形式で出題され多様化する', () => {
  const fmts = formatsOf(VPOOL[0], VPOOL); // 会う
  assert.ok(fmts.size >= 2, '会うは複数形式: ' + [...fmts].join(','));
  assert.ok([...fmts].every((f) => ['reading', 'meaning', 'reverse', 'cloze'].includes(f)), '語彙の形式のみ');
});

test('makeQuestion(かな語): 読み問題は出ない(漢字なし)', () => {
  const fmts = formatsOf(VPOOL[4], VPOOL); // ありがとう
  assert.ok(!fmts.has('reading'), 'かな語に読み問題なし');
  assert.ok([...fmts].every((f) => ['meaning', 'reverse', 'cloze'].includes(f)));
});

test('makeQuestion(文法): usage/reverse 等で出題', () => {
  const g: GrammarItem = { id: 'g1', level: 'N4', category: 'bunpou', type: 'grammar', point: '〜なければならない', romaji: 'nakereba naranai', meaning: 'must, have to', exampleJa: '', exampleEn: '' };
  const g2: GrammarItem = { ...g, id: 'g2', point: '〜てもいい', meaning: 'may, it is ok to' };
  const fmts = formatsOf(g, [g, g2]);
  assert.ok([...fmts].every((f) => ['usage', 'reverse', 'cloze'].includes(f)), '文法の形式のみ: ' + [...fmts].join(','));
  assert.ok(fmts.has('usage') || fmts.has('reverse'));
});

test('makeQuestion(文法): 穴埋め対象外(GRAMMAR_CLOZE_OK外)の文法はcloze不生成', () => {
  // g1 は判定ホワイトリストに無い合成ID → clozeは出ない(曖昧出題の抑止)
  const g: GrammarItem = { id: 'g1', level: 'N4', category: 'bunpou', type: 'grammar', point: '〜たほうがいい', romaji: '', meaning: 'had better', exampleJa: '傘（かさ）を持（も）っていったほうがいい。', exampleEn: '' };
  for (let s = 1; s <= 50; s++) {
    const q = makeQuestion(g, [g], mulberry32(s));
    assert.notEqual(q.format, 'cloze', '非対象の文法でclozeは生成しない');
  }
});

test('sample: 重複なく最大n件を抽出', () => {
  const out = sample(VPOOL, 3, mulberry32(5));
  assert.equal(out.length, 3);
  assert.equal(new Set(out.map((i) => i.id)).size, 3, '重複なし');
  assert.ok(out.every((i) => VPOOL.includes(i)), '元配列の要素');
  assert.equal(sample(VPOOL, 99, mulberry32(5)).length, VPOOL.length, 'n>len は全件');
});

test('賢い誤答(読み形式): 正解に似た候補を選び、極端に違う候補は外す', () => {
  const target = vocab('t', '会う', 'あう', 'to meet');
  const shorts = ['かう', 'いう', 'かく', 'よむ', 'みる', 'のむ', 'きく', 'すう', 'まう', 'ぬう']
    .map((rd, i) => vocab('s' + i, '見' + i, rd, 'm' + i));
  const longv = vocab('L', '挨', 'ありがとうございます', 'thanks');
  const pool = [target, ...shorts, longv];
  let q: ReturnType<typeof makeQuestion> | null = null;
  for (let s = 1; s <= 80 && !q; s++) {
    const t = makeQuestion(target, pool, mulberry32(s));
    if (t.format === 'reading') q = t;
  }
  assert.ok(q, 'reading形式が出る');
  assert.equal(new Set(q!.choices).size, 4, '4択・重複なし');
  assert.ok(q!.choices.includes('あう'), '正解を含む');
  assert.ok(!q!.choices.includes('ありがとうございます'), '極端に長い候補は似てる上位プールから外れる');
});

test('buildQueue: 期限切れ(learning優先) → 未測定 の順で最大n件', () => {
  const states: Record<string, ItemState> = {
    v1: { ...newItemState(T0), reps: 3, dueAt: T0 - 1000 }, // due(学習済)
    v2: { ...newItemState(T0), reps: 0, dueAt: T0 - 2000 }, // due(再学習) → 先頭
    v3: { ...newItemState(T0), reps: 2, dueAt: T0 + 99999 }, // まだ先(除外)
  };
  const q = buildQueue(VPOOL, states, T0, 3, mulberry32(7));
  assert.equal(q[0].id, 'v2', '再学習(reps0)が最優先');
  assert.ok(q.slice(0, 2).map((i) => i.id).includes('v1'), 'due が未測定より先');
  assert.equal(q.length, 3);
  assert.ok(!q.some((i) => i.id === 'v3'), '未到来は出さない');
});

test('reinsertForRelearn: gap問後に差し込む', () => {
  const rest: StudyItem[] = [VPOOL[1], VPOOL[2], VPOOL[3]];
  const out = reinsertForRelearn(rest, VPOOL[0], 2);
  assert.equal(out[2].id, 'v1', '2問後に再挿入');
  assert.equal(out.length, 4);
});

test('dueStats: 復習(期限切れ)/新規(未測定)/習得済 を数える', () => {
  const states: Record<string, ItemState> = {
    v1: { ...newItemState(T0), p: 0.7, dueAt: T0 - 1000 }, // 期限切れ かつ 習得済
    v2: { ...newItemState(T0), p: 0.2, dueAt: T0 - 1000 }, // 期限切れ だが 未習得
    v3: { ...newItemState(T0), p: 0.8, dueAt: T0 + 99999 }, // 未到来 だが 習得済
    // v4, v5 は state なし → 新規
  };
  const st = dueStats(VPOOL, states, T0);
  assert.equal(st.total, 5);
  assert.equal(st.due, 2, 'v1,v2 が期限切れ');
  assert.equal(st.fresh, 2, 'v4,v5 が未測定');
  assert.equal(st.learned, 2, 'v1,v3 が習得済');
});
