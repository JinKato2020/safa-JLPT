// Supabaseクライアント(単一)。セッションは AsyncStorage に永続。
// 埋め込むのは公開安全な anon/publishable キーのみ(RLSでデータ保護)。service_roleは絶対に置かない。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nxovouiqelynryumjvyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bfqPNA4Z83i87E99YLwUyQ_I5NFMC3v';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RNではURLにセッションは載らない
  },
});
