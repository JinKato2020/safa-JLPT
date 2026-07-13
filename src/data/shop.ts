// ショップ商品カタログ(着せ替え専用)。段階1はMVP: frame_defaultのみ実素材、他は絵文字プレビュー(装備反映は段階2)。
import type { ImageSourcePropType } from 'react-native';
import type { ShopKind } from '../store/wallet';

export type ShopItem = { id: string; kind: ShopKind; price: number; nameKey: string; emoji?: string; asset?: ImageSourcePropType };

const FRAME_DEFAULT = require('../../assets/tabs/status_frame.png');

export const SHOP: ShopItem[] = [
  { id: 'frame_default', kind: 'frame', price: 0, nameKey: 'shop.item_frame_default', asset: FRAME_DEFAULT },
  { id: 'petal_sakura', kind: 'petal', price: 400, nameKey: 'shop.item_petal_sakura', emoji: '🌸' },
  { id: 'petal_gold', kind: 'petal', price: 600, nameKey: 'shop.item_petal_gold', emoji: '✨' },
  { id: 'outfit_summer', kind: 'outfit', price: 900, nameKey: 'shop.item_outfit_summer', emoji: '👘' },
  { id: 'badge_gold', kind: 'badge', price: 700, nameKey: 'shop.item_badge_gold', emoji: '🏅' },
  { id: 'theme_night', kind: 'theme', price: 800, nameKey: 'shop.item_theme_night', emoji: '🌙' },
];
export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((i) => [i.id, i]));
