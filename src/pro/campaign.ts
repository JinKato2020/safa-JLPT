// 地域キャンペーン（完全Pro無料）のリモート判定。★ログイン不要（anon 読み取り）。
// 端末地域(Localization regionCode)が free_pro_campaigns(active=true) に含まれれば campaign Pro を有効化。
// 開始/終了はサーバーの active 行だけで切替（再ビルド不要）。判定は端末ローカル＝クラウドに漏れない。
// 正本テーブル＝docs/supabase/free_pro_campaign.sql。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { supabase } from '../config/supabase';
import { setCampaignProActive } from './campaignFlag';
import { matchesCampaign } from './campaignMatch';

const CACHE_KEY = 'free_pro_regions_v1';

/** 端末の地域コード(ISO2・大文字)。取れなければ ''。 */
export function deviceRegion(): string {
  try { return (Localization.getLocales?.()[0]?.regionCode || '').toUpperCase(); }
  catch { return ''; }
}

/** サーバーから「いま有効な無料地域」を取得。失敗は null（＝呼び出し側はキャッシュ据え置き）。 */
async function fetchActiveRegions(): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.from('free_pro_campaigns').select('region').eq('active', true);
    if (error || !data) return null;
    return (data as { region: string | null }[]).map((r) => (r.region || '').toUpperCase()).filter(Boolean);
  } catch {
    return null;
  }
}

/** 起動時に1回: キャッシュで即判定 → サーバー取得で更新＋再キャッシュ。
 *  ・取得失敗（オフライン等）はキャッシュのまま（初回ネット断に耐える）。
 *  ・サーバーが [] を返す（＝キャンペーン終了）場合も正しく false に反映。 */
export async function initFreeProCampaign(): Promise<void> {
  const region = deviceRegion();
  // 1) キャッシュで即時反映
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const regions = JSON.parse(cached) as string[];
      setCampaignProActive(matchesCampaign(regions, region));
    }
  } catch { /* 無視 */ }
  // 2) サーバー取得で更新
  const regions = await fetchActiveRegions();
  if (regions == null) return; // 取得失敗＝キャッシュのまま
  setCampaignProActive(matchesCampaign(regions, region));
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(regions)); } catch { /* 無視 */ }
}
