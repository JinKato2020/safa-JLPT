// 継続率(リテンション)計測の純粋ロジック。願い(wishKey)別に D1/D7/D30 を出すためのコホート鍵と、
// ライフサイクル計測3点(インストール / 初回セッション完了 / 翌日起動)の発火判定を提供する。
// 発火(sendEvent/AsyncStorage)は telemetry 側。ここは「何を・いつ送るか」を決めるだけ(副作用なし・テスト可)。
// D7/D30 は日次スナップショットに wishKey+daysSinceInstall を載せる(telemetry)ことでサーバ側集計する。
// 仕様: docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md §8(計測3点+wishKey別D7/D30)
import { dayStr, type AppState } from '../store/state';

// 計測イベント名(一度だけ送る)。
export const M_INSTALL = 'install';
export const M_FIRST_SESSION = 'first_session';
export const M_NEXT_DAY_OPEN = 'next_day_open';

const DAY_MS = 24 * 3600 * 1000;

/** コホート鍵=願いの種類。未設定=none / あとで=later / 自由記述=custom / それ以外は6種のいずれか。 */
export function metricsWishKey(state: AppState): string {
  const w = state.settings.wish;
  return w ? w.kind : 'none';
}

/** インストール日(dayStr)。未確定(旧データ)は null。 */
export function installDayStr(state: AppState): string | null {
  return state.installedAt ? dayStr(state.installedAt) : null;
}

/** インストールからの経過日数(暦日ベース)。未確定は null。 */
export function daysSinceInstall(state: AppState, now: number): number | null {
  if (!state.installedAt) return null;
  const a = Math.floor(state.installedAt / DAY_MS);
  const b = Math.floor(now / DAY_MS);
  return Math.max(0, b - a);
}

export interface CohortProps { wishKey: string; installDay: string | null; daysSinceInstall: number | null }

/** すべての計測イベント・日次スナップショットに添えるコホート情報。 */
export function cohortProps(state: AppState, now: number): CohortProps {
  return { wishKey: metricsWishKey(state), installDay: installDayStr(state), daysSinceInstall: daysSinceInstall(state, now) };
}

export interface MetricEvent { name: string; props: CohortProps }

/**
 * 起動時に送るべきライフサイクル計測(まだ送っていないものだけ)。
 *  - install: installedAt 確定済みで未送信
 *  - next_day_open: インストール翌日以降に初めて開いた(D1到達の指標)で未送信
 * first_session はセッション完了が契機なのでここには含めない(telemetry.sendFirstSessionOnce)。
 */
export function dueLifecycleOpens(state: AppState, now: number, seen: readonly string[] = []): MetricEvent[] {
  const out: MetricEvent[] = [];
  const props = cohortProps(state, now);
  if (state.installedAt && !seen.includes(M_INSTALL)) out.push({ name: M_INSTALL, props });
  const d = daysSinceInstall(state, now);
  if (d != null && d >= 1 && !seen.includes(M_NEXT_DAY_OPEN)) out.push({ name: M_NEXT_DAY_OPEN, props });
  return out;
}
