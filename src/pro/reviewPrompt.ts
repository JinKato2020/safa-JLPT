// 学習完了時の約4日ごとの評価・要望サイクル。実際の評価画面の表示可否・回数はOSが制御する。
// 満足度や成績による選別・謝礼は設けない。要望メールはユーザー操作で作成する。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { reviewIsDue } from './reviewPromptCore';

const LAST_KEY = 'review_ask_last_v1'; // 旧バージョンの日時も引き継ぐ
let checking = false;

export async function maybeAskForReview(installedAt: number, studyCompleted: boolean): Promise<boolean> {
  if (checking || !studyCompleted) return false;
  checking = true;
  try {
    const last = Number(await AsyncStorage.getItem(LAST_KEY));
    const now = Date.now();
    if (!reviewIsDue(installedAt, last, now, studyCompleted)) return false;
    // OSが表示を省略しても4日あける。旧・生涯3回のアプリ側制限は廃止。
    await AsyncStorage.setItem(LAST_KEY, String(now));
    try {
      if (await StoreReview.isAvailableAsync()) await StoreReview.requestReview();
    } catch { /* 評価機能が使えなくても要望の入口は表示する */ }
    return true;
  } catch {
    return false;
  } finally {
    checking = false;
  }
}
