// my単語帳のイラスト資産(バンドル同梱=require、即時表示)。badges.ts と同方式。
// 生成: blog/tools/gen-images.mjs(Gemini 2.5 Flash Image=Nano Banana)。原寸は デザイン提案/イラスト本生成_原寸 に保管。
// マスコット=子ぎつね書生(hero:迎える / cheer:応援 / empty:まだ空)。本表紙=語彙/漢字/文法(和綴じ・区分色)。
import type { ImageSourcePropType } from 'react-native';

export type MascotPose = 'hero' | 'cheer' | 'empty';
export const MASCOT: Record<MascotPose, ImageSourcePropType> = {
  hero: require('../../assets/mywords/mascot_hero.png'),
  cheer: require('../../assets/mywords/mascot_cheer.png'),
  empty: require('../../assets/mywords/mascot_empty.png'),
};

export type BookKind = 'vocab' | 'kanji' | 'grammar';
export const BOOK_COVERS: Record<BookKind, ImageSourcePropType> = {
  vocab: require('../../assets/mywords/book_vocab.png'),
  kanji: require('../../assets/mywords/book_kanji.png'),
  grammar: require('../../assets/mywords/book_grammar.png'),
};
