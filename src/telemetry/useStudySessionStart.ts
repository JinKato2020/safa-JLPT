import { useEffect, useRef } from 'react';
import { useRoute } from '@react-navigation/native';
import { useAppState } from '../store/store';
import { sendEvent } from './telemetry';
import { createStudySessionRecorder } from './studySession';

export function useStudySessionStart(allowed: boolean): void {
  const route = useRoute();
  const state = useAppState();
  const recorder = useRef<ReturnType<typeof createStudySessionRecorder> | null>(null);
  if (!recorder.current) recorder.current = createStudySessionRecorder((props, level) => {
    void sendEvent('study_set_start', props, level);
  });
  useEffect(() => {
    if (state.settings.telemetry === false) return;
    recorder.current!(route.name, route.key, state.settings.level, allowed);
  }, [allowed, route.name, route.key, state.settings.level, state.settings.telemetry]);
}
