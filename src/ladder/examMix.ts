import type { meaningIn } from '../data';
import { daimonUnitIds, questionForUnit, MOJI_DAIMON, BUNPOU_DAIMON } from '../data/daimon';
import type { Level } from '../engine/engine';
import { sample, type Question, type Rng } from '../quiz/quiz';
import type { AppState } from '../store/state';
import { practicePriority, buildPracticeMix, type PracticeProblem } from './practiceMix';

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

function examCandidates(level: Level, progress: Progress, now: number, rng: Rng): ExamProblem[] {
  const problems: ExamProblem[] = [];
  for (const format of examFormats(level, rng)) {
    const ranked = format.map(candidate => ({ candidate, score: unitPriority(progress, candidate.id, now), tie: rng() }));
    ranked.sort((a, b) => a.score - b.score || a.tie - b.tie);
    for (const { candidate } of ranked) {
      const problem = candidate.make();
      if (problem && problem.question.choices[problem.question.answerIndex]) {
        problems.push(problem);
        break;
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

function practiceFamily(p: PracticeProblem) {
  if (p.kind === 'practiceChoice') return p.ref.type;
  return p.kind.startsWith('g') ? 'grammar' : 'vocab';
}

export function buildWeaknessMix(
  level: Level, l1: Parameters<typeof meaningIn>[1], progress: Progress, now: number, rng = Math.random,
): MixedProblem[] {
  const select = <T extends MixedProblem>(problems: T[], family: (p: T) => string) => {
    const sorted = sample(problems, problems.length, rng).sort((a, b) =>
      unitPriority(progress, a.itemId, now) - unitPriority(progress, b.itemId, now));
    const covered = new Set<string>();
    const varied = sorted.filter(p => {
      const group = family(p);
      if (covered.has(group)) return false;
      covered.add(group);
      return true;
    });
    const selected = new Set(varied);
    return shuffleFamilies([...varied, ...sorted.filter(p => !selected.has(p))].slice(0, 5), family, rng);
  };
  const exam = select(examCandidates(level, progress, now, rng), p => p.family);
  const practice = select(buildPracticeMix(level, l1, progress.mastery ?? {}, now, progress.items, rng), practiceFamily);
  const groups = rng() < 0.5 ? [exam, practice] : [practice, exam];
  return Array.from({ length: Math.max(exam.length, practice.length) }, (_, i) =>
    groups.flatMap(group => group[i] ? [group[i]] : [])).flat();
}
