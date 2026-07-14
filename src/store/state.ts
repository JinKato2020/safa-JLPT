// アプリ永続状態の型と初期値・日付ヘルパー。
import type { ItemState, Level } from '../engine/engine';
import type { SaveRef } from '../quiz/quiz';

export type { SaveRef };

// テーマ = ライト/ダーク/自動 ＋ 水彩(桜/空/緑/藤/茜。ライト系＋淡い水彩背景)。
export type ThemeMode = 'light' | 'dark' | 'auto' | 'sakura' | 'sky' | 'green' | 'fuji' | 'akane';
export const WATERCOLOR_THEMES = ['sakura', 'sky', 'green', 'fuji', 'akane'] as const;
export type WatercolorTheme = (typeof WATERCOLOR_THEMES)[number];
export const isWatercolor = (t?: ThemeMode): t is WatercolorTheme => !!t && (WATERCOLOR_THEMES as readonly string[]).includes(t);

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
  accountPromptSeen?: boolean; // 初回のアカウント登録案内を表示済み(旧stateには無い→未表示)
  uiLang?: string;         // UI表示言語(未設定→端末言語を自動判定)
  telemetry?: boolean;     // 利用状況の匿名送信(未設定/true=ON, false=停止)
  badgeSet?: 'natural' | 'gorgeous'; // バッジ/勲章のデザインセット(未設定→natural)
  listeningAudioMode?: 'stream' | 'download'; // 聴解音声: 都度配信(stream)/レベル一括DL(download)。未設定→download(従来挙動)
  font?: 'system' | 'maru' | 'mincho' | 'kyokasho'; // 表示フォント(未設定→maru=丸ゴシック)。App Bから移植
  kakitoriGrid?: 'none' | 'ta' | 'kome';   // 書き取りグリッド(未設定→kome=米字格)
  kakitoriSpeed?: 'slow' | 'normal' | 'fast'; // 書き順アニメ速度(未設定→normal)
  kakitoriSound?: boolean;                  // 合格時の読み上げTTS(未設定→ON)
  kakitoriMode?: 'drill' | 'free';          // ドリル/自由練習(未設定→drill)
}

export interface Streak {
  current: number;
  longest: number;
  lastStudyDay: string | null; // YYYY-MM-DD
  freezes: number;             // 連続を守るフリーズ残数
  history: string[];           // 学習した日(YYYY-MM-DD)
}

export interface GrowthPoint {
  day: string;       // YYYY-MM-DD
  learned: number;   // その日時点の「覚えた語」数(成長カーブ用スナップショット)
  passProb?: number; // その日時点の合格率(%)。合格率推移グラフ用。旧データには無い→省略可。
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
  kakitori?: Record<string, { step: number; stars: number; best: number; due?: string; interval?: number; reps?: number }>; // 漢字書き取り進捗(char→) 旧stateには無い→省略可
  myList?: SaveRef[]; // my単語帳(保存した語/文法)。旧stateには無い→省略可(実質[])。
  studySeconds?: number; // 累計学習時間(秒)。アプリ前面滞在秒を加算。旧stateには無い→0扱い。
  wallet?: { points: number };          // 所持桜貝(内部通貨)。未設定→0
  owned?: string[];                     // 購入済みアイテムID(着せ替え)
  equipped?: { hair?: string; outfit?: string; brush?: string; companion?: string; tool?: string }; // 着せ替え(髪型/服/筆)・仲間の装備中ID。背景・フォントは settings で反映
  claimedMilestones?: string[];         // 節目付与の重複防止
  dailyEarn?: { day: string; amount: number }; // 1日獲得上限の当日累計
  updatedAt?: number; // 最終更新(epoch ms)。クラウド同期のLWW比較基準。旧stateには無い→0扱い。
}

/** 保存/同期用に updatedAt を刻んだ複製を返す(純関数・入力は不変)。 */
export function withUpdatedAt(state: AppState, now: number): AppState {
  return { ...state, updatedAt: now };
}

/** my単語帳トグル(純粋関数・テスト可能): 同一type+idが既存なら削除、無ければ追加。 */
export function toggleMyList(list: SaveRef[], ref: SaveRef): SaveRef[] {
  const i = list.findIndex((r) => r.type === ref.type && r.id === ref.id);
  if (i >= 0) return [...list.slice(0, i), ...list.slice(i + 1)];
  return [...list, ref];
}

/** my単語帳に既に登録済みか(UI側の「登録済み✓」表示判定用)。 */
export function isInMyList(list: SaveRef[] | undefined, ref: SaveRef): boolean {
  return !!list?.some((r) => r.type === ref.type && r.id === ref.id);
}

export const STATE_VERSION = 1;

export const INITIAL_STATE: AppState = {
  version: STATE_VERSION,
  settings: { level: 'N4', l1: 'vi', examDate: null, theme: 'dark', reminder: null, onboarded: false, tourDone: false },
  items: {},
  streak: { current: 0, longest: 0, lastStudyDay: null, freezes: 2, history: [] },
  growth: [],
  mockHistory: [],
  myList: [],
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
