// 広場アバターのプリセット定義(男子5・女子5=10種)。オンボーディングで1つ選ぶ。
// 【art】実画像はAI生成(画像/キャラクター 由来のPNG)に差し替える。いまは未作成のため image:null=
//        絵文字プレースホルダで描画する。差し替え時は image に require('...png') を入れるだけ(呼び出し側は不変)。
export type AvatarDef = {
  code: string;            // 保存/送受信で使う不変コード
  gender: 'm' | 'f';
  emoji: string;           // 画像が無い間のプレースホルダ
  image: number | null;    // require('...png') を入れると実画像で描画
};

// 男子=男の子1(既定)・男の子2・男の子3の3種。女子=女の子1〜4の4種。すべて8方向の実スプライト。
export const AVATARS: AvatarDef[] = [
  { code: 'm_boy1', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/hero/down.png') },
  { code: 'm_boy2', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/hero_m2/down.png') },
  { code: 'm_boy3', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/hero_m3/down.png') },
  { code: 'm_boy4', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/hero_m4/down.png') },
  { code: 'm_boy5', gender: 'm', emoji: '🧑', image: require('../../assets/kotoba/hero_m5/down.png') },
  { code: 'f_g1', gender: 'f', emoji: '👧', image: require('../../assets/kotoba/hero_f/down.png') },
  { code: 'f_g2', gender: 'f', emoji: '👧', image: require('../../assets/kotoba/hero_f2/down.png') },
  { code: 'f_g3', gender: 'f', emoji: '👧', image: require('../../assets/kotoba/hero_f3/down.png') },
  { code: 'f_g4', gender: 'f', emoji: '👧', image: require('../../assets/kotoba/hero_f4/down.png') },
];

export const AVATAR_CODES = AVATARS.map((a) => a.code);
export const DEFAULT_AVATAR = 'm_boy1';
export const avatarsByGender = (g: 'm' | 'f'): AvatarDef[] => AVATARS.filter((a) => a.gender === g);

/** コードから定義を引く。未知コードは既定(先頭)にフォールバック。 */
export function avatarOf(code: string | undefined | null): AvatarDef {
  return AVATARS.find((a) => a.code === code) ?? AVATARS[0];
}
