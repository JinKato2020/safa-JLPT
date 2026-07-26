// RevenueCat(react-native-purchases)の薄いラッパー。UI・起動処理はこの関数だけを呼ぶ(SDKを直接触らない)。
// 【重要】キー未設定(src/config/revenuecat.ts が空)なら、全メソッドが安全に何もしない＝アプリは従来どおり動く。
// 例外は決してUIへ投げない(課金の失敗でアプリを落とさない)。Proかどうかの正本はストアのレシート。
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { revenueCatApiKey, purchasesConfigured, PRO_ENTITLEMENT_ID } from '../config/revenuecat';

let configured = false;

/** 起動時に1回。Proでなくても必要(購入・復元・権利同期の土台)。キー未設定なら何もしない。 */
export async function initPurchases(appUserID?: string | null): Promise<void> {
  if (configured || !purchasesConfigured()) return;
  try {
    // eslint-disable-next-line no-undef
    if (typeof __DEV__ !== 'undefined' && __DEV__) await Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: revenueCatApiKey(), appUserID: appUserID ?? null });
    configured = true;
  } catch {
    /* 課金初期化に失敗してもアプリは止めない */
  }
}

/** CustomerInfo から「今Proか」を読む純粋な写像。 */
function isProActive(info: CustomerInfo): boolean {
  return !!info.entitlements.active[PRO_ENTITLEMENT_ID];
}

/** RevenueCat と同期して「今Proか」を返す。呼び出し側は結果を setPurchaseActive で保存する。
 *  未設定・通信失敗時は null(=状態を変えない＝端末に保存済みの前回値を保つ)。 */
export async function syncEntitlement(): Promise<boolean | null> {
  if (!configured) return null;
  try {
    return isProActive(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

/** 購入画面に出す商品一式。未設定・失敗時は null(画面は「まもなく提供」を出す)。 */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    return (await Purchases.getOfferings()).current ?? null;
  } catch {
    return null;
  }
}

/** 購入。成功して権利(pro)が立ったら true。ユーザーキャンセル・失敗は false。 */
export async function purchase(pkg: PurchasesPackage): Promise<boolean> {
  if (!configured) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return isProActive(customerInfo);
  } catch {
    return false; // キャンセルもここに来る(RevenueCatはキャンセルを例外で返す)
  }
}

/** 購入の復元(Apple審査で必須)。復元後にProなら true。 */
export async function restore(): Promise<boolean> {
  if (!configured) return false;
  try {
    return isProActive(await Purchases.restorePurchases());
  } catch {
    return false;
  }
}

/** ログイン時: RevenueCat のユーザーを実IDへ紐付け(機種変・複数端末で権利がfollowする)。→ 現在Proか。 */
export async function linkAccount(userId: string): Promise<boolean | null> {
  if (!configured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return isProActive(customerInfo);
  } catch {
    return null;
  }
}

/** ログアウト時: 匿名IDへ戻す(すでに匿名なら例外→無視)。 */
export async function unlinkAccount(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    /* すでに匿名などは無視 */
  }
}
