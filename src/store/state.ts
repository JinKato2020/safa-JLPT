// アプリ永続状態の型と初期値・日付ヘルパー。
import type { ItemState, Level } from '../engine/engine';
import type { SaveRef } from '../quiz/quiz';
import type { MasterySlice } from '../review/facetMastery';

export type { SaveRef };

// テーマ = ライト/ダーク/自動 ＋ 水彩(桜/空/緑/藤/茜。ライト系＋淡い水彩背景)。
export type ThemeMode = 'light' | 'dark' | 'auto' | 'sakura' | 'sky' | 'green' | 'fuji' | 'akane';
export const WATERCOLOR_THEMES = ['sakura', 'sky', 'green', 'fuji', 'akane'] as const;
export type WatercolorTheme = (typeof WATERCOLOR_THEMES)[number];
export const isWatercolor = (t?: ThemeMode): t is WatercolorTheme => !!t && (WATERCOLOR_THEMES as readonly string[]).includes(t);

export type TargetExam = 'jlpt' | 'jft'; // 目標試験(JLPT / JFT-Basic)。未設定=jlpt。

// 演出の減衰カウンタ(接点ID→回数)。total=通算表示回数 / skips=見送り回数 / lastDay=最終接触(dayStr) / dayCount=当日回数。§6
export interface DecayCounter { total: number; skips: number; lastDay: string; dayCount: number }

