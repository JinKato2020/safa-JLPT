// アプリ状態ストア: Context + useReducer + AsyncStorage 永続化。
// エンジン(習得更新/SRS/客観クイズ)と streak ロジックを統合する単一の真実。
import {
  createContext, useContext, useEffect, useReducer, useState,
  type Dispatch, type ReactNode,
} from 'react';
import { newItemState, recordQuiz, recordMock, effectiveP } from '../engine/engine';
import { type Settings, type MockResult, type SaveRef, INITIAL_STATE, dayStr, toggleMyList, withUpdatedAt } from './state';
export type { AppState } from './state';
import type { AppState } from './state';
import { readinessFor } from './selectors';
import { recordAnswer, sendEvent } from '../telemetry/telemetry';
import { applyStudyDay } from './streak';
import { loadState, saveState, clearState } from './storage';
import { applyKakitoriProgress } from '../kakitori/progress';
import { recordFacet } from '../review/facetMastery';
import { facetsForUnit, facetsForKakitori } from '../review/facetMap';
import { addPoints as walletAdd, awardOnce as walletAwardOnce, buy as walletBuy, equip as walletEquip, buyAvatarDrink as walletBuyAvatarDrink, spendAvatarChange as walletSpendAvatarChange, type ShopKind } from './wallet';
import { syncMockTickets, buyMockTicket as ticketBuy, spendMockTicket } from './tickets';
import { consumeSession as quotaConsume, grantAdBonus as quotaAdBonus } from '../pro/dailyQuota';
import { setPurchaseActive as proSetPurchase, grantProDays as proGrantDays } from '../pro/entitlement';
import { recordDecay } from '../story/decay';
import { recordQualifyingDay } from '../referral/trigger';

