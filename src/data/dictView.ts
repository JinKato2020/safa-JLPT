// 共有辞書(remote: dictRemote.SharedDict)を、辞書画面の表示用 StudyItem に変換する層。
//  ・JLPT も App B も「同じ共有辞書」を見せるための橋渡し(辞書画面のみ。クイズ/SRSの素材は別)。
//  ・SRS習得度(✓/・)を保つため、word|reading / char を端末同梱データのSRS item id に対応付ける。
//    対応が無い語(共有辞書のみに在る語)は id を合成(sv:/sk:)＝習得度は「新規」表示。
//  ・ja-kanji は level を持たない(KANJIDIC由来)ので、同梱データから char→level を補完。
//    補完できない漢字は level 空＝「全」表示時のみ出る(各級フィルタには出ない)。
import { VOCAB, KANJI, DICT_EXT_VOCAB, DICT_EXT_KANJI, type VocabItem, type KanjiItem } from '.';
import type { SharedDict } from './dictRemote';
import type { Level } from '../engine/engine';

export type DictMaps = {
  wrId: Record<string, string>;     // "word|reading" → SRS item id(同梱)
  charId: Record<string, string>;   // char → SRS item id(同梱)
  charLevel: Record<string, string>;// char → level(同梱から補完)
};

/** 同梱データから習得度マッピング＆漢字レベル補完表を作る(画面マウント時に一度)。 */
export function buildDictMaps(): DictMaps {
  const wrId: Record<string, string> = {};
  for (const v of [...VOCAB, ...DICT_EXT_VOCAB]) wrId[`${v.word}|${v.reading}`] = v.id;
  const charId: Record<string, string> = {};
  const charLevel: Record<string, string> = {};
  for (const k of [...KANJI, ...DICT_EXT_KANJI]) { charId[k.char] = k.id; charLevel[k.char] = k.level; }
  return { wrId, charId, charLevel };
}

/** 共有辞書の語彙 → 表示用 VocabItem[]。意味=gloss(英・JMdict)。 */
export function sharedVocabItems(dict: SharedDict, m: DictMaps): VocabItem[] {
  return dict.vocab.map((v): VocabItem => ({
    id: m.wrId[`${v.word}|${v.reading}`] ?? `sv:${v.word}|${v.reading}`,
    level: v.level as Level,
    category: 'moji_goi',
    type: 'vocab',
    word: v.word,
    reading: v.reading,
    meaning: v.gloss || (v.senses && v.senses.join(', ')) || '',
    tags: [],
  }));
}

/** 共有辞書の漢字 → 表示用 KanjiItem[]。on/kun/意味は配列を連結。level は同梱から補完(無ければ空)。 */
export function sharedKanjiItems(dict: SharedDict, m: DictMaps): KanjiItem[] {
  return dict.kanji.map((k): KanjiItem => ({
    id: m.charId[k.char] ?? `sk:${k.char}`,
    level: ((m.charLevel[k.char] ?? '') as Level),
    category: 'moji_goi',
    type: 'kanji',
    char: k.char,
    on: (k.on || []).join('、'),
    kun: (k.kun || []).join('、'),
    meaning: (k.meanings || []).join('; '),
    strokes: k.strokes ?? 0,
    grade: k.grade ?? 0,
  }));
}
