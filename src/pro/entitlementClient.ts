// ログイン中アカウントの Pro権利(pro_until)をサーバーから読む境界(副作用)。
// RLS(en_read: user_id = auth.uid())で本人の行だけ読める＋GRANT select 済み。
// これで管理側が Supabase の entitlements.pro_until を未来にするだけで、恒久/期限付きProを配れる。
//   ・pro_until = 紹介/お試し/管理付与 由来の期限つきPro(epoch)。課金(RevenueCat=purchaseActive)とは別系統。
//   ・proStatus は proUntil>now を isPro(source:'referral')として拾う。過去/null なら効かない=失効も反映できる。
import { supabase } from '../config/supabase';

/** 本人の pro_until を epoch ms で返す。行なし/null/失敗は null(=呼び出し側は状態を変えない)。 */
export async function pullProUntil(userId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('entitlements')
      .select('pro_until')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    const v = (data as { pro_until?: string | number | null } | null)?.pro_until;
    if (v == null) return null; // 付与なし=既存の状態を保つ(未取得と失効を取り違えない)
    const ms = typeof v === 'number' ? v : Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}
