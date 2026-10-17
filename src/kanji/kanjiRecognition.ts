// 漢字認識テストの出題生成(純関数・rng注入でテスト可能)。設計正本=04_漢字ID紐づけと漢字マスタリー_設計書.pdf(段階B①)。
// 字を単独提示→意味/読みを4択(文脈文なし)。結果は char の mean/read 面へ計上(answerId の #krecog_* を facetMap が写像)。
//  ・意味Q=meaningClear な字だけ(校のように意味を出しにくい字は作らない)。
//  ・読みQ=訓読み優先(字の意味に直結・設計①)。1モーラの訓stem(た/あ/り)は紛らわしいので避け音読みへ。
//    誤答に「答えと同じ読み(同音)」やその字の他の読みを入れない(設計②の一意化。特に音読みのみの字)。

export type KRKind = 'mean' | 'read';
// reading=読みstem(送り仮名なし)。display=学習者向け表示形(訓は送り仮名を補い「つよ（い）」/音はカタカナ)。
// display は呼び出し側(画面)が formatKanjiReading で解決して渡す。省略時は showReading が簡易整形。
export interface KRReading { type: 'on' | 'kun'; reading: string; display?: string }
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

const hiraToKata = (s: string): string => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
// 読みの表示: display(送り仮名付きの整形形)が有ればそれを使う。無ければ簡易整形(音=カタカナ/訓=ひらがなstem)。
const showReading = (r: KRReading): string => r.display ?? (r.type === 'on' ? hiraToKata(r.reading) : r.reading);

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function pickItems(pool: KRItem[], count: number, rng: () => number): KRItem[] {
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

/** 出題に使う読み。まず訓読み(送り仮名を補って分かりやすく)、訓が無ければ一般的な音読み(先頭=主要)。
 *  同じ字に訓が複数ある時は stem が長い＝より特徴的な読みを選ぶ(上: あ<うえ)。作れない字は null。
 *  例: 強→つよ（い） / 手→て(訓を優先。上手のズ等の稀読みは選ばない) / 会→あ（う）。 */
export function pickAnswerReading(it: KRItem): KRReading | null {
  const kun = it.readings.filter((r) => r.type === 'kun');
  if (kun.length) return [...kun].sort((a, b) => b.reading.length - a.reading.length)[0];
  const on = it.readings.filter((r) => r.type === 'on');
  return on.length ? on[0] : null;
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

function makeQuestion(it: KRItem, pool: KRItem[], rng: () => number, only?: KRKind): KRQuestion | null {
  const canMean = it.meaningClear && !!it.meaning;
  const ans = pickAnswerReading(it);
  let kinds: KRKind[] = [];
  if (canMean) kinds.push('mean');
  if (ans) kinds.push('read');
  if (only) kinds = kinds.filter((k) => k === only); // 意味/読みを別ボタンに分離した時=その種別だけ出題(作れない字はスキップ)
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

/** 認識テストの1セッション(count問)。各字1問・作れる面(意味/読み)から出題。作れない字はスキップ。
 *  only を渡すと その種別(意味 or 読み)だけ出題(2ボタン分離用)。 */
export function buildKanjiRecognitionQuiz(pool: KRItem[], count: number, rng: () => number, only?: KRKind): KRQuestion[] {
  const out: KRQuestion[] = [];
  for (const it of shuffle(pool, rng)) {
    if (out.length >= count) break;
    const q = makeQuestion(it, pool, rng, only);
    if (q && q.choices.length >= 2) out.push(q); // 誤答が全く作れない病的ケースは捨てる
  }
  return out;
}
