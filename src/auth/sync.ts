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

/**
 * ログイン確立時の統合判断。'restore'=リモートを復元(引き継ぎ) / 'push'=ローカルをリモートへ。
 *  ・ローカルが「ディスク未復元」(state.updatedAt が無い=まっさらな新規/再インストール)なら、
 *    リモートが在れば必ず 'restore'。空のローカルでバックアップを上書きしない(=データ消失を防ぐ)。
 *  ・それ以外は updatedAt の LWW。
 * localHydratedFromDisk: このローカル state が永続データから復元されたものか(=保持すべき実データがある)。
 */
export function decideLoginSync(
  local: AppState,
  remote: AppState | null,
  localHydratedFromDisk: boolean,
): 'restore' | 'push' {
  if (!remote) return 'push';                 // バックアップ無し=ローカルを初回バックアップとして push
  if (!localHydratedFromDisk) return 'restore'; // 新規/再インストール=保持すべきローカル無し→必ず復元
  return chooseNewer(local, remote) === 'remote' ? 'restore' : 'push'; // 実データあり=LWW
}
