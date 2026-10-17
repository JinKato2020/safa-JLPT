// 自動生成: バッジ画像のrequireマップ。set×metric×tier(1-10)。
/* eslint-disable */
export const BADGE_IMAGES = {
  natural: {
    pass: [require('../../assets/badges/natural_pass_01.png'), require('../../assets/badges/natural_pass_02.png'), require('../../assets/badges/natural_pass_03.png'), require('../../assets/badges/natural_pass_04.png'), require('../../assets/badges/natural_pass_05.png'), require('../../assets/badges/natural_pass_06.png'), require('../../assets/badges/natural_pass_07.png'), require('../../assets/badges/natural_pass_08.png'), require('../../assets/badges/natural_pass_09.png'), require('../../assets/badges/natural_pass_10.png')],
    cover: [require('../../assets/badges/natural_cover_01.png'), require('../../assets/badges/natural_cover_02.png'), require('../../assets/badges/natural_cover_03.png'), require('../../assets/badges/natural_cover_04.png'), require('../../assets/badges/natural_cover_05.png'), require('../../assets/badges/natural_cover_06.png'), require('../../assets/badges/natural_cover_07.png'), require('../../assets/badges/natural_cover_08.png'), require('../../assets/badges/natural_cover_09.png'), require('../../assets/badges/natural_cover_10.png')],
  },
  gorgeous: {
    pass: [require('../../assets/badges/gorgeous_pass_01.png'), require('../../assets/badges/gorgeous_pass_02.png'), require('../../assets/badges/gorgeous_pass_03.png'), require('../../assets/badges/gorgeous_pass_04.png'), require('../../assets/badges/gorgeous_pass_05.png'), require('../../assets/badges/gorgeous_pass_06.png'), require('../../assets/badges/gorgeous_pass_07.png'), require('../../assets/badges/gorgeous_pass_08.png'), require('../../assets/badges/gorgeous_pass_09.png'), require('../../assets/badges/gorgeous_pass_10.png')],
    cover: [require('../../assets/badges/gorgeous_cover_01.png'), require('../../assets/badges/gorgeous_cover_02.png'), require('../../assets/badges/gorgeous_cover_03.png'), require('../../assets/badges/gorgeous_cover_04.png'), require('../../assets/badges/gorgeous_cover_05.png'), require('../../assets/badges/gorgeous_cover_06.png'), require('../../assets/badges/gorgeous_cover_07.png'), require('../../assets/badges/gorgeous_cover_08.png'), require('../../assets/badges/gorgeous_cover_09.png'), require('../../assets/badges/gorgeous_cover_10.png')],
  },
} as const;
export type BadgeSet = keyof typeof BADGE_IMAGES;
export type BadgeMetric = "pass" | "cover";
/** 0-100の値→段階1-10のインデックス(0始まり)。 */
export function badgeTierIndex(pct: number): number { return Math.min(9, Math.max(0, Math.floor(pct / 10))); }
