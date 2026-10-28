import type { Level } from '../engine/engine';

export const LEVEL_OFFERING_ID = 'jlpt_lifetime_levels';
export const LEVEL_PRODUCTS = {
  N3: { product: 'JLPT_PRO_N3', entitlement: 'pro_n3', package: 'n3_lifetime' },
  N4: { product: 'JLPT_PRO_N4', entitlement: 'pro_n4', package: 'n4_lifetime' },
  N5: { product: 'JLPT_PRO_N5', entitlement: 'pro_n5', package: 'n5_lifetime' },
} as const;
export const PURCHASE_LEVELS: Level[] = ['N5', 'N4', 'N3'];
export type PurchaseAccess = { allLevels: boolean; levels: Level[] };
export const EMPTY_PURCHASE_ACCESS: PurchaseAccess = { allLevels: false, levels: [] };

type Entitlement = { isActive?: boolean; productIdentifier?: string; isSandbox?: boolean };
export type PurchaseInfo = { entitlements: { active: Record<string, Entitlement> } };
export function purchaseAccessFromInfo(info: PurchaseInfo): PurchaseAccess {
  const active = info.entitlements.active;
  return {
    allLevels: !!active.pro && active.pro.isActive !== false,
    levels: PURCHASE_LEVELS.filter(level => {
      const e = active[LEVEL_PRODUCTS[level].entitlement];
      return !!e && e.isActive !== false;
    }),
  };
}

export function levelForPackage(identifier: string): Level | null {
  return PURCHASE_LEVELS.find(level => LEVEL_PRODUCTS[level].package === identifier) ?? null;
}

export function hasPurchasedLevel(access: PurchaseAccess, level: Level): boolean {
  return access.levels.includes(level);
}

/** A package must be paired with the SAME product as its entitlement. */
export function purchasedPackage(info: PurchaseInfo, identifier: string, productId: string): boolean {
  const level = levelForPackage(identifier);
  if (!level) return false;
  const entitlement = info.entitlements.active[LEVEL_PRODUCTS[level].entitlement];
  return !!entitlement && entitlement.isActive !== false && entitlement.productIdentifier === productId;
}
