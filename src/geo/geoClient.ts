// 接続国(IP由来)の記録。Cloudflare(=safa-lang.com の前段)の trace から接続国コードだけ取り、`user_geo` に本人ぶんを直接 upsert する。
// Cloudflare基盤はプライバシーポリシーに既載=第三者を増やさない。IPは扱わず国コードのみ保存。
// ※以前は Edge Function `geo-country` 経由だったが「呼び出しは来るのに user_geo が空」＝関数側で書けていなかったため、
//   関数を介さずクライアントから直接書く方式へ変更(RLSで本人の行だけ・grant要=docs/supabase/geo.sql)。関数は不要に。
import { supabase } from '../config/supabase';

// Cloudflare trace から2文字の国コードを取る。失敗/未取得は null(その場合は関数側のヘッダ判定に任せる)。
async function cfCountry(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000); // 5秒で諦める(ログインを遅延させない)
    const res = await fetch('https://safa-lang.com/cdn-cgi/trace', { signal: ctrl.signal });
    clearTimeout(to);
    const txt = await res.text();
    const m = txt.match(/(?:^|\n)loc=([A-Za-z]{2})/);
    const cc = m ? m[1].toUpperCase() : null;
    return cc && cc !== 'XX' && cc !== 'T1' ? cc : null;
  } catch {
    return null;
  }
}

/** ログイン確立時に呼ぶ。接続国を user_geo へ本人ぶん記録(統計・課金計算用)。通信失敗は握る(次回ログインで再試行)。 */
export async function recordGeoCountry(): Promise<void> {
  try {
    const country = await cfCountry();
    if (!country) return; // 国が取れなければ何もしない(次回ログインで再試行)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;    // 未ログインなら記録しない(RLSで弾かれる)
    await supabase.from('user_geo').upsert(
      { user_id: user.id, country, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  } catch { /* 失敗は無視 */ }
}
