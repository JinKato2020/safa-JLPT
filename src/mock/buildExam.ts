// 模試の組み立て(純ロジック・React非依存=node テスト可)。旧 MockScreen.tsx から切り出し(挙動不変)。
// 比率駆動: フル=本番の出題数、ミニ=round(÷3)。JLPTは大問内訳まで本番比率、JFTは区分(セクション)比率。
// 大問横断の語ユニーク化(usedWords)・⑧文章の文法の意図的除外・出題数の穴埋め等はここに集約。
import { examReadingFor, examListeningFor, passageGrammarSetsFor, passageGrammarMockSetsFor, readingItemsForSub, readingMockItemsForSub, listeningItemsForSub, listeningMockItemsForSub, LISTENING_SUBTYPES, JFT_EXPRESSION, type ReadingSubtype, type ListeningSubtype } from '../data';
import { sample, shuffleChoices, type ExampleHint, type SaveRef } from '../quiz/quiz';
import { blueprintCounts, daimonCounts, DAIMON_SEC, DOKKAI_BLUEPRINT, CHOUKAI_BLUEPRINT, type Daimon } from '../data/examBlueprint';
import { daimonUnitIds, questionForUnit, mockUnitIds, MOJI_DAIMON } from '../data/daimon';
import { readingToSet, type PassageSet } from '../quiz/passageSet';
import type { Level } from '../engine/engine';

export type Sec = 'moji_goi' | 'bunpou' | 'dokkai' | 'choukai';
export type Seen = Record<string, unknown>; // state.items(学習済の項目)

export interface MockItem {
  kind: 'word' | 'listening' | 'passageSet';
  id: string;
  section: Sec;
  question: string;
  choices: string[];
  answerIndex: number;
  prompt?: string;
  reading?: string;
  example?: ExampleHint;
  furi?: string;
  furiTarget?: string;
  noTargetRuby?: boolean;
  title?: string;
  body?: string;
  clipId?: string;
  script?: string;
  audioChoices?: boolean; // 概要/発話/即時=選択肢が音声で読まれる=番号のみ表示・シャッフル不可
  explain?: string;
  itemId?: string;
  idLabel?: string; // ヘッダーID表示専用(漢字読み/表記=「…（漢字/N4）」)。id(=採点/再出題キー)は変えない。
  daimon?: Daimon; // 大問(知識区分の内訳集計用)
  grpKey?: string; // 大問分野のi18nラベルキー(聴解の区分ラベル等・ヘッダ表示用)
  saveRef?: SaveRef; // my単語帳への保存対象(questionForUnit経由の語daimonのみ)
  set?: PassageSet; // kind==='passageSet'用: 読解1文章 or 文章の文法1文章＋複数設問を一括提示(PassageSetPlayer)
}

// 小区分キー→i18nラベルキー(聴解の区分ラベル・ヘッダ表示用)。
const LISTEN_SUB_LABEL: Record<string, string> = Object.fromEntries(LISTENING_SUBTYPES.map((x) => [x.key, x.labelKey]));

/** 未学習(初見)を優先して n 件抽出。足りなければ学習済で補充＝模試は「答えを知らない問題」を優先。 */
function pickFresh<T>(pool: T[], isSeen: (x: T) => boolean, n: number): T[] {
  const fresh = sample(pool.filter((x) => !isSeen(x)), n);
  if (fresh.length >= n) return fresh;
  return [...fresh, ...sample(pool.filter(isSeen), n - fresh.length)];
}

