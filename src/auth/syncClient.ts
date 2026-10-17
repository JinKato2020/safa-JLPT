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
  const clientUpdatedAt = state.updatedAt ?? 0;
  // サーバー側LWWガード: 「クラウドが持つ時刻より新しい書き込みだけ」を通す(push_user_state RPC)。
  // 素の upsert は新旧を比べず上書きするため、古い端末の stale state が新しいクラウドを塗り替え、
  // 別端末の学習が消える余地があった。RPC は client_updated_at が既存以上のときだけ書く。
  const { error } = await supabase.rpc('push_user_state', {
    p_state: state,
    p_client_updated_at: clientUpdatedAt,
    p_version: STATE_VERSION,
  });
  if (!error) return;
  // RPC 未デプロイ(関数が無い)時だけ従来の upsert にフォールバック=同期を止めない。
  // ※SQL(schema.sql の push_user_state)を貼るまでの一時経路でガードは効かない(現状と同等)。貼れば自動でガード有効。
  const code = (error as { code?: string }).code ?? '';
  if (code === 'PGRST202' || code === '42883') {
    await supabase.from(SYNC_TABLE).upsert({
      user_id: userId,
      state,
      client_updated_at: clientUpdatedAt,
      version: STATE_VERSION,
      updated_at: new Date().toISOString(),
    });
  }
}
