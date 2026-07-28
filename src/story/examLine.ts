// 受験日の一言(前夜/当日/翌日)。examDate から発火タイミングを決め、減衰 perDay:1 で1日1回だけ桜が一言。
// 【誤発火しない】examDate=null(「好き」層など試験日を持たない人)は必ず null を返す。純関数・副作用なし。
// 仕様: docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md §5 / 台詞正本: voice.ts の exam:{eve,day,after}
import { dayStr, type AppState } from '../store/state';
import { intensityFor, recordDecay } from './decay';
import { composeVoice, type VoiceResult } from './voice';

const EXAM = 'exam';

export type ExamTiming = 'eve' | 'day' | 'after';
export interface ExamLine extends VoiceResult { timing: ExamTiming }

// YYYY-MM-DD → 通日番号(TZ非依存)。
function dayNo(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * 受験日と今日の関係 → 前夜(-1)/当日(0)/翌日(+1)。examDate 未設定・範囲外は null(=一言を出さない)。
 * 「好き」層など examDate:null の人は常に null になり、受験日の演出は一切発火しない。
 */
export function examTiming(examDate: string | null | undefined, now: number): ExamTiming | null {
  if (!examDate) return null;
  const until = dayNo(examDate) - dayNo(dayStr(now));
  if (until === 1) return 'eve';
  if (until === 0) return 'day';
  if (until === -1) return 'after';
  return null;
}

/**
 * 今日の「受験日の一言」(なければ null)。願い別台詞＋減衰 perDay:1 で1日1回に絞る。副作用なし(記録は markExamShown)。
 * 出す/出さないの判定のみ。UI はこの text をそのまま桜の一言として表示する。
 */
export function examLineToday(
  state: AppState,
  now: number,
  opts: { reduceMotion?: boolean; seed?: number; recent?: readonly string[] } = {},
): ExamLine | null {
  const timing = examTiming(state.settings.examDate, now);
  if (!timing) return null;
  // perDay:1 → 今日すでに出していれば none。
  if (intensityFor(state.storyDecay, EXAM, { now, reduceMotion: opts.reduceMotion }) === 'none') return null;
  const res = composeVoice({
    occasion: { kind: 'exam', timing, wish: state.settings.wish },
    variant: 'full',
    now,
    seed: opts.seed ?? 0,
    recent: opts.recent,
  });
  if (!res.text) return null;
  return { ...res, timing };
}

/** 受験日の一言を「今日出した」と記録した新 state を返す(純粋・入力不変)。 */
export function markExamShown(state: AppState, now: number): AppState {
  return { ...state, storyDecay: recordDecay(state.storyDecay, EXAM, now) };
}
