import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudySessionRecorder } from './studySession';

test('a set counts at admission, even without any answers or completion', () => {
  const events: unknown[] = [];
  const record = createStudySessionRecorder((props, level) => events.push({ props, level }));
  record('Quiz', 'set-1', 'N3', false); // blocked by quota
  assert.equal(events.length, 0);
  record('Quiz', 'set-1', 'N3', true);
  record('Quiz', 'set-1', 'N3', true); // rerender, focus/resume, StrictMode
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { props: { sessionId: 'set-1', screen: 'Quiz', source: 'exam', definition: 'set_start_v1' }, level: 'N3' });
  createStudySessionRecorder((p) => events.push(p))('Quiz', 'set-2', 'N3', true);
  assert.equal(events.length, 2); // starting a new set counts again
});

test('all question screens count; mock exams and passive browsing do not', () => {
  for (const screen of ['Quiz', 'Reading', 'PassageGrammar', 'Listening', 'WordDrill', 'KanjiForm', 'KanjiRecognition', 'ListeningQuiz', 'Kakitori']) {
    const events: unknown[] = [];
    createStudySessionRecorder(p => events.push(p))(screen, screen, 'N5', true);
    assert.equal(events.length, 1, screen);
  }
  for (const screen of ['Mock', 'Flashcard', 'WordsHome', 'Dictionary', 'PosterAudio', 'Home']) {
    const events: unknown[] = [];
    createStudySessionRecorder(p => events.push(p))(screen, screen, 'N5', true);
    assert.equal(events.length, 0, screen);
  }
});
