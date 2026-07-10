// 単語タブの受容MC問題(4択)を実データ+distractorから組む。設計書 §2.1, §3.5。
// 産出系(かなタイル/完全並べ替え/書き取り)は別形式のため別モジュール。
import vocab from '../data/vocab.json';
import grammar from '../data/grammar.json';
import kanjiCards from '../data/kanjiCards.json';
import kanjiFacets from '../data/kanjiFacets.json';
import { Facet } from './mastery';
import { Candidate, inferPos, pickSimilar } from './distractor';
import { mulberry32 } from './rng';

export interface McProblem {
  itemId: string;
  facet: Facet;
  promptKind: 'audio' | 'kanji' | 'grammar'; // audio=読みを再生 / kanji=字を表示 / grammar=文法点を表示
  prompt: string;
  choices: string[];
  answerIndex: number;
}

// 正解+ダミーを seed で決定論シャッフルし、正解位置を返す。
function place(answer: string, distractors: string[], seed: number): { choices: string[]; answerIndex: number } {
  const rng = mulberry32(seed);
  const choices = [answer, ...distractors]
    .map((c) => ({ c, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.c);
  return { choices, answerIndex: choices.indexOf(answer) };
}

type V = { id: string; level: string; word: string; reading: string; meaning: string };
const VOCAB = vocab as V[];
type G = { id: string; level: string; point: string; meaning: string };
const GRAMMAR = grammar as G[];
const KANJI = kanjiCards as Record<string, { level: string; glossShort: string }>;
const FACETS = kanjiFacets as Record<string, { meaningClear: boolean }>;

// 語彙 音→意(受容): 🔊読み → 意味を4択。ダミー=同レベル・同品詞の意味。
export function vocabMeaningProblem(vId: string, seed = 1, n = 3): McProblem | null {
  const v = VOCAB.find((x) => x.id === vId);
  if (!v) return null;
  const pool: Candidate<string>[] = VOCAB
    .filter((x) => x.level === v.level && x.meaning !== v.meaning)
    .map((x) => ({ key: x.meaning, bucket: inferPos(x.meaning), item: x.meaning }));
  const distractors = pickSimilar(v.meaning, inferPos(v.meaning), pool, n, seed);
  return { itemId: v.id, facet: 'meaning', promptKind: 'audio', prompt: v.reading, ...place(v.meaning, distractors, seed) };
}

// 漢字 意味(受容・明快字のみ): 字 → 意味を4択。ダミー=同レベルの別字の意味。
export function kanjiMeaningProblem(ch: string, seed = 1, n = 3): McProblem | null {
  const card = KANJI[ch];
  if (!card || !FACETS[ch]?.meaningClear) return null; // bound字は意味問題を出さない
  const pool: Candidate<string>[] = Object.entries(KANJI)
    .filter(([c, k]) => c !== ch && k.level === card.level && FACETS[c]?.meaningClear && k.glossShort !== card.glossShort)
    .map(([, k]) => ({ key: k.glossShort, bucket: 'other', item: k.glossShort }));
  const distractors = pickSimilar(card.glossShort, 'other', pool, n, seed);
  return { itemId: `kanji:${ch}`, facet: 'kanji_meaning', promptKind: 'kanji', prompt: ch, ...place(card.glossShort, distractors, seed) };
}

// 文法 意味(受容・意味が言える点): 文法点 → 意味を4択。ダミー=同レベルの別文法点の意味。
export function grammarMeaningProblem(gId: string, seed = 1, n = 3): McProblem | null {
  const g = GRAMMAR.find((x) => x.id === gId);
  if (!g) return null;
  const pool: Candidate<string>[] = GRAMMAR
    .filter((x) => x.level === g.level && x.meaning !== g.meaning)
    .map((x) => ({ key: x.meaning, bucket: 'other', item: x.meaning }));
  const distractors = pickSimilar(g.meaning, 'other', pool, n, seed);
  return { itemId: g.id, facet: 'g_meaning', promptKind: 'grammar', prompt: g.point, ...place(g.meaning, distractors, seed) };
}
