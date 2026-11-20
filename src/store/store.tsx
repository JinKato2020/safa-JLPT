// アプリ状態ストア: Context + useReducer + AsyncStorage 永続化。
// エンジン(習得更新/SRS/客観クイズ)と streak ロジックを統合する単一の真実。
import {
  createContext, useContext, useEffect, useReducer, useState,
  type Dispatch, type ReactNode,
} from 'react';
import { type Settings, type MockResult, type SaveRef, type AppState, INITIAL_STATE, dayStr } from './state';
export type { AppState } from './state';
import { reducer, type Action } from './reducer';
export { reducer } from './reducer';
import { recordAnswer, sendEvent } from '../telemetry/telemetry';
import { loadState, saveState, clearState } from './storage';
import type { ShopKind } from './wallet';
import type { PurchaseAccess } from '../pro/levelPurchases';

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
      dispatch({ type: 'SYNC_TICKETS', now: Date.now() }); // Pro:登録日起点で歓迎1+暦月ごと+1(上限なし) / 非Pro:0にクリア(課金同期後に再実行=App.tsx)
      setHydrated(true);
    })();
  }, []);

  // 変更を永続化(復元前は保存しない=初期値で上書きしない)。updatedAt は reducer が
  // 「本当のデータ変更のとき」だけ刻むので、ここでは state をそのまま書く(起動時のhousekeeping では進めない)。
  useEffect(() => {
    if (hydrated) saveState(state);
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
    quizAnswer: (itemId: string, correct: boolean, weakness = false) => {
      recordAnswer(itemId, correct); // 全回答を匿名記録(問題別正答率の資源化)
      dispatch({ type: 'QUIZ_ANSWER', itemId, correct, weakness, now: Date.now() });
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
    clearTicketNotice: () => dispatch({ type: 'CLEAR_TICKET_NOTICE' }),
    buyAvatarDrink: () => dispatch({ type: 'BUY_AVATAR_DRINK', now: Date.now() }),
    spendAvatarChange: () => dispatch({ type: 'SPEND_AVATAR_CHANGE', now: Date.now() }),
    consumeSession: () => dispatch({ type: 'CONSUME_SESSION', now: Date.now() }),
    grantAdBonus: () => dispatch({ type: 'GRANT_AD_BONUS', now: Date.now() }),
    setPurchaseActive: (active: boolean) => dispatch({ type: 'SET_PURCHASE_ACTIVE', active, now: Date.now() }),
    setPurchaseAccess: (access: PurchaseAccess, ownerId?: string) => dispatch({ type: 'SET_PURCHASE_ACCESS', access, ownerId, now: Date.now() }),
    grantProDays: (days: number) => dispatch({ type: 'GRANT_PRO_DAYS', days, now: Date.now() }),
    markStoryShown: (id: string, skipped = false) => dispatch({ type: 'MARK_STORY_SHOWN', id, now: Date.now(), skipped }),
    markStudyDay: (qualifying: boolean) => dispatch({ type: 'SET_COMPLETED', day: dayStr(Date.now()), qualifying }),
    setEnteredCode: (code: string) => dispatch({ type: 'SET_ENTERED_CODE', code }),
    setReferralStats: (qualified: number) => dispatch({ type: 'SET_REFERRAL_STATS', qualified }),
    markUnlockSeen: (key: string) => dispatch({ type: 'MARK_UNLOCK_SEEN', key }),
    seedUnlocksSeen: (keys: string[]) => dispatch({ type: 'SEED_UNLOCKS_SEEN', keys }),
    hydrate: (s: AppState) => dispatch({ type: 'HYDRATE', state: s }),
    setTrialStart: (at: number) => dispatch({ type: 'SET_TRIAL_START', at }), // サーバー確定のお試し受取日(アカウント単位)を反映
    setProUntil: (until: number) => dispatch({ type: 'SET_PRO_UNTIL', until }), // サーバー(entitlements.pro_until)由来の期限つきProを反映

    reset: () => {
      clearState();
      dispatch({ type: 'RESET' });
    },
  };
}
