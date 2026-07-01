import type { Category } from '../engine/engine';
import type { Daimon } from '../data/examBlueprint';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  // 診断クイズ / 弱点ドリル(itemIds 指定でその語だけを出題) / 大問学習(daimon 指定=本番の大問を固定形式で連続出題)
  Quiz: { category?: Category | 'all'; itemIds?: string[]; title?: string; daimon?: Daimon } | undefined;
  Flashcard: undefined; // 漢字・語彙 連続学習→連続テスト
  Grammar: undefined;   // 文法 連続学習→連続テスト
  Mock: { full?: boolean } | undefined; // ミニ/フル模試(本番形式・弱点ヒートマップ)
  Reading: { subtype?: 'naiyou_tan' | 'naiyou_chu' | 'choubun' | 'joho' } | undefined;   // 読解(小区分つき)
  Listening: { subtype?: 'kadai' | 'point' | 'gaiyou' | 'hatsuwa' | 'sokuji' } | undefined; // 聴解(小区分つき)
};
