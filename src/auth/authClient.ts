// Supabase Auth の薄いラッパ。UIから supabase を直接触らせない。
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { SYNC_TABLE } from './sync';

export async function signUp(email: string, password: string): Promise<{ error?: string; needsConfirm: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message, needsConfirm: false };
  // 確認メールON: session は null(=確認待ち)。
  return { needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(cb: (s: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** 認証ユーザー削除。Edge Function を試み、失敗時は自分のデータ行削除にフォールバック。最後に必ずサインアウト。 */
export async function deleteAccount(userId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw error;
  } catch {
    await supabase.from(SYNC_TABLE).delete().eq('user_id', userId);
  }
  await supabase.auth.signOut();
}
