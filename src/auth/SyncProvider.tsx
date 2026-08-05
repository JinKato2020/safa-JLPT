// 認証セッションを購読し、ログイン中は AppState をクラウドへ pull/push(デバウンス)する副作用層。
// ローカル永続(store)は不変。ここは「その上のバックアップ層」。
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { getSession, onAuthStateChange } from './authClient';
import { pullState, pushState } from './syncClient';
import { decideLoginSync } from './sync';
import { useAppState, useAppActions, useHydrated, useHydratedFromDisk } from '../store/store';
import { setTelemetryAccount } from '../telemetry/telemetry';

type SyncCtx = { session: Session | null; email: string | null; lastSyncedAt: number | null };
const Ctx = createContext<SyncCtx>({ session: null, email: null, lastSyncedAt: null });
export function useSync(): SyncCtx {
  return useContext(Ctx);
}

const PUSH_DEBOUNCE_MS = 3000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  const hydrated = useHydrated();
  const fromDisk = useHydratedFromDisk();
  const { hydrate } = useAppActions();
  const [session, setSession] = useState<Session | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // 初回のpull/reconcileが終わるまでは push を止める(空データでリモートを上書きしない=再インストール時のデータ消失防止)。
  const initialSyncDone = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // テレメトリにアカウントID(=紐づけ)を注入。未ログイン→null(匿名)。ログイン/ログアウトで切替。
  useEffect(() => {
    setTelemetryAccount(session?.user?.id ?? null);
  }, [session]);

  // ログイン確立時: リモートを引いて安全に統合する。
  //  ・ローカルが「ディスク未復元」(=まっさらな新規/再インストール。state.updatedAt が無い)なら、
  //    リモートが在れば無条件でリモートを復元する。空のローカルでバックアップを上書きしない。
  //  ・それ以外は updatedAt の LWW(新しい方を採用)。ローカルが新しければリモートへ push。
  useEffect(() => {
    if (!session || !hydrated) return;
    initialSyncDone.current = false; // 新しいセッションの統合が終わるまで push を止める
    let cancelled = false;
    (async () => {
      const remote = await pullState(session.user.id);
      if (cancelled) return;
      const local = stateRef.current;
      if (decideLoginSync(local, remote, fromDisk) === 'restore' && remote) {
        hydrate(remote); // クラウドのバックアップを復元(データ引き継ぎ)
      } else {
        await pushState(session.user.id, { ...local, updatedAt: local.updatedAt ?? Date.now() });
      }
      if (!cancelled) {
        initialSyncDone.current = true; // 統合完了=以降のローカル変更を push してよい
        setLastSyncedAt(Date.now());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ログイン中のローカル変更: デバウンスして push。初回統合が終わるまでは push しない(空上書き防止)。
  useEffect(() => {
    if (!session || !hydrated || !initialSyncDone.current) return;
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
