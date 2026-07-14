// 桜貝ショップの商品カタログ。大分類(タブ)=着せ替え/仲間/道具。
//  ・着せ替え=髪型/服/筆(スロット別に各1つ装備)。仲間=相棒1体を選択。道具=消耗品/お守り(所持、効果は順次実装)。
//  ・背景テーマ・フォントは設定画面へ移設(ここには含めない)。通貨=桜貝(wallet.points)。
import type { ImageSourcePropType } from 'react-native';
import type { ShopKind } from '../store/wallet';

// タブ(大分類)。
export type ShopCat = 'dressup' | 'companion' | 'tool';

export type ShopItem = {
  id: string; cat: ShopCat; kind: ShopKind; price: number; name: string; emoji?: string; asset?: ImageSourcePropType;
  rarity?: number; // 希少度(1〜5)。価値の目安として★で表示。省略=無印
};

export const SHOP: ShopItem[] = [
  // 着せ替え(髪型/服/筆) — 巫女の見た目。髪型・服・筆はそれぞれ別スロットで同時装備できる。
  { id: 'hair_osage', cat: 'dressup', kind: 'hair', price: 0, name: 'おさげ', emoji: '💇' },
  { id: 'hair_yui', cat: 'dressup', kind: 'hair', price: 600, name: '結い上げ', emoji: '🎀' },
  { id: 'hair_ribbon', cat: 'dressup', kind: 'hair', price: 500, name: '桜リボン', emoji: '🌸' },
  { id: 'outfit_miko', cat: 'dressup', kind: 'outfit', price: 0, name: '巫女装束', emoji: '👘' },
  { id: 'outfit_yukata', cat: 'dressup', kind: 'outfit', price: 700, name: '夏の浴衣', emoji: '🎐' },
  { id: 'outfit_haregi', cat: 'dressup', kind: 'outfit', price: 1000, name: '桜の晴れ着', emoji: '🌸' },
  { id: 'brush_take', cat: 'dressup', kind: 'brush', price: 0, name: '竹の筆', rarity: 1, asset: require('../../assets/shop/brush/brush_take.png') },
  { id: 'brush_sakura', cat: 'dressup', kind: 'brush', price: 400, name: '桜染めの筆', rarity: 2, asset: require('../../assets/shop/brush/brush_sakura.png') },
  { id: 'brush_makie', cat: 'dressup', kind: 'brush', price: 900, name: '金蒔絵の筆', rarity: 3, asset: require('../../assets/shop/brush/brush_makie.png') },
  { id: 'brush_raden', cat: 'dressup', kind: 'brush', price: 1600, name: '螺鈿の筆', rarity: 4, asset: require('../../assets/shop/brush/brush_raden.png') },
  { id: 'brush_tenpitsu', cat: 'dressup', kind: 'brush', price: 2800, name: '天の霊筆', rarity: 5, asset: require('../../assets/shop/brush/brush_tenpitsu.png') },
  // 仲間 — 連れ歩く相棒。1体を選んで装備。
  { id: 'pet_dog', cat: 'companion', kind: 'companion', price: 500, name: '子犬', emoji: '🐕' },
  { id: 'pet_fox', cat: 'companion', kind: 'companion', price: 800, name: '白狐', emoji: '🦊' },
  { id: 'pet_cat', cat: 'companion', kind: 'companion', price: 600, name: '招き猫', emoji: '🐈' },
  { id: 'pet_tanuki', cat: 'companion', kind: 'companion', price: 700, name: '狸', emoji: '🦝' },
  // 道具 — 学習を助ける消耗品・お守り(所持。消費/効果は順次実装)。
  { id: 'tool_mock_ticket', cat: 'tool', kind: 'tool', price: 300, name: '模試チケット', emoji: '📝' },
  { id: 'tool_retry', cat: 'tool', kind: 'tool', price: 200, name: '再挑戦券', emoji: '🔁' },
  { id: 'tool_freeze', cat: 'tool', kind: 'tool', price: 250, name: '連続フリーズ', emoji: '❄️' },
  { id: 'tool_omamori', cat: 'tool', kind: 'tool', price: 400, name: '合格お守り', emoji: '🧧' },
];
export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((i) => [i.id, i]));

// タブ定義。順=着せ替え→仲間→道具。
export const SHOP_CATS: { cat: ShopCat; label: string }[] = [
  { cat: 'dressup', label: '着せ替え' },
  { cat: 'companion', label: '仲間' },
  { cat: 'tool', label: '道具' },
];

// 着せ替えタブ内の小見出し(スロット別)。
export const KIND_LABEL: Record<ShopKind, string> = {
  hair: '髪型', outfit: '服', brush: '筆', companion: '仲間', tool: '道具',
};