// JFTの知識区分を n 問。JFT本番に忠実に: 文字と語彙(moji_goi)=①〜⑤(検証済バンク)、会話と表現(bunpou)=JFT_EXPRESSION。
// JLPTの文法(組み立て/文章の文法)はJFTに無いので出さない。評価だけJFT基準(readinessForで別途)。
function jftKnowledgeItems(levels: Level[], category: 'moji_goi' | 'bunpou', n: number, seen: Seen, usedWords: Set<string>): MockItem[] {
  if (n <= 0) return [];
  if (category === 'bunpou') {
    // 会話と表現: 場面(situation)に適切な表現を4択で。
    const picked = pickFresh(JFT_EXPRESSION, (e) => !!seen[e.id], n);
    return picked.map((e) => {
      const { choices, answerIndex } = shuffleChoices([e.answer, ...e.choices.filter((x) => x !== e.answer)].slice(0, 4), 0);
      return { kind: 'word' as const, id: e.id, section: 'bunpou' as Sec, prompt: e.situation, question: '', choices, answerIndex, explain: e.explain };
    });
  }
  const daimons = MOJI_DAIMON; // 文字と語彙 = ①〜⑤(漢字読み/表記/文脈規定/言い換え/用法)
  const per = Math.floor(n / daimons.length);
  let rem = n - per * daimons.length;
  return daimons.flatMap((d) => knowledgeForDaimon(levels, d, per + (rem-- > 0 ? 1 : 0), seen, usedWords));
}

// 大問1つを count 問。学習と同一の固定問題集(daimonUnitIds→questionForUnit)から出題＝模試も検証済バンクに統一。
// 全大問(漢字読み/表記/文脈規定/言い換え/用法/文法形式/組み立て/文章の文法)が questionForUnit 経由で各固定バンクへ。
export function knowledgeForDaimon(levels: Level[], daimon: Daimon, count: number, seen: Seen, usedWords: Set<string>): MockItem[] {
  if (count <= 0) return [];
  const sec = DAIMON_SEC[daimon];
  // 模試専用プール(初見の別文)を持つ大問(漢字読み)は、そのプールから出題＝通常学習の文と重複しない。
  const mockUnits = levels.flatMap((lv) => mockUnitIds(lv, daimon));
  const useMock = mockUnits.length > 0;
  const units = useMock ? mockUnits : levels.flatMap((lv) => daimonUnitIds(lv, daimon, 'all'));
  // 未出題(seen)優先で並べ、大問横断で同じ語(vocabId/文法id)は1模試に1回だけ＝usedWords でスキップ。
  const fresh = sample(units.filter((u) => !seen[u]), units.length);
  const stale = sample(units.filter((u) => !!seen[u]), units.length);
  const out: MockItem[] = [];
  const spill: MockItem[] = []; // 大問横断で既使用の語ゆえ避けた候補(本番出題数に満たない時だけ穴埋めに使う)。
  for (const unit of [...fresh, ...stale]) {
    if (out.length >= count) break;
    const q = questionForUnit(unit, Math.random, useMock);
    if (!q) continue;
    // 大問横断の語キー: saveRef(type:id=語彙/漢字/文法の実体)があればそれ、無ければユニットidの語部分。
    const wkey = q.saveRef ? `${q.saveRef.type}:${q.saveRef.id}` : unit.split('#')[0];
    const item: MockItem = {
      kind: 'word', id: unit, section: sec, daimon,
      question: q.question, choices: q.choices, answerIndex: q.answerIndex,
      prompt: q.prompt || undefined, reading: q.reading, example: q.example, furi: q.furi, furiTarget: q.furiTarget, noTargetRuby: q.noTargetRuby, explain: q.explain, itemId: q.itemId, idLabel: q.idLabel, saveRef: q.saveRef,
    };
    if (usedWords.has(wkey)) { spill.push(item); continue; } // 別の大問で既に使った語=まず避ける(不足時のみ後で使う)
    usedWords.add(wkey);
    out.push(item);
  }
  // 重複回避を優先しても本番の出題数に届かない時だけ、避けた候補で穴埋め(数量>厳密なユニーク性)。
  // プールが薄い/kanji_read↔orthography等の共有saveRefで語が枯れても、大問の問題数が本番より減らないようにする。
  for (const item of spill) { if (out.length >= count) break; out.push(item); }
  return out;
}