type Action =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'QUIZ_ANSWER'; itemId: string; correct: boolean; now: number }
  | { type: 'MOCK_ANSWER'; itemId: string; correct: boolean; now: number }
  | { type: 'RECORD_MOCK'; result: MockResult }
  | { type: 'KAKITORI_PROGRESS'; char: string; step: number; score: number; skipped?: boolean; now?: number }
  | { type: 'ADD_TO_MY_LIST'; ref: SaveRef }
  | { type: 'ADD_STUDY_SECONDS'; sec: number }
  | { type: 'ADD_POINTS'; amount: number; now: number; cap?: boolean }
  | { type: 'AWARD_ONCE'; key: string; amount: number }
  | { type: 'BUY_ITEM'; item: { id: string; price: number }; now: number }
  | { type: 'EQUIP_ITEM'; item: { id: string; kind: ShopKind } }
  | { type: 'SYNC_TICKETS'; now: number }
  | { type: 'BUY_TICKET'; now: number }
  | { type: 'SPEND_TICKET'; now: number }
  | { type: 'BUY_AVATAR_DRINK'; now: number }
  | { type: 'SPEND_AVATAR_CHANGE'; now: number }
  | { type: 'CONSUME_SESSION'; now: number }
  | { type: 'GRANT_AD_BONUS'; now: number }
  | { type: 'SET_PURCHASE_ACTIVE'; active: boolean; now: number }
  | { type: 'GRANT_PRO_DAYS'; days: number; now: number }
  | { type: 'MARK_STORY_SHOWN'; id: string; now: number; skipped?: boolean }
  | { type: 'SET_COMPLETED'; day: string; qualifying: boolean }
  | { type: 'SET_ENTERED_CODE'; code: string }
  | { type: 'SET_REFERRAL_STATS'; qualified: number }
  | { type: 'MARK_UNLOCK_SEEN'; key: string }
  | { type: 'SEED_UNLOCKS_SEEN'; keys: string[] }
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

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'QUIZ_ANSWER': {
      const prev = state.items[action.itemId] ?? newItemState(action.now);
      // 漢字読み/表記は答えが一つで暗記懸念が薄い→不正解は即再出題OK。他大問(文脈/用法/文法等)は翌日以降(ユーザー要望2026-07-17)。
      const immediate = action.itemId.endsWith('#kanji_read') || action.itemId.endsWith('#orthography');
      const next = recordQuiz(prev, action.correct, action.now, immediate);
      // 面別マスタリーへも合流(additive・従来のitems記録は維持)。統合復習/予想得点の正本。
      const mastery = recordFacet(state.mastery ?? {}, facetsForUnit(action.itemId), action.correct, 'practice', action.now);
      const withDay = withStudyDay({ ...state, items: { ...state.items, [action.itemId]: next }, mastery }, action.now);
      // 1問正解=2貝は quizAnswer 側の ADD_POINTS で付与(MOCK_ANSWERと同経路)。ここで足すと二重取りになるため学習日の記録だけ返す。
      return withDay;
    }
    case 'MOCK_ANSWER': {
      // 模試は「その項目が初見(state.itemsに無い)のときだけ」evidenceに記録(初見保証で正当=模試は常に初見プール)。
      // 既出(万一の再出題)は学習日のみ→暗記/再出題の水増しを防ぐ。台帳/非台帳(kb-/usg-/moji)を問わず統一。
      if (state.items[action.itemId]) return withStudyDay(state, action.now);
      const next = recordMock(newItemState(action.now), action.correct, action.now);
      // 面へも合流(初見時のみ=itemsと同条件。mockは重み5)。
      const mastery = recordFacet(state.mastery ?? {}, facetsForUnit(action.itemId), action.correct, 'mock', action.now);
      return withStudyDay({ ...state, items: { ...state.items, [action.itemId]: next }, mastery }, action.now);
    }
    case 'RECORD_MOCK':
      return { ...state, mockHistory: [...(state.mockHistory ?? []), action.result].slice(-60) };
    case 'KAKITORI_PROGRESS': {
      const map = state.kakitori ?? {};
      // 合格(見ないで書く=step>=3・未スキップ)なら write(副read)面を補強(成功のみ底上げ)。
      const passed = !action.skipped && action.step >= 3;
      const mastery = passed
        ? recordFacet(state.mastery ?? {}, facetsForKakitori(action.char), true, 'practice', action.now ?? Date.now())
        : (state.mastery ?? {});
      return { ...state, kakitori: { ...map, [action.char]: applyKakitoriProgress(map[action.char], action) }, mastery };
    }
    case 'ADD_TO_MY_LIST':
      return { ...state, myList: toggleMyList(state.myList ?? [], action.ref) };
    case 'ADD_STUDY_SECONDS':
      return { ...state, studySeconds: (state.studySeconds ?? 0) + Math.max(0, Math.round(action.sec)) };
    case 'ADD_POINTS':
      return walletAdd(state, action.amount, action.now, { cap: action.cap });
    case 'AWARD_ONCE':
      return walletAwardOnce(state, action.key, action.amount);
    case 'BUY_ITEM':
      return walletBuy(state, action.item, action.now);
    case 'EQUIP_ITEM':
      return walletEquip(state, action.item);
    case 'SYNC_TICKETS':
      return syncMockTickets(state, action.now);
    case 'BUY_TICKET':
      return ticketBuy(state, action.now);
    case 'SPEND_TICKET':
      return spendMockTicket(state, action.now);
    case 'BUY_AVATAR_DRINK':
      return walletBuyAvatarDrink(state, action.now);
    case 'SPEND_AVATAR_CHANGE':
      return walletSpendAvatarChange(state, action.now);
    case 'CONSUME_SESSION':
      return quotaConsume(state, action.now);
    case 'GRANT_AD_BONUS':
      return quotaAdBonus(state, action.now);
    case 'SET_PURCHASE_ACTIVE':
      return proSetPurchase(state, action.active, action.now);
    case 'GRANT_PRO_DAYS':
      return proGrantDays(state, action.days, action.now);
    case 'MARK_STORY_SHOWN':
      // 出迎え(daily_greet)を「今日出した」と記録=減衰レイヤーで1日1回に絞る。付与ロジックには一切触れない。
      return { ...state, storyDecay: recordDecay(state.storyDecay, action.id, action.now, { skipped: action.skipped }) };
    case 'SET_COMPLETED': {
      // セット完了(約60問)＝適格学習日。qualifyingの時だけ当日を distinct 追加(水増し防止)。
      if (!action.qualifying) return state;
      const days = recordQualifyingDay(state.referral?.qualifyingDays ?? [], action.day);
      return { ...state, referral: { ...state.referral, qualifyingDays: days } };
    }
    case 'SET_ENTERED_CODE':
      // 新規が初回に入力した紹介コードを保存(成立時にこのコードで報告する)。
      return { ...state, referral: { ...state.referral, enteredCode: action.code } };
    case 'SET_REFERRAL_STATS':
      // 自分が紹介した継続人数(サーバー集計)をキャッシュ。テレメトリ/アカウント画面が参照。
      return { ...state, referral: { ...state.referral, referredQualified: action.qualified } };
    case 'MARK_UNLOCK_SEEN':
      return (state.unlocksSeen ?? []).includes(action.key) ? state : { ...state, unlocksSeen: [...(state.unlocksSeen ?? []), action.key] };
    case 'SEED_UNLOCKS_SEEN':
      // 初回のみ(未定義時)現解禁分を無音記録。既存ユーザーが更新直後に一斉演出されるのを防ぐ。
      return state.unlocksSeen === undefined ? { ...state, unlocksSeen: action.keys } : state;
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

