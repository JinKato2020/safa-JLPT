// 広場アバターのプリセット定義(男子5・女子5=10種)。オンボーディングで1つ選ぶ。
// 【art】実画像はAI生成(画像/キャラクター 由来のPNG)に差し替える。いまは未作成のため image:null=
//        絵文字プレースホルダで描画する。差し替え時は image に require('...png') を入れるだけ(呼び出し側は不変)。
export type AvatarDef = {
  code: string;            // 保存/送受信で使う不変コード
  gender: 'm' | 'f';
  emoji: string;           // 画像が無い間のプレースホルダ
  image: number | null;    // require('...png') を入れると実画像で描画
};

// 男子=和風チビ(着物色替え6種・実画像)。女子=実画像がまだ無いので絵文字プレースホルダ(art予定)。
export const AVATARS: AvatarDef[] = [
  { code: 'm_blue', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/npc/blue_down.png') },
  { code: 'm_green', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/npc/green_down.png') },
  { code: 'm_crimson', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/npc/crimson_down.png') },
  { code: 'm_purple', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/npc/purple_down.png') },
  { code: 'm_teal', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/npc/teal_down.png') },
  { code: 'm_amber', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/npc/amber_down.png') },
  { code: 'f_g1', gender: 'f', emoji: '👧', image: require('../../assets/kotoba/hero_f/down.png') },
  { code: 'f_g2', gender: 'f', emoji: '👧', image: require('../../assets/kotoba/hero_f2/down.png') },
];

export const AVATAR_CODES = AVATARS.map((a) => a.code);
export const DEFAULT_AVATAR = 'm_blue';
export const avatarsByGender = (g: 'm' | 'f'): AvatarDef[] => AVATARS.filter((a) => a.gender === g);

/** コードから定義を引く。未知コードは既定(先頭)にフォールバック。 */
export function avatarOf(code: string | undefined | null): AvatarDef {
  return AVATARS.find((a) => a.code === code) ?? AVATARS[0];
}
