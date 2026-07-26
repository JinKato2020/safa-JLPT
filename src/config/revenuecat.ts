// RevenueCat の「公開SDKキー」。アプリに埋め込んで安全な公開キーで、秘密鍵ではない(Supabaseのanonキーと同じ扱い)。
// アカウント作成後、RevenueCat ダッシュボードの各プラットフォームの Public SDK key をここに入れる。
//   iOS   : Project → API keys → Apple App Store の "appl_..." を IOS_KEY へ
//   Android: 同 → Google Play Store の "goog_..." を ANDROID_KEY へ
// 空のうちは課金機能は一切起動しない(no-op)＝アプリは今までどおり動く。キーを入れて初めて有効化される。
import { Platform } from 'react-native';

const IOS_KEY = '';     // 例: 'appl_xxxxxxxxxxxxxxxxxxxxxxxx'
const ANDROID_KEY = ''; // 例: 'goog_xxxxxxxxxxxxxxxxxxxxxxxx'

// どの商品(年額/月額/受験パック)を買っても立つ「権利」の識別子。RevenueCat の Entitlements で 'pro' を1つ作る。
export const PRO_ENTITLEMENT_ID = 'pro';

/** 今のプラットフォームの公開SDKキー。未設定なら ''(=課金を起動しない)。 */
export function revenueCatApiKey(): string {
  return (Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY).trim();
}

/** キーが入っているか(=課金を有効化してよいか)。 */
export function purchasesConfigured(): boolean {
  return revenueCatApiKey().length > 0;
}
