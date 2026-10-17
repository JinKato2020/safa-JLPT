// Firebase Analytics(Google広告の最適化用イベント計測)の薄いラッパー。
// 計測はこの関数だけを呼ぶ(SDKを直接触らない)。
// 【重要】計測の失敗でアプリを落とさない。ネイティブ非搭載環境(テスト/web/Expo Go)でも
//   読み込み時に落ちないよう遅延require＋全て try/catch で握りつぶす。
//
// 標準イベント(first_open/session_start 等)は Firebase が自動収集する。
// ここで足すのは「広告の最適化ターゲットにしたい行動」= purchase / study_complete / trial_start。

type Params = Record<string, string | number | boolean | undefined>;

let _mod: { default: () => { logEvent: (n: string, p?: Params) => Promise<void> } } | null = null;
let _tried = false;

function analyticsFn(): (() => { logEvent: (n: string, p?: Params) => Promise<void> }) | null {
  if (!_tried) {
    _tried = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      _mod = require('@react-native-firebase/analytics');
    } catch {
      _mod = null; // ネイティブ非搭載環境=計測なしで安全に動く
    }
  }
  return _mod?.default ?? null;
}

/** 任意イベントを記録。失敗しても無視。 */
export async function logEvent(name: string, params?: Params): Promise<void> {
  const a = analyticsFn();
  if (!a) return;
  try {
    // undefined を除いた params だけ渡す(Firebaseは値なしキーを嫌う)
    const clean = params
      ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
      : undefined;
    await a().logEvent(name, clean as Params);
  } catch {
    /* 計測失敗はアプリに影響させない */
  }
}

/** Pro購入完了(広告の最終最適化ターゲット)。RevenueCatの購入成功時に呼ぶ。 */
export function logPurchase(p?: { value?: number; currency?: string; item_id?: string }): void {
  // Firebase標準の 'purchase' イベント。value/currency があれば売上として集計される。
  void logEvent('purchase', p);
}

/** 学習セッション完了(高頻度=初期の広告最適化に向く)。 */
export function logStudyComplete(p?: { correct?: number; total?: number; category?: string }): void {
  void logEvent('study_complete', p);
}

/** お試し開始(課金より件数が多い中間指標)。UIで「お試しを始める」を実行した時に呼ぶ。 */
export function logTrialStart(): void {
  void logEvent('trial_start');
}
