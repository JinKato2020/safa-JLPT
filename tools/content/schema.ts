// app/tools/content/schema.ts — 新コンテンツ形式のスキーマ定数(移行/検証/manifestで共有)。
export const LANGS = ['ja', 'ne', 'vi', 'en', 'zh', 'ko', 'th', 'id', 'bn', 'my'] as const;
export type Lang = (typeof LANGS)[number];

// i18n値は基本string(explain等)。読解/聴解のパッセージ訳(body)は行配列=string[]を許す。
export type ContentItem = { id: string; i18n: Record<string, Record<string, string | string[]>>; [k: string]: unknown };
export type ContentFile = { schema: 1; daimon: string; level: string; languages: string[]; items: ContentItem[] };
export type LexiconFile = { schema: 1; kind: 'meaning' | 'example'; level: string; languages: string[]; items: Record<string, Record<string, string>> };
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
  { daimon: 'orthography', prefix: 'orthography', folder: 'moji_goi', neutral: ['sentence', 'underline', 'answer', 'choices'], translate: ['explain'], neField: 'explainNe' },
  { daimon: 'context', prefix: 'context', folder: 'moji_goi', neutral: ['prompt', 'question', 'answer', 'choices'], translate: ['explain'], neField: 'explainNe' },
  { daimon: 'synonym', prefix: 'synonym', folder: 'moji_goi', neutral: ['sentence', 'underline', 'word', 'answer', 'choices'], translate: ['explain'], neField: 'reasonNe' },
  // 用法/文法形式/組み立ては現状 解説データ無し(将来 i18n.<lang>.explain を追加)。今は訳必須にしない。
  { daimon: 'usage', prefix: 'usage', folder: 'moji_goi', neutral: ['stem', 'question', 'answer', 'choices'], translate: [] },
  { daimon: 'grammar_form', prefix: 'grammar_form', folder: 'bunpou', neutral: ['stem', 'question', 'answer', 'choices'], translate: [] },
  { daimon: 'order', prefix: 'order', folder: 'bunpou', neutral: ['stem', 'question', 'answer', 'choices'], translate: [] },
];
