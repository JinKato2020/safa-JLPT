// 【学校ライセンスPro(導出型)の番人】schoolFlag が proStatus に正しく効くか＋優先順位。
//  ・所属中(license_until>now)=Pro(source:'school')／失効・未所属=落ちる＝「名簿から外れたら即消える」導出型。
//  ・優先順位: 購入 > キャンペーン > 学校 > 紹介(proUntil) > お試し。
//   実行: node --import tsx --test src/pro/schoolFlag.test.ts
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { proStatus } from './entitlement';
import { setSchoolLicenseUntil } from './schoolFlag';
import { setCampaignProActive } from './campaignFlag';
import type { AppState } from '../store/state';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const st = (entitlements: Record<string, unknown> = {}, settings: Record<string, unknown> = {}): AppState =>
  ({ entitlements, settings } as unknown as AppState);

afterEach(() => { setSchoolLicenseUntil(null); setCampaignProActive(false); }); // テスト間でフラグをリセット

test('所属中(license未来)=Pro(source:school)', () => {
  setSchoolLicenseUntil(NOW + 30 * DAY);
  const r = proStatus(st(), NOW);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'school');
  assert.equal(r.until, NOW + 30 * DAY);
});

test('名簿から外れた(null)=即PRO終了', () => {
  setSchoolLicenseUntil(null);
  assert.equal(proStatus(st(), NOW).isPro, false);
});

test('ライセンス失効(過去)=PROは落ちる', () => {
  setSchoolLicenseUntil(NOW - DAY);
  assert.equal(proStatus(st(), NOW).isPro, false);
});

test('購入は学校より優先(payer表示)', () => {
  setSchoolLicenseUntil(NOW + 30 * DAY);
  const r = proStatus(st({ purchaseActive: true }), NOW);
  assert.equal(r.source, 'purchase');
});

test('キャンペーンは学校より優先', () => {
  setSchoolLicenseUntil(NOW + 30 * DAY);
  setCampaignProActive(true);
  assert.equal(proStatus(st(), NOW).source, 'campaign');
});

test('学校は紹介(proUntil)より優先', () => {
  setSchoolLicenseUntil(NOW + 30 * DAY);
  const r = proStatus(st({ proUntil: NOW + 5 * DAY }), NOW);
  assert.equal(r.source, 'school');
});

test('devFree は学校より優先(検証用の強制無料)', () => {
  setSchoolLicenseUntil(NOW + 30 * DAY);
  assert.equal(proStatus(st({}, { devFree: true }), NOW).isPro, false);
});
