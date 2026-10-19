// 地域キャンペーン（完全Pro無料）の「端末ローカル」フラグ。
// ★クラウド同期しない＝同一アカウントでも台湾端末だけ無料／日本端末は有料、が正しく出る（地域差が漏れない）。
// proStatus（純関数）はこの getter を見る。UIの即時反映は useSyncExternalStore 用の subscribe を使う。
// このファイルは外部依存ゼロ（supabase/RN を import しない）＝純関数テストから安全に使える。
let active = false;
const listeners = new Set<() => void>();

/** 起動時にリモート判定の結果を注入（campaign.ts から呼ぶ）。変化時だけ購読者へ通知。 */
export function setCampaignProActive(v: boolean): void {
  if (v === active) return;
  active = v;
  listeners.forEach((l) => l());
}

/** いま地域キャンペーンでPro無料か（端末地域がリモートの対象地域に含まれる）。 */
export function isCampaignProActive(): boolean {
  return active;
}

/** useSyncExternalStore 用: フラグ変化を購読。返り値で解除。 */
export function subscribeCampaign(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
