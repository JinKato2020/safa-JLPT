// app/tools/content/schema.ts — 新コンテンツ形式のスキーマ定数(移行/検証/manifestで共有)。
export const LANGS = ['ja', 'ne', 'vi', 'en', 'zh', 'ko', 'th', 'id', 'bn', 'my'] as const;
export type Lang = (typeof LANGS)[number];

// i18n値は基本string(explain等)。読解/聴解のパッセージ訳(body)は行配列=string[]を許す。
export type ContentItem = { id: string; i18n: Record<string, Record<string, string | string[]>>; [k: string]: unknown };
export type ContentFile = { schema: 1; daimon: string; level: string; languages: string[]; items: ContentItem[] };
// kanjigloss = 漢字カードの例語(会社 等)の母語グロス。key=語そのもの(vocab訳流用977＋生成205)。辞書タブの漢字リスト用。
// furigana = 語彙例文のふりがな(漢字(よみ)形式)のOTA上書き。key=vocabId・値={ ja: "ふりがな文" }。同梱 vocabFurigana.json を初期値に上書き(ビルド無しで修正配信)。
//   ※ example(kind)は母語訳に加え ja/en を items[vid].ja/en に置くと、辞書タブの例文(日本語/英語)を OTA で上書きできる(同梱 vocabExamplesAi.json が初期値)。
// vocabfix/kanjifix/grammarfix = 辞書表示フィールドのOTA上書き。key=vocabId/漢字char/文法id・値={ field: 新しい値 }。同梱を初期値に上書き(ビルド無しで修正配信)。
//   vocabfix: word/reading/meaning ・ kanjifix: meaning/on/kun ・ grammarfix: point/romaji/meaning/exampleJa/exampleEn。id/構造は同梱のまま(壊さない)。
export type LexiconFile = { schema: 1; kind: 'meaning' | 'example' | 'kanjigloss' | 'furigana' | 'vocabfix' | 'kanjifix' | 'grammarfix'; level: string; languages: string[]; items: Record<string, Record<string, string>> };
export type ManifestEntry = { sha256: string; bytes: number; count: number };
export type Manifest = { schema: 1; contentVersion: string; languages: string[]; daimonLabels: Record<string, string>; files: Record<string, ManifestEntry> };

export const DAIMON_LABELS: Record<string, string> = {
  kanji_read: '大問1 漢字読み', orthography: '大問2 表記', context: '大問3 文脈規定', synonym: '大問4 言い換え類義', usage: '大問5 用法',
  grammar_form: '文法・大問1 文法形式判断', order: '文法・大問2 文の組み立て', passage_grammar: '文法・大問3 文章の文法',
  naiyou_tan: '読解 内容理解(短)', naiyou_chu: '読解 内容理解(中)', choubun: '読解 内容理解(長)', joho: '読解 情報検索',
  kadai: '聴解 課題理解', point: '聴解 ポイント理解', gaiyou: '聴解 概要理解', hatsuwa: '聴解 発話表現', sokuji: '聴解 即時応答',
};

export type DaimonSpec = { daimon: string; prefix: string; folder: 'moji_goi' | 'bunpou'; neutral: string[]; translate: string[]; neField?: string };
// 文字語彙・文法(単票バンク系)。読解/聴解/文章の文法はネスト構造のため個別処理(migrate側)。
export const DAIMON_SPEC: DaimonSpec[] = [
  { daimon: 'kanji_read', prefix: 'kanji_read', folder: 'moji_goi', neutral: ['sentence', 'underline', 'answer', 'choices'], translate: [] },
  { daimon: 'orthography', prefix: 'orthography', folder: 'moji_goi', neutral: ['sentence', 'underline', 'answer', 'choices'], translate: [], neField: 'explainNe' }, // 解説・母語訳は廃止(2026-09-02)。読み/表記は下線語のデコード課題ゆえ訳不要。
  { daimon: 'context', prefix: 'context', folder: 'moji_goi', neutral: ['prompt', 'question', 'answer', 'choices'], translate: [] }, // 解説は廃止(2026-09-02)。対訳は本文(i18n.en/ne.prompt)で任意。
  { daimon: 'synonym', prefix: 'synonym', folder: 'moji_goi', neutral: ['sentence', 'underline', 'word', 'answer', 'choices'], translate: [] }, // 解説は廃止(2026-09-02)。
  // 用法/文法形式/組み立ては現状 解説データ無し(将来 i18n.<lang>.explain を追加)。今は訳必須にしない。
  // ★neutral には BankUnit(data/daimon.ts)が要るフィールドを漏らさず入れること。
  //   pointId … saveRefForBank が文法idの逆引きに使う。落とすと学習記録が保存されない。
  //   ambiguous … order のうち「複数正解=一意にならない」と監査された296問の除外印。
  //               落とすと除外が効かなくなり、答えが定まらない問題が出題される。
  //   level/daimon はファイルヘッダ側に持つ(rehydrate が復元する)。
  { daimon: 'usage', prefix: 'usage', folder: 'moji_goi', neutral: ['stem', 'question', 'answer', 'choices'], translate: [] },
  { daimon: 'grammar_form', prefix: 'grammar_form', folder: 'bunpou', neutral: ['stem', 'question', 'answer', 'choices', 'pointId'], translate: [] },
  { daimon: 'order', prefix: 'order', folder: 'bunpou', neutral: ['stem', 'question', 'answer', 'choices', 'pointId', 'ambiguous'], translate: [] },
];
