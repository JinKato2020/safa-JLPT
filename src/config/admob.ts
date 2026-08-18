// AdMob(react-native-google-mobile-ads)の設定値。UI・起動処理は src/pro/ads.ts だけがここを見る。
// 【重要】本番IDが未設定なら Google 公式の「テスト広告ID」を使う＝実広告を出さず安全に動作確認できる。
//         本番リリース前に、AdMob で作った本物のIDへ置き換える(下の空文字を埋める)。
//
// ■ アプリID(ca-app-pub-XXXX~YYYY)は app.json の "react-native-google-mobile-ads" プラグインに書く。
//   いまはそこに Google のサンプルアプリID(ca-app-pub-3940256099942544~…)が入っている。
//   AdMob でアプリを登録したら、app.json の androidAppId / iosAppId を本物に置き換えること。
// ■ 広告ユニットID(ca-app-pub-XXXX/YYYY)は下でJSから参照するのでここに書く。
import { Platform } from 'react-native';

// ↓↓↓ AdMob で「リワード広告」ユニットを作ったら、ここを本物のユニットIDに置き換える(iOS/Android 別々)。
const IOS_REWARDED_ID = 'ca-app-pub-8926100627445480/4757634081';
const ANDROID_REWARDED_ID = 'ca-app-pub-8926100627445480/7192225739';

// Google 公式のテスト用リワードID(未設定時のフォールバック。テスト広告しか出ない=規約違反にならない)
const TEST_REWARDED_IOS = 'ca-app-pub-3940256099942544/1712485313';
const TEST_REWARDED_ANDROID = 'ca-app-pub-3940256099942544/5224354917';

// テスト端末のID。ここに入れた端末は、本物IDでも「テスト広告」が出る(自分でタップしても安全)。
// 端末IDの調べ方: 一度アプリで広告を出すと、端末のログに
//   「Use RequestConfiguration.Builder.setTestDeviceIds(Arrays.asList("XXXX")) to get test ads」
// と表示される。その "XXXX" をここに足して再ビルドする。空のままなら全員に本番広告(=本番挙動)。
export const TEST_DEVICE_IDS: string[] = [];

// 【一時・公開前の動作確認用】true の間は、本物のユニットIDが入っていても Google のテスト広告を出す。
// 理由: アプリがストア未公開(AdMob承認状況=要審査)の間は本番広告が配信されない。テスト広告なら公開前でも出るので
//       「広告の読み込み〜表示までアプリ側が正常に動くか」を確認できる。テスト広告が出れば残る原因はAdMob審査だけ。
// ⚠ 一般公開の前に必ず false に戻すこと(本番アプリでテスト広告を出すのはポリシー違反)。
export const FORCE_TEST_ADS = true;

/** 本番のリワードIDが設定済みか(=テストでなく本物の広告を出す状態か)。UIの表示切替に使える。 */
export function adsConfigured(): boolean {
  const id = Platform.OS === 'ios' ? IOS_REWARDED_ID : ANDROID_REWARDED_ID;
  return id.trim().length > 0;
}

/** いま使うリワード広告ユニットID(本番が空ならテストID)。 */
export function rewardedAdUnitId(): string {
  if (FORCE_TEST_ADS) return Platform.OS === 'ios' ? TEST_REWARDED_IOS : TEST_REWARDED_ANDROID;
  if (Platform.OS === 'ios') return IOS_REWARDED_ID.trim() || TEST_REWARDED_IOS;
  return ANDROID_REWARDED_ID.trim() || TEST_REWARDED_ANDROID;
}
