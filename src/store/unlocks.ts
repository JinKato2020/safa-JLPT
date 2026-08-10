// 書斎タブ(単語タブ)の学習モード段階解禁。試験タブ(認識)でカバー率を上げると、書斎タブ(産出=難)が順に解禁される。
// 判定は面別カバー率(coverageBars=リング/合格率と同じ正本)。しきい値=分野別カバー率5→10→15→20%。
import type { AppState } from './state';
import { coverageBars } from './selectors';

export type UnlockKey = 'listen_kanji' | 'listen_vocab' | 'kakitori_kanji' | 'vproduce' | 'gbuild';

// 各モードの解禁条件。kubun=判定に使う分野カバー率。need=解禁%。labelKey=解禁演出の見出し。
export const UNLOCKS: { key: UnlockKey; kubun: 'kanji' | 'vocab' | 'grammar'; need: number; labelKey: string }[] = [
  { key: 'listen_vocab', kubun: 'vocab', need: 5, labelKey: 'unlock.listen_vocab' },
  { key: 'listen_kanji', kubun: 'kanji', need: 5, labelKey: 'unlock.listen_kanji' },
  { key: 'kakitori_kanji', kubun: 'kanji', need: 10, labelKey: 'unlock.kakitori_kanji' },
  { key: 'vproduce', kubun: 'vocab', need: 15, labelKey: 'unlock.vproduce' },
  { key: 'gbuild', kubun: 'grammar', need: 20, labelKey: 'unlock.gbuild' },
];

// KubunCard がボタン別ゲートに使うしきい値(分野=そのカードのkubunと一致するのでカード内のpctで判定できる)。
export const UNLOCK_NEED = { listen: 5, kakitori: 10, vproduce: 15, gbuild: 20 } as const;

/** 分野別カバー率(0-100)。coverageBars(learned/total)から算出。 */
export function coveragePct(state: AppState, now: number): Record<'kanji' | 'vocab' | 'grammar', number> {
  const out = { kanji: 0, vocab: 0, grammar: 0 };
  for (const b of coverageBars(state, now)) out[b.key] = b.total > 0 ? Math.round((100 * b.learned) / b.total) : 0;
  return out;
}

/** 開発用(無限ポイント)は全解禁扱いで動作確認しやすく。 */
const devBypass = (state: AppState) => state.settings.devUnlimitedPoints === true;

/** いま解禁済みのモードキー集合。 */
export function unlockedKeys(state: AppState, now: number): Set<UnlockKey> {
  if (devBypass(state)) return new Set(UNLOCKS.map((u) => u.key));
  const pct = coveragePct(state, now);
  return new Set(UNLOCKS.filter((u) => pct[u.kubun] >= u.need).map((u) => u.key));
}

/** 初回seed用: いま解禁済みの全キー(既存ユーザーは演出せず既知扱いにする)。 */
export function currentlyUnlocked(state: AppState, now: number): UnlockKey[] {
  return [...unlockedKeys(state, now)];
}

/** 未演出でいま解禁条件を満たした最初のモード(演出対象)。無ければ null。 */
export function firstUnseenUnlock(state: AppState, now: number): (typeof UNLOCKS)[number] | null {
  const seen = new Set(state.unlocksSeen ?? []);
  const pct = coveragePct(state, now);
  for (const u of UNLOCKS) if (!seen.has(u.key) && pct[u.kubun] >= u.need) return u;
  return null;
}
