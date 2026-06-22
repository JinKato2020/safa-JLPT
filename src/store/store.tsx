// アプリ状態ストア: Context + useReducer + AsyncStorage 永続化。
// エンジン(習得更新/SRS/客観クイズ)と streak ロジックを統合する単一の真実。
import {
  createContext, useContext, useEffect, useReducer, useState,
  type Dispatch, type ReactNode,
} from 'react';
import { newItemState, recordQuiz, recordMock, effectiveP } from '../engine/engine';
import { type AppState, type Settings, type MockResult, INITIAL_STATE, dayStr } from './state';
import { applyStudyDay } from './streak';
import { loadState, saveState, clearState } from './storage';

type Action =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'QUIZ_ANSWER'; itemId: string; correct: boolean; now: number }
  | { type: 'MOCK_ANSWER'; itemId: string; correct: boolean; now: number }
  | { type: 'RECORD_MOCK'; result: MockResult }
  | { type: 'RESET' };

function countLearned(items: AppState['items'], now: number): number {
  let n = 0;
  for (const it of Object.values(items)) if (effectiveP(it, now) >= 0.6) n++;
  return n;
}

function withStudyDay(state: AppState, now: number): AppState {
  const day = dayStr(now);
  const streak = applyStudyDay(state.streak, day);
  const learned = countLearned(state.items, now);
  const prev = state.growth ?? [];
  const last = prev[prev.length - 1];
  const growth = last && last.day === day
    ? [...prev.slice(0, -1), { day, learned }] // 同日は最新値で上書き
    : [...prev, { day, learned }];
  return { ...state, streak, growth };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'QUIZ_ANSWER': {
      const prev = state.items[action.itemId] ?? newItemState(action.now);
      const next = recordQuiz(prev, action.correct, action.now);
      return withStudyDay({ ...state, items: { ...state.items, [action.itemId]: next } }, action.now);
    }
    case 'MOCK_ANSWER': {
      const prev = state.items[action.itemId] ?? newItemState(action.now);
      const next = recordMock(prev, action.correct, action.now);
      return withStudyDay({ ...state, items: { ...state.items, [action.itemId]: next } }, action.now);
    }
    case 'RECORD_MOCK':
      return { ...state, mockHistory: [...(state.mockHistory ?? []), action.result].slice(-60) };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

const StateCtx = createContext<AppState>(INITIAL_STATE);
const DispatchCtx = createContext<Dispatch<Action>>(() => undefined);
const HydratedCtx = createContext<boolean>(false);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  // 起動時に永続状態を復元
  useEffect(() => {
    (async () => {
      const saved = await loadState();
      if (saved) dispatch({ type: 'HYDRATE', state: saved });
      setHydrated(true);
    })();
  }, []);

  // 変更を永続化(復元前は保存しない=初期値で上書きしない)
  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>
        <HydratedCtx.Provider value={hydrated}>{children}</HydratedCtx.Provider>
      </DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useAppState(): AppState {
  return useContext(StateCtx);
}

export function useHydrated(): boolean {
  return useContext(HydratedCtx);
}

export function useAppActions() {
  const dispatch = useContext(DispatchCtx);
  return {
    setSettings: (patch: Partial<Settings>) => dispatch({ type: 'SET_SETTINGS', patch }),
    quizAnswer: (itemId: string, correct: boolean) =>
      dispatch({ type: 'QUIZ_ANSWER', itemId, correct, now: Date.now() }),
    mockAnswer: (itemId: string, correct: boolean) =>
      dispatch({ type: 'MOCK_ANSWER', itemId, correct, now: Date.now() }),
    recordMockResult: (result: MockResult) => dispatch({ type: 'RECORD_MOCK', result }),
    reset: () => {
      clearState();
      dispatch({ type: 'RESET' });
    },
  };
}
