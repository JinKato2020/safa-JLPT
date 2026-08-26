// 漢字の「形の弁別」テストの出題生成(純関数・rng注入でテスト可能)。
// 字の意味/読みを手がかりに、見た目がそっくりな4択(正解＋似た字3つ)から正しい字を選ぶ。
// 結果は char の form 面へ計上(answerId の #kdiscrim_form を facetMap が写像)。
// 「書き取り(産出)」より易しい認識レベルで、"似た字の取り違え"だけを独立に測る踏み石。

export interface KFItem {
  char: string;
  hint: string;      // 手がかり(意味＋読み。呼び出し側で母語解決済み)。どの字かを一意に指す。
  similar: string[]; // 見た目が似た字(誤答候補・kanjiSimilar.json 由来)。
}
export interface KFQuestion {
  char: string;
  hint: string;
  answerId: string;  // `${char}#kdiscrim_form`(quizAnswer→facetMap→form面)
  choices: string[]; // 4択の漢字(正解＋似た字3)
  answerIndex: number;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 1字の弁別問題。似た字が3つ揃わない字は null(=形の弁別が作れない=form面の分母外)。 */
export function makeFormQuestion(it: KFItem, rng: () => number): KFQuestion | null {
  const distractors = it.similar.filter((s) => s && s !== it.char);
  const uniq = [...new Set(distractors)];
  if (uniq.length < 3) return null; // 4択に足りない=作れない
  const picked = shuffle(uniq, rng).slice(0, 3);
  const options = shuffle([it.char, ...picked], rng);
  return { char: it.char, hint: it.hint, answerId: `${it.char}#kdiscrim_form`, choices: options, answerIndex: options.indexOf(it.char) };
}

/** 形の弁別テストの1セッション(count問)。各字1問・似た字が3つ揃う字だけ出題。 */
export function buildKanjiFormQuiz(pool: KFItem[], count: number, rng: () => number): KFQuestion[] {
  const out: KFQuestion[] = [];
  for (const it of shuffle(pool, rng)) {
    if (out.length >= count) break;
    const q = makeFormQuestion(it, rng);
    if (q) out.push(q);
  }
  return out;
}