// 読解=1文章(+全設問)をpassage-setステップに。PassageSetPlayerが本文＋全設問を一括提示→一括採点(設問単位でスコア加算)。
function readingSetItems(levels: Level[], nPassages: number, seen: Seen): MockItem[] {
  const picked = pickFresh(levels.flatMap((lv) => examReadingFor(lv)), (p) => p.questions.some((q) => !!seen[q.id]), nPassages);
  return picked.map((p) => {
    const set = readingToSet(p);
    return { kind: 'passageSet' as const, id: set.id, section: 'dokkai' as Sec, question: '', choices: [], answerIndex: -1, set };
  });
}
// 文章の文法(大問⑧)=セット形式(1文章＋複数設問)。本番同様フル/ミニ問わず1セットのみ(JFTには無い区分)。
function passageGrammarItems(levels: Level[], seen: Seen): MockItem[] {
  // 模試専用プール(初見)があればそこから、無ければ学習セットへフォールバック(他大問と同型の useMock 優先)。
  const all = levels.flatMap((lv) => { const m = passageGrammarMockSetsFor(lv); return m.length ? m : passageGrammarSetsFor(lv); });
  if (all.length === 0) return [];
  const picked = pickFresh(all, (st) => st.questions.some((q) => !!seen[q.id]), 1);
  return picked.map((set) => ({ kind: 'passageSet' as const, id: set.id, section: 'bunpou' as Sec, question: '', choices: [], answerIndex: -1, set }));
}
function listeningItems(levels: Level[], nClips: number, seen: Seen): MockItem[] {
  const picked = pickFresh(levels.flatMap((lv) => examListeningFor(lv)), (cl) => cl.questions.some((q) => !!seen[q.id]), nClips);
  return picked.flatMap((cl) =>
    cl.questions.map((q) => {
      const sc = shuffleChoices(q.choices, q.answerIndex);
      return {
        kind: 'listening' as const, id: q.id, section: 'choukai' as Sec,
        title: cl.title, clipId: cl.id, script: cl.script, question: q.q, choices: sc.choices, answerIndex: sc.answerIndex, explain: q.explain,
      };
    }),
  );
}
// JLPT読解=本番の小区分構成(DOKKAI_BLUEPRINT)どおりに組む。各小区分の目安“設問数”に達するまで本文を採る
//  (短文=1問/本、中文=数問/本、長文=数問/本、情報検索=1問/本)。プールは学習と共有し pickFresh で未出題優先。
function readingByBlueprint(levels: Level[], level: Level, full: boolean, seen: Seen): MockItem[] {
  const bp = DOKKAI_BLUEPRINT[level] ?? {};
  const out: MockItem[] = [];
  for (const sub of Object.keys(bp) as ReadingSubtype[]) {
    const targetQ = full ? bp[sub] : Math.max(1, Math.round(bp[sub] / 3));
    // 模試専用プール(初見)があればそこから、無ければ学習へフォールバック(passageGrammarItems と同型の useMock 優先)。
    const pool = levels.flatMap((lv) => { const m = readingMockItemsForSub(lv, sub); return m.length ? m : readingItemsForSub(lv, sub); });
    const picked = pickFresh(pool, (p) => p.questions.some((q) => !!seen[q.id]), pool.length);
    let q = 0;
    for (const p of picked) {
      if (q >= targetQ) break;
      out.push({ kind: 'passageSet', id: p.id, section: 'dokkai' as Sec, question: '', choices: [], answerIndex: -1, set: readingToSet(p) });
      q += p.questions.length;
    }
  }
  return out;
}
// JLPT聴解=本番の区分構成(CHOUKAI_BLUEPRINT)どおり。音声(mp3)を持つクリップのみ。区分ごとに目安数まで採る。
function listeningByBlueprint(levels: Level[], level: Level, full: boolean, seen: Seen): MockItem[] {
  const bp = CHOUKAI_BLUEPRINT[level] ?? {};
  const out: MockItem[] = [];
  for (const sub of Object.keys(bp) as ListeningSubtype[]) {
    const targetQ = full ? bp[sub] : Math.max(1, Math.round(bp[sub] / 3));
    // 模試専用プール(初見)を優先、無ければ学習へフォールバック(readingByBlueprint と同型)。音声(mp3)を持つクリップのみ。
    const pool = levels.flatMap((lv) => { const m = listeningMockItemsForSub(lv, sub); return m.length ? m : listeningItemsForSub(lv, sub); }).filter((cl) => !!cl.audio);
    const picked = pickFresh(pool, (cl) => cl.questions.some((q) => !!seen[q.id]), pool.length);
    let q = 0;
    for (const cl of picked) {
      if (q >= targetQ) break;
      for (const qq of cl.questions) {
        // 発話/即時(audioChoices)は選択肢が音声で順に流れる=正解位置が音声に焼込み済ゆえシャッフル不可(ListeningScreenと同じ)。
        const sc = cl.audioChoices ? { choices: qq.choices, answerIndex: qq.answerIndex } : shuffleChoices(qq.choices, qq.answerIndex);
        out.push({ kind: 'listening' as const, id: qq.id, section: 'choukai' as Sec, grpKey: LISTEN_SUB_LABEL[sub], title: cl.title, clipId: cl.id, script: cl.script, audioChoices: cl.audioChoices, question: qq.q, choices: sc.choices, answerIndex: sc.answerIndex, explain: qq.explain });
      }
      q += cl.questions.length;
    }
  }
  return out;
}

