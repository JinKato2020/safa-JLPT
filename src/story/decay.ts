// 演出の減衰レイヤー(共通)。接点ごとの「見せ方」full/short/none を方針テーブル1つで決める純関数。
// 付与(桜貝)とは完全分離: ここは "どう見せるか" だけ。報酬の加算は呼び出し側が none でも必ず別途行う(§6-1)。
// うるさい時は DECAY_POLICIES の数字だけ触ればチューニングできる(コードを読まない・§6)。
// 仕様: docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md §6
import { dayStr, type DecayCounter } from '../store/state';

// none = 演出を出さない(ただし報酬フラッシュ +🐚 は別途残す・真のゼロにしない §6-2)。
export type Intensity = 'full' | 'short' | 'none';

// 接点の方針。実利用者が付いた接点だけ DECAY_POLICIES に載せる(未使用の空基盤を作らない)。
export interface DecayPolicy {
  perDay?: number;          // 1日あたりの上限回数(超えたら none で抑制)。未指定=無制限。daily_greet=1
  fullTimes: number;        // この通算回数までは full(以降 short)
  shortTimes: number;       // full を使い切った後この回数だけ short(以降 none)
  refreshAfterDays: number; // 最終接触からこの日数以上あけば full に戻す(復帰体験・§6-4)
}

// スキップは最強の信号(§6-3)。全接点共通の閾値。2回で short・4回で none。
export const SKIP_TO_SHORT = 2;
export const SKIP_TO_NONE = 4;

// テーブルに無い接点の保険(クラッシュ回避)。初回 full → 数回 short → none。
const DEFAULT_POLICY: DecayPolicy = { fullTimes: 1, shortTimes: 4, refreshAfterDays: 7 };

export const DECAY_POLICIES: Record<string, DecayPolicy> = {
  // 毎日の出迎え: 1日1回・最初の3日は full・4日あけば full 復帰。lastGreetDay を吸収(§6)。
  daily_greet: { perDay: 1, fullTimes: 3, shortTimes: 100000, refreshAfterDays: 4 },
  // 受験日の一言(前夜/当日/翌日): 1日1回・年数回の稀少イベントなので常に full(refreshAfterDays:1で毎日リセット)。
  exam: { perDay: 1, fullTimes: 9999, shortTimes: 0, refreshAfterDays: 1 },
};

const policyFor = (id: string): DecayPolicy => DECAY_POLICIES[id] ?? DEFAULT_POLICY;

const RANK: Record<Intensity, number> = { none: 0, short: 1, full: 2 };
const min = (a: Intensity, b: Intensity): Intensity => (RANK[a] <= RANK[b] ? a : b);

// YYYY-MM-DD → 通日番号(日差計算用・TZ非依存)。
function dayNo(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// 空白(refreshAfterDays 以上)があれば新規扱い=full 復帰。当日でなければ dayCount を 0 に。
function effective(policy: DecayPolicy, c: DecayCounter | undefined, today: string) {
  if (!c || dayNo(today) - dayNo(c.lastDay) >= policy.refreshAfterDays) {
    return { total: 0, skips: 0, dayCount: 0 };
  }
  return { total: c.total, skips: c.skips, dayCount: c.lastDay === today ? c.dayCount : 0 };
}

/**
 * この接点を「いま」どの強さで見せるか。none=演出は出さない(報酬の付与は呼び出し側が別途必ず行う)。
 * OS の Reduce Motion はここ1箇所に集約(§6-5): full を short に丸める(none はそのまま)。
 */
export function decideIntensity(
  policy: DecayPolicy,
  counter: DecayCounter | undefined,
  ctx: { now: number; reduceMotion?: boolean },
): Intensity {
  const e = effective(policy, counter, dayStr(ctx.now));

  // 1日上限に達していれば抑制(daily_greet の「今日はもう出迎えた」)。
  if (policy.perDay != null && e.dayCount >= policy.perDay) return 'none';

  // 回数ラダー
  let byCount: Intensity;
  if (e.total < policy.fullTimes) byCount = 'full';
  else if (e.total < policy.fullTimes + policy.shortTimes) byCount = 'short';
  else byCount = 'none';

  // スキップ信号(最強)。回数ラダーと合わせて弱い方を採る。
  let bySkip: Intensity = 'full';
  if (e.skips >= SKIP_TO_NONE) bySkip = 'none';
  else if (e.skips >= SKIP_TO_SHORT) bySkip = 'short';

  let out = min(byCount, bySkip);
  if (ctx.reduceMotion) out = min(out, 'short');
  return out;
}

/**
 * 接点を1回「見せた(または見送った)」ことを記録した新カウンタを返す(純粋・入力不変)。
 * skipped=true はユーザーが演出を飛ばした信号=次回以降を弱める。
 */
export function recordShown(
  policy: DecayPolicy,
  counter: DecayCounter | undefined,
  now: number,
  opts: { skipped?: boolean } = {},
): DecayCounter {
  const today = dayStr(now);
  const e = effective(policy, counter, today);
  return {
    total: e.total + 1,
    skips: e.skips + (opts.skipped ? 1 : 0),
    lastDay: today,
    dayCount: e.dayCount + 1,
  };
}

/** state.storyDecay の該当接点を更新した複製を返す(接点IDで方針を引く)。純粋。 */
export function recordDecay(
  map: Record<string, DecayCounter> | undefined,
  id: string,
  now: number,
  opts: { skipped?: boolean } = {},
): Record<string, DecayCounter> {
  const next = recordShown(policyFor(id), map?.[id], now, opts);
  return { ...(map ?? {}), [id]: next };
}

/** 接点の強さを接点IDで直接引く(UI用の薄いラッパ)。 */
export function intensityFor(
  map: Record<string, DecayCounter> | undefined,
  id: string,
  ctx: { now: number; reduceMotion?: boolean },
): Intensity {
  return decideIntensity(policyFor(id), map?.[id], ctx);
}

/** 開発・QA: 全接点の減衰カウンタを消去(=全部 full に戻す)。純粋。 */
export function clearDecay<T extends { storyDecay?: Record<string, DecayCounter> }>(state: T): T {
  const next = { ...state };
  delete next.storyDecay;
  return next;
}
