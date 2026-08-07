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
  studying: string | null;
  strong: string | null;
  personality: string | null;
  mood_msg: string | null;
};

/** 自分の公開プロフィールを publish(町に表示するために必要)。成功で true。 */
export async function friendPublish(p: {
  nickname: string; country: string | null; gender: string | null; avatar: string; level: string;
  streak: number; learned: number; weekLearned: number;
  studying?: string | null; strong?: string | null; personality?: string | null; moodMsg?: string | null;
}): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('friend_publish', {
      p_nickname: p.nickname, p_country: p.country, p_gender: p.gender, p_avatar: p.avatar, p_level: p.level,
      p_streak: p.streak, p_learned: p.learned, p_week_learned: p.weekLearned,
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
