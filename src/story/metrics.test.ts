import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, dayStr, type AppState } from '../store/state';
import { makeWish } from './wish';
import {
  metricsWishKey, installDayStr, daysSinceInstall, cohortProps, dueLifecycleOpens,
  M_INSTALL, M_NEXT_DAY_OPEN,
} from './metrics';

const T = Date.UTC(2026, 6, 28, 3, 0, 0);
const DAY = 24 * 3600 * 1000;

function mk(over: Partial<AppState> = {}): AppState {
  return { ...INITIAL_STATE, ...over };
}
function withWish(kind: Parameters<typeof makeWish>[0]): AppState {
  return { ...INITIAL_STATE, installedAt: T, settings: { ...INITIAL_STATE.settings, wish: makeWish(kind, T) } };
}

test('metricsWishKey: 願い種別・未設定none・あとでlater・自由記述custom', () => {
  assert.equal(metricsWishKey(mk()), 'none');
  assert.equal(metricsWishKey(withWish('family')), 'family');
  assert.equal(metricsWishKey(withWish('later')), 'later');
  assert.equal(metricsWishKey(withWish('custom')), 'custom');
});

test('installDayStr/daysSinceInstall: 未確定はnull・経過日数は暦日', () => {
  assert.equal(installDayStr(mk()), null);
  assert.equal(daysSinceInstall(mk(), T), null);
  const s = mk({ installedAt: T });
  assert.equal(installDayStr(s), dayStr(T));
  assert.equal(daysSinceInstall(s, T), 0);
  assert.equal(daysSinceInstall(s, T + 7 * DAY), 7);
});

test('cohortProps: 全計測に添えるコホート情報', () => {
  const s = withWish('self');
  assert.deepEqual(cohortProps(s, T + 30 * DAY), { wishKey: 'self', installDay: dayStr(T), daysSinceInstall: 30 });
});

test('dueLifecycleOpens: 初回はinstallのみ・翌日以降はnext_day_open・未確定は空', () => {
  const s = mk({ installedAt: T });
  // 初回(当日): install だけ
  const d0 = dueLifecycleOpens(s, T, []);
  assert.deepEqual(d0.map((e) => e.name), [M_INSTALL]);
  // 翌日・install既送: next_day_open だけ
  const d1 = dueLifecycleOpens(s, T + DAY, [M_INSTALL]);
  assert.deepEqual(d1.map((e) => e.name), [M_NEXT_DAY_OPEN]);
  // 両方送信済: 空
  assert.deepEqual(dueLifecycleOpens(s, T + DAY, [M_INSTALL, M_NEXT_DAY_OPEN]), []);
  // installedAt未確定(旧データ): 何も出さない
  assert.deepEqual(dueLifecycleOpens(mk(), T, []), []);
});

test('dueLifecycleOpens: 同日2回目起動は install を二重に出さない(seenで抑制)', () => {
  const s = mk({ installedAt: T });
  assert.deepEqual(dueLifecycleOpens(s, T, [M_INSTALL]), []);
});
