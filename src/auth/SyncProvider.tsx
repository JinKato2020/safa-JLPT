// 認証セッションを購読し、ログイン中は AppState をクラウドへ pull/push(デバウンス)する副作用層。
// ローカル永続(store)は不変。ここは「その上のバックアップ層」。
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { getSession, onAuthStateChange } from './authClient';
import { pullState, pushState } from './syncClient';
import { chooseNewer } from './sync';
import { useAppState, useAppActions, useHydrated } from '../store/store';

type SyncCtx = { session: Session | null; email: string | null; lastSyncedAt: number | null };
const Ctx = createContext<SyncCtx>({ session: null, email: null, lastSyncedAt: null });
export function useSync(): SyncCtx {
  return useContext(Ctx);
}

const PUSH_DEBOUNCE_MS = 3000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  const hydrated = useHydrated();
  const { hydrate } = useAppActions();
  const [session, setSession] = useState<Session | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const localTsRef = useRef<number>(state.updatedAt ?? 0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ローカル変更時刻を追跡(LWW比較のローカル側)。
  useEffect(() => {
    localTsRef.current = Date.now();
  }, [state]);

  // セッション取得＋購読＋RN前後でトークン自動更新を制御。
  useEffect(() => {
    void getSession().then(setSession);
    const unsub = onAuthStateChange((s) => setSession(s));
    supabase.auth.startAutoRefresh();
    const rn = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      unsub();
      rn.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  // ログイン確立時: リモートを引いて新しい方を採用(remote採用→hydrate、そうでなければ push)。
  useEffect(() => {
    if (!session || !hydrated) return;
    let cancelled = false;
    (async () => {
      const remote = await pullState(session.user.id);
      if (cancelled) return;
      const local = { ...stateRef.current, updatedAt: Math.max(stateRef.current.updatedAt ?? 0, localTsRef.current) };
      if (chooseNewer(local, remote) === 'remote' && remote) {
        hydrate(remote);
      } else {
        await pushState(session.user.id, local);
      }
      if (!cancelled) setLastSyncedAt(Date.now());
    })();
    return () => {
      cancelled = true;
    };
  }, [session, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ログイン中のローカル変更: デバウンスして push。
  useEffect(() => {
    if (!session || !hydrated) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      const local = { ...stateRef.current, updatedAt: Date.now() };
      void pushState(session.user.id, local).then(() => setLastSyncedAt(Date.now()));
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, session, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={{ session, email: session?.user?.email ?? null, lastSyncedAt }}>{children}</Ctx.Provider>;
}
