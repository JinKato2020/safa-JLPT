// カテゴリー分類の正本タクソノミー。漢字傘8＝語彙の傘も兼ねる／語彙小テーマ(umbrella付)／文法機能11。
// ラベルは i18n `cat.<id>`(初期 ja、無い言語は ja フォールバック)。order昇順＝表示順。
export type CatKind = 'kanji' | 'vocab' | 'grammar';
export interface Cat { id: string; kind: CatKind; umbrella?: string; label: string; order: number }

// 漢字傘8（語彙の傘も兼ねる）
const K: [string, string][] = [
  ['nature', '自然・天地'], ['position', '位置・方向'], ['body', '人・体・家族'], ['numtime', '数・時・暦'],
  ['action', '動作'], ['state', '様子・性質'], ['society', '暮らし・社会'], ['mind', '心・考え・抽象'],
];
// 語彙小テーマ [id, umbrella, label]
const V: [string, string, string][] = [
  ['weather', 'nature', '天気・季節'], ['animal', 'nature', '動物'], ['plant', 'nature', '植物'], ['geo', 'nature', '地理・自然'],
  ['direction', 'position', '位置・方向'], ['deixis', 'position', '指示(こそあど場所)'],
  ['family', 'body', '家族・人'], ['bodyhealth', 'body', '体・健康'], ['relation', 'body', '人間関係・呼び方'],
  ['number', 'numtime', '数・量'], ['time', 'numtime', '時間・日付'], ['counter', 'numtime', '助数詞（数え方）'],
  ['move', 'action', '移動・往来'], ['giveget', 'action', '授受・売買'], ['perceive', 'action', '見る聞く話す'], ['daily', 'action', '日常動作'], ['mindverb', 'action', '心の動き'],
  ['size', 'state', '大小・多少・長短'], ['quality', 'state', '新旧・良悪'], ['color', 'state', '色'], ['sense', 'state', '感覚・様子'], ['adverb', 'state', '副詞'],
  ['food', 'society', '食べ物・飲み物'], ['home', 'society', '家・日用品'], ['clothes', 'society', '衣服'], ['shopmoney', 'society', '買い物・お金'], ['transport', 'society', '交通'], ['place', 'society', '場所・建物'], ['school', 'society', '学校・勉強'], ['work', 'society', '仕事・社会'], ['hobby', 'society', '趣味・遊び'],
  ['emotion', 'mind', '気持ち・感情'], ['think', 'mind', '思考・判断'], ['abstract', 'mind', '抽象概念'], ['expression', 'mind', 'あいさつ・表現'], ['function', 'mind', '機能語'],
];
// 文法機能11
const G: [string, string][] = [
  ['particle', '助詞'], ['verbform', '動詞・活用の形'], ['pattern', '文型・接続'], ['timeorder', '時・順序'],
  ['reason', '理由・目的'], ['condition', '条件・仮定'], ['request', '依頼・許可・禁止・意志'], ['degree', '比較・程度'],
  ['evidential', '推量・伝聞・様態'], ['suffix', '接尾・機能語'], ['keigo', '敬語・丁寧'],
];

let o = 0;
export const CATS: Cat[] = [
  ...K.map(([id, label]): Cat => ({ id, kind: 'kanji', label, order: o++ })),
  ...V.map(([id, umbrella, label]): Cat => ({ id, kind: 'vocab', umbrella, label, order: o++ })),
  ...G.map(([id, label]): Cat => ({ id, kind: 'grammar', label, order: o++ })),
];
export const CAT_BY_ID: Record<string, Cat> = Object.fromEntries(CATS.map((c) => [c.id, c]));
