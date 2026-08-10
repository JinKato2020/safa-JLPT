// 書斎タブ(単語タブ)の学習モード段階解禁。試験タブ(認識)でカバー率を上げると、書斎タブ(産出=難)が順に解禁される。
// 判定は【全体カバー率】=3辞書(漢字/語彙/文法)の合計 覚えた数/総数(AICoachの covLearned/covTotalAll と同じ正本)。
// しきい値=全体カバー率 5→10→15→20%。演出もボタンゲートも同じ全体基準で一致させる。
import type { AppState } from './state';
import { coverageBars } from './selectors';

export type UnlockKey = 'listening' | 'kakitori_kanji' | 'vproduce' | 'gbuild';

// 各モードの解禁条件。need=解禁する全体カバー率%。labelKey=解禁演出の見出し(「◯◯」に入る)。
// 「聞き取り」は漢字・語彙の聞き取りを1つに統合(5%で両方解禁)。
export const UNLOCKS: { key: UnlockKey; need: number; labelKey: string }[] = [
  { key: 'listening', need: 5, labelKey: 'unlock.listening' },
  { key: 'kakitori_kanji', need: 10, labelKey: 'unlock.kakitori_kanji' },
  { key: 'vproduce', need: 15, labelKey: 'unlock.vproduce' },
  { key: 'gbuild', need: 20, labelKey: 'unlock.gbuild' },
];

// KubunCard がボタン別ゲートに使うしきい値(全体カバー率%)。聞き取り=5 / 漢字書き取り=10 / 語彙パズル=15 / 文法パズル=20。
export const UNLOCK_NEED = { listen: 5, kakitori: 10, vproduce: 15, gbuild: 20 } as const;

/** 全体カバー率(0-100)。3辞書(漢字/語彙/文法)の合計 覚えた数 / 合計 総数。 */
export function overallCoveragePct(state: AppState, now: number): number {
  let learned = 0;
  let total = 0;
  for (const b of coverageBars(state, now)) { learned += b.learned; total += b.total; }
  return total > 0 ? Math.round((100 * learned) / total) : 0;
}

/** 開発用(無限ポイント)は全解禁扱いで動作確認しやすく。 */
const devBypass = (state: AppState) => state.settings.devUnlimitedPoints === true;

/** いま解禁済みのモードキー集合。 */
export function unlockedKeys(state: AppState, now: number): Set<UnlockKey> {
  if (devBypass(state)) return new Set(UNLOCKS.map((u) => u.key));
  const pct = overallCoveragePct(state, now);
  return new Set(UNLOCKS.filter((u) => pct >= u.need).map((u) => u.key));
}

/** 初回seed用: いま解禁済みの全キー(既存ユーザーは演出せず既知扱いにする)。 */
export function currentlyUnlocked(state: AppState, now: number): UnlockKey[] {
  return [...unlockedKeys(state, now)];
}

/** 未演出でいま解禁条件を満たした最初のモード(演出対象)。無ければ null。 */
export function firstUnseenUnlock(state: AppState, now: number): (typeof UNLOCKS)[number] | null {
  const seen = new Set(state.unlocksSeen ?? []);
  const pct = overallCoveragePct(state, now);
  for (const u of UNLOCKS) if (!seen.has(u.key) && pct >= u.need) return u;
  return null;
}
