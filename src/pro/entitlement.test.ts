import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, type AppState } from '../store/state';
import { proStatus, grantProDays, setPurchaseActive, trialEndsAt, TRIAL_DAYS, DAY_MS } from './entitlement';

const T0 = 1_800_000_000_000; // 固定の基準時刻(テストを実時計に依存させない)
// 既定=ログイン済みでお試し受取済み(trialStartedAt=T0)のユーザー。未ログイン相当は trialStartedAt を外して表現。
const base = (over: Partial<AppState> = {}): AppState => ({ ...INITIAL_STATE, installedAt: T0, trialStartedAt: T0, ...over });

test('お試し: 初回起動から7日以内は Pro', () => {
  const r = proStatus(base(), T0 + 1 * DAY_MS);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'trial');
  assert.equal(r.trialDaysLeft, 6);
});

test('再インストール→再ログインでも お試しは復活しない(サーバー受取日が起点)', () => {
  // サーバーは既受取アカウントに「元の受取日(T0)」を返す。installedAt が新しくても関係ない。
  const now = T0 + 100 * DAY_MS;
  const s = base({ trialStartedAt: T0, installedAt: now }); // 再インストール直後=installedAtは新しいが受取日は古い
  const r = proStatus(s, now);
  assert.equal(trialEndsAt(s), T0 + TRIAL_DAYS * DAY_MS); // 起点はサーバー受取日 T0
  assert.equal(r.isPro, false); // 既に切れている=再付与されない(荒稼ぎ防止)
  assert.equal(r.source, 'none');
});

test('未ログイン/未受取(trialStartedAt無し)は お試しなし', () => {
  const s = base({ trialStartedAt: undefined }); // installedAt はあるが受取日は無い
  assert.equal(trialEndsAt(s), undefined);
  assert.equal(proStatus(s, T0 + 1 * DAY_MS).source, 'none'); // installedAt では付与されない
  assert.equal(proStatus(s, T0 + 1 * DAY_MS).isPro, false);
});

test('お試し: 7日を過ぎたら無料に戻る(データは消えない)', () => {
  const s = base();
  const r = proStatus(s, T0 + TRIAL_DAYS * DAY_MS + 1);
  assert.equal(r.isPro, false);
  assert.equal(r.source, 'none');
  assert.equal(r.trialDaysLeft, 0);
  assert.deepEqual(s.items, INITIAL_STATE.items); // 降格しても何も削らない
});

test('購入はお試し切れより優先される', () => {
  const s = setPurchaseActive(base(), true, T0);
  const r = proStatus(s, T0 + 365 * DAY_MS);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'purchase');
  assert.equal(s.entitlements?.purchaseCheckedAt, T0);
});

test('開発スイッチ devPro は最優先', () => {
  const s = base({ settings: { ...INITIAL_STATE.settings, devPro: true } });
  assert.equal(proStatus(s, T0 + 999 * DAY_MS).source, 'dev');
});

test('開発スイッチ devFree は devPro より優先(お試し中でも無料に落ちる)', () => {
  const s = base({ settings: { ...INITIAL_STATE.settings, devFree: true, devPro: true } });
  const r = proStatus(s, T0 + 1 * DAY_MS); // お試し期間のど真ん中
  assert.equal(r.isPro, false);
  assert.equal(r.source, 'none');
  assert.equal(r.trialDaysLeft, 0);
});

test('紹介+7日: お試し中に足すと お試し終了日から7日 伸びる(二重取りしない)', () => {
  const s = grantProDays(base(), 7, T0 + 2 * DAY_MS);
  assert.equal(s.entitlements?.proUntil, (trialEndsAt(base()) as number) + 7 * DAY_MS);
  const r = proStatus(s, T0 + 10 * DAY_MS);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'referral');
});

test('紹介+7日: お試しが切れた後に足すと 今から7日', () => {
  const now = T0 + 30 * DAY_MS;
  const s = grantProDays(base(), 7, now);
  assert.equal(s.entitlements?.proUntil, now + 7 * DAY_MS);
  assert.equal(proStatus(s, now + 6 * DAY_MS).isPro, true);
  assert.equal(proStatus(s, now + 8 * DAY_MS).isPro, false);
});

test('installedAt が無い旧データでも落ちない(=無料扱い)', () => {
  const s: AppState = { ...INITIAL_STATE };
  delete (s as { installedAt?: number }).installedAt;
  assert.equal(proStatus(s, T0).isPro, false);
  assert.equal(trialEndsAt(s), undefined);
});
