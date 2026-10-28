// RevenueCat(react-native-purchases)の薄いラッパー。UI・起動処理はこの関数だけを呼ぶ(SDKを直接触らない)。
// 【重要】キー未設定(src/config/revenuecat.ts が空)なら、全メソッドが安全に何もしない＝アプリは従来どおり動く。
// 例外は決してUIへ投げない(課金の失敗でアプリを落とさない)。Proかどうかの正本はストアのレシート。
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { revenueCatApiKey, purchasesConfigured } from '../config/revenuecat';
import { LEVEL_OFFERING_ID, LEVEL_PRODUCTS, purchaseAccessFromInfo, purchasedPackage, levelForPackage, type PurchaseAccess } from './levelPurchases';
import { logPurchase } from '../analytics/analytics';

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

/** RevenueCat と同期して購入権利一式を返す。呼び出し側は結果を setPurchaseAccess で保存する。
 *  未設定・通信失敗時は null(=状態を変えない＝端末に保存済みの前回値を保つ)。 */
export async function syncEntitlement(): Promise<PurchaseAccess | null> {
  if (!configured) return null;
  try {
    return purchaseAccessFromInfo(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

/** CustomerInfo が更新される度(購入直後の遅延付与・自動更新・他端末での変化)に購入権利一式をコールバック。
 *  戻り値=解除関数。購入直後に権利が返らずPROに切り替わらない不具合の保険(手動Restore不要にする)。 */
export function addProUpdateListener(cb: (access: PurchaseAccess) => void): () => void {
  if (!configured) return () => {};
  try {
    const listener = (info: CustomerInfo) => cb(purchaseAccessFromInfo(info));
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => { try { Purchases.removeCustomerInfoUpdateListener(listener); } catch { /* noop */ } };
  } catch {
    return () => {};
  }
}

/** 購入画面に出す商品一式。未設定・失敗時は null(画面は「まもなく提供」を出す)。 */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    // Defaultは旧公開版向けに温存。新アプリはレベル別買い切りだけを提示する。
    return (await Purchases.getOfferings()).all[LEVEL_OFFERING_ID] ?? null;
  } catch {
    return null;
  }
}

/** 購入。選択した商品と対応するレベル権利を確認する。キャンセル・失敗は null。 */
export async function purchase(pkg: PurchasesPackage): Promise<{ access: PurchaseAccess; confirmed: boolean } | null> {
  if (!configured || !levelForPackage(pkg.identifier)) return null;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const confirmed = purchasedPackage(customerInfo, pkg.identifier, pkg.product.identifier);
    const level = levelForPackage(pkg.identifier)!;
    if (confirmed && !customerInfo.entitlements.active[LEVEL_PRODUCTS[level].entitlement]?.isSandbox) {
      logPurchase({ value: pkg.product.price, currency: pkg.product.currencyCode, item_id: pkg.product.identifier });
    }
    return { access: purchaseAccessFromInfo(customerInfo), confirmed };
  } catch { return null; } // キャンセル・通信失敗は権利キャッシュを消さない。
}

/** 購入の復元(Apple審査で必須)。復元した購入権利一式を返す。 */
export async function restore(): Promise<PurchaseAccess | null> {
  if (!configured) return null;
  try {
    return purchaseAccessFromInfo(await Purchases.restorePurchases());
  } catch {
    return null;
  }
}

/** ログイン時: RevenueCat のユーザーを実IDへ紐付け(機種変・複数端末で権利がfollowする)。→ 現在Proか。 */
export async function linkAccount(userId: string): Promise<PurchaseAccess | null> {
  if (!configured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return purchaseAccessFromInfo(customerInfo);
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
