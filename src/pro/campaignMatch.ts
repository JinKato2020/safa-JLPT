// キャンペーン地域マッチング（純粋関数・ネイティブ依存なし＝node --test で検証可能）。
// free_pro_campaigns(active=true) の region 一覧に対し、この端末が無料Pro対象かを判定する。
//  ・'ALL' … 全世界キャンペーン。端末地域が不明('')でも対象にする（拡散優先・ログイン不要）。
//  ・それ以外 … 端末の地域コード(ISO2大文字)が一覧に含まれれば対象（例 'TW'）。
// 使用元＝src/pro/campaign.ts。正本テーブル＝docs/supabase/free_pro_campaign.sql。
export function matchesCampaign(activeRegions: readonly string[], deviceRegion: string): boolean {
  if (activeRegions.includes('ALL')) return true; // 全世界（地域コード不問）
  return deviceRegion !== '' && activeRegions.includes(deviceRegion);
}
