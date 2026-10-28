const EXAM_SCREENS = new Set(['Quiz', 'Reading', 'PassageGrammar', 'Listening']);
const PRACTICE_SCREENS = new Set(['WordDrill', 'KanjiForm', 'KanjiRecognition', 'ListeningQuiz', 'Kakitori']);

export function studySessionSource(screen: string): 'exam' | 'practice' | null {
  return EXAM_SCREENS.has(screen) ? 'exam' : PRACTICE_SCREENS.has(screen) ? 'practice' : null;
}

/** One route instance is one set, even if effects run again or the app resumes. */
export function createStudySessionRecorder(send: (props: Record<string, unknown>, level: string) => void) {
  let recorded = false;
  return (screen: string, sessionId: string, level: string, allowed: boolean) => {
    const source = studySessionSource(screen);
    if (recorded || !allowed || !source) return;
    recorded = true;
    send({ sessionId, screen, source, definition: 'set_start_v1' }, level);
  };
}
