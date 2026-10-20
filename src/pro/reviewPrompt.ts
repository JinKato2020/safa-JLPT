// OS標準の「アプリ内レビュー」シートを、良いタイミングで“規約準拠”にお願いする薄いラッパ。
//  ・全ユーザーに同条件で出す（満足した人だけ誘導する review gating はしない）。謝礼なし・星数指定なし。
//  ・OS標準シート（iOS=SKStoreReview / Android=In-App Review API）なので文言はOSが各言語でローカライズ
//    ＝アプリ側の翻訳は不要（11言語の追加作業なし）。
//  ・頻度制限: 前回から60日以上 かつ 生涯3回まで（OSも別途 年1回程度に自動制限）。
//  呼び出し元＝学習完了(AfterStudyReward)・模試完了(MockScreen result)。失敗は握りつぶす（学習体験に影響させない）。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const LAST_KEY = 'review_ask_last_v1';   // 前回お願いした時刻(ms)
const COUNT_KEY = 'review_ask_count_v1'; // これまでにお願いした回数
const MIN_INTERVAL_MS = 60 * 24 * 60 * 60 * 1000; // 60日
const MAX_ASKS = 3;                                // 生涯の最大お願い回数

export async function maybeAskForReview(): Promise<void> {
  try {
    if (!(await StoreReview.isAvailableAsync())) return; // 非対応端末/ストア未接続は何もしない
    const [lastRaw, countRaw] = await Promise.all([
      AsyncStorage.getItem(LAST_KEY),
      AsyncStorage.getItem(COUNT_KEY),
    ]);
    const last = lastRaw ? Number(lastRaw) : 0;
    const count = countRaw ? Number(countRaw) : 0;
    if (count >= MAX_ASKS) return;
    if (last && Date.now() - last < MIN_INTERVAL_MS) return;
    // 記録を先に進めてから依頼（再入・連打で二重に出さない）。
    await AsyncStorage.multiSet([[LAST_KEY, String(Date.now())], [COUNT_KEY, String(count + 1)]]);
    await StoreReview.requestReview();
  } catch {
    /* 評価は失敗しても学習体験に影響させない */
  }
}