export interface Settings {
  level: Level;            // 目標級(JLPTのみ。JFTはレベル選択なし=知識ベースはN4/A2)
  targetExam?: TargetExam; // 目標試験プロファイル(未設定→jlpt)
  l1: string;              // 母語コード (vi/ne/id/my/en/zh)
  examDate: string | null; // 試験日 YYYY-MM-DD
  theme: ThemeMode;
  reminder: string | null; // 学習リマインド "HH:MM"
  onboarded: boolean;      // オンボーディング(自己チェック)完了
  // 広場/町のプロフィール(オンボーディングで入力)。未設定=未入力(旧stateにも無い)
  nickname?: string;       // 表示名(自由入力)
  country?: string;        // 国コード(ISO2, 例 'VN'。'XX'=その他)
  gender?: 'm' | 'f';      // アバターの性別
  avatar?: string;         // アバターのコード(avatars.ts)
  handed?: 'right' | 'left'; // 町のカーソル(スティック)を置く側。未設定→right(右利き=右手の親指で操作)
  mood?: string;           // 町アバターの定型ムード(努力タイプ)のキー(moods.ts)。会話カードで相手に見える。未設定→既定
  studying?: string;       // 町アバターに表示する「いま勉強している分野」の定型選択。未設定→非表示
  personality?: string;    // 性格(20種・persona.ts)のキー。最初のアバター設定で選ぶ。会話カードに表示
  moodMsg?: string;        // ムードメッセージ(20種・persona.ts)のキー。いまの気分の定型ひとこと。会話カード/頭上に表示
  accountPromptSeen?: boolean; // 初回のアカウント登録案内を表示済み(旧stateには無い→未表示)
  uiLang?: string;         // UI表示言語(未設定→端末言語を自動判定)
  telemetry?: boolean;     // 利用状況の匿名送信(未設定/true=ON, false=停止)
  adTracking?: boolean;    // 広告トラッキング許可(オンボの既定ON。未設定/true=許可, false=拒否→ATTを尋ねず非パーソナライズ広告)
  badgeSet?: 'natural' | 'gorgeous'; // バッジ/勲章のデザインセット(未設定→natural)
  listeningAudioMode?: 'stream' | 'download'; // 聴解音声: 都度配信(stream)/レベル一括DL(download)。未設定→download(従来挙動)
  listeningRate?: number;  // 聴解音声の再生スピード(0.5〜1.5。未設定→1.0=等速)
  font?: 'system' | 'maru' | 'mincho' | 'kyokasho'; // 表示フォント(未設定→maru=丸ゴシック)。App Bから移植
  kakitoriGrid?: 'none' | 'ta' | 'kome';   // 書き取りグリッド(未設定→kome=米字格)
  kakitoriSpeed?: 'slow' | 'normal' | 'fast'; // 書き順アニメ速度(未設定→normal)
  kakitoriSound?: boolean;                  // 合格時の読み上げTTS(未設定→ON)
  kakitoriMode?: 'drill' | 'free';          // ドリル/自由練習(未設定→drill)
  devUnlimitedPoints?: boolean;             // 【開発用】ON=桜貝を無限に扱い、ショップで無制限購入
  devPro?: boolean;                         // 【開発用】ON=Pro課金状態 / OFF=無課金として扱う
  devFree?: boolean;                        // 【開発用】ON=無料ユーザー扱い(お試し中でも無料・1日の上限も実際にかける)
  devPassPct?: number | null;               // 【開発用】0-100を設定するとhomeStatus.passPctを固定(辞書背景/AIコーチ等の挙動確認)。null/未設定=自動計算
  devRewardHalf?: boolean;                   // 【開発用】ON=ご褒美イラストを1/2(2回に1回)出す。通常は約1/10(REWARD_EVERY=10)
  devUnlimitedMock?: boolean;                // 【開発用】ON=模試チケットを消費せず無制限に受験できる(チケット0でも開始可)
  devMockSkip?: boolean;                      // 【開発用】ON=模試中に「次の休憩へ」スキップボタンを表示(現ブロックの設問を全カットして次の休憩/終了へ)
  devUnlockAll?: boolean;                      // 【開発用】ON=書斎の学習モードを全体カバー率に関係なく全解禁(動作確認用)。ポイント無限とは独立
  lastSakuraSpeechAt?: number | null;       // 桜の癒し吹き出しを最後に出した時刻(ms)。約5時間に1度に絞るためのゲート
  sakuraRecoDay?: string;                    // 桜が「今日のオススメ」案内を出した日(YYYY-M-D)。毎日最初の一言だけこの案内にする
  afterStudyCount?: number;                  // 学習後のご褒美(イラスト＋励まし＋AIコーチ)を約10回に1度出すためのカウンタ
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
  // 予想得点(客観)。旧stateには無い=省略可。AIコーチ「模試の記録」で最新値・推移・区分別を可視化。
  level?: string;                 // 受験級(N5/N4/N3)
  predScore?: number;             // 予想得点(得点)
  predMax?: number;               // 満点(JLPTは180)
  passTotal?: number;             // 合格ライン(点)
  sections?: { key: string; score: number; max: number; min: number; below: boolean }[]; // 区分別の予想得点
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
  equipped?: { hair?: string; outfit?: string; brush?: string; costume?: string; companion?: string; tool?: string }; // 着せ替え(髪型/服/筆/民族衣装)・仲間の装備中ID。背景・フォントは settings で反映
  claimedMilestones?: string[];         // 節目付与の重複防止
  dailyEarn?: { day: string; amount: number }; // 1日獲得上限の当日累計
  storyDecay?: Record<string, DecayCounter>; // 演出の減衰カウンタ(接点ID→回数)。出迎えの1日1回もここに吸収。§6
  installedAt?: number;                 // 初回起動(ダウンロード)日時 epoch ms。模試チケット月次付与の起点。未設定→初回起動で確定。
  trialStartedAt?: number;              // 無料お試し(7日Pro)の起点 epoch ms。正本はサーバー(entitlements.trial_claimed_at)で、ログイン時に trial-claim から注入。アカウント単位で1回だけ発行=再インストール→再ログインしても再付与されない(荒稼ぎ防止)。未ログイン/未受取=未設定=お試しなし。
  mockTickets?: number;                 // 模試チケット所持数(上限3)。未設定→0(初回起動で1付与)。
  mockGrantsClaimed?: number;           // 消化済み月次付与数(installedAtからの経過月と比較して差分を付与)。
  avatarChangeTokens?: number;          // アバター変更券の所持数。登録後アバターは既定で変更不可。「すがた変えドリンク」購入で+1、変更実行で-1。未設定→0
  unlocksSeen?: string[];               // 書斎タブの段階解禁で「解禁演出を見せ済み」のモードキー。未設定→初回に現解禁分を無音でseed(既存ユーザーが一斉に演出されないように)
  entitlements?: {              // Pro(有料)の権利。未設定→無料
    purchaseActive?: boolean;   // RevenueCat同期結果のキャッシュ(正本はストアのレシート)
    purchaseCheckedAt?: number; // 最後に同期できた時刻 epoch ms
    proUntil?: number;          // 期限つきPro(紹介など)の終了時刻 epoch ms
  };
  dailyQuota?: { day: string; used: number; bonus: number }; // 1日の練習回数。day=YYYY-MM-DD / used=今日始めた回数 / bonus=広告で足した回数
  referral?: {                    // 紹介制度。未設定→未参加。継続の起点は installedAt を流用。
    qualifyingDays?: string[];    // 適格学習日(その日に1セット≒60問以上完了)ISO(YYYY-MM-DD)配列
    enteredCode?: string;         // 新規が初回入力した紹介コード(成立時にこのコードで報告)
    referredQualified?: number;   // 自分が紹介して「継続(qualified/rewarded)」に達した人数。サーバーから取得しキャッシュ(テレメトリ/アカウント画面で参照)。
  };
  mastery?: MasterySlice;   // 単語×面(read/write/mean/listen/grammar)の統合苦手度。統合復習/予想得点の正本。旧stateには無い→移行で構築。
  masteryMigrated?: boolean; // 旧キー(items/kakitori)→面の一度きり移行を済ませたか。undefined/false=未移行。
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

// 初期から所持＋装備している髪型(標準=ロング)。ショート装備後もここへ戻せるよう、既存ユーザーにも所持を補完する。
export const DEFAULT_HAIR_ID = 'hair_long';
// 「なし」= 装備を外す選択肢。初期から所持＋既定装備(=筆/民族衣装は未装備の見た目)。
export const NONE_BRUSH_ID = 'brush_none';
export const NONE_COSTUME_ID = 'costume_none';
// 仲間(柴犬)。柴1(茶①)は初期から所持＋装備＝はじめの仲間。有効な仲間ID一覧(旧仮ペット等の無効IDを既定へ戻す判定に使う)。
export const DEFAULT_COMPANION_ID = 'pet_shiba1';
export const COMPANION_IDS = [
  'pet_shiba1', 'pet_shiba2', 'pet_shiba3', 'pet_shiba4', 'pet_shiba5', 'pet_shiba6',
  'pet_kuro1', 'pet_kuro2', 'pet_kuro3', 'pet_kuro4', 'pet_kuro5', 'pet_kuro6',
];
// 既存ユーザーにも所持を補完すべき既定アイテム(装備を外せるように・はじめの仲間を持たせる)。
export const DEFAULT_OWNED = [DEFAULT_HAIR_ID, NONE_BRUSH_ID, NONE_COSTUME_ID, DEFAULT_COMPANION_ID];

export const INITIAL_STATE: AppState = {
  version: STATE_VERSION,
  settings: { level: 'N4', l1: 'vi', examDate: null, theme: 'light', reminder: null, onboarded: false, font: 'mincho', telemetry: true, adTracking: true },
  items: {},
  streak: { current: 0, longest: 0, lastStudyDay: null, freezes: 2, history: [] },
  growth: [],
  mockHistory: [],
  myList: [],
  owned: [...DEFAULT_OWNED],
  equipped: { hair: DEFAULT_HAIR_ID, brush: NONE_BRUSH_ID, costume: NONE_COSTUME_ID, companion: DEFAULT_COMPANION_ID },
  mastery: {},
  masteryMigrated: true, // 新規インストールは移行対象の旧データが無い＝済み扱い。旧ユーザーはloadStateの移行が偽→実行。
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
