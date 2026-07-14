// ショップ商品カタログ(装飾)。背景(水彩テーマ)とフォントは apply で実設定(settings)に反映。
// 称号/枠/花びらは owned/equipped の状態管理(見た目への全面反映は段階的)。
import type { ImageSourcePropType } from 'react-native';
import type { ShopKind } from '../store/wallet';
import type { ThemeMode } from '../store/state';
import type { FontKey } from '../theme/fonts';

// apply を持つ品は「装備」で settings を更新して実際にアプリへ反映する(背景=テーマ / フォント)。
export type ShopItem = {
  id: string; kind: ShopKind; price: number; name: string; emoji?: string; asset?: ImageSourcePropType;
  apply?: { theme?: ThemeMode; font?: FontKey };
};

const FRAME_DEFAULT = require('../../assets/tabs/status_frame.png');

export const SHOP: ShopItem[] = [
  // 背景(水彩テーマ)= settings.theme に反映。桜は無料/既定。
  { id: 'bg_sakura', kind: 'theme', price: 0, name: '桜', emoji: '🌸', apply: { theme: 'sakura' } },
  { id: 'bg_sky', kind: 'theme', price: 500, name: '空', emoji: '☁️', apply: { theme: 'sky' } },
  { id: 'bg_green', kind: 'theme', price: 500, name: '緑', emoji: '🍃', apply: { theme: 'green' } },
  { id: 'bg_fuji', kind: 'theme', price: 600, name: '藤', emoji: '💜', apply: { theme: 'fuji' } },
  { id: 'bg_akane', kind: 'theme', price: 700, name: '茜', emoji: '🌅', apply: { theme: 'akane' } },
  // フォント = settings.font に反映。丸ゴは無料/既定。
  { id: 'font_maru', kind: 'font', price: 0, name: '丸ゴシック', emoji: '🅰️', apply: { font: 'maru' } },
  { id: 'font_mincho', kind: 'font', price: 400, name: '明朝体', emoji: '🈂️', apply: { font: 'mincho' } },
  { id: 'font_kyokasho', kind: 'font', price: 500, name: '教科書体', emoji: '✏️', apply: { font: 'kyokasho' } },
  { id: 'font_system', kind: 'font', price: 0, name: '端末の書体', emoji: '📱', apply: { font: 'system' } },
  // 称号 / 枠 / 花びら(状態管理)。
  { id: 'badge_gold', kind: 'badge', price: 700, name: '金の称号', emoji: '🏅' },
  { id: 'frame_default', kind: 'frame', price: 0, name: '標準の枠', asset: FRAME_DEFAULT },
  { id: 'petal_sakura', kind: 'petal', price: 400, name: '桜の花びら', emoji: '🌸' },
  { id: 'petal_gold', kind: 'petal', price: 600, name: '金の花びら', emoji: '✨' },
];
export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((i) => [i.id, i]));

// カテゴリ(タブ)定義。順=背景→フォント→称号→枠→花びら。
export const SHOP_CATS: { kind: ShopKind; label: string }[] = [
  { kind: 'theme', label: '背景' },
  { kind: 'font', label: 'フォント' },
  { kind: 'badge', label: '称号' },
  { kind: 'frame', label: '枠' },
  { kind: 'petal', label: '花びら' },
];
