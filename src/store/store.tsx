// アプリ状態ストア: Context + useReducer + AsyncStorage 永続化。
// エンジン(習得更新/SRS/客観クイズ)と streak ロジックを統合する単一の真実。
import {
  createContext, useContext, useEffect, useReducer, useState,
  type Dispatch, type ReactNode,
} from 'react';
import { newItemState, recordQuiz, recordMock, effectiveP } from '../engine/engine';
import { type AppState, type Settings, type MockResult, type SaveRef, INITIAL_STATE, dayStr, toggleMyList, withUpdatedAt } from './state';
import { readinessFor } from './selectors';
import { recordAnswer, sendEvent } from '../telemetry/telemetry';
import { applyStudyDay } from './streak';
import { loadState, saveState, clearState } from './storage';
import { applyKakitoriProgress } from '../kakitori/progress';

type Action =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'QUIZ_ANSWER'; itemId: string; correct: boolean; now: number }
  | { type: 'MOCK_ANSWER'; itemId: string; correct: boolean; now: number }
  | { type: 'RECORD_MOCK'; result: MockResult }
  | { type: 'KAKITORI_PROGRESS'; char: string; step: number; score: number; skipped?: boolean; now?: number }
  | { type: 'ADD_TO_MY_LIST'; ref: SaveRef }
  | { type: 'ADD_STUDY_SECONDS'; sec: number }
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
  const passProb = readinessFor(state, now).passProbability; // その日時点の合格率(推移グラフ用)
  const prev = state.growth ?? [];
  const last = prev[prev.length - 1];
  const point = { day, learned, passProb };
  const growth = last && last.day === day
    ? [...prev.slice(0, -1), point] // 同日は最新値で上書き
    : [...prev, point];
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
      // バンクの合成項目(kb-*=用法/組み立て/文章/cloze)はSRS/evidenceに記録しない。
      // 採点(模試pct)はMockScreenのローカル集計で別途行う。記録すると到達度の分母外なのにevidenceだけ水増しし、
      // 大リングの信頼幅±が不当に狭くなる(過信)＋storage肥大するため除外。学習日(streak)だけは反映。
      if (action.itemId.startsWith('kb-')) return withStudyDay(state, action.now);
      const prev = state.items[action.itemId] ?? newItemState(action.now);
      const next = recordMock(prev, action.correct, action.now);
      return withStudyDay({ ...state, items: { ...state.items, [action.itemId]: next } }, action.now);
    }
    case 'RECORD_MOCK':
      return { ...state, mockHistory: [...(state.mockHistory ?? []), action.result].slice(-60) };
    case 'KAKITORI_PROGRESS': {
      const map = state.kakitori ?? {};
      return { ...state, kakitori: { ...map, [action.char]: applyKakitoriProgress(map[action.char], action) } };
    }
    case 'ADD_TO_MY_LIST':
      return { ...state, myList: toggleMyList(state.myList ?? [], action.ref) };
    case 'ADD_STUDY_SECONDS':
      return { ...state, studySeconds: (state.studySeconds ?? 0) + Math.max(0, Math.round(action.sec)) };
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

  // 変更を永続化(復元前は保存しない=初期値で上書きしない)。保存の都度 updatedAt を刻む(同期のLWW基準)。
  useEffect(() => {
    if (hydrated) saveState(withUpdatedAt(state, Date.now()));
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
    setSettings: (patch: Partial<Settings>) => { void sendEvent('setting_changed', patch as Record<string, unknown>); dispatch({ type: 'SET_SETTINGS', patch }); },
    quizAnswer: (itemId: string, correct: boolean) => {
      recordAnswer(itemId, correct); // 全回答を匿名記録(問題別正答率の資源化)
      dispatch({ type: 'QUIZ_ANSWER', itemId, correct, now: Date.now() });
    },
    mockAnswer: (itemId: string, correct: boolean) => {
      recordAnswer(itemId, correct);
      dispatch({ type: 'MOCK_ANSWER', itemId, correct, now: Date.now() });
    },
    recordMockResult: (result: MockResult) => dispatch({ type: 'RECORD_MOCK', result }),
    recordKakitori: (char: string, step: number, score: number, opts?: { skipped?: boolean; now?: number }) =>
      dispatch({ type: 'KAKITORI_PROGRESS', char, step, score, skipped: opts?.skipped, now: opts?.now }),
    addToMyList: (ref: SaveRef) => dispatch({ type: 'ADD_TO_MY_LIST', ref }),
    addStudySeconds: (sec: number) => dispatch({ type: 'ADD_STUDY_SECONDS', sec }),
    hydrate: (s: AppState) => dispatch({ type: 'HYDRATE', state: s }),
    reset: () => {
      clearState();
      dispatch({ type: 'RESET' });
    },
  };
}
