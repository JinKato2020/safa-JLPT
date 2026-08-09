// AdMob(リワード広告)の薄いラッパー。UI・起動処理はこの関数だけを呼ぶ(SDKを直接触らない)。
// 【重要】ネイティブSDKが無い環境(Expo Go・古いOTAで届いた場合)でも決して落とさない＝全て安全に no-op(広告なし)。
//         本番IDが未設定なら Google テスト広告が出る(src/config/admob.ts)。
import { Platform } from 'react-native';
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
let personalized = false; // 既定は非パーソナライズ。iOSはATT許可＋トグルON、AndroidはトグルON のときだけ true。

// iOSのATT(トラッキング許可)状態を返す。トグルONで呼ばれ、未確定なら初回だけシステムのダイアログを出す。
// Android/その他はATTが無いので常に許可扱い(トグルに従う)。モジュール未リンク(Expo Go等)は許可なし=非パーソナライズで安全側。
async function attGranted(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tt = require('expo-tracking-transparency');
    let status: string | undefined = (await tt.getTrackingPermissionsAsync?.())?.status;
    if (status === 'undetermined') status = (await tt.requestTrackingPermissionsAsync())?.status;
    return status === 'granted';
  } catch {
    return false; // 未リンク環境などは許可なし扱い
  }
}

/**
 * 起動時(オンボ完了後)に1回。広告SDKを初期化する。失敗してもアプリは止めない。
 * パーソナライズ広告の可否: iOS=「トラッキングを許可する」トグルON かつ ATTで許可された時だけ / Android=トグルON。
 * それ以外は非パーソナライズ広告(IDFA/AAIDでアプリ横断の個人追跡はしない)。
 */
export async function initAds(optIn = true): Promise<void> {
  // トグルOFFならATTを尋ねず非パーソナライズ。ONならiOSでATTを確認(初回のみダイアログ)。inited済でも毎回更新。
  personalized = optIn ? await attGranted() : false;
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
