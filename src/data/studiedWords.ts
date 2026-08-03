// SaveRef[] → 学習後まとめ画面(AfterStudyReward)の表示語に解決する共通純関数。
// vocab/kanji/grammar.json から語・意味を引く(MyWordsScreenと同じ解決)。未収載idは静かにスキップ・重複は除去。
// 各語の正誤(correct)も一緒に運ぶ(参考表示用)。同じ語が複数回出たら最後の正誤を採用。
import { VOCAB, GRAMMAR, KANJI, meaningIn } from './index';
import type { SaveRef } from '../store/state';

export interface StudiedWord { ref: SaveRef; word: string; meaning?: string; correct?: boolean }

// 学習後の正誤表から「問題と選択肢」を振り返るための、出題時スナップショット(QuizScreenが捕捉)。
// 出題時の実際の問題文・選択肢・正解位置をそのまま保持する(再生成せず、見たものをそのまま見せる)。
export interface StudiedQuestion {
  prompt?: string;
  example?: { text: string; hit: boolean }[];
  furi?: string;
  furiTarget?: string;
  noTargetRuby?: boolean;
  question: string;
  choices: string[];
  answerIndex: number;
}

const V = new Map(VOCAB.map((v) => [v.id, v]));
const G = new Map(GRAMMAR.map((g) => [g.id, g]));
const K = new Map(KANJI.map((k) => [k.id, k]));

/** 学習した語(ref＋正誤)を表示語へ解決(重複除去=最後の正誤を採用・l1翻訳対応)。順序は初出順。 */
export function resolveStudiedWords(items: readonly { ref: SaveRef; correct?: boolean }[], l1?: string): StudiedWord[] {
  const nm = (key: string, fb: string) => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined) ?? fb;
  const idx = new Map<string, number>();
  const out: StudiedWord[] = [];
  for (const it of items) {
    const ref = it.ref;
    if (!ref.id) continue;
    const key = ref.type + ':' + ref.id;
    if (idx.has(key)) { out[idx.get(key)!].correct = it.correct; continue; } // 再出=正誤だけ更新
    let w: StudiedWord | null = null;
    if (ref.type === 'vocab') { const v = V.get(ref.id); if (v) w = { ref, word: v.word, meaning: nm(v.id, v.meaning) }; }
    else if (ref.type === 'kanji') { const k = K.get(ref.id); if (k) w = { ref, word: k.char, meaning: nm(k.char, k.meaning) }; }
    else { const g = G.get(ref.id); if (g) w = { ref, word: g.point, meaning: nm(g.id, g.meaning) }; }
    if (w) { w.correct = it.correct; idx.set(key, out.length); out.push(w); }
  }
  return out;
}