const StateCtx = createContext<AppState>(INITIAL_STATE);
const DispatchCtx = createContext<Dispatch<Action>>(() => undefined);
const HydratedCtx = createContext<boolean>(false);
// このセッションのローカル state が「ディスクの永続データから復元された」か。
// false=まっさらな新規/再インストール(保持すべきローカルデータ無し)。クラウド同期の統合判断で使う。
const HydratedFromDiskCtx = createContext<boolean>(false);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [fromDisk, setFromDisk] = useState(false);

  // 起動時に永続状態を復元
  useEffect(() => {
    (async () => {
      const saved = await loadState();
      if (saved) { dispatch({ type: 'HYDRATE', state: saved }); setFromDisk(true); }
      dispatch({ type: 'SYNC_TICKETS', now: Date.now() }); // 初回=インストール日+歓迎1枚 / 以降=30日ごと+1(上限3)
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
        <HydratedCtx.Provider value={hydrated}>
          <HydratedFromDiskCtx.Provider value={fromDisk}>{children}</HydratedFromDiskCtx.Provider>
        </HydratedCtx.Provider>
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

/** ローカル state がディスクの永続データから復元されたか。false=新規/再インストール。 */
export function useHydratedFromDisk(): boolean {
  return useContext(HydratedFromDiskCtx);
}

export function useAppActions() {
  const dispatch = useContext(DispatchCtx);
  return {
    setSettings: (patch: Partial<Settings>) => { void sendEvent('setting_changed', patch as Record<string, unknown>); dispatch({ type: 'SET_SETTINGS', patch }); },
    quizAnswer: (itemId: string, correct: boolean) => {
      recordAnswer(itemId, correct); // 全回答を匿名記録(問題別正答率の資源化)
      dispatch({ type: 'QUIZ_ANSWER', itemId, correct, now: Date.now() });
      if (correct) dispatch({ type: 'ADD_POINTS', amount: 2, now: Date.now(), cap: true });
    },
    mockAnswer: (itemId: string, correct: boolean) => {
      recordAnswer(itemId, correct);
      dispatch({ type: 'MOCK_ANSWER', itemId, correct, now: Date.now() });
      if (correct) dispatch({ type: 'ADD_POINTS', amount: 2, now: Date.now(), cap: true });
    },
    recordMockResult: (result: MockResult) => {
      dispatch({ type: 'RECORD_MOCK', result });
      dispatch({ type: 'ADD_POINTS', amount: 50, now: Date.now(), cap: true }); // 模試完了
    },
    recordKakitori: (char: string, step: number, score: number, opts?: { skipped?: boolean; now?: number }) => {
      dispatch({ type: 'KAKITORI_PROGRESS', char, step, score, skipped: opts?.skipped, now: opts?.now });
      if (step >= 3 && !opts?.skipped && score >= 2) dispatch({ type: 'ADD_POINTS', amount: 5, now: Date.now(), cap: true }); // 漢字マスター
    },
    addToMyList: (ref: SaveRef) => dispatch({ type: 'ADD_TO_MY_LIST', ref }),
    addStudySeconds: (sec: number) => dispatch({ type: 'ADD_STUDY_SECONDS', sec }),
    addPoints: (amount: number, opts?: { cap?: boolean }) => dispatch({ type: 'ADD_POINTS', amount, now: Date.now(), cap: opts?.cap }),
    awardOnce: (key: string, amount: number) => dispatch({ type: 'AWARD_ONCE', key, amount }),
    buyItem: (item: { id: string; price: number }) => dispatch({ type: 'BUY_ITEM', item, now: Date.now() }),
    equipItem: (item: { id: string; kind: ShopKind }) => dispatch({ type: 'EQUIP_ITEM', item }),
    syncTickets: () => dispatch({ type: 'SYNC_TICKETS', now: Date.now() }),
    buyMockTicket: () => dispatch({ type: 'BUY_TICKET', now: Date.now() }),
    spendMockTicket: () => dispatch({ type: 'SPEND_TICKET', now: Date.now() }),
    buyAvatarDrink: () => dispatch({ type: 'BUY_AVATAR_DRINK', now: Date.now() }),
    spendAvatarChange: () => dispatch({ type: 'SPEND_AVATAR_CHANGE', now: Date.now() }),
    consumeSession: () => dispatch({ type: 'CONSUME_SESSION', now: Date.now() }),
    grantAdBonus: () => dispatch({ type: 'GRANT_AD_BONUS', now: Date.now() }),
    setPurchaseActive: (active: boolean) => dispatch({ type: 'SET_PURCHASE_ACTIVE', active, now: Date.now() }),
    grantProDays: (days: number) => dispatch({ type: 'GRANT_PRO_DAYS', days, now: Date.now() }),
    markStoryShown: (id: string, skipped = false) => dispatch({ type: 'MARK_STORY_SHOWN', id, now: Date.now(), skipped }),
    markStudyDay: (qualifying: boolean) => dispatch({ type: 'SET_COMPLETED', day: dayStr(Date.now()), qualifying }),
    setEnteredCode: (code: string) => dispatch({ type: 'SET_ENTERED_CODE', code }),
    setReferralStats: (qualified: number) => dispatch({ type: 'SET_REFERRAL_STATS', qualified }),
    markUnlockSeen: (key: string) => dispatch({ type: 'MARK_UNLOCK_SEEN', key }),
    seedUnlocksSeen: (keys: string[]) => dispatch({ type: 'SEED_UNLOCKS_SEEN', keys }),
    hydrate: (s: AppState) => dispatch({ type: 'HYDRATE', state: s }),
    reset: () => {
      clearState();
      dispatch({ type: 'RESET' });
    },
  };
}
