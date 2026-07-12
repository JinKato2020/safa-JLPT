// 単語/試験/辞書タブの全画面背景イラスト(ユーザー提供・縦長853x1844≒スマホ比)。
// 背景の上に半透明の没入UI(和紙/ガラス調カード・透明タップ領域)を重ねる。
import type { ImageSourcePropType } from 'react-native';

export type TabKey = 'word' | 'exam' | 'dict';

// 各タブの全画面背景。
// word=学習タブ.PNG(語彙/文法/漢字の掛軸シーン), exam=試験タブ.PNG(試験会場の門), dict=図書館.PNG。
export const TAB_BG: Record<TabKey, ImageSourcePropType> = {
  word: require('../../assets/tabs/word_bg.jpg'),
  exam: require('../../assets/tabs/exam_bg.jpg'),
  dict: require('../../assets/tabs/dict_bg.jpg'),
};
