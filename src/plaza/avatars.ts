// 広場アバターのプリセット定義(男子5・女子5=10種)。オンボーディングで1つ選ぶ。
// 【art】実画像はAI生成(画像/キャラクター 由来のPNG)に差し替える。いまは未作成のため image:null=
//        絵文字プレースホルダで描画する。差し替え時は image に require('...png') を入れるだけ(呼び出し側は不変)。
export type AvatarDef = {
  code: string;            // 保存/送受信で使う不変コード
  gender: 'm' | 'f';
  emoji: string;           // 画像が無い間のプレースホルダ
  image: number | null;    // require('...png') を入れると実画像で描画
};

export const AVATARS: AvatarDef[] = [
  { code: 'm1', gender: 'm', emoji: '🧑', image: null },
  { code: 'm2', gender: 'm', emoji: '👨', image: null },
  { code: 'm3', gender: 'm', emoji: '🧑‍🦱', image: null },
  { code: 'm4', gender: 'm', emoji: '👨‍🦰', image: null },
  { code: 'm5', gender: 'm', emoji: '🧔', image: null },
  { code: 'f1', gender: 'f', emoji: '👩', image: null },
  { code: 'f2', gender: 'f', emoji: '👧', image: null },
  { code: 'f3', gender: 'f', emoji: '👩‍🦰', image: null },
  { code: 'f4', gender: 'f', emoji: '👩‍🦱', image: null },
  { code: 'f5', gender: 'f', emoji: '🧕', image: null },
];

export const AVATAR_CODES = AVATARS.map((a) => a.code);
export const DEFAULT_AVATAR = 'm1';

/** コードから定義を引く。未知コードは既定(先頭)にフォールバック。 */
export function avatarOf(code: string | undefined | null): AvatarDef {
  return AVATARS.find((a) => a.code === code) ?? AVATARS[0];
}
