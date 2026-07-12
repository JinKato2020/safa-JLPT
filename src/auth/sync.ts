// 同期の純粋ロジック(Supabaseクライアントを import しない=node テスト可)。
import type { AppState } from '../store/state';

export const SYNC_TABLE = 'user_state';

/** LWW: リモートが厳密に新しい時だけ remote。無い/同値/古い時は local。 */
export function chooseNewer(local: AppState, remote: AppState | null): 'local' | 'remote' {
  if (!remote) return 'local';
  const l = local.updatedAt ?? 0;
  const r = remote.updatedAt ?? 0;
  return r > l ? 'remote' : 'local';
}
