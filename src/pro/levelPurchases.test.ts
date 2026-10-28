import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseAccessFromInfo, purchasedPackage, levelForPackage, type PurchaseInfo } from './levelPurchases';
import { proStatus, setPurchaseAccess } from './entitlement';
import { INITIAL_STATE } from '../store/state';
import { quotaFor } from './dailyQuota';
import { syncMockTickets, canBuyMockTicket } from '../store/tickets';
import { mergeRestoredState } from '../auth/sync';

const now = Date.UTC(2026, 9, 28, 12);
const info = (active: PurchaseInfo['entitlements']['active']): PurchaseInfo => ({ entitlements: { active } });
const n3 = info({ pro_n3: { isActive: true, productIdentifier: 'JLPT_PRO_N3' } });

test('N3 lifetime unlocks only N3, including after a long time offline', () => {
  const access = purchaseAccessFromInfo(n3);
  assert.deepEqual(access, { allLevels: false, levels: ['N3'] });
  const state = setPurchaseAccess(INITIAL_STATE, access, now, 'account-a');
  for (const time of [now, now + 10 * 365 * 86400000]) {
    assert.equal(proStatus(state, time, 'N3').isPro, true);
    assert.equal(proStatus(state, time, 'N4').isPro, false);
    assert.equal(proStatus(state, time, 'N5').isPro, false);
  }
  assert.equal(quotaFor({ ...state, settings: { ...state.settings, level: 'N3' } }, now).unlimited, true);
  assert.equal(quotaFor({ ...state, settings: { ...state.settings, level: 'N4' } }, now).unlimited, false);
});

test('restore combines levels; refunds replace rather than accumulate cached rights', () => {
  const access = purchaseAccessFromInfo(info({
    ...n3.entitlements.active, pro_n5: { isActive: true }, pro_n4: { isActive: false },
  }));
  assert.deepEqual(access.levels, ['N5', 'N3']);
  const state = setPurchaseAccess(INITIAL_STATE, access, now, 'account-a');
  const revoked = setPurchaseAccess(state, purchaseAccessFromInfo(info({})), now + 1, 'account-a');
  assert.equal(proStatus(revoked, now, 'N3').isPro, false);
  assert.deepEqual(revoked.entitlements?.purchaseLevels, []);
});

test('legacy global purchases and referral rights remain valid on all levels', () => {
  const legacy = setPurchaseAccess(INITIAL_STATE, purchaseAccessFromInfo(info({ pro: { isActive: true } })), now);
  for (const level of ['N3', 'N4', 'N5'] as const) assert.equal(proStatus(legacy, now, level).isPro, true);
  const referral = { ...INITIAL_STATE, entitlements: { proUntil: now + 1000 } };
  const state = setPurchaseAccess(referral, purchaseAccessFromInfo(n3), now, 'a');
  assert.equal(state.entitlements?.proUntil, now + 1000);
  assert.equal(proStatus(state, now, 'N4').source, 'referral');
  assert.equal(proStatus({ ...state, settings: { ...state.settings, devFree: true } }, now, 'N3').isPro, false);
});

test('purchase success requires the selected package, product and matching entitlement', () => {
  assert.equal(purchasedPackage(n3, 'n3_lifetime', 'JLPT_PRO_N3'), true);
  assert.equal(purchasedPackage(n3, 'n4_lifetime', 'JLPT_PRO_N4'), false);
  assert.equal(purchasedPackage(n3, 'n3_lifetime', 'JLPT_PRO_N4'), false);
  assert.equal(purchasedPackage(n3, '$rc_monthly', 'JLPT_PRO_N3'), false);
  assert.equal(levelForPackage('n5_lifetime'), 'N5');
  assert.equal(levelForPackage('$rc_lifetime'), null);
});

test('switching to an unowned level preserves tickets but cannot buy tickets there', () => {
  const purchased = setPurchaseAccess(INITIAL_STATE, purchaseAccessFromInfo(n3), now);
  const state = { ...purchased, settings: { ...purchased.settings, level: 'N3' as const }, wallet: { points: 9999 } };
  const granted = syncMockTickets(state, now);
  assert.equal(granted.mockTickets, 1);
  assert.equal(canBuyMockTicket(granted, now), true);
  const free = syncMockTickets({ ...granted, settings: { ...granted.settings, level: 'N4' } }, now + 1);
  assert.equal(free.mockTickets, 1);
  assert.equal(free.proSince, now);
  assert.equal(canBuyMockTicket(free, now), false);
  const back = syncMockTickets({ ...free, settings: { ...free.settings, level: 'N3' } }, now + 2);
  assert.equal(back.mockTickets, 1);
});

test('cloud restore cannot overwrite RevenueCat snapshot or resurrect revoked purchases', () => {
  const local = setPurchaseAccess(INITIAL_STATE, { allLevels: false, levels: [] }, now, 'account-b');
  const remote = setPurchaseAccess(INITIAL_STATE, { allLevels: true, levels: ['N3'] }, now - 1000, 'account-a');
  const merged = mergeRestoredState(local, remote);
  assert.equal(merged.entitlements?.purchaseOwnerId, 'account-b');
  assert.equal(proStatus(merged, now, 'N3').isPro, false);
});
