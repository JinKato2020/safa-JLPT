// 「願い」= 物語の軸(なぜ日本語を学ぶか)の純関数。UI/reducerはここを使う。副作用なし・入力不変。
// 仕様: docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md §1
import { dayStr, type Wish, type WishKind } from '../store/state';

// UIカードの並び順。i18nキー = wish.opt_<kind>。custom=自由記述、later=あとで決める。
export const WISH_KINDS: WishKind[] = ['work_live', 'study', 'talk', 'family', 'like', 'self', 'custom', 'later'];

/** 願いが「実際に設定済み」か。later/未設定は未設定扱い＝桜は節目で触れない。 */
export function hasWish(w?: Wish): boolean {
  return !!w && w.kind !== 'later';
}

/** 願いを1つ作る純関数。custom は text をトリムして保持(空でも custom として残す)。他は text を持たない。 */
export function makeWish(kind: WishKind, now: number, text?: string): Wish {
  if (kind === 'custom') return { kind: 'custom', text: (text ?? '').trim(), setAt: dayStr(now) };
  return { kind, setAt: dayStr(now) };
}
