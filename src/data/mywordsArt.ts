// my単語帳「桜の書斎」の同梱アセット(require=即時表示)。
// 案内キャラ=桜の巫女(ユーザー提供絵)。guide.open=開き目 / guide.blink=目だけ閉じた同一絵(瞬き用・目以外は完全同一)。
// room=書斎の背景(部屋)。生成/加工の由来は デザイン提案/ に保管。本(和綴じ)はViewで描画=画像不要。
import type { ImageSourcePropType } from 'react-native';

export const GUIDE: { open: ImageSourcePropType; blink: ImageSourcePropType } = {
  open: require('../../assets/mywords/guide_open.png'),
  blink: require('../../assets/mywords/guide_blink.png'),
};
export const ROOM: ImageSourcePropType = require('../../assets/mywords/room.jpg');

export type BookKind = 'vocab' | 'kanji' | 'grammar';
