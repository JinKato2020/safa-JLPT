// 接続国(IP由来)の記録。Edge Function `geo-country` が Cloudflare の国ヘッダから判定してサーバーに保存する。
// アプリは「記録して」と1回叩くだけ(国コードはサーバーが決める=クライアントは国を送らない/IPも扱わない)。
import { supabase } from '../config/supabase';

/** ログイン確立時に呼ぶ。接続国をサーバーへ記録(統計・課金計算用)。通信失敗は握る(次回ログインで再試行)。 */
export async function recordGeoCountry(): Promise<void> {
  try { await supabase.functions.invoke('geo-country'); } catch { /* 失敗は無視 */ }
}
