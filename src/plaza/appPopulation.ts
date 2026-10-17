// 実ユーザー数(概算)を取得し、町に出す架空アバターの量(fakeFactor)を決める。
// 数値の出所 = サーバーの app_user_count() RPC(friend_profiles の行数 = ログイン済みの実ユーザー)。
// 端末に12時間キャッシュ(町を開くたびにDBを叩かない)。取得失敗/未取得は 0 扱い = 架空を最大表示(初期の“無人”を回避)。
// 方針(2026-08-13 ユーザー確定): リリース初期は架空で賑わい、実ユーザーが FADE_AT を超えたら架空は 0 = 自然に置換。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

const CACHE_KEY = 'app_user_count_v1';
const TTL_MS = 12 * 60 * 60 * 1000; // 12時間
export const FADE_AT = 100;          // この実ユーザー数で架空アバターは 0 になる

/** サーバーから実ユーザー数を取得。失敗時 null。 */
export async function fetchAppUserCount(): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('app_user_count');
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
}

/** 実ユーザー数(キャッシュ優先・期限切れ/未取得はサーバーへ)。取得できなければ 0(=架空を最大表示)。 */
export async function getAppUserCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const { n, at } = JSON.parse(raw) as { n: number; at: number };
      if (typeof n === 'number' && typeof at === 'number' && Date.now() - at < TTL_MS) return n;
    }
  } catch {
    /* キャッシュ破損は無視して取り直す */
  }
  const n = await fetchAppUserCount();
  if (n == null) return 0; // 取れなければ安全側(架空を最大表示)
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ n, at: Date.now() }));
  } catch {
    /* 保存失敗は無視(次回また取り直す) */
  }
  return n;
}

/** 実ユーザー数 → 架空アバターの表示率(1=最大 / 0=出さない)。FADE_AT で 0。 */
export function fakeFactor(realCount: number): number {
  if (!Number.isFinite(realCount) || realCount <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - realCount / FADE_AT));
}
