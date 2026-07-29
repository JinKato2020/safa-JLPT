// SaveRef[] → 学習後まとめ画面(AfterStudyReward)の表示語に解決する共通純関数。
// vocab/kanji/grammar.json から語・意味を引く(MyWordsScreenと同じ解決)。未収載idは静かにスキップ・重複は除去。
// これで全ドリル(単語タブ/試験タブ)が「学習した語をまとめて私の単語帳へ」を同じ形で出せる。
import { VOCAB, GRAMMAR, KANJI, meaningIn } from './index';
import type { SaveRef } from '../store/state';

export interface StudiedWord { ref: SaveRef; word: string; meaning?: string }

const V = new Map(VOCAB.map((v) => [v.id, v]));
const G = new Map(GRAMMAR.map((g) => [g.id, g]));
const K = new Map(KANJI.map((k) => [k.id, k]));

/** 学習した SaveRef 群を表示語へ解決(重複除去・l1翻訳対応)。順序は入力順を保つ。 */
export function resolveStudiedWords(refs: readonly SaveRef[], l1?: string): StudiedWord[] {
  const nm = (key: string, fb: string) => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined) ?? fb;
  const seen = new Set<string>();
  const out: StudiedWord[] = [];
  for (const ref of refs) {
    const key = ref.type + ':' + ref.id;
    if (!ref.id || seen.has(key)) continue;
    seen.add(key);
    if (ref.type === 'vocab') { const v = V.get(ref.id); if (v) out.push({ ref, word: v.word, meaning: nm(v.id, v.meaning) }); }
    else if (ref.type === 'kanji') { const k = K.get(ref.id); if (k) out.push({ ref, word: k.char, meaning: nm(k.char, k.meaning) }); }
    else { const g = G.get(ref.id); if (g) out.push({ ref, word: g.point, meaning: nm(g.id, g.meaning) }); }
  }
  return out;
}
