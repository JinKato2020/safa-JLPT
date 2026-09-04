// AdMob は native 専用（react-native-google-mobile-ads は web で codegen native を読み込みバンドルに失敗する）。
// Web では広告を出さない no-op スタブ。Metro が web ビルド時に ./ads → ./ads.web を自動解決する。
// ※SNSモック撮影(Expo Web で実 AICoach を描く)を成立させるための web 分岐。native の src/pro/ads.ts は不変。
export async function initAds(_optIn = true): Promise<void> {
  /* web: 何もしない */
}
export function showRewardedAd(): Promise<boolean> {
  return Promise.resolve(false);
}
