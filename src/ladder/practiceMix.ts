import { KANJI, cardFaceReadings, formatKanjiReading, meaningIn } from '../data';
import flags from '../data/words/kanjiFacets.json';
import reps from '../data/words/kanjiDrillReps.json';
import similar from '../data/words/kanjiSimilar.json';
import { effectiveP, type ItemState } from '../engine/engine';
import { makeFormQuestion } from '../kanji/kanjiForm';
import { makeRecognitionQuestion } from '../kanji/kanjiRecognition';
import { buildKanjiQuiz, buildVocabQuiz, type LQItem, type LQQuestion } from '../listening/listeningQuiz';
import { facetsForUnit } from '../review/facetMap';
import type { MasterySlice } from '../review/facetMastery';
import type { SaveRef } from '../store/state';
import { levelListFor } from '../words/levelList';
import { buildDrill, type DrillKind, type DrillProblem } from './wordDrill';

export type PracticeChoice = {
  kind: 'practiceChoice';
  itemId: string;
  instruction: string;
  choices: string[];
  answerIndex: number;
  ref: SaveRef;
  prompt?: string;
  feedback?: string;
  audio?: LQQuestion;
};

export type PracticeProblem = DrillProblem | PracticeChoice;

export function practicePriority(mastery: MasterySlice, unit: string, now: number, itemProgress?: ItemState): number {
  const score = (progress?: ItemState) => progress
    ? effectiveP(progress, now) + (progress.dueAt <= now ? 0 : 2)
    : 1;
  const facets = facetsForUnit(unit).map(({ itemId, facet }) => score(mastery[itemId]?.[facet]));
  return facets.length ? Math.min(itemProgress ? score(itemProgress) : 3, ...facets) : score(itemProgress);
}

export function buildPracticeMix(
  level: 'N5' | 'N4' | 'N3', l1: Parameters<typeof meaningIn>[1],
  mastery: MasterySlice, now: number, items: Record<string, ItemState>, rng = Math.random,
): PracticeProblem[] {
  const priority = (id: string) => practicePriority(mastery, id, now, items[id]);
  const word = (kind: Exclude<DrillKind, 'mixed'>) =>
    buildDrill(kind, level, 5, Math.floor(rng() * 0xffff) + 1, priority)[0];

  const kanji = KANJI.filter(k => k.type === 'kanji' && k.level === level).map(k => ({
    id: k.id, char: k.char,
    meaning: meaningIn(k.char, l1) ?? k.meaning ?? '',
    meaningClear: (flags as Record<string, { meaningClear?: boolean }>)[k.char]?.meaningClear ?? false,
    readings: cardFaceReadings(k.char, level).map(r => ({ ...r, display: formatKanjiReading(k.char, r.reading, r.type) })),
  }));
  const kanjiAudio = kanji.flatMap(k => {
    const rep = (reps as Record<string, { level: string; bound: boolean; word: string; reading: string }>)[k.char];
    return rep?.reading ? [{ ...rep, id: k.id, char: k.char }] : [];
  });
  const vocabAudio = (levelListFor('vocab', level) as LQItem[])
    .filter(v => v.reading && v.word !== 'では' && !/[～~]/.test(v.word));
  const refFor = (id: string): SaveRef => ({ type: 'kanji', id });
  let focusChar: string | undefined;

  function choose<T extends { id: string; char?: string }>(
    pool: T[], unit: (item: T) => string, question: (item: T) => PracticeChoice | null,
    preferred?: (item: T) => boolean,
  ): PracticeChoice | undefined {
    const ranked = pool.map(item => ({
      item, score: priority(unit(item)), tie: rng(), preferred: preferred?.(item) ?? false,
    }));
    ranked.sort((a, b) => a.score - b.score || Number(b.preferred) - Number(a.preferred) || a.tie - b.tie);
    for (const { item } of ranked) {
      const q = question(item);
      if (q && q.choices.length === 4 && new Set(q.choices).size === 4 && q.answerIndex >= 0) return q;
    }
  }

  const recognize = (kind: 'mean' | 'read') => choose(kanji, k => `${k.char}#krecog_${kind}`, k => {
    const q = makeRecognitionQuestion(k, kanji, rng, kind);
    return q && {
      ...q, kind: 'practiceChoice', itemId: q.answerId, instruction: `krecog.prompt_${kind}`,
      prompt: k.char, ref: refFor(k.id),
    };
  }, k => kind === 'mean' ? kanjiAudio.some(a => a.char === k.char) && k.readings.length > 0 : k.char === focusChar);
  const mean = recognize('mean');
  focusChar = mean?.prompt;

  const listen = (kind: 'kanji' | 'vocab') => {
    const wrap = (audio: LQQuestion, ref: SaveRef): PracticeChoice => ({
      ...audio, kind: 'practiceChoice', itemId: audio.answerId, instruction: `listening2.prompt_${kind}`,
      audio, ref, feedback: audio.audioReading,
    });
    return kind === 'kanji'
      ? choose(kanjiAudio, k => k.char, k => wrap(buildKanjiQuiz([k], kanjiAudio, rng)[0], refFor(k.id)), k => k.char === focusChar)
      : choose(vocabAudio, v => v.id, v => wrap(buildVocabQuiz([v], vocabAudio, rng)[0], { type: 'vocab', id: v.id }));
  };
  const form = () => choose(kanji, k => `${k.char}#kdiscrim_form`, k => {
    const entry = (similar as Record<string, { formMakeable?: boolean; similar?: string[] }>)[k.char];
    if (!entry?.formMakeable || !entry.similar) return null;
    const reading = k.readings.find(r => r.type === 'kun') ?? k.readings[0];
    const hint = [k.meaning, reading?.display].filter(Boolean).join('　');
    const q = makeFormQuestion({ char: k.char, hint, similar: entry.similar }, rng);
    return q && { ...q, kind: 'practiceChoice', itemId: q.answerId, instruction: 'kform.prompt', prompt: hint, ref: refFor(k.id) };
  });

  return [
    mean, word('vMeaning'), word('gMeaning'),
    recognize('read'), word('vReading'), word('gBuild'),
    listen('kanji'), listen('vocab'), form(), word('vWriting'), word('vProduce'),
  ].filter((q): q is PracticeProblem => q !== undefined);
}
