// 聞き取りドリルの出題生成(純関数)。rng注入でテスト可能・毎回ダミーと順が変わる。
import { vocabIdForWord } from '../words/vocabIndex';

export type LQItem = { id: string; word: string; reading: string; meaning: string };
export type KanjiRep = { id: string; char: string; level: string; bound: boolean; word: string; reading: string };
export type LQQuestion = {
  answerId: string;
  audioVocabId: string | null; // mp3再生用(あればplayVocab、無ければTTS)
  audioReading: string;        // TTS用の読み
  audioChar?: string;          // 漢字ドリル専用: kanji mp3再生用(audioVocabId無い時のフォールバック元)
  choices: string[];
  answerIndex: number;
};

const KANJI_RE = /[一-龿々〆]/;
function kanjiSet(s: string): Set<string> { const o = new Set<string>(); for (const c of s) if (KANJI_RE.test(c)) o.add(c); return o; }
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function pickItems<T extends { id: string }>(pool: T[], count: number, rng: () => number): T[] {
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

/** 語彙ダミー: 共通漢字>読み長/かな一致 でスコアし近いプールから。不足は補充。 */
export function nearDistractors(correct: LQItem, pool: LQItem[], count: number, rng: () => number): LQItem[] {
  const ck = kanjiSet(correct.word); const cr = correct.reading;
  const scored = pool
    .filter((p) => p.id !== correct.id && p.word !== correct.word && p.meaning !== correct.meaning)
    .map((p) => {
      let s = 0; for (const k of kanjiSet(p.word)) if (ck.has(k)) s += 3;
      if (p.reading.length === cr.length) s += 1;
      if (p.reading[0] === cr[0] || p.reading[p.reading.length - 1] === cr[cr.length - 1]) s += 1;
      return { p, s };
    });
  const near = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 20).map((x) => x.p);
  const chosen = shuffle(near, rng).slice(0, count);
  if (chosen.length < count) {
    const haveIds = new Set(chosen.map((x) => x.id).concat(correct.id));
    const haveMeanings = new Set(chosen.map((x) => x.meaning).concat(correct.meaning));
    for (const f of shuffle(pool.filter((p) => !haveIds.has(p.id)), rng)) {
      if (chosen.length >= count) break;
      if (haveMeanings.has(f.meaning)) continue; // 意味重複はスコアリングの誤答扱いになるため必ず除外
      chosen.push(f);
      haveIds.add(f.id);
      haveMeanings.add(f.meaning);
    }
  }
  return chosen.slice(0, count);
}

export function buildVocabQuiz(items: LQItem[], pool: LQItem[], rng: () => number): LQQuestion[] {
  return items.map((it) => {
    const options = shuffle([it, ...nearDistractors(it, pool, 3, rng)], rng);
    return {
      answerId: it.id,
      audioVocabId: it.id, // 語彙は全て mp3 あり
      audioReading: it.reading,
      choices: options.map((o) => o.meaning),
      answerIndex: options.findIndex((o) => o.id === it.id),
    };
  });
}

/** 漢字ダミー: 同レベル・正解と同じ reading を除外(同音で当たらない事故防止)・近い字からランダム。不足は補充。 */
export function nearKanjiDistractors(correct: KanjiRep, pool: KanjiRep[], count: number, rng: () => number): KanjiRep[] {
  const cand = pool.filter((p) => p.id !== correct.id && p.char !== correct.char && p.reading !== correct.reading);
  const chosen = shuffle(cand, rng).slice(0, count);
  if (chosen.length < count) {
    // 最終手段: 同音読み除外を緩めて補充(id/char重複のみ避ける)。現行データでは到達しない想定だがプール枯渇時の防御。
    const have = new Set(chosen.map((x) => x.id).concat(correct.id));
    for (const f of shuffle(pool.filter((p) => !have.has(p.id) && p.char !== correct.char), rng)) {
      if (chosen.length >= count) break;
      chosen.push(f);
      have.add(f.id);
    }
  }
  return chosen.slice(0, count);
}

export function buildKanjiQuiz(items: KanjiRep[], pool: KanjiRep[], rng: () => number): LQQuestion[] {
  return items.map((it) => {
    const options = shuffle([it, ...nearKanjiDistractors(it, pool, 3, rng)], rng);
    const audioVocabId = it.bound || !it.word ? null : vocabIdForWord(it.word, it.reading);
    return {
      answerId: it.id,
      audioVocabId,
      audioReading: it.reading,
      audioChar: it.char,
      choices: options.map((o) => o.char),
      answerIndex: options.findIndex((o) => o.id === it.id),
    };
  });
}
