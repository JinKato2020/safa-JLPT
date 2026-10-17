// SaveRef[] → 学習後まとめ画面(AfterStudyReward)の表示語に解決する共通純関数。
// vocab/kanji/grammar.json から語・意味を引く(MyWordsScreenと同じ解決)。未収載idは静かにスキップ・重複は除去。
// 各語の正誤(correct)も一緒に運ぶ(参考表示用)。同じ語が複数回出たら最後の正誤を採用。
import { VOCAB, GRAMMAR, KANJI, meaningIn } from './index';
import type { SaveRef } from '../store/state';

export interface StudiedWord {
  ref: SaveRef;
  word: string;
  meaning?: string;
  correct?: boolean;
  noSave?: boolean;        // 辞書に無い(意味を持たない)問題=単語帳に保存できない行。意味は空欄で正誤・問題だけ見せる。
  q?: StudiedQuestion;     // 出題スナップショット(問題の見直し用)。あれば行から全画面レビューへ。
}

// 学習後の正誤表から「問題の見直し(全画面)」を開くための、出題時スナップショット。
// 出題時の実際の本文/台本/問題文/選択肢/正解位置をそのまま保持する(再生成せず、見たものをそのまま見せる)。
export interface StudiedQuestion {
  itemId?: string;     // 出題ユニットid(意味を持たない問題の行キー/重複除去に使う)
  prompt?: string;
  example?: { text: string; hit: boolean }[];
  furi?: string;
  furiTarget?: string;
  noTargetRuby?: boolean;
  passage?: string;    // 読解の本文(見出し＋段落)
  script?: string;     // 聴解の台本(話者ターンは全角空白区切り)
  clipTitle?: string;  // 聴解クリップの見出し
  question: string;
  choices: string[];
  answerIndex: number;
  picked?: number;     // 選んだ選択肢(不正解の×表示用)
  explain?: string;    // 解説(あれば)
  correct?: boolean;   // この回の正誤(一覧のバッジ用)
  label?: string;      // 見直し一覧の行ラベル
}

const V = new Map(VOCAB.map((v) => [v.id, v]));
const G = new Map(GRAMMAR.map((g) => [g.id, g]));
const K = new Map(KANJI.map((k) => [k.id, k]));

/** 学習した語(ref＋正誤)を表示語へ解決(重複除去=最後の正誤を採用・l1翻訳対応)。順序は初出順。
 *  辞書に無い(意味を持たない)問題は、スナップショット q があれば「意味空欄の行」として残す
 *  (正誤・問題内容は分かるように)。q が無い従来呼び出しは、未収載refを静かにスキップ(他画面の互換)。 */
export function resolveStudiedWords(items: readonly { ref?: SaveRef; correct?: boolean; q?: StudiedQuestion }[], l1?: string): StudiedWord[] {
  const nm = (key: string, fb: string) => (l1 && l1 !== 'en' ? meaningIn(key, l1) : undefined) ?? fb;
  const idx = new Map<string, number>();
  const out: StudiedWord[] = [];
  for (const it of items) {
    const ref = it.ref;
    let w: StudiedWord | null = null;
    if (ref?.id) {
      if (ref.type === 'vocab') { const v = V.get(ref.id); if (v) w = { ref, word: v.word, meaning: nm(v.id, v.meaning) }; }
      else if (ref.type === 'kanji') { const k = K.get(ref.id); if (k) w = { ref, word: k.char, meaning: nm(k.char, k.meaning) }; }
      else { const g = G.get(ref.id); if (g) w = { ref, word: g.point, meaning: nm(g.id, g.meaning) }; }
    }
    if (!w) {
      // 辞書解決できない問題。スナップショットがある時だけ、意味空欄の行として残す。
      if (!it.q) continue; // 従来通り: スナップショット無し＝スキップ
      const label = it.q.prompt || it.q.question || '';
      const synthId = 'q:' + (it.q.itemId || label);
      w = { ref: { type: 'grammar', id: synthId }, word: label, meaning: undefined, noSave: true, q: it.q };
    } else if (it.q) {
      w.q = it.q; // 解決できた行にもスナップショットを添える(見直しへ)
    }
    const key = w.noSave ? w.ref.id : w.ref.type + ':' + w.ref.id;
    if (idx.has(key)) { out[idx.get(key)!].correct = it.correct; continue; } // 再出=正誤だけ更新
    w.correct = it.correct;
    idx.set(key, out.length); out.push(w);
  }
  return out;
}
