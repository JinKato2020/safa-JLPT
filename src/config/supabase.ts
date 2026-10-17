// Supabaseクライアント(単一)。セッションは AsyncStorage に永続。
// 埋め込むのは公開安全な anon/publishable キーのみ(RLSでデータ保護)。service_roleは絶対に置かない。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nxovouiqelynryumjvyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bfqPNA4Z83i87E99YLwUyQ_I5NFMC3v';

// createClient呼び出しをこの非ジェネリック関数に閉じ込め、具体的な戻り型をここで確定させる
// (ReturnType<typeof createClient>のようにジェネリック関数自体から型を取ると既定の型引数が解決されず壊れるため)。
function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // RNではURLにセッションは載らない
      flowType: 'pkce', // OAuth(Google)はPKCE。exchangeCodeForSessionで安全に交換
    },
  });
}
type Client = ReturnType<typeof makeClient>;
let _client: Client | null = null;
// 実クライアントは初回アクセス時まで生成しない(遅延)。import しただけでは
// GoTrueClientの自動リフレッシュタイマー/AsyncStorage初期アクセスが走らない(=Node単体テストで安全)。
// RN実行時は最初の supabase.xxx アクセスで即構築されるため挙動は従来と同一。
function client(): Client {
  if (!_client) _client = makeClient();
  return _client;
}
// 呼び出し側(supabase.auth.foo() / supabase.from(...))はそのまま。Proxyが初回プロパティアクセスで実体化する。
// 関数は実クライアントへbindして返す(receiverをProxyのままにするとメソッド内部のthis参照・private fieldで壊れるため)。
export const supabase = new Proxy({} as Client, {
  get(_target, prop) {
    const c = client() as unknown as Record<PropertyKey, unknown>;
    const val = c[prop];
    return typeof val === 'function' ? val.bind(c) : val;
  },
});
