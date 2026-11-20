import { VOCAB, GRAMMAR, KANJI, allItemIdsFor, READING_MOCK, LISTENING_MOCK, type meaningIn } from '../data';
import { SIGNAL_WEIGHT } from '../engine/engine';
import { daimonUnitIds, questionForUnit, mockUnitIds, MOJI_DAIMON, BUNPOU_DAIMON } from '../data/daimon';
import type { Level } from '../engine/engine';
import { sample, type Question, type Rng } from '../quiz/quiz';
import type { AppState } from '../store/state';
import { practicePriority, practiceCandidates, practiceFamily, type PracticeProblem } from './practiceMix';

type Progress = Pick<AppState, 'items' | 'mastery'>;
export type ExamProblem = {
  kind: 'examChoice';
  itemId: string;
  family: 'vocab' | 'grammar';
  question: Question;
};

type Candidate = { id: string; make: () => ExamProblem | null };

function examFormats(level: Level, rng: Rng): Candidate[][] {
  return [...MOJI_DAIMON, ...BUNPOU_DAIMON.filter(d => d !== 'passage_grammar')].map(daimon =>
    daimonUnitIds(level, daimon, 'learn').map(id => ({
      id,
      make: (): ExamProblem | null => {
        const question = questionForUnit(id, rng);
        return question && { kind: 'examChoice', itemId: id, family: MOJI_DAIMON.includes(daimon) ? 'vocab' : 'grammar', question };
      },
    })),
  );

}

function unitPriority(progress: Progress, id: string, now: number) {
  return practicePriority(progress.mastery ?? {}, id, now, progress.items[id]);
}

function examCandidates(level: Level, progress: Progress, now: number, rng: Rng, perFormat = 1): ExamProblem[] {
  const problems: ExamProblem[] = [];
  for (const format of examFormats(level, rng)) {
    const ranked = format.map(candidate => ({ candidate, score: unitPriority(progress, candidate.id, now), tie: rng() }));
    ranked.sort((a, b) => a.score - b.score || a.tie - b.tie);
    let added = 0;
    for (const { candidate } of ranked) {
      const problem = candidate.make();
      if (problem && problem.question.choices[problem.question.answerIndex]) {
        problems.push(problem);
        if (++added === perFormat) break;
      }
    }
  }
  return problems;
}

function shuffleFamilies<T>(problems: T[], family: (p: T) => string, rng: Rng): T[] {
  const remaining = sample(problems, problems.length, rng);
  const result: T[] = [];
  while (remaining.length) {
    const previous = result.at(-1);
    const counts = new Map<string, number>();
    for (const problem of remaining) {
      const key = family(problem);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const mustAlternate = [...counts].find(([, count]) => count > remaining.length / 2)?.[0];
    const different = (p: T) => !previous || family(p) !== family(previous);
    const next = remaining.findIndex(p => different(p) && (!mustAlternate || family(p) === mustAlternate));
    const fallback = next < 0 ? remaining.findIndex(different) : next;
    result.push(remaining.splice(Math.max(fallback, 0), 1)[0]);
  }
  return result;
}

export function buildExamMix(level: Level, progress: Progress, now: number, rng = Math.random): ExamProblem[] {
  return shuffleFamilies(examCandidates(level, progress, now, rng), p => p.family, rng);
}

export type MixedProblem = PracticeProblem | ExamProblem;

// Infer past tab usage from graded units in this level, including repeated answers.
function examShare(level: Level, items: Progress['items']) {
  const examIds = new Set([
    ...[...MOJI_DAIMON, ...BUNPOU_DAIMON].flatMap(d => [...daimonUnitIds(level, d), ...mockUnitIds(level, d)]),
    ...[...READING_MOCK, ...LISTENING_MOCK].filter(i => i.level === level).flatMap(i => i.questions.map(q => q.id)),
    ...allItemIdsFor(level, 'dokkai'), ...allItemIdsFor(level, 'choukai'),
  ]);
  const practiceIds = new Set([...VOCAB, ...GRAMMAR, ...KANJI].filter(i => i.level === level)
    .flatMap(i => i.type === 'kanji' ? [i.id, i.char] : [i.id]));
  let exam = 0;
  let practice = 0;
  for (const [id, item] of Object.entries(items)) {
    // Mock grading records only the first encounter, so at most one mock weight is present.
    const mock = item.evidence >= SIGNAL_WEIGHT.mock && item.evidence % SIGNAL_WEIGHT.practice === SIGNAL_WEIGHT.mock % SIGNAL_WEIGHT.practice;
    const total = mock ? 1 + (item.evidence - SIGNAL_WEIGHT.mock) / SIGNAL_WEIGHT.practice : item.evidence / SIGNAL_WEIGHT.practice;
    const attempts = Math.max(0, Math.round(total) - (item.weaknessAnswers ?? 0));
    if (examIds.has(id)) exam += attempts;
    else {
      const [base, facet] = id.split('#');
      if (practiceIds.has(base) && (!facet || /^(krecog_mean|krecog_read|kdiscrim_form|produce|gbuild|gmeaning|vrecog_mean|vrecog_read|vrecog_write)$/.test(facet))) practice += attempts;
    }
  }
  return exam + practice ? exam / (exam + practice) : 0.5;
}

export function buildWeaknessMix(
  level: Level, l1: Parameters<typeof meaningIn>[1], progress: Progress, now: number, rng = Math.random,
): MixedProblem[] {
  const examCount = Math.round(10 * examShare(level, progress.items));
  const byPriority = (a: MixedProblem, b: MixedProblem) =>
    unitPriority(progress, a.itemId, now) - unitPriority(progress, b.itemId, now);
  const take = <T extends MixedProblem>(pool: T[], count: number, family: (p: T) => string) => {
    const ranked = sample(pool, pool.length, rng).sort(byPriority);
    const seen = new Set<string>();
    const first = ranked.filter(p => {
      if (seen.has(family(p))) return false;
      seen.add(family(p));
      return true;
    });
    return [...first, ...ranked.filter(p => !first.includes(p))].slice(0, count);
  };
  const exam = examCount ? examCandidates(level, progress, now, rng, examCount > (level === 'N5' ? 6 : 7) ? 2 : 1) : [];
  const practice = practiceCandidates(level, l1, progress.mastery ?? {}, now, progress.items, rng);
  const selectedExam = take(exam, Math.max(examCount, 10 - practice.length), p => p.family);
  const picked: MixedProblem[] = [...selectedExam, ...take(practice, 10 - selectedExam.length, practiceFamily)];
  return sample(picked, picked.length, rng);
}
