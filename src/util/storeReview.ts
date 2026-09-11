// アプリ評価の導線。本番はOSの評価ダイアログ(Apple/Google推奨・アプリ内で完結)を出すが、
// これは仕様上「開発ビルド・シミュレータ・頻度制限下」では何も表示されない(強制表示はAppleが禁止)。
// そこで、ユーザーが明示的に「評価する」を押した時や開発プレビューでは、ストアのレビュー投稿ページを
// 直接開いて「押したのに何も起きない(リンク切れに見える)」を防ぐ。
import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

const IOS_APP_ID = '6782896670'; // App Store の数値ID(eas.json ascAppId)
const ANDROID_PKG = 'com.safa.english'; // Android パッケージ名(app.json android.package)

/** ストアのレビュー投稿ページ(アプリ内スキーム)。 */
function reviewDeepLink(): string {
  return Platform.OS === 'android'
    ? `market://details?id=${ANDROID_PKG}`
    : `itms-apps://itunes.apple.com/app/id${IOS_APP_ID}?action=write-review`;
}

/** ストアのレビュー投稿ページ(ブラウザ用・スキームが開けない時のフォールバック)。 */
function reviewWebLink(): string {
  return Platform.OS === 'android'
    ? `https://play.google.com/store/apps/details?id=${ANDROID_PKG}`
    : `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`;
}

/**
 * アプリ評価をお願いする。
 *  forceStore=false(既定): 本番はOSの評価ダイアログ。使えない環境ならストアのレビューページへ。
 *  forceStore=true(開発プレビュー等): 必ずストアのレビューページを開いて動作確認できるようにする。
 */
export async function askStoreReview(forceStore = false): Promise<void> {
  if (!forceStore) {
    try {
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        return;
      }
    } catch {
      /* 使えない環境 → ストアページへフォールバック */
    }
  }
  try {
    await Linking.openURL(reviewDeepLink());
    return;
  } catch {
    /* スキームが開けない → ブラウザURLへ */
  }
  try {
    await Linking.openURL(reviewWebLink());
  } catch {
    /* 開けなくてもアプリは落とさない */
  }
}
