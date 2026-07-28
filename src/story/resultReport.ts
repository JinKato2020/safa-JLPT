// 合格/不合格の自己申告フロー(§4=設計上の最大の要・解約が最も起きる瞬間を物語で受け止める)。
// 【原則】
//  ・自己申告に桜貝は付けない(嘘の旨味を作らない)。証は「壁に残る記念の色紙」= reward:0。
//  ・「消える演出(花吹雪・犬)」と「残る証(色紙)」を分ける。色紙は合格のみ壁に残る。
//  ・不合格は慰めない。願いにだけ触れる(voice の result:fail)。壁に残さず・貝も付けない。
//  ・合格は「叶ったね」→ 軸の書き換えを勧める(理由は変わる・ここが一番効く)。
//  ・必ず「次の門」で終える。手習い帳(myList)・貝殻(wallet)は必ず次へ持ち越す(applyは触れない)。
// 仕様: docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md §4 / 台詞正本: voice.ts の result:{pass,fail}
import { type Level } from '../engine/engine';
import { dayStr, type AppState, type Shikishi, type Wish } from '../store/state';
import { composeVoice, type Occasion, type VoiceResult } from './voice';

export type Outcome = 'pass' | 'fail';

// YYYY-MM-DD → 通日番号(TZ非依存)。
function dayNo(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// JLPTの級順(このアプリはN5-N3)。次の門=一つ上の級。N3が頂点→null。
const LEVEL_ORDER: readonly Level[] = ['N5', 'N4', 'N3'];
export function nextLevel(level: Level): Level | null {
  const i = LEVEL_ORDER.indexOf(level);
  return i >= 0 && i < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[i + 1] : null;
}

export interface NextGate {
  kind: 'advance' | 'retry';  // advance=次の級へ / retry=同じ門をもう一度
  level: Level;               // 次にくぐる門
}

export interface ResultReport {
  outcome: Outcome;
  voice: VoiceResult;                 // result:pass|fail × 願い の一言
  ephemeral: 'petals_dogs' | 'quiet'; // 消える演出(合格=花吹雪+犬 / 不合格=静か)。数秒で消える
  shikishi: Shikishi | null;          // 壁に残る証(合格のみ)
  suggestRewish: boolean;             // 合格=軸の書き換えを勧める(人の理由は変わる)
  nextGate: NextGate;                 // 必ず次の門で終える
  carryOver: { myList: true; wallet: true }; // 手習い帳・貝殻は必ず持ち越す(明示)
  reward: 0;                          // 自己申告に桜貝は付けない(嘘の旨味を作らない)
}

/** 報告内容から画面表示用の指示を組む(純粋・状態は変えない)。壁への追記は applyResultReport。 */
export function buildResultReport(opts: { level: Level; outcome: Outcome; date: string; wish?: Wish; seed?: number }): ResultReport {
  const { level, outcome, date, wish } = opts;
  // result は人生の一言。二文目の季節/時間帯は付けない(variant:'short'=core のみ)。
  const occasion: Occasion = { kind: 'result', outcome, wish };
  const voice = composeVoice({ occasion, variant: 'short', now: 0, seed: opts.seed ?? 0 });
  const carryOver = { myList: true, wallet: true } as const;

  if (outcome === 'pass') {
    const nl = nextLevel(level);
    return {
      outcome, voice, ephemeral: 'petals_dogs',
      shikishi: { level, date },
      suggestRewish: true,
      nextGate: nl ? { kind: 'advance', level: nl } : { kind: 'retry', level }, // 頂点(N3)は同じ門で研鑽
      carryOver, reward: 0,
    };
  }
  return {
    outcome, voice, ephemeral: 'quiet',
    shikishi: null,          // 不合格は壁に残さない
    suggestRewish: false,    // 慰めない=願いに触れるだけ(voice)。書き換えは勧めない
    nextGate: { kind: 'retry', level },
    carryOver, reward: 0,
  };
}

/** この級の合格色紙が既に壁にあるか(「報告する」導線の非表示/重複farm防止に)。 */
export function hasPassShikishi(state: AppState, level: Level): boolean {
  return !!state.shikishi?.some((s) => s.level === level);
}

/**
 * 報告を状態へ反映(純粋・入力不変)。合格のみ色紙を壁へ1枚(級ごと一度)。不合格・重複は状態を変えない。
 * 手習い帳(myList)・貝殻(wallet)には一切触れない=必ず持ち越される。桜貝も付けない(reward:0)。
 */
export function applyResultReport(state: AppState, opts: { level: Level; outcome: Outcome; date: string }): AppState {
  if (opts.outcome !== 'pass') return state;      // 不合格は壁に残さない・状態変化なし
  if (hasPassShikishi(state, opts.level)) return state; // 級ごと一度(嘘の旨味/重複を防ぐ)
  return { ...state, shikishi: [...(state.shikishi ?? []), { level: opts.level, date: opts.date }] };
}

/**
 * 発表期の「そろそろ結果が出る頃かな」を出すべきか。examDate 経過後の一定窓(既定21〜56日)で true。
 * examDate=null(好き層など)や窓外は false=催促しない。純粋。
 */
export function resultReminderDue(
  examDate: string | null | undefined,
  now: number,
  win: { from?: number; to?: number } = {},
): boolean {
  if (!examDate) return false;
  const from = win.from ?? 21;
  const to = win.to ?? 56;
  const passed = dayNo(dayStr(now)) - dayNo(examDate);
  return passed >= from && passed <= to;
}

/** 発表期のヒント台詞(願い非依存・そっと)。UIは「報告する」導線に添える。 */
export function resultHint(seed = 0, recent: readonly string[] = []): VoiceResult {
  return composeVoice({ occasion: { kind: 'result_hint' }, variant: 'short', now: 0, seed, recent });
}
