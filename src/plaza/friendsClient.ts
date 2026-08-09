// 友だち(招待制)のクライアント境界(副作用)。全操作はサーバーの SECURITY DEFINER 関数(RPC)経由。
// クライアントはテーブルに直接触らない(docs/supabase/friends.sql)。ネットワーク失敗は握って安全側を返す。
import { supabase } from '../config/supabase';

// 公開プロフィール(町のステータス表示に使う情報)。
export type FriendProfile = {
  user_id: string;
  nickname: string;
  country: string | null;      // 国コード(ISO2)
  gender: string | null;       // 'm' | 'f'
  avatar: string;              // アバターコード(m_boy1..f_g5)
  level: string;               // 'N5'|'N4'|'N3' ...
  streak: number;
  learned: number;             // 覚えた語数
  week_learned: number;
  study_seconds: number;       // 累計学習時間(秒)。町ステータスの「総時間」を実データで表示
  studying: string | null;
  strong: string | null;
  personality: string | null;
  mood_msg: string | null;
};

/** 自分の公開プロフィールを publish(町に表示するために必要)。成功で true。 */
export async function friendPublish(p: {
  nickname: string; country: string | null; gender: string | null; avatar: string; level: string;
  streak: number; learned: number; weekLearned: number; studySeconds?: number;
  studying?: string | null; strong?: string | null; personality?: string | null; moodMsg?: string | null;
}): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('friend_publish', {
      p_nickname: p.nickname, p_country: p.country, p_gender: p.gender, p_avatar: p.avatar, p_level: p.level,
      p_streak: p.streak, p_learned: p.learned, p_week_learned: p.weekLearned, p_study_seconds: p.studySeconds ?? 0,
      p_studying: p.studying ?? null, p_strong: p.strong ?? null,
      p_personality: p.personality ?? null, p_mood_msg: p.moodMsg ?? null,
    });
    return !error;
  } catch { return false; }
}

/** 招待主(owner)の公開プロフィール(招待画面で「誰からの招待か」を表示)。無ければ null。 */
export async function townInviter(ownerId: string): Promise<FriendProfile | null> {
  try {
    const { data, error } = await supabase.rpc('town_inviter', { p_owner: ownerId });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data[0] as FriendProfile;
  } catch { return null; }
}

/** 招待を受けて owner の町に参加(片方向)。成功で true。 */
export async function townJoin(ownerId: string): Promise<boolean> {
  try { const { error } = await supabase.rpc('town_join', { p_owner: ownerId }); return !error; } catch { return false; }
}

/** 自分の町の住人(=参加してくれた人たち)。失敗時は空配列。 */
export async function townMembers(): Promise<FriendProfile[]> {
  try {
    const { data, error } = await supabase.rpc('town_members');
    if (error || !Array.isArray(data)) return [];
    return data as FriendProfile[];
  } catch { return []; }
}

/** owner の町から自分が抜ける。成功で true。 */
export async function townLeave(ownerId: string): Promise<boolean> {
  try { const { error } = await supabase.rpc('town_leave', { p_owner: ownerId }); return !error; } catch { return false; }
}

/** 自分の町から member を外す。成功で true。 */
export async function townKick(memberId: string): Promise<boolean> {
  try { const { error } = await supabase.rpc('town_kick', { p_member: memberId }); return !error; } catch { return false; }
}

// --- 応援(固定6種)の配信。送れるのは「自分の町の住人(招待して参加した友だち)」だけ。受信箱方式(docs/supabase/cheers.sql)。 ---
export type CheerInboxItem = {
  id: number; from_user: string; from_nick: string | null; from_avatar: string | null;
  cheer_key: string; body: string | null; created_at: string; read_at: string | null;
};

/**
 * 友だち(自分の町の住人)に応援を送る。成功で true(関係外/回数制限などは false)。
 * text を渡すと自由メッセージ(cheerKey='custom')。渡さなければ固定6種のキー。
 */
export async function cheerSend(toUserId: string, cheerKey: string, text?: string): Promise<boolean> {
  try { const { error } = await supabase.rpc('cheer_send', { p_to: toUserId, p_key: cheerKey, p_text: text ?? null }); return !error; } catch { return false; }
}

/** 自分宛の応援一覧(送り主付き・新しい順)。失敗時は空配列。 */
export async function cheerInbox(): Promise<CheerInboxItem[]> {
  try {
    const { data, error } = await supabase.rpc('cheer_inbox');
    if (error || !Array.isArray(data)) return [];
    return data as CheerInboxItem[];
  } catch { return []; }
}

/** 未読の応援数(バッジ用)。失敗時は 0。 */
export async function cheerUnreadCount(): Promise<number> {
  try { const { data, error } = await supabase.rpc('cheer_unread_count'); return (!error && typeof data === 'number') ? data : 0; } catch { return 0; }
}

/** 受信箱を開いた時に未読を既読化。 */
export async function cheerMarkRead(): Promise<void> {
  try { await supabase.rpc('cheer_mark_read'); } catch { /* 失敗は無視(次回開いた時に再試行) */ }
}
