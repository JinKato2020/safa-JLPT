// 紹介制度のクライアント側の呼び出し境界(副作用)。既存 auth の Supabase クライアントを流用し、
// Edge Function を functions.invoke で叩く。ネットワーク失敗は握って安全側('pending')を返す
// (サーバーは冪等なので次回同期で再試行できる)。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

export type QualifyResult = 'rewarded' | 'pending' | 'rejected';

// 新規側の匿名端末ID(new_user_ref)。telemetry と同じ匿名IDキーを再利用し、端末で安定させる。
const K_ANON = 'safa-jlpt:anonId';
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** 端末の匿名参照(new_user_ref)。無ければ生成して保存。取得失敗時は一時IDを返す。 */
export async function getDeviceRef(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(K_ANON);
    if (!id) { id = uuid(); await AsyncStorage.setItem(K_ANON, id); }
    return id;
  } catch {
    return uuid();
  }
}

/** 自分の紹介コードを取得(無ければサーバーが1ユーザー1コードで採番)。失敗時は空文字。 */
export async function getMyCode(): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('referral-issue-code');
    if (error) return '';
    return (data as { code?: string })?.code ?? '';
  } catch {
    return '';
  }
}

/** 自分が紹介して「継続(qualified/rewarded)」に達した人数を取得。
 *  referrals は RLS で referrer_user_id = auth.uid() の行だけ読めるので、状態で絞って件数を数えるだけ。
 *  未ログイン/未デプロイ/通信失敗は 0 を返す(安全側)。 */
export async function getReferredQualifiedCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('referrals')
      .select('new_user_ref', { count: 'exact', head: true })
      .in('status', ['qualified', 'rewarded']);
    return !error && typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

/** 継続トリガー成立をサーバーへ報告。サーバーが再計算し、成立で両者に7日Pro。冪等。
 *  ネットワーク失敗は握って 'pending'(=未確定・次回同期で再試行)。 */
export async function reportQualified(
  code: string,
  newUserRef: string,
  qualifyingDays: string[],
  installAt: number,
): Promise<QualifyResult> {
  try {
    const { data, error } = await supabase.functions.invoke('referral-qualify', {
      body: { code, new_user_ref: newUserRef, qualifying_days: qualifyingDays, install_at: installAt },
    });
    if (error) return 'pending';
    const status = (data as { status?: string })?.status;
    return status === 'rewarded' || status === 'rejected' ? status : 'pending';
  } catch {
    return 'pending';
  }
}
