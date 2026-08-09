// 接続国(IP由来)の記録。Cloudflare(=safa-lang.com の前段)の trace から接続国を取り、Edge Function `geo-country` に渡して保存する。
// Cloudflare基盤はプライバシーポリシーに既載=第三者を増やさない。IPは扱わず国コードのみ。国コードはサーバー(user_geo)に保存。
// ※Edge Function側は cf-ipcountry があればそれを優先し、無ければここで渡す国を使う(環境差の保険)。
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

/** ログイン確立時に呼ぶ。接続国をサーバーへ記録(統計・課金計算用)。通信失敗は握る(次回ログインで再試行)。 */
export async function recordGeoCountry(): Promise<void> {
  try {
    const country = await cfCountry();
    await supabase.functions.invoke('geo-country', country ? { body: { country } } : undefined);
  } catch { /* 失敗は無視 */ }
}
