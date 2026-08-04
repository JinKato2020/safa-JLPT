// 言葉の都・中央広場のクライアント境界(副作用)。全操作はサーバーの SECURITY DEFINER 関数(RPC)経由。
// クライアントはテーブルに直接触らない(docs/supabase/plaza.sql)。ネットワーク失敗は握って安全側を返す。
import { supabase } from '../config/supabase';

// 送れる固定メッセージの種類(サーバーの whitelist と一致)。表示テキストは i18n plaza.msg_<kind>。
export type MessageKind = 'flower' | 'ganbare' | 'issho' | 'sugoi' | 'otsukare' | 'nice';
export const MESSAGE_KINDS: MessageKind[] = ['flower', 'ganbare', 'issho', 'sugoi', 'otsukare', 'nice'];

// 広場に立つ人(plaza_sample の返り)。
export type PlazaPerson = {
  user_id: string;
  nickname: string;
  flag: string;         // 国コード(例 'NP')。絵文字はクライアントで描画
  level: string;        // 'N5'|'N4'|'N3' ...
  streak_days: number;
  today_count: number;
  avatar: string;       // 'm1'..'m5' | 'f1'..'f5'
  cheers_received: number;
  last_active: string;  // ISO日時
};

// 受け取ったメッセージ(plaza_inbox の返り)。
export type InboxItem = {
  from_nick: string;
  from_flag: string;
  from_avatar: string;
  kind: MessageKind;
  created_at: string;
};

/** 参加/更新(自分の1行を upsert)。成功で true。 */
export async function plazaJoin(p: {
  nickname: string; flag: string; level: string; streak: number; today: number; avatar: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('plaza_upsert', {
      p_nickname: p.nickname, p_flag: p.flag, p_level: p.level,
      p_streak: p.streak, p_today: p.today, p_avatar: p.avatar,
    });
    return !error;
  } catch { return false; }
}

/** 広場から外れる(visible=false)。成功で true。 */
export async function plazaLeave(): Promise<boolean> {
  try { const { error } = await supabase.rpc('plaza_leave'); return !error; } catch { return false; }
}

/** 広場の約20人を取得(自分/通報済みを除外・同じ級を優先)。失敗時は空配列。 */
export async function plazaSample(level?: string, limit = 20): Promise<PlazaPerson[]> {
  try {
    const { data, error } = await supabase.rpc('plaza_sample', { p_level: level ?? null, p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return data as PlazaPerson[];
  } catch { return []; }
}

/** 固定メッセージを送る。成功で相手の累計応援数、失敗で null(1日1回超過・未参加・通信失敗など)。 */
export async function plazaSend(toUserId: string, kind: MessageKind): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('plaza_send', { p_to: toUserId, p_kind: kind });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch { return null; }
}

/** 受け取ったメッセージ(最近N件)。失敗時は空配列。 */
export async function plazaInbox(limit = 30): Promise<InboxItem[]> {
  try {
    const { data, error } = await supabase.rpc('plaza_inbox', { p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return data as InboxItem[];
  } catch { return []; }
}

/** 通報(相手ごと1回)。別々の3人で自動非表示。成功で true。 */
export async function plazaReport(reportedUserId: string, reason?: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('plaza_report', { p_reported: reportedUserId, p_reason: reason ?? null });
    return !error;
  } catch { return false; }
}