// JFT模試は4セクションを必ず含む＝本番構成。出題はJFT公式順 ①文字と語彙②会話と表現③聴解④読解 にグループ化(セクション不可逆の本番再現)。
const JFT_SEC_ORDER: Record<Sec, number> = { moji_goi: 0, bunpou: 1, choukai: 2, dokkai: 3 };
export function buildExam(levels: Level[], full: boolean, jft: boolean, seen: Seen): MockItem[] {
  const bp = blueprintCounts(levels[0], full, jft);
  // 大問横断で同じ語(語彙/漢字/文法)を2つ以上の大問に出さない＝この模試1回で共有する既使用語セット。
  // 各大問を順に組み立て、先に使った語は後の大問でスキップ(プール自体は大問間で重複可・別回で再利用可)。
  const usedWords = new Set<string>();
  // 知識区分: JLPT=大問別(漢字読み/表記/文脈規定/言い換え/用法/文法形式/組み立て/文章の文法)、JFT=区分2つ。
  // 【意図的な例外・永久ルール mock-cross-daimon-no-word-reuse の例外】
  //   大問横断の語ユニーク化(usedWords)には、単発問題の大問①〜⑦のみが参加する。
  //   passage_grammar(大問⑧「文章の文法」)は "文章まるごと" のセット形式で専用プールから丸ごと出題するため、
  //   語単位で弾くと文章が崩れる/出題数が足りなくなる。よって usedWords には参加させない(＝daimonCounts から
  //   passage_grammar を除外し、passageGrammarItems には usedWords を渡さない)。この例外により、同一模試内で
  //   ⑧と①〜⑦の間で文法語が重なりうるのは許容する。番人=src/mock/passageGrammarDedupException.test.ts が
  //   この除外マーカーを固定(将来うっかり参加/除外解除されたら失敗し、この判断を読み直させる)。
  const knowledge = jft
    ? [...jftKnowledgeItems(levels, 'moji_goi', bp.moji_goi, seen, usedWords), ...jftKnowledgeItems(levels, 'bunpou', bp.bunpou, seen, usedWords)]
    : daimonCounts(levels[0], full).filter((d) => d.daimon !== 'passage_grammar').flatMap((d) => knowledgeForDaimon(levels, d.daimon, d.count, seen, usedWords));
  const passageGrammar = jft ? [] : passageGrammarItems(levels, seen); // JFTにJLPTの文章の文法は無い。⑧はusedWords不参加(上記の意図的な例外)
  // JLPT=本番の小区分構成どおりに読解/聴解を組む(短文/中文/長文/情報検索・課題/ポイント/概要/発話/即時)。JFTは従来の予約枠。
  const reading = jft ? readingSetItems(levels, bp.dokkai, seen) : readingByBlueprint(levels, levels[0], full, seen);
  const listening = jft ? listeningItems(levels, bp.choukai, seen) : listeningByBlueprint(levels, levels[0], full, seen);
  if (jft) {
    // JFT=公式セクション順(①文字語彙②会話表現③聴解④読解)
    return [...knowledge, ...reading, ...listening].sort((a, b) => JFT_SEC_ORDER[a.section] - JFT_SEC_ORDER[b.section]);
  }
  // JLPT=本番ブロック順(①文字語彙・文法(⑧文章の文法含む) ②読解 ③聴解)
  return [...knowledge, ...passageGrammar, ...reading, ...listening];
}
