// 【地域キャンペーンの番人】campaignFlag が proStatus に正しく効くか。
// ・有効=完全Pro(source:'campaign')＝広告/上限はPro扱いで自動オフ。
// ・devFree(検証用の強制無料)はキャンペーンより優先。
// ・課金(purchase)はキャンペーンより優先表示＝payerに周知バナーを出さない。
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { proStatus } from './entitlement';
import { setCampaignProActive } from './campaignFlag';
import type { AppState } from '../store/state';

const NOW = 1_700_000_000_000;
const st = (entitlements: Record<string, unknown> = {}, settings: Record<string, unknown> = {}): AppState =>
  ({ entitlements, settings } as unknown as AppState);

afterEach(() => setCampaignProActive(false)); // テスト間でフラグをリセット

test('キャンペーン有効=完全Pro(source:campaign)', () => {
  setCampaignProActive(true);
  const r = proStatus(st(), NOW);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'campaign');
});

test('キャンペーン無効=無料に戻る', () => {
  setCampaignProActive(false);
  assert.equal(proStatus(st(), NOW).isPro, false);
});

test('devFree はキャンペーンより優先(検証用の強制無料が効く)', () => {
  setCampaignProActive(true);
  assert.equal(proStatus(st({}, { devFree: true }), NOW).isPro, false);
});

test('課金(purchase)はキャンペーンより優先表示(payerにバナーを出さない)', () => {
  setCampaignProActive(true);
  const r = proStatus(st({ purchaseActive: true }), NOW);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'purchase');
});
