// ホームの案内キャラ(桜の巫女)=AIコーチのセリフ候補を状態に応じて出し分ける純関数。
// t = translate関数(i18n)。候補配列を返し、UI側でランダムに1つ選ぶ。テスト可能(副作用なし)。
import type { HomeStatus } from './homeStatus';

export type CoachCtx = { status: HomeStatus; learned: number };

/** 現在の到達度・継続・弱点に合わせたコーチのセリフ候補を返す。必ず1つ以上返る。 */
export function coachLines(
  t: (k: string, p?: Record<string, string | number>) => string,
  ctx: CoachCtx,
): string[] {
  const { status, learned } = ctx;
  const lines: string[] = [];

  // 継続日数
  if (status.streakDays >= 3) lines.push(t('coach.streak', { n: status.streakDays }));
  else if (status.streakDays <= 0) lines.push(t('coach.streak0'));

  // 合格率の帯で励ましを変える
  if (status.passPct >= 70) lines.push(t('coach.pass_high'));
  else if (status.passPct >= 40) lines.push(t('coach.pass_mid'));
  else lines.push(t('coach.pass_low'));

  // 一番弱い分野をそっと促す
  const weakest = [...status.subjects].sort((a, b) => a.pct - b.pct)[0];
  if (weakest) lines.push(t('coach.weak', { s: t(weakest.labelKey) }));

  // 積み上げ(覚えた語)
  if (learned >= 100) lines.push(t('coach.learned', { n: learned }));

  // 常時候補の汎用はげまし
  lines.push(t('coach.tip1'), t('coach.tip2'), t('coach.greet'));

  return lines;
}

/** 候補から1つ選ぶ(rng省略時はMath.random)。純粋にしたい時はrngを渡す。 */
export function pickLine(lines: string[], rng: () => number = Math.random): string {
  if (lines.length === 0) return '';
  return lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))];
}
