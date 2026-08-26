// 学習タブの各ドリルが「対象にできる項目(ID紐づけ)」のカバー率を、
// アプリ本体の eligible 関数を直接呼んで集計する(=実装とのドリフトを防ぐ)。
// 出力: scratchpad/pg/drill_coverage.json（Python が xlsx へ転記）＋標準出力に表。
//   語彙ドリル … 母数=レベル内 語彙数 / 文法ドリル … 母数=レベル内 文法点数(n5-g-92除外)
//   漢字ドリル … 母数=レベル内 漢字数
// 実行: node --import tsx tools/drill_coverage.ts
import { writeFileSync } from 'node:fs';
import { produceEligible, buildEligible, meaningEligible } from '../src/ladder/wordDrill';
import { levelListFor } from '../src/words/levelList';
import vocab from '../src/data/shared/vocab.json';
import grammar from '../src/data/shared/grammar.json';
import { KANJI } from '../src/data';
import kanjiDrillReps from '../src/data/words/kanjiDrillReps.json';
import kanjiFacets from '../src/data/words/kanjiFacets.json';
import kanjiSimilar from '../src/data/words/kanjiSimilar.json';
import gbuildPermanentExcluded from '../src/data/shared/gbuildPermanentExcluded.json';

const LEVELS = ['N5', 'N4', 'N3'] as const;
const V = vocab as { id: string; level: string; word: string }[];
const G = grammar as { id: string; level: string }[];
const K = KANJI as { id: string; char: string; level: string; type: string }[];
const reps = kanjiDrillReps as Record<string, unknown>;
const EXCL = new Set(['n5-g-92']); // 指標対象外(本文非依存の活用ドリル)

const vocabTotal = (lv: string) => V.filter((v) => v.level === lv).length;
const grammarTotal = (lv: string) => G.filter((g) => g.level === lv && !EXCL.has(g.id)).length;
const kanjiTotal = (lv: string) => K.filter((k) => k.type === 'kanji' && k.level === lv).length;

// 聞き取り・語彙の対象(ListeningQuizScreen と同条件): 非自立語/波ダッシュ語を除外
const listenVocabEligible = (lv: string) =>
  (levelListFor('vocab', lv) as { word: string }[]).filter((v) => !/[～~]/.test(v.word) && v.word !== 'では').length;
// 聞き取り・漢字の対象(同): 当該レベルの漢字で drill rep を持つ字
const listenKanjiEligible = (lv: string) =>
  K.filter((k) => k.type === 'kanji' && k.level === lv && reps[k.char]).length;
// 漢字ドリル(認識テスト/形の弁別)の対象。read=全字・mean=意味が立つ字(meaningClear)・form=似た字が3つ揃う字(formMakeable)。
const KF = kanjiFacets as Record<string, { meaningClear?: boolean }>;
const KS = kanjiSimilar as Record<string, { formMakeable?: boolean }>;
const kanjiMeanEligible = (lv: string) => K.filter((k) => k.type === 'kanji' && k.level === lv && KF[k.char]?.meaningClear).length;
const kanjiFormEligible = (lv: string) => K.filter((k) => k.type === 'kanji' && k.level === lv && KS[k.char]?.formMakeable).length;

// 文法パズルの「永久に不可能」点(分離型/助詞1個/分類ラベル)＝真の分母から除外。
const lvlOf = new Map(G.map((g) => [g.id, g.level]));
const permById = gbuildPermanentExcluded as { id: string; reason: string }[];
const gbuildPermanent = (lv: string) => permById.filter((p) => lvlOf.get(p.id) === lv).length;

// achievable = そのドリルで「そもそも作れる」項目数(=真のカバー率の分母)。
//   自動生成ドリル(語彙パズル/聞き取り)は非対象=全て構造的に不可能ゆえ achievable=cov(真の100%)。
//   文法パズルは achievable = 母数 − 永久不可能(埋められない天井を除く)。
type Row = { kubun: string; drill: string; cov: number; tot: number; achievable: number };
const rows: Record<string, Row[]> = {};
for (const lv of LEVELS) {
  const vt = vocabTotal(lv), gt = grammarTotal(lv), kt = kanjiTotal(lv);
  const vProd = produceEligible(lv).length;
  const lVoc = listenVocabEligible(lv);
  const gMean = meaningEligible(lv).filter((g) => !EXCL.has(g.id)).length;
  const gBld = buildEligible(lv).filter((s) => !EXCL.has(s.g.id)).length;
  const lKan = listenKanjiEligible(lv);
  const kMean = kanjiMeanEligible(lv), kForm = kanjiFormEligible(lv);
  rows[lv] = [
    { kubun: '語彙', drill: '語彙パズル(産出)', cov: vProd, tot: vt, achievable: vProd },
    { kubun: '語彙', drill: '聞き取り(語彙)', cov: lVoc, tot: vt, achievable: lVoc },
    { kubun: '文法', drill: '意味を選ぶ(受容)', cov: gMean, tot: gt, achievable: gt },
    { kubun: '文法', drill: '文法パズル(産出)', cov: gBld, tot: gt, achievable: gt - gbuildPermanent(lv) },
    // 漢字ドリル(易→難): 意味/読み(認識)→形の弁別→聞き取り。書き取りは練習ゆえ面(カバー率)に数えない。
    { kubun: '漢字', drill: '意味を選ぶ(漢字)', cov: kMean, tot: kt, achievable: kMean },
    { kubun: '漢字', drill: '読み(漢字)', cov: kt, tot: kt, achievable: kt },
    { kubun: '漢字', drill: '形の弁別(漢字)', cov: kForm, tot: kt, achievable: kForm },
    { kubun: '漢字', drill: '聞き取り(漢字)', cov: lKan, tot: kt, achievable: lKan },
  ];
}

writeFileSync('scratchpad/pg/drill_coverage.json', JSON.stringify(rows, null, 2));
for (const lv of LEVELS) {
  console.log(`\n■ ${lv}`);
  for (const r of rows[lv]) {
    const all = r.tot ? Math.round((r.cov / r.tot) * 100) : 0;
    const tru = r.achievable ? Math.min(100, Math.round((r.cov / r.achievable) * 100)) : 0;
    console.log(`  ${r.kubun}\t${r.drill}\t全ID ${r.cov}/${r.tot}=${all}%\t真の ${r.cov}/${r.achievable}=${tru}%`);
  }
}
console.log('\nWROTE scratchpad/pg/drill_coverage.json');
