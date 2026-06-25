// アプリ永続状態の型と初期値・日付ヘルパー。
import type { ItemState, Level } from '../engine/engine';

export type ThemeMode = 'light' | 'dark' | 'auto';

export type TargetExam = 'jlpt' | 'jft'; // 目標試験(JLPT / JFT-Basic)。未設定=jlpt。

export interface Settings {
  level: Level;            // 目標級(JLPTのみ。JFTはレベル選択なし=知識ベースはN4/A2)
  targetExam?: TargetExam; // 目標試験プロファイル(未設定→jlpt)
  l1: string;              // 母語コード (vi/ne/id/my/en/zh)
  examDate: string | null; // 試験日 YYYY-MM-DD
  theme: ThemeMode;
  reminder: string | null; // 学習リマインド "HH:MM"
  onboarded: boolean;      // オンボーディング(自己チェック)完了
  tourDone?: boolean;      // 初回ガイドツアー完了(旧stateには無い→未完扱い)
  uiLang?: string;         // UI表示言語(未設定→端末言語を自動判定)
  telemetry?: boolean;     // 利用状況の匿名送信(未設定/true=ON, false=停止)
}

export interface Streak {
  current: number;
  longest: number;
  lastStudyDay: string | null; // YYYY-MM-DD
  freezes: number;             // 連続を守るフリーズ残数
  history: string[];           // 学習した日(YYYY-MM-DD)
}

export interface GrowthPoint {
  day: string;     // YYYY-MM-DD
  learned: number; // その日時点の「覚えた語」数(成長カーブ用スナップショット)
}

// 模試の採点記録(成長可視化用)。
export interface MockResult {
  ts: number;    // epoch ms(時系列)
  day: string;   // YYYY-MM-DD
  pct: number;   // 正答率 0-100
  correct: number;
  total: number;
  full: boolean; // フル模試(true)/ミニ(false)
}

export interface AppState {
  version: number;
  settings: Settings;
  items: Record<string, ItemState>; // itemId → 習得状態
  streak: Streak;
  growth?: GrowthPoint[];           // 学習日ごとの習得数(旧stateには無い→省略可)
  mockHistory?: MockResult[];       // 模試の採点履歴(旧stateには無い→省略可)
}

export const STATE_VERSION = 1;

export const INITIAL_STATE: AppState = {
  version: STATE_VERSION,
  settings: { level: 'N4', l1: 'vi', examDate: null, theme: 'auto', reminder: null, onboarded: false, tourDone: false },
  items: {},
  streak: { current: 0, longest: 0, lastStudyDay: null, freezes: 2, history: [] },
  growth: [],
  mockHistory: [],
};

/** epoch ms → ローカル日付 YYYY-MM-DD */
export function dayStr(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** b - a の日数差(YYYY-MM-DD同士) */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** YYYY-MM-DD に delta 日加算(カレンダー演算・UTCで安定)。 */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** today を末尾に、過去 n 日分の日付配列(古い順)。週間バー/カレンダー用。 */
export function lastNDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
}
