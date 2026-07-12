import type { Category } from '../engine/engine';
import type { Daimon } from '../data/examBlueprint';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Account: undefined; // アカウント作成/ログイン(段階1: メール+パスワード)
  Settings: undefined; // 設定(旧・設定タブ=ProfileScreen をモーダル化。右上の歯車から開く)
  // 診断クイズ / 弱点ドリル(itemIds 指定でその語だけを出題) / 大問学習(daimon 指定=本番の大問を固定形式で連続出題)
  Quiz: { category?: Category | 'all'; itemIds?: string[]; title?: string; daimon?: Daimon; expression?: boolean } | undefined;
  Flashcard: { ids?: string[] } | undefined; // 漢字・語彙 連続学習→連続テスト(個別漢字79字を含む)。ids指定時はその語id集合だけを復習(my単語帳の「復習する」)
  MyWords: undefined; // my単語帳(保存した語/文法)一覧
  Mock: { full?: boolean } | undefined; // ミニ/フル模試(本番形式・弱点ヒートマップ)
  Reading: { subtype?: 'naiyou_tan' | 'naiyou_chu' | 'choubun' | 'joho' } | undefined;   // 読解(小区分つき)
  PassageGrammar: undefined; // 文章の文法(大問⑧・セット形式=1文章＋5設問。passageGrammar.json)
  Listening: { subtype?: 'kadai' | 'point' | 'gaiyou' | 'hatsuwa' | 'sokuji' } | undefined; // 聴解(小区分つき)
  Kakitori: { level?: 'N5' | 'N4' | 'N3'; mode?: 'drill' | 'review'; char?: string } | undefined; // 漢字書き取り(サンプル10字・3ステップ、単字自由練習対応)
  KanjiDetail: { char: string; scope?: 'level' | 'all' }; // scope=level:自レベル読み(単語タブ) / all(既定):全読み(辞書)
  ListeningQuiz: { kind: 'vocab' | 'kanji' }; // 聞き取りドリル(学習→テスト・語彙/漢字)
  WordDrill: { kind: 'vProduce' | 'gBuild' | 'gMeaning' | 'mixed'; level?: 'N5' | 'N4' | 'N3' }; // 単語タブ新形式(意味から単語/文をつくる/意味を選ぶ/今日のオススメ=横断)
};

export type Kubun = 'kanji' | 'vocab' | 'grammar';
export type WordsStackParamList = {
  WordsHome: undefined;                       // 世界観ハブ(掛軸=語彙/文法/漢字・今日の目標札)
  WordKubun: { kubun: Kubun };                // 1区分の練習ホーム(カバー率＋各ドリル。旧CardsScreenの1カード分)
  WordList: { view: Kubun; mode: 'study' };
};
export type DictStackParamList = {
  DictHome: undefined;                        // 図書館ホーム(4カード=語彙/漢字/文法辞書＋My単語帳)
  DictList: { view: Kubun };                  // 各辞書リスト(BrowseScreen)
};
export type StudyStackParamList = {
  StudyHome: undefined;                       // 試験タブ 世界観ホーム(タイル=オススメ/4カテゴリ/模試)
  StudyCategory: { cat: Category };           // 1カテゴリ詳細(全体正答率＋ミックス＋大問)
};
