// 単語タブの受容MC問題(4択)を実データ+distractorから組む。設計書 §2.1, §3.5。
// 産出系(かなタイル/完全並べ替え/書き取り)は別形式のため別モジュール。
import vocab from '../data/shared/vocab.json';
import grammar from '../data/shared/grammar.json';
import kanjiCards from '../data/words/kanjiCards.json';
import kanjiFacets from '../data/words/kanjiFacets.json';
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

// 語彙 読み認識(受容): 語(表記) → 読みを4択。かな語(word===reading)は表記=答えのため出題不可。
//   ダミー=同レベルの別語の読み。モーラ数(粗い長さ)が同じ読みを優先=紛らわしさ。全て純かな。
export function vocabReadingProblem(vId: string, seed = 1, n = 3): McProblem | null {
  const v = VOCAB.find((x) => x.id === vId);
  if (!v || v.word === v.reading) return null; // かな語=表記が答えそのもの
  const isKana = (r: string) => /^[ぁ-ゖー]+$/.test(r);
  if (!isKana(v.reading)) return null;
  const len = (r: string) => [...r].length;
  const pool: Candidate<string>[] = VOCAB
    .filter((x) => x.level === v.level && x.reading !== v.reading && isKana(x.reading))
    .map((x) => ({ key: x.reading, bucket: String(len(x.reading)), item: x.reading }));
  const distractors = pickSimilar(v.reading, String(len(v.reading)), pool, n, seed);
  if (distractors.length < n) return null; // ダミー不足=出題しない(4択を割らない)
  return { itemId: v.id, facet: 'on', promptKind: 'kanji', prompt: v.word, ...place(v.reading, distractors, seed) };
}

// 語彙 表記認識(受容・かたち): 意味 → 正しい漢字表記の単語を4択。文脈なし＝表記大問より難しい。
//   漢字を含む語のみ(かな語は綴りが無い)。ダミー=同レベルの別漢字語の表記で、同音異字(同じ読み・別表記)を最優先
//   ＝綴りの弁別になる。プロンプト=意味(語を一意特定・読みだけだと暑い/熱い/厚い等の同音異字で非一意になるため)。
export function vocabWritingProblem(vId: string, seed = 1, n = 3): McProblem | null {
  const v = VOCAB.find((x) => x.id === vId);
  if (!v || v.word === v.reading || !/[一-龥々〆ヶ]/.test(v.word)) return null; // かな語/漢字なし=綴りが無い
  const pool: Candidate<string>[] = VOCAB
    .filter((x) => x.level === v.level && x.id !== v.id && x.word !== v.word && x.meaning !== v.meaning
      && /[一-龥々〆ヶ]/.test(x.word) && !/[～~]/.test(x.word)) // 束縛形態素(～付き)はダミーに使わない
    .map((x) => ({ key: x.word, bucket: x.reading === v.reading ? 'homophone' : 'other', item: x.word }));
  const distractors = pickSimilar(v.word, 'homophone', pool, n, seed); // 同音異字を優先
  if (distractors.length < n) return null; // ダミー不足=出題しない(4択を割らない)
  return { itemId: v.id, facet: 'kanji_write', promptKind: 'grammar', prompt: v.meaning, ...place(v.word, distractors, seed) };
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
