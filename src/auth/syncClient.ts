// クラウド状態の pull/push(Supabase Postgres)。1ユーザー=1行(upsert)。
import { supabase } from '../config/supabase';
import { SYNC_TABLE } from './sync';
import { type AppState, STATE_VERSION } from '../store/state';

export async function pullState(userId: string): Promise<AppState | null> {
  const { data, error } = await supabase
    .from(SYNC_TABLE)
    .select('state, client_updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const st = data.state as AppState;
  return { ...st, updatedAt: (data.client_updated_at as number) ?? st.updatedAt ?? 0 };
}

export async function pushState(userId: string, state: AppState): Promise<void> {
  await supabase.from(SYNC_TABLE).upsert({
    user_id: userId,
    state,
    client_updated_at: state.updatedAt ?? 0,
    version: STATE_VERSION,
    updated_at: new Date().toISOString(),
  });
}
