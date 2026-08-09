// AdMob(リワード広告)の薄いラッパー。UI・起動処理はこの関数だけを呼ぶ(SDKを直接触らない)。
// 【重要】ネイティブSDKが無い環境(Expo Go・古いOTAで届いた場合)でも決して落とさない＝全て安全に no-op(広告なし)。
//         本番IDが未設定なら Google テスト広告が出る(src/config/admob.ts)。
import { rewardedAdUnitId, TEST_DEVICE_IDS } from '../config/admob';

// ネイティブSDKは遅延require(未リンクでも import 時に落ちない)。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any = null;
let tried = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sdk(): any {
  if (tried) return mod;
  tried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('react-native-google-mobile-ads');
  } catch {
    mod = null;
  }
  return mod;
}

let inited = false;
let personalized = true; // オンボの「トラッキングを許可する」がOFF→非パーソナライズ広告(ATTも尋ねない)。

/**
 * 起動時に1回。広告SDKを初期化する。失敗してもアプリは止めない。
 * ※ATT(トラッキング許可)の確認ダイアログは出さない方針(ユーザー指定)。
 *   トラッキング可否は設定画面のトグル(=optIn)で扱い、広告のパーソナライズ有無だけを切り替える。
 *   iOSでATT未許可なら Google SDK 側で自動的にIDFAを使わない(=個別追跡なし)ので、これで整合する。
 */
export async function initAds(optIn = true): Promise<void> {
  personalized = optIn; // 設定でトグル→次に読み込む広告から反映(inited済でも更新)
  if (inited) return;
  const m = sdk();
  if (!m) return;
  try {
    // テスト端末を登録(空なら本番広告)。本物IDでもここに載る端末はテスト広告=自分でタップしても安全。
    try {
      if (TEST_DEVICE_IDS.length > 0) {
        await m.default().setRequestConfiguration({ testDeviceIdentifiers: TEST_DEVICE_IDS });
      }
    } catch { /* 設定できなくても初期化は続ける */ }
    await m.default().initialize();
    inited = true;
  } catch {
    /* 広告初期化に失敗してもアプリは止めない */
  }
}

/**
 * リワード広告を1本 読み込んで表示する。
 * 最後まで見て報酬を得たら true。それ以外(未リンク・読み込み失敗・途中で閉じた)は false。
 * 呼び出し側は true の時だけ grantAdBonus() を呼ぶ。
 */
export function showRewardedAd(): Promise<boolean> {
  const m = sdk();
  if (!m) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    try {
      const { RewardedAd, RewardedAdEventType, AdEventType } = m;
      const ad = RewardedAd.createForAdRequest(rewardedAdUnitId(), {
        requestNonPersonalizedAdsOnly: !personalized, // 拒否した人には非パーソナライズ広告
      });
      let earned = false;
      let settled = false;
      // eslint-disable-next-line prefer-const
      let unsubs: Array<() => void> = [];
      const finish = (v: boolean) => {
        if (settled) return;
        settled = true;
        unsubs.forEach((u) => { try { u(); } catch { /* noop */ } });
        resolve(v);
      };
      unsubs = [
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          try { ad.show(); } catch { finish(false); }
        }),
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
        ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)),
        ad.addAdEventListener(AdEventType.ERROR, () => finish(false)),
      ];
      ad.load();
      // 保険: 一定時間 読み込めなければ諦める(UIが固まらないように)
      setTimeout(() => finish(false), 20000);
    } catch {
      resolve(false);
    }
  });
}
