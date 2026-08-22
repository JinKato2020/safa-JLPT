// 漢字認識テストの出題生成(純関数・rng注入でテスト可能)。設計正本=04_漢字ID紐づけと漢字マスタリー_設計書.pdf(段階B①)。
// 字を単独提示→意味/読みを4択(文脈文なし)。結果は char の mean/read 面へ計上(answerId の #krecog_* を facetMap が写像)。
//  ・意味Q=meaningClear な字だけ(校のように意味を出しにくい字は作らない)。
//  ・読みQ=訓読み優先(字の意味に直結・設計①)。1モーラの訓stem(た/あ/り)は紛らわしいので避け音読みへ。
//    誤答に「答えと同じ読み(同音)」やその字の他の読みを入れない(設計②の一意化。特に音読みのみの字)。

export type KRKind = 'mean' | 'read';
export interface KRReading { type: 'on' | 'kun'; reading: string }
export interface KRItem {
  char: string;
  meaning: string;      // 表示用の意味(母語 or glossShort・呼び出し側で解決済み)
  meaningClear: boolean; // 単独提示で意味を問える字か(kanjiFacets.meaningClear)
  readings: KRReading[]; // 自レベル以下の読み(cardFaceReadings 由来・on/kun)
}
export interface KRQuestion {
  char: string;
  kind: KRKind;
  answerId: string; // `${char}#krecog_mean` | `${char}#krecog_read`(quizAnswer→facetMap→mean/read面)
  choices: string[];
  answerIndex: number;
}

const KUN_MIN_LEN = 2; // 1モーラの訓stem(食=た・会=あ・人=り)は誤答になりにくく紛らわしいので答えに使わない。
const hiraToKata = (s: string): string => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
// 読みの表示: 音=カタカナ / 訓=ひらがな。選択肢は答えと同じ種類で揃えるので4択の字種は一致し、字種で答えが割れない。
const showReading = (r: KRReading): string => (r.type === 'on' ? hiraToKata(r.reading) : r.reading);

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function pickItems(pool: KRItem[], count: number, rng: () => number): KRItem[] {
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

/** 出題に使う読み(訓優先・1モーラ訓は避け音へ)。作れない字は null。 */
export function pickAnswerReading(it: KRItem): KRReading | null {
  const kun = it.readings.filter((r) => r.type === 'kun' && r.reading.length >= KUN_MIN_LEN);
  if (kun.length) return kun[0];
  const on = it.readings.filter((r) => r.type === 'on');
  if (on.length) return on[0];
  const anyKun = it.readings.filter((r) => r.type === 'kun'); // 音が無く1モーラ訓しか無い字の最終手段
  return anyKun.length ? anyKun[0] : null;
}

/** 意味の誤答=同レベル他字の意味(meaningClear優先・重複意味除外)。 */
function meaningDistractors(it: KRItem, pool: KRItem[], count: number, rng: () => number): string[] {
  const take = (cands: KRItem[]): string[] => {
    const seen = new Set<string>([it.meaning]);
    const out: string[] = [];
    for (const p of shuffle(cands, rng)) {
      if (p.char === it.char || !p.meaning || seen.has(p.meaning)) continue;
      seen.add(p.meaning); out.push(p.meaning);
      if (out.length >= count) break;
    }
    return out;
  };
  const chosen = take(pool.filter((p) => p.meaningClear));
  if (chosen.length >= count) return chosen;
  return [...chosen, ...take(pool).filter((m) => !chosen.includes(m))].slice(0, count); // 不足時は制約緩和
}

/** 読みの誤答=他字の同種読み(音/訓を揃える)。答えと同音・その字の全読みは除外(設計②)。 */
function readingDistractors(it: KRItem, answer: KRReading, pool: KRItem[], count: number, rng: () => number): string[] {
  const ban = new Set<string>(it.readings.map((r) => showReading(r))); // その字の全読み(表示形)を誤答から除外=二重正解防止
  const collect = (sameType: boolean): string[] => {
    const seen = new Set<string>([...ban]);
    const out: string[] = [];
    const cands = shuffle(pool.filter((p) => p.char !== it.char), rng);
    for (const p of cands) {
      for (const r of p.readings) {
        if (sameType && r.type !== answer.type) continue;
        const disp = showReading(r);
        if (seen.has(disp)) continue; // 同音(同一表示文字列)は入れない
        seen.add(disp); out.push(disp);
        if (out.length >= count) return out;
      }
    }
    return out;
  };
  const same = collect(true);
  if (same.length >= count) return same;
  const relaxed = collect(false).filter((d) => !same.includes(d)); // 同種で足りなければ字種混在も許容
  return [...same, ...relaxed].slice(0, count);
}

function makeQuestion(it: KRItem, pool: KRItem[], rng: () => number): KRQuestion | null {
  const canMean = it.meaningClear && !!it.meaning;
  const ans = pickAnswerReading(it);
  const kinds: KRKind[] = [];
  if (canMean) kinds.push('mean');
  if (ans) kinds.push('read');
  if (!kinds.length) return null;
  const kind = kinds[Math.floor(rng() * kinds.length) % kinds.length];

  if (kind === 'mean') {
    const options = shuffle([it.meaning, ...meaningDistractors(it, pool, 3, rng)], rng);
    return { char: it.char, kind, answerId: `${it.char}#krecog_mean`, choices: options, answerIndex: options.indexOf(it.meaning) };
  }
  const correct = showReading(ans!);
  const options = shuffle([correct, ...readingDistractors(it, ans!, pool, 3, rng)], rng);
  return { char: it.char, kind, answerId: `${it.char}#krecog_read`, choices: options, answerIndex: options.indexOf(correct) };
}

/** 認識テストの1セッション(count問)。各字1問・作れる面(意味/読み)から出題。作れない字はスキップ。 */
export function buildKanjiRecognitionQuiz(pool: KRItem[], count: number, rng: () => number): KRQuestion[] {
  const out: KRQuestion[] = [];
  for (const it of shuffle(pool, rng)) {
    if (out.length >= count) break;
    const q = makeQuestion(it, pool, rng);
    if (q && q.choices.length >= 2) out.push(q); // 誤答が全く作れない病的ケースは捨てる
  }
  return out;
}
