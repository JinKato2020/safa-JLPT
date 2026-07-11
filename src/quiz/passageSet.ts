// 1文章＝複数設問の共通モデルと純関数。読解(reading.json)と文章の文法(passageGrammar.json)を統一。
export interface PassageBlock { title?: string; body: string; format?: string }
export interface SetQuestion { id: string; q?: string; blankNo?: number; choices: string[]; answerIndex: number; pointId?: string }
export interface PassageSet {
  id: string;
  level: 'N5' | 'N4' | 'N3';
  kind: 'reading' | 'passage_grammar';
  subtype?: string;
  passages: PassageBlock[];
  questions: SetQuestion[];
}

interface ReadingRaw { id: string; level: string; subtype?: string; format?: string; title?: string; body: string; questions: { id: string; q: string; choices: string[]; answerIndex: number }[] }

/** reading.json の1エントリを PassageSet に写像（データ改変なし）。 */
export function readingToSet(p: ReadingRaw): PassageSet {
  return {
    id: p.id,
    level: p.level as PassageSet['level'],
    kind: 'reading',
    subtype: p.subtype,
    passages: [{ title: p.title, body: p.body, format: p.format }],
    questions: p.questions.map((q) => ({ id: q.id, q: q.q, choices: q.choices, answerIndex: q.answerIndex })),
  };
}

/** 一括採点。answers[i]=選択index or null。全問回答済みで allAnswered。 */
export function gradeSet(answers: (number | null)[], questions: SetQuestion[]): { allAnswered: boolean; correct: boolean[]; correctCount: number } {
  const allAnswered = questions.length > 0 && answers.length === questions.length && answers.every((a) => a !== null);
  const correct = questions.map((q, i) => answers[i] === q.answerIndex);
  const correctCount = correct.filter(Boolean).length;
  return { allAnswered, correct, correctCount };
}
