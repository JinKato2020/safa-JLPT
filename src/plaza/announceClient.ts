// 運営からのお知らせ(全員一律のブロードキャスト)のクライアント境界。
//  ・誰でも読める公開テーブル(announcements)を直接 select する(未ログインでも取得できる)。docs/supabase/announcements.sql
//  ・既読は端末ローカル(AsyncStorage)に「最後に受信箱を開いた時刻」を持つ。未読=その時刻より後に作られたお知らせ。
//    → 未ログインでもバッジ/既読が動く。サーバーに既読テーブルは作らない。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

export type Announcement = {
  id: number; created_at: string; emoji: string | null;
  title_ja: string; body_ja: string;
  title_en: string | null; body_en: string | null;
  title_ne: string | null; body_ne: string | null;
};

/** active なお知らせを新しい順に取得(最大50件)。失敗時は空配列(=安全側)。 */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const { data, error } = await supabase
      .from('announcements').select('*').eq('active', true)
      .order('created_at', { ascending: false }).limit(50);
    if (error || !Array.isArray(data)) return [];
    return data as Announcement[];
  } catch { return []; }
}

/** 表示言語に合わせて題名・本文を選ぶ。ne→(無ければ)en→ja、en系/その他→en→ja の順でフォールバック。 */
export function pickAnnounce(a: Announcement, lang: string): { title: string; body: string } {
  const en = a.title_en ? { title: a.title_en, body: a.body_en ?? a.body_ja } : null;
  const ne = a.title_ne ? { title: a.title_ne, body: a.body_ne ?? a.body_ja } : null;
  const ja = { title: a.title_ja, body: a.body_ja };
  if (lang === 'ja') return ja;
  if (lang === 'ne') return ne ?? en ?? ja;
  return en ?? ja; // en および他言語(日本語/ネパール語以外)は英語→日本語
}

const READ_KEY = 'announceReadAt'; // 端末ローカルの「最後に受信箱を開いた時刻」(ISO)

/** 既読基準時刻(ms)。未設定は 0(=すべて未読扱い)。 */
export async function announceReadAtMs(): Promise<number> {
  try { const v = await AsyncStorage.getItem(READ_KEY); const ms = v ? Date.parse(v) : 0; return Number.isNaN(ms) ? 0 : ms; } catch { return 0; }
}

/** 受信箱を開いた時に既読化(現在時刻を保存)。 */
export async function markAnnounceRead(): Promise<void> {
  try { await AsyncStorage.setItem(READ_KEY, new Date().toISOString()); } catch { /* 失敗は無視(次回開いた時に再試行) */ }
}

/** 既読時刻より後に作られたお知らせ数(バッジ用)。 */
export function announceUnread(list: Announcement[], readAtMs: number): number {
  return list.reduce((n, a) => (Date.parse(a.created_at) > readAtMs ? n + 1 : n), 0);
}
