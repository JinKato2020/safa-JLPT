// ミニ模試(言語知識20問) / フル模試(全区分=漢字語彙＋文法＋読解＋聴解)。本番形式・客観採点(重み5)。
// 採点後: 区分別の弱点ヒートマップ → 語彙/文法の弱点だけ復習(Quiz)へ。掲示板§5(UWorld閉ループ)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Animated, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { useT } from '../i18n';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { isInMyList } from '../store/state';
import { guessCorrect, jftMockScore } from '../store/selectors';
import { dayStr } from '../store/state';
import { examReadingFor, examListeningFor, rubyNeeded, passageGrammarSetsFor, readingItemsForSub, listeningItemsForSub, READING_SUBTYPES, LISTENING_SUBTYPES, type ReadingSubtype, type ListeningSubtype } from '../data';
import RubyText from '../components/RubyText';
import AppButton from '../components/AppButton';
import PassageSetPlayer from '../components/PassageSetPlayer';
import AnswerFooter from '../components/AnswerFooter';
import { readingToSet, type PassageSet } from '../quiz/passageSet';
import { listeningSource } from '../data/listeningAudio';
import { mockTicketCount } from '../store/tickets';
import { sendMock } from '../telemetry/telemetry';
import { sample, shuffleChoices, type ExampleHint, type SaveRef } from '../quiz/quiz';
import { blueprintCounts, daimonCounts, DAIMON_SEC, DAIMON_LABEL, DOKKAI_BLUEPRINT, CHOUKAI_BLUEPRINT, type Daimon } from '../data/examBlueprint';
import { daimonUnitIds, questionForUnit, MOJI_DAIMON } from '../data/daimon';
import { JFT_EXPRESSION } from '../data';
import type { Level } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

const IMG_BREAK = require('../../assets/mock/mock_break.jpg');
const IMG_END = require('../../assets/mock/mock_end.jpg');
// 合否証明書は「レベル(N5/N4/N3)を画像に焼き込んだ」6枚から選ぶ。端末ごとのフォント差でレベル文字がズレないよう、
// 文字レイヤ重ねをやめ画像の一部にした(tools/bake_cert_levels.py で mock_cert_{pass,fail}.jpg の隙間へ焼き込み生成)。
const IMG_CERT: Record<'pass' | 'fail', Record<Level, number>> = {
  pass: {
    N5: require('../../assets/mock/mock_cert_pass_n5.jpg'),
    N4: require('../../assets/mock/mock_cert_pass_n4.jpg'),
    N3: require('../../assets/mock/mock_cert_pass_n3.jpg'),
  },
  fail: {
    N5: require('../../assets/mock/mock_cert_fail_n5.jpg'),
    N4: require('../../assets/mock/mock_cert_fail_n4.jpg'),
    N3: require('../../assets/mock/mock_cert_fail_n3.jpg'),
  },
};

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Sec = 'moji_goi' | 'bunpou' | 'dokkai' | 'choukai';
type Styles = ReturnType<typeof makeStyles>;

const SEC_ORDER: Sec[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const SEC_LABEL: Record<Sec, string> = { moji_goi: 'mock.sec_moji_goi', bunpou: 'mock.sec_bunpou', dokkai: 'mock.sec_dokkai', choukai: 'mock.sec_choukai' };
// JFTのセクション名(①文字と語彙②会話と表現③聴解④読解)。
const JFT_SEC_LABEL: Record<Sec, string> = { moji_goi: 'exam.jft_cat_moji', bunpou: 'exam.jft_cat_hyougen', dokkai: 'mock.sec_dokkai', choukai: 'mock.sec_choukai' };
// 1問あたりの持ち時間(秒)。JFT/ミニのタイマー算出に使用(JLPTフルは科目別ブロック時間=BLOCK_MINで計る)。
const SEC_SECONDS: Record<Sec, number> = { moji_goi: 40, bunpou: 40, dokkai: 110, choukai: 90 };

// 本番の「試験科目(時間の区切り)」= 模試の休憩ブロック。イントロの足切りカードと同じ束ね方・同じ制限時間で一致させる。
//  N5/N4=2ブロック(言語知識・読解 / 聴解) ・ N3=3ブロック(文字語彙 / 文法・読解 / 聴解)。合計= N5:90 N4:115 N3:140。
const MOCK_TIME_SECTIONS: Record<string, { label: string; secs: Sec[]; min: number }[]> = {
  N5: [{ label: '言語知識・読解', secs: ['moji_goi', 'bunpou', 'dokkai'], min: 60 }, { label: '聴解', secs: ['choukai'], min: 30 }],
  N4: [{ label: '言語知識・読解', secs: ['moji_goi', 'bunpou', 'dokkai'], min: 80 }, { label: '聴解', secs: ['choukai'], min: 35 }],
  N3: [{ label: '言語知識（文字・語彙）', secs: ['moji_goi'], min: 30 }, { label: '言語知識（文法）・読解', secs: ['bunpou', 'dokkai'], min: 70 }, { label: '聴解', secs: ['choukai'], min: 40 }],
};
// 小区分キー→i18nラベルキー(大問分野の見出し用)。
const READING_SUB_LABEL: Record<string, string> = Object.fromEntries(READING_SUBTYPES.map((x) => [x.key, x.labelKey]));
const LISTEN_SUB_LABEL: Record<string, string> = Object.fromEntries(LISTENING_SUBTYPES.map((x) => [x.key, x.labelKey]));
interface ExamBlock { label: string; from: number; to: number; ms: number }
function buildBlocks(exam: MockItem[], isJft: boolean, level: Level): ExamBlock[] {
  // JFT = 休憩なしの1ブロック(通しタイマー)。JLPTは試験科目に分割。
  if (isJft) {
    const ms = exam.reduce((a, it) => a + stepSeconds(it) * 1000, 0);
    return [{ label: 'JFT模試', from: 0, to: exam.length, ms }];
  }
  const specs = MOCK_TIME_SECTIONS[level] ?? MOCK_TIME_SECTIONS.N4;
  const blocks: ExamBlock[] = [];
  for (const sp of specs) {
    const from = exam.findIndex((it) => sp.secs.includes(it.section));
    if (from < 0) continue;
    let to = from;
    while (to < exam.length && sp.secs.includes(exam[to].section)) to++;
    blocks.push({ label: sp.label, from, to, ms: sp.min * 60_000 });
  }
  return blocks.length ? blocks : [{ label: '', from: 0, to: exam.length, ms: specs.reduce((a, x) => a + x.min, 0) * 60_000 }];
}

// 合格判定(近似)。本番は尺度得点だが、模試は正答率で近似: 総合(合格点/180)と各得点区分の足切り(基準点/満点)を両方満たせば合格。
//  得点区分の束ね方は本番どおり(N4/N5=言語知識・読解＋聴解の2区分 / N3=言語知識＋読解＋聴解の3区分)。
const PASS_RULE: Record<string, { overall: number; sections: { secs: Sec[]; min: number }[] }> = {
  N5: { overall: 80 / 180, sections: [{ secs: ['moji_goi', 'bunpou', 'dokkai'], min: 38 / 120 }, { secs: ['choukai'], min: 19 / 60 }] },
  N4: { overall: 90 / 180, sections: [{ secs: ['moji_goi', 'bunpou', 'dokkai'], min: 38 / 120 }, { secs: ['choukai'], min: 19 / 60 }] },
  N3: { overall: 95 / 180, sections: [{ secs: ['moji_goi', 'bunpou'], min: 19 / 60 }, { secs: ['dokkai'], min: 19 / 60 }, { secs: ['choukai'], min: 19 / 60 }] },
};
function passJlpt(answers: { section: Sec; correct: boolean }[], level: Level): boolean {
  const rule = PASS_RULE[level];
  if (!rule || answers.length === 0) return false;
  const overallOk = answers.filter((a) => a.correct).length / answers.length >= rule.overall;
  const secOk = rule.sections.every((g) => {
    const items = answers.filter((a) => g.secs.includes(a.section));
    if (items.length === 0) return true; // その区分が無ければスキップ
    return items.filter((a) => a.correct).length / items.length >= g.min;
  });
  return overallOk && secOk;
}

interface MockItem {
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
  explain?: string;
  itemId?: string;
  daimon?: Daimon; // 大問(知識区分の内訳集計用)
  grpKey?: string; // 大問分野のi18nラベルキー(聴解の区分ラベル等・ヘッダ表示用)
  saveRef?: SaveRef; // my単語帳への保存対象(questionForUnit経由の語daimonのみ)
  set?: PassageSet; // kind==='passageSet'用: 読解1文章 or 文章の文法1文章＋複数設問を一括提示(PassageSetPlayer)
}
interface Answer { id: string; section: Sec; correct: boolean; label: string; drillable: boolean; }

type Seen = Record<string, unknown>; // state.items(学習済の項目)

/** 未学習(初見)を優先して n 件抽出。足りなければ学習済で補充＝模試は「答えを知らない問題」を優先。 */
function pickFresh<T>(pool: T[], isSeen: (x: T) => boolean, n: number): T[] {
  const fresh = sample(pool.filter((x) => !isSeen(x)), n);
  if (fresh.length >= n) return fresh;
  return [...fresh, ...sample(pool.filter(isSeen), n - fresh.length)];
}
// JFTの知識区分を n 問。JFT本番に忠実に: 文字と語彙(moji_goi)=①〜⑤(検証済バンク)、会話と表現(bunpou)=JFT_EXPRESSION。
// JLPTの文法(組み立て/文章の文法)はJFTに無いので出さない。評価だけJFT基準(readinessForで別途)。
function jftKnowledgeItems(levels: Level[], category: 'moji_goi' | 'bunpou', n: number, seen: Seen): MockItem[] {
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
  return daimons.flatMap((d) => knowledgeForDaimon(levels, d, per + (rem-- > 0 ? 1 : 0), seen));
}

// 大問1つを count 問。学習と同一の固定問題集(daimonUnitIds→questionForUnit)から出題＝模試も検証済バンクに統一。
// 全大問(漢字読み/表記/文脈規定/言い換え/用法/文法形式/組み立て/文章の文法)が questionForUnit 経由で各固定バンクへ。
function knowledgeForDaimon(levels: Level[], daimon: Daimon, count: number, seen: Seen): MockItem[] {
  if (count <= 0) return [];
  const sec = DAIMON_SEC[daimon];
  const units = levels.flatMap((lv) => daimonUnitIds(lv, daimon, 'all'));
  const picked = pickFresh(units, (u) => !!seen[u], count);
  const out: MockItem[] = [];
  for (const unit of sample(picked, picked.length)) {
    const q = questionForUnit(unit);
    if (!q) continue;
    out.push({
      kind: 'word', id: unit, section: sec, daimon,
      question: q.question, choices: q.choices, answerIndex: q.answerIndex,
      prompt: q.prompt || undefined, reading: q.reading, example: q.example, furi: q.furi, furiTarget: q.furiTarget, noTargetRuby: q.noTargetRuby, explain: q.explain, itemId: q.itemId, saveRef: q.saveRef,
    });
  }
  return out.slice(0, count);
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
  const all = levels.flatMap((lv) => passageGrammarSetsFor(lv));
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
    const pool = levels.flatMap((lv) => readingItemsForSub(lv, sub));
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
    const pool = levels.flatMap((lv) => listeningItemsForSub(lv, sub)).filter((cl) => !!cl.audio);
    const picked = pickFresh(pool, (cl) => cl.questions.some((q) => !!seen[q.id]), pool.length);
    let q = 0;
    for (const cl of picked) {
      if (q >= targetQ) break;
      for (const qq of cl.questions) {
        const sc = shuffleChoices(qq.choices, qq.answerIndex);
        out.push({ kind: 'listening' as const, id: qq.id, section: 'choukai' as Sec, grpKey: LISTEN_SUB_LABEL[sub], title: cl.title, clipId: cl.id, script: cl.script, question: qq.q, choices: sc.choices, answerIndex: sc.answerIndex, explain: qq.explain });
      }
      q += cl.questions.length;
    }
  }
  return out;
}

// JFT模試は4セクションを必ず含む＝本番構成。出題はJFT公式順 ①文字と語彙②会話と表現③聴解④読解 にグループ化(セクション不可逆の本番再現)。
const JFT_SEC_ORDER: Record<Sec, number> = { moji_goi: 0, bunpou: 1, choukai: 2, dokkai: 3 };
// 比率駆動: フル=本番の出題数、ミニ=round(÷3)。JLPTは大問内訳まで本番比率、JFTは区分(セクション)比率。
function buildExam(levels: Level[], full: boolean, jft: boolean, seen: Seen): MockItem[] {
  const bp = blueprintCounts(levels[0], full, jft);
  // 知識区分: JLPT=大問別(漢字読み/表記/文脈規定/言い換え/用法/文法形式/組み立て/文章の文法)、JFT=区分2つ。
  // passage_grammar(大問⑧)はセット形式で別途扱う(BANKからは除外済=Task 5)。daimonCountsからは除いてknowledgeForDaimonに渡さない。
  const knowledge = jft
    ? [...jftKnowledgeItems(levels, 'moji_goi', bp.moji_goi, seen), ...jftKnowledgeItems(levels, 'bunpou', bp.bunpou, seen)]
    : daimonCounts(levels[0], full).filter((d) => d.daimon !== 'passage_grammar').flatMap((d) => knowledgeForDaimon(levels, d.daimon, d.count, seen));
  const passageGrammar = jft ? [] : passageGrammarItems(levels, seen); // JFTにJLPTの文章の文法は無い
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

function mmss(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function formatScript(s: string): string {
  return s.split('　').map((t) => t.trim()).filter(Boolean).join('\n');
}
// 1ステップの持ち時間。passage-setは内包する設問数ぶん(=1問=SEC_SECONDS[section])を合算(本番の1文章複数設問の持ち時間相当)。
function stepSeconds(it: MockItem): number {
  const base = SEC_SECONDS[it.section] ?? 60;
  return it.kind === 'passageSet' && it.set ? base * Math.max(1, it.set.questions.length) : base;
}
// 1ステップが内包する「設問」の一覧(タイムオーバー時の未回答判定用)。word/listening=自身1問、passageSet=セット内の全設問。
function stepQuestionIds(it: MockItem): { id: string; section: Sec; label: string }[] {
  if (it.kind === 'passageSet' && it.set) {
    const label = it.set.passages[0]?.title ?? '';
    return it.set.questions.map((q) => ({ id: q.id, section: it.section, label }));
  }
  return [{ id: it.id, section: it.section, label: it.prompt ?? it.title ?? '' }];
}

export default function MockScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Mock'>>();
  const full = route.params?.full ?? true; // ミニ模試は廃止。既定はフル(全区分)。
  const preview = route.params?.preview; // 開発者確認用: 'pass'/'fail' で終了→合否画面を直接表示
  const state = useAppState();
  const { mockAnswer, recordMockResult, addToMyList, spendMockTicket } = useAppActions();
  const c = useColors();
  const t = useT();
  const { width: winW, height: winH } = useWindowDimensions();
  const s = useMemo(() => makeStyles(c), [c]);
  // レベル適応ルビ: ユーザーのレベル以上(同レベル含む)の漢字群にだけ読みを振る。
  const rubyGate = (run: string) => rubyNeeded(run, state.settings.level);

  const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const level = (state.settings.level as Level) ?? 'N4';
  const [exam] = useState<MockItem[]>(() => buildExam(isJft ? ['N5', 'N4'] : [state.settings.level], full, isJft, state.items));
  // 本番の試験科目=時間の区切り(JLPTフルは3ブロック＋間に休憩 / JFT・ミニは1ブロック通し)。
  const blocks = useMemo(() => buildBlocks(exam, isJft, level), [exam, isJft, level]);
  const [blockIdx, setBlockIdx] = useState(0);
  const [blockStartedAt, setBlockStartedAt] = useState(() => Date.now());
  const curBlock = blocks[blockIdx] ?? blocks[0];
  const multiBlock = blocks.length > 1;
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  // フロー: break(各科目の前=模試休憩画面) → exam(出題) →(科目終わり)→ 次の科目の break … 最後の科目後 → end(模試終了) → calc(計算演出) → result(合否)
  const [phase, setPhase] = useState<'exam' | 'break' | 'end' | 'calc' | 'result'>(preview ? 'end' : 'break');
  const ticketSpentRef = useRef(false); // チケットは最初の科目スタートで1回だけ消費
  const calcProg = useRef(new Animated.Value(0)).current; // 結果計算バー(0→1で約5秒)
  const [calcPct, setCalcPct] = useState(0);
  const [showBubble, setShowBubble] = useState(false);   // 合否証明書の表示後、少し遅れて桜の吹き出しを出す
  const bubbleOp = useRef(new Animated.Value(0)).current; // 桜吹き出しのフェードイン
  const [playing, setPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0); // 現在の聴解問題の再生回数(JFTは2回まで)
  const [reveal2, setReveal2] = useState(false); // 解答後のスクリプト/解説
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordedRef = useRef(false);
  const [prevMock] = useState(() => {
    const h = (state.mockHistory ?? []).filter((m) => m.full === full);
    return h.length ? h[h.length - 1] : null;
  });

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => undefined);
    return () => { soundRef.current?.unloadAsync().catch(() => undefined); };
  }, []);

  // 結果到達時に採点を1回だけ記録(成長可視化用)。
  useEffect(() => {
    if (phase !== 'result' || recordedRef.current || answers.length === 0) return;
    recordedRef.current = true;
    const correctN = answers.filter((a) => a.correct).length;
    const now = Date.now();
    recordMockResult({ ts: now, day: dayStr(now), pct: Math.round((100 * correctN) / answers.length), correct: correctN, total: answers.length, full });
    // 匿名計測: 模試結果(区分別%・タイムオーバー・所要)を送信。
    const byc: Record<string, { c: number; t: number }> = {};
    for (const a of answers) { (byc[a.section] ||= { c: 0, t: 0 }).t++; if (a.correct) byc[a.section].c++; }
    const sections: Record<string, number | null> = {};
    for (const k of ['moji_goi', 'bunpou', 'dokkai', 'choukai']) sections[k] = byc[k] ? Math.round((100 * byc[k].c) / byc[k].t) : null;
    void sendMock({ level: state.settings.level, full, pct: Math.round((100 * correctN) / answers.length), sections, timedOut, elapsedSec: Math.round(((endedAt ?? now) - startedAt) / 1000) });
  }, [phase]);

  const cur = exam[idx];
  useEffect(() => { setPlayCount(0); }, [idx]); // 問題が変わったら再生回数リセット
  // 合否画面へ入ったら、証明書を見せてから約2秒後に桜の吹き出し(合否に合わせた一言)をふわっと出す。
  useEffect(() => {
    if (phase !== 'result') { setShowBubble(false); bubbleOp.setValue(0); return; }
    const id = setTimeout(() => {
      setShowBubble(true);
      Animated.timing(bubbleOp, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }, 2000);
    return () => clearTimeout(id);
  }, [phase, bubbleOp]);
  const byCat = useMemo(() => {
    const out: Record<string, { c: number; t: number }> = {};
    for (const a of answers) { (out[a.section] ||= { c: 0, t: 0 }).t++; if (a.correct) out[a.section].c++; }
    return out;
  }, [answers]);

  const stopSound = async () => {
    if (soundRef.current) { await soundRef.current.unloadAsync().catch(() => undefined); soundRef.current = null; }
    setPlaying(false);
  };
  const JFT_LISTEN_MAX = 2; // JFT本番=聴解は2回まで再生
  const play = async () => {
    if (!cur || !cur.clipId) return;
    if (isJft && cur.kind === 'listening' && playCount >= JFT_LISTEN_MAX) return; // 2回制限
    const src = await listeningSource(cur.clipId);
    if (!src) return;
    await stopSound();
    try {
      const rate = state.settings.listeningRate ?? 1;
      // shouldCorrectPitch=速度を変えても声の高さを保つ / High=iOSのSpectralアルゴリズム(声を最も自然に引き伸ばす。0.5倍でも人声の質感を維持)
      const { sound } = await Audio.Sound.createAsync(src, { shouldPlay: true, rate, shouldCorrectPitch: true, pitchCorrectionQuality: Audio.PitchCorrectionQuality.High });
      soundRef.current = sound;
      setPlaying(true);
      setPlayCount((n) => n + 1);
      sound.setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => { if (st.isLoaded && st.didJustFinish) setPlaying(false); });
    } catch { setPlaying(false); }
  };

  // 制限時間: 本番の試験科目ごと(=ブロック)に計る。JLPTフル=科目別(BLOCK_MIN)・間に休憩 / JFT・ミニ=1ブロック通し。
  //  ブロックの時間が切れたら、そのブロックの未回答を不正解にして次の科目(休憩)へ。最後の科目なら結果へ。
  const [remainingMs, setRemainingMs] = useState(() => blocks[0]?.ms ?? 0);
  const [timedOut, setTimedOut] = useState(false);
  // 現ブロック(科目)を終える(時間切れ or 最終問題の回答後)。最後の科目なら模試終了へ、そうでなければ次の科目を進めて休憩へ。
  const sectionDone = () => {
    void stopSound();
    if (blockIdx + 1 >= blocks.length) { setEndedAt(Date.now()); setPhase('end'); }
    else { setBlockIdx((b) => b + 1); setPhase('break'); }
  };
  useEffect(() => {
    if (phase !== 'exam' || !curBlock) return;
    const deadline = blockStartedAt + curBlock.ms;
    const tick = () => {
      const r = deadline - Date.now();
      if (r > 0) { setRemainingMs(r); return; }
      setRemainingMs(0);
      setTimedOut(true);
      void stopSound();
      setAnswers((prev) => {
        const done = new Set(prev.map((a) => a.id));
        // このブロック(科目)の未回答だけを不正解に(まだ到達していない後続科目は対象外)。passage-setは設問ごとに判定。
        const miss = exam.slice(curBlock.from, curBlock.to).flatMap((it) =>
          stepQuestionIds(it)
            .filter((q) => !done.has(q.id))
            .map((q) => ({ id: q.id, section: q.section, correct: false, label: q.label, drillable: it.kind === 'word' })),
        );
        return [...prev, ...miss];
      });
      sectionDone(); // ★制限時間に達したら休憩画面へ強制移動(最後の科目なら模試終了へ)
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [phase, blockIdx, blockStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // これから始める科目(=現ブロック)を開始する。最初の科目スタートでチケットを1回だけ消費。
  //  開発用の無制限モード(devUnlimitedMock)はチケット不要・消費なし。通常はチケット0なら開始不可。
  const unlimitedMock = state.settings.devUnlimitedMock === true;
  const startSection = async () => {
    if (!ticketSpentRef.current && !unlimitedMock && mockTicketCount(state) <= 0) {
      Alert.alert(t('mock.no_ticket_title'), t('mock.no_ticket_body'));
      return;
    }
    await stopSound();
    if (!ticketSpentRef.current) { ticketSpentRef.current = true; if (!unlimitedMock) spendMockTicket(); }
    setIdx(curBlock.from);
    setPicked(null);
    setReveal2(false);
    setRemainingMs(curBlock.ms);
    setBlockStartedAt(Date.now());
    setPhase('exam');
  };
  // 「結果を計算する」→ 約5秒でバーを0→100%に(実際の計算は一瞬だが、ドキドキ感の演出)→ 合否画面へ。
  const startCalc = () => {
    setPhase('calc');
    setCalcPct(0);
    calcProg.setValue(0);
    const lid = calcProg.addListener(({ value }) => setCalcPct(Math.round(value * 100)));
    Animated.timing(calcProg, { toValue: 1, duration: 5000, useNativeDriver: false }).start(() => {
      calcProg.removeListener(lid);
      setCalcPct(100);
      setPhase('result');
    });
  };

  // 休憩画面(各科目の前・科目と科目の間)。休憩画像＋分野/制限時間＋「(分野)をスタート」。開始まで待てる。
  if (phase === 'break') {
    const bLabel = curBlock?.label ?? '';
    const bMin = Math.round((curBlock?.ms ?? 0) / 60_000);
    const bN = (curBlock?.to ?? 0) - (curBlock?.from ?? 0);
    // 1回目(blockIdx 0)=休憩不要=開始の一言のみ。2回目以降=前の科目終わり→桜が ①ねぎらい ②休憩 ③準備できたら開始。
    const isFirst = blockIdx === 0;
    return (
      <View style={s.fullImgWrap}>
        <Image source={IMG_BREAK} style={{ width: winW, height: winH }} resizeMode="cover" />
        <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFill}>
          <View style={s.breakOverlay}>
            <View style={s.breakTop}>
              <Pressable onPress={async () => { await stopSound(); nav.goBack(); }} hitSlop={12} style={s.breakBack}>
                <Text style={s.breakBackT}>← {t('mock.break_back')}</Text>
              </Pressable>
            </View>
            {/* 桜の吹き出し(前の科目後=ねぎらい→休憩→準備 / 1回目=開始の一言のみ)。 */}
            <View style={s.restBubble}>
              {isFirst ? (
                <Text style={s.restLine}>{t('mock.start_first')}</Text>
              ) : (
                <>
                  <Text style={s.restLine}>{t('mock.rest_greet')}</Text>
                  <Text style={s.restLine}>{t('mock.rest_relax')}</Text>
                  <Text style={s.restLine}>{t('mock.rest_ready')}</Text>
                </>
              )}
            </View>
            <View style={s.breakPanel}>
              <Text style={s.breakNextLbl}>{multiBlock ? `${blockIdx + 1} / ${blocks.length}　${t('mock.break_next')}` : t('mock.break_next')}</Text>
              <Text style={s.breakNext}>{bLabel}</Text>
              <Text style={s.breakMeta}>{t('mock.break_meta', { n: bN, m: bMin })}</Text>
              <Text style={s.breakWarn}>{t('mock.break_warn')}</Text>
              <Pressable style={s.breakBtn} onPress={startSection}><Text style={s.breakBtnT}>{t('mock.break_start_named', { s: bLabel })}</Text></Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // 模試終了画面(最後の科目のあと)。桜のねぎらい(上部=空)＋「結果を計算する」(下部)。桜の絵(下部中央)にかぶらない。
  if (phase === 'end') {
    return (
      <View style={s.fullImgWrap}>
        <Image source={IMG_END} style={{ width: winW, height: winH }} resizeMode="cover" />
        <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFill}>
          {/* 桜のねぎらいは画面の中ほど(空〜社の辺り)に。桜の絵(下部)にはかぶらない。 */}
          <View style={s.endMid}>
            <View style={s.endBubble}>
              {t('mock.end_sakura').split('\n').map((ln, i) => (<Text key={i} style={s.endBubbleT}>{ln}</Text>))}
            </View>
          </View>
          <View style={s.endBtnBar}>
            <Pressable style={s.breakBtn} onPress={startCalc}><Text style={s.breakBtnT}>{t('mock.end_calc')}</Text></Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // 結果計算の演出(約5秒でバー100%)。背景は模試終了画面のまま。
  if (phase === 'calc') {
    return (
      <View style={s.fullImgWrap}>
        <Image source={IMG_END} style={{ width: winW, height: winH }} resizeMode="cover" />
        <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFill}>
          <View style={s.calcOverlay}>
            <View style={s.calcPanel}>
              <Text style={s.calcH}>{t('mock.calc_title')}</Text>
              <View style={s.calcTrack}>
                <Animated.View style={[s.calcFill, { width: calcProg.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
              </View>
              <Text style={s.calcPct}>{calcPct}%</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'result' || !cur) {
    const correct = answers.filter((a) => a.correct).length;
    const pct = Math.round((100 * correct) / (answers.length || 1));
    const pctTrue = Math.round(100 * guessCorrect(pct / 100)); // 当て推量補正後の実力(4択偶然25%を除去)
    const jftSc = isJft ? jftMockScore(answers.map((a) => ({ id: a.id, section: a.section, correct: a.correct }))) : null;
    const wrongDrill = answers.filter((a) => !a.correct && a.drillable);
    const elapsed = (endedAt ?? Date.now()) - startedAt;
    // 合否: 開発者プレビューは指定どおり / 本番はJFT=jftScore・JLPT=passJlpt(総合＋各区分の足切り)。
    const passed = preview ? preview === 'pass' : (isJft ? !!jftSc?.pass : passJlpt(answers, level));
    // 証明書サイズは画面の縦横の両方で必ず収める(はみ出し防止)。証明書=縦長(0.738=738/1000)。
    //  高さは画面の34%以内、かつ横幅からも制限(縦横どちらでもはみ出さない)。空の辺り(上部)へ置く。
    const certH = Math.round(Math.min(winH * 0.34, (winW - spacing.lg * 4) / 0.738)); // 程よい大きさ
    const certW = Math.round(certH * 0.738);                   // 証明書画像の実アスペクト(余白統一後 738/1000)
    const certTop = Math.round(winH * 0.02);                   // 上部バーのすぐ下(空の辺り)
    const certSrc = IMG_CERT[passed ? 'pass' : 'fail'][level];  // レベルは画像に焼き込み済(端末フォント差でズレない)
    return (
      <View style={s.fullImgWrap}>
        <ScrollView showsVerticalScrollIndicator={!preview}>
          {/* 第1レイヤ: 模試終了(空〜桜)の全画面。画面遷移はさせず、この上に合否証明書を「空の辺り」へ別レイヤで重ねる。 */}
          <View style={{ width: winW, height: winH }}>
            {/* 背景の空。※absoluteFillだけだと新アーキで画像の実寸(intrinsic)に化ける端末があるため、必ず明示のwidth/heightで固定する。 */}
            <Image source={IMG_END} style={{ position: 'absolute', left: 0, top: 0, width: winW, height: winH }} resizeMode="cover" />
            <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFill}>
              <View style={s.topOnImg}>
                <Pressable onPress={async () => { await stopSound(); nav.goBack(); }} hitSlop={12}>
                  <Text style={s.closeOnImg}>✕</Text>
                </Pressable>
              </View>
              {/* 証明書は上部(空の辺り)へ。縦横とも画面内に必ず収まる確定サイズ。レベル(N5/N4/N3)は画像に焼き込み済。 */}
              <View style={{ alignItems: 'center', marginTop: certTop }}>
                {/* ⚠️巨大化の真因対策: Imageは必ず明示の width/height(=certW×certH)で固定する(absoluteFill+containだと端末により実寸738×1000に化ける)。 */}
                <Image source={certSrc} style={{ width: certW, height: certH }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }} />
              {preview ? (
                <View style={s.previewFooter}>
                  <Text style={s.previewNote}>{t('mock.preview_note')}</Text>
                  <Pressable style={s.imgCloseBtn} onPress={() => nav.goBack()}><Text style={s.imgCloseT}>{t('mock.close')}</Text></Pressable>
                </View>
              ) : (
                <View style={s.scrollHint}><Text style={s.scrollHintT}>{t('mock.see_details')}</Text></View>
              )}
            </SafeAreaView>
            {/* 桜の吹き出し(証明書表示の少し後にふわっと出る)。合否に合わせた一言。桜の頭上・下向きの尻尾で「桜が話す」感じに。 */}
            {showBubble && (
              <Animated.View pointerEvents="none" style={[s.sakuraSpeech, { top: Math.round(winH * 0.5), opacity: bubbleOp }]}>
                <View style={s.sakuraBubble}>
                  <Text style={s.sakuraBubbleT}>{t(passed ? 'mock.sakura_pass' : 'mock.sakura_fail')}</Text>
                </View>
                <View style={s.sakuraTail} />
              </Animated.View>
            )}
          </View>

          {!preview && (
          <View style={s.statsSheet}>
          <View style={s.resultHero}>
            {isJft && jftSc ? (
              <>
                <Text style={s.resultPct}>{jftSc.total}<Text style={s.resultMax}> / 250</Text></Text>
                <Text style={[s.resultTrue, jftSc.pass && { color: c.green }]}>{t(jftSc.bandKey)}{jftSc.pass ? '' : ` ・ ${t('mock.jft_pass_at')}`}</Text>
              </>
            ) : (
              <>
                <Text style={s.resultPct}>{pct}%</Text>
                <Text style={s.resultTrue}>{t('mock.result_true', { n: pctTrue })}</Text>
              </>
            )}
            <Text style={s.resultFrac}>{t('mock.result_frac', { n: correct, m: answers.length, t: mmss(elapsed) })}</Text>
            <Text style={s.resultCap}>{t('mock.full_exam')}</Text>
            {timedOut ? <Text style={s.timeup}>{t('mock.timeup')}</Text> : null}
            {prevMock ? (
              <Text style={[s.resultDelta, { color: pct - prevMock.pct > 0 ? c.green : pct - prevMock.pct < 0 ? c.red : c.mute }]}>
                {t('mock.result_delta_base', { n: prevMock.pct, m: pct })}
                {pct - prevMock.pct > 0
                  ? t('mock.result_delta_up', { n: pct - prevMock.pct })
                  : pct - prevMock.pct < 0
                    ? t('mock.result_delta_down', { n: prevMock.pct - pct })
                    : t('mock.result_delta_same')}
              </Text>
            ) : null}
          </View>

          <Text style={s.sectionH}>{t('mock.section_weakness')}</Text>
          <View style={s.heatCard}>
            {SEC_ORDER.filter((k) => byCat[k]).map((k) => (
              <Bar key={k} label={SEC_LABEL[k]} correct={byCat[k].c} total={byCat[k].t} tc={c} s={s} />
            ))}
          </View>

          {wrongDrill.length > 0 ? (
            <Pressable
              style={s.cta}
              onPress={() => nav.replace('Quiz', { itemIds: wrongDrill.map((w) => w.id), title: '弱点ドリル' })}
            >
              <Text style={s.ctaTxt}>{t('mock.drill_cta', { n: wrongDrill.length })}</Text>
            </Pressable>
          ) : (
            <Text style={s.allOk}>{t('mock.all_ok')}</Text>
          )}
          <Pressable style={s.ghost} onPress={() => nav.goBack()}>
            <Text style={s.ghostTxt}>{t('mock.close')}</Text>
          </Pressable>
          </View>
          )}
        </ScrollView>
      </View>
    );
  }

  const onPick = (choiceIdx: number) => {
    if (picked !== null) return;
    const isCorrect = choiceIdx === cur.answerIndex;
    setPicked(choiceIdx);
    if (cur.kind !== 'word') setReveal2(true);
    mockAnswer(cur.id, isCorrect);
    setAnswers((a) => [
      ...a,
      { id: cur.id, section: cur.section, correct: isCorrect, label: cur.prompt ?? cur.title ?? '', drillable: cur.kind === 'word' },
    ]);
  };
  const next = async () => {
    await stopSound();
    setPicked(null);
    setReveal2(false);
    // ブロック(科目)内はまだ次の問題へ。科目の最後まで解いたら休憩(または結果)へ。
    if (idx + 1 < curBlock.to) setIdx((i) => i + 1);
    else sectionDone();
  };
  // passage-setステップ(読解/文章の文法)が全問回答された時にPassageSetPlayerから1回だけ呼ばれる。設問ごとにmock集計へ加算(採点は
  // PassageSetPlayer内のquizAnswerが既に記録済み=ここではMockScreenローカルの正誤集計(結果画面/区分ヒートマップ/JFT得点)のみ行う)。
  const accumulateScore = (results: { id: string; correct: boolean }[]) => {
    const section = cur.section;
    const label = cur.set?.passages[0]?.title ?? '';
    setAnswers((a) => [...a, ...results.map((r) => ({ id: r.id, section, correct: r.correct, label, drillable: false }))]);
  };

  const reveal = picked !== null;

  // 大問分野(ヘッダ表示)と、その大問内での現在位置。知識=大問ラベル/読解=小区分/文章の文法/聴解=区分。
  const sigOf = (it: MockItem): string =>
    it.kind === 'listening' ? 'L:' + (it.grpKey ?? '')
      : it.daimon ? 'K:' + it.daimon
        : it.kind === 'passageSet' ? (it.section === 'bunpou' ? 'PG' : 'R:' + (it.set?.subtype ?? ''))
          : 'S:' + it.section;
  const grpKeyOf = (it: MockItem): string | undefined =>
    it.kind === 'listening' ? it.grpKey
      : it.daimon ? DAIMON_LABEL[it.daimon]
        : it.kind === 'passageSet' ? (it.section === 'bunpou' ? DAIMON_LABEL.passage_grammar : READING_SUB_LABEL[it.set?.subtype ?? ''])
          : (isJft ? JFT_SEC_LABEL : SEC_LABEL)[it.section];
  const curSig = sigOf(cur);
  let gStart = idx; while (gStart > curBlock.from && sigOf(exam[gStart - 1]) === curSig) gStart--;
  let gEnd = idx; while (gEnd + 1 < curBlock.to && sigOf(exam[gEnd + 1]) === curSig) gEnd++;
  const grpLabelKey = grpKeyOf(cur);
  const grpLabel = grpLabelKey ? t(grpLabelKey) : (multiBlock ? curBlock.label : '');

  return (
    <SafeAreaView style={s.c}>
      <View style={s.topWrap}>
        <View style={s.topRow}>
          <Pressable onPress={async () => { await stopSound(); nav.goBack(); }} hitSlop={12}>
            <Text style={s.close}>✕</Text>
          </Pressable>
          {multiBlock ? <Text style={s.blockTag}>{curBlock.label}</Text> : <View />}
          <View style={{ width: 20 }} />
        </View>
        {/* ★制限時間を最上部に大きく目立たせる */}
        <View style={[s.timerBox, remainingMs <= 60000 ? s.timerBoxLow : null]}>
          <Text style={s.timerBoxLbl}>{t('mock.time_left')}</Text>
          <Text style={[s.timerBig, remainingMs <= 60000 ? s.timerLow : null]}>{mmss(remainingMs)}</Text>
        </View>
        {/* 大問分野（大問内の 現在/総数）＋ 問題IDを小さく */}
        <View style={s.daimonRow}>
          <Text style={s.secTag} numberOfLines={1}>{grpLabel}　{idx - gStart + 1} / {gEnd - gStart + 1}</Text>
          <Text style={s.qidText}>ID: {cur.id}</Text>
        </View>
      </View>

      {cur.kind === 'passageSet' && cur.set ? (
        // 読解/文章の文法=1文章＋全設問を一括提示。採点は設問単位(PassageSetPlayerのonGraded)。「次へ」もPassageSetPlayer側で統一。
        <PassageSetPlayer key={cur.set.id} set={cur.set} isLast={idx + 1 >= curBlock.to && blockIdx + 1 >= blocks.length} onNext={next} onGraded={accumulateScore} />
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          {cur.kind === 'word' ? (
            <View style={s.promptCard}>
              {cur.furi ? (
                // ふりがな付き問題文=レベル適応ルビ(同レベル以上の漢字のみ)。①漢字読みは対象語のルビを抑止。
                <RubyText text={cur.furi} target={cur.furiTarget} style={s.mockSentence} hitStyle={s.exHit} rubyStyle={s.mockRuby} rubyGate={rubyGate} noRubyOnHit={cur.noTargetRuby} center />
              ) : (
                <>
                  {cur.prompt ? <Text style={s.prompt}>{cur.prompt}</Text> : null}
                  {cur.example ? (
                    <Text style={s.readingHint}>
                      {cur.example.map((sg, i) => (
                        <Text key={i} style={sg.hit ? s.exHit : undefined}>{sg.text}</Text>
                      ))}
                    </Text>
                  ) : cur.reading ? (
                    <Text style={s.readingHint}>{cur.reading}</Text>
                  ) : null}
                </>
              )}
              <Text style={s.qtext}>{cur.question}</Text>
            </View>
          ) : (
            <View style={s.passageCard}>
              <Text style={s.passTitle}>{cur.title}</Text>
              {(() => {
                const used = isJft && playCount >= JFT_LISTEN_MAX;
                return (
                  <Pressable style={[s.playBtn, playing && s.playBtnOn, used && !playing && s.playBtnUsed]} onPress={play} disabled={used && !playing}>
                    <Text style={[s.playTxt, playing && s.playTxtOn]}>
                      {playing ? t('mock.playing') : isJft ? (used ? t('mock.play_used') : t('mock.play_jft', { n: JFT_LISTEN_MAX - playCount })) : t('mock.play_audio')}
                    </Text>
                  </Pressable>
                );
              })()}
              {reveal2 ? <Text style={s.passBody}>{formatScript(cur.script ?? '')}</Text> : null}
            </View>
          )}

          {cur.kind !== 'word' ? <RubyText text={cur.question ?? ''} style={s.qtextBig} rubyStyle={s.mockRuby} rubyGate={rubyGate} /> : null}

          <View style={s.choices}>
            {cur.choices.map((ch, i) => {
              const isAnswer = i === cur.answerIndex;
              const isPicked = i === picked;
              return (
                <Pressable
                  key={i}
                  style={[s.choice, reveal && isAnswer && s.choiceCorrect, reveal && isPicked && !isAnswer && s.choiceWrong]}
                  onPress={() => onPick(i)}
                  disabled={reveal}
                >
                  <View style={s.choiceTxtWrap}><RubyText text={ch} style={s.choiceTxt} rubyStyle={s.mockRuby} rubyGate={rubyGate} /></View>
                  {reveal && isAnswer ? <Text style={s.mark}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>

          {/* 全ドリル共通の回答フッター(正誤＋次へ)。毎問の私の単語帳登録は廃止(模試は結果重視)。 */}
          {reveal ? (
            <AnswerFooter correct={picked === cur.answerIndex} onNext={next} nextKind={idx + 1 >= curBlock.to && blockIdx + 1 >= blocks.length ? 'result' : 'next'} />
          ) : (
            <Text style={s.hint}>{t('mock.hint')}</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Bar({ label, correct, total, tc, s }: { label: string; correct: number; total: number; tc: ThemeColors; s: Styles }) {
  const t = useT();
  const pct = total ? Math.round((100 * correct) / total) : 0;
  const color = pct >= 80 ? tc.green : pct >= 50 ? tc.amber : tc.red;
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{t(label)}</Text>
      <View style={s.barTrack}><View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
      <Text style={[s.barPct, { color }]}>{pct}%</Text>
      <Text style={s.barFrac}>{correct}/{total}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.md },
    // 出題中(exam)画面の上部バー(閉じる/タイマー/進捗+区分タグ)。passage-setはPassageSetPlayer(自前ScrollView)を
    // ネストさせない為、ScrollViewの外に出して常設表示する(word/listening/passageSet共通)。
    topWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    close: { fontSize: ty.h2, color: c.mute },
    progress: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
    timer: { fontSize: ty.small, color: c.ink2, fontWeight: '800' },
    timerLow: { color: c.red },
    timeup: { fontSize: ty.small, color: c.red, fontWeight: '800', marginTop: spacing.xs },
    secTag: { fontSize: ty.tiny, fontWeight: '800', color: c.blue, letterSpacing: 1, flexShrink: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    blockTag: { fontSize: ty.tiny, color: c.mute, fontWeight: '800', flex: 1, textAlign: 'center' },
    timerBox: { alignSelf: 'center', alignItems: 'center', backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.xl, marginTop: spacing.xs },
    timerBoxLow: { backgroundColor: c.ngBg, borderColor: c.red },
    timerBoxLbl: { fontSize: ty.tiny, color: c.mute, fontWeight: '800', letterSpacing: 1 },
    timerBig: { fontSize: 30, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'], lineHeight: 34 },
    daimonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.sm },
    qidText: { fontSize: ty.tiny, color: c.faint, fontWeight: '700' },
    // 休憩/開始画面・模試終了画面(全画面イラスト＋半透明パネル)
    fullImgWrap: { flex: 1, backgroundColor: '#000' },
    breakOverlay: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
    breakTop: { flexDirection: 'row' },
    breakBack: { backgroundColor: 'rgba(20,16,10,0.55)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
    breakBackT: { color: '#fff', fontSize: ty.small, fontWeight: '800' },
    // 桜の吹き出し(休憩画面の中ほど=桜の上あたり)。ねぎらい/休憩/準備の台詞。
    restBubble: { alignSelf: 'center', maxWidth: 460, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: 6, alignItems: 'center' },
    restLine: { fontSize: ty.body, color: '#3a2e1f', fontWeight: '800', textAlign: 'center', lineHeight: 24 },
    breakPanel: { backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: 4 },
    breakNextLbl: { fontSize: ty.tiny, color: '#6b5b45', fontWeight: '800', letterSpacing: 1 },
    breakNext: { fontSize: ty.h2, color: '#241a10', fontWeight: '900', textAlign: 'center' },
    breakMeta: { fontSize: ty.small, color: '#3a2f20', fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
    breakWarn: { fontSize: ty.small, color: '#b4531f', fontWeight: '800', textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
    breakBtn: { width: '100%', backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
    breakBtnT: { color: '#fff', fontSize: ty.body, fontWeight: '900', letterSpacing: 1 },
    // 模試終了(桜のねぎらい吹き出しは中ほどへ / 計算ボタンは下部)
    endMid: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
    endBtnBar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    endBubble: { backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: 3, alignSelf: 'center', maxWidth: 360 },
    endBubbleT: { fontSize: ty.body, color: '#241a10', fontWeight: '700', lineHeight: 25, textAlign: 'center' },
    // 結果計算バー(模試終了画面の上に半透明パネル)
    calcOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    calcPanel: { width: '90%', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.md },
    calcH: { fontSize: ty.h2, fontWeight: '900', color: '#241a10' },
    calcTrack: { width: '100%', height: 9, borderRadius: 999, backgroundColor: '#e9e1d3', overflow: 'hidden' },
    calcFill: { height: '100%', backgroundColor: c.blue, borderRadius: 999 },
    calcPct: { fontSize: ty.h1, fontWeight: '900', color: c.blue, fontVariant: ['tabular-nums'] },
    // 合否証明書(結果画面上部・模試終了画面を背景に空の辺りへ重ねる)
    certHero: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#cfe3f5', alignItems: 'center', justifyContent: 'flex-start', marginBottom: spacing.md },
    // 証明書に重ねるレベル文字(元N3の位置・濃紺のセリフ体で証明書に馴染ませる)
    // レベル文字。数字が下がらない字形(ライニング数字)のセリフ体にする=NとN以外の数字が同じ高さ・同じベースラインで揃う(Georgiaは旧字体数字でズレる)。
    previewNote: { fontSize: ty.small, color: '#fff', fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    // 結果画面(模試終了の全画面＋証明書オーバーレイ)。上部バー・スクロール誘導は空の上に載るので白＋影で視認性確保。
    topOnImg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    closeOnImg: { fontSize: ty.h2, color: '#fff', fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    progressOnImg: { fontSize: ty.small, color: '#fff', fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    previewFooter: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center', gap: spacing.sm },
    imgCloseBtn: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
    imgCloseT: { color: '#241a10', fontSize: ty.body, fontWeight: '900', letterSpacing: 1 },
    scrollHint: { paddingBottom: spacing.md, alignItems: 'center' },
    scrollHintT: { fontSize: ty.small, color: '#fff', fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    statsSheet: { backgroundColor: c.bg, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
    // 桜の吹き出し(合否コメント)。桜の頭上に浮かせ、下向きの尻尾で発話者=桜を示す。
    sakuraSpeech: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
    sakuraBubble: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, maxWidth: 340, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
    sakuraBubbleT: { fontSize: ty.body, color: '#241a10', fontWeight: '700', lineHeight: 23, textAlign: 'center' },
    sakuraTail: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(255,255,255,0.96)', marginTop: -1 },
    promptCard: {
      backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
      paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.xs, minHeight: 130, justifyContent: 'center',
    },
    prompt: { fontSize: 30, fontWeight: '800', color: c.ink, textAlign: 'center' },
    readingHint: { fontSize: ty.small, color: c.mute },
    mockSentence: { fontSize: ty.h2, lineHeight: 32, color: c.ink },
    mockRuby: { fontSize: 10, lineHeight: 12, color: c.mute, textAlign: 'center' },
    exHit: { color: c.ink, textDecorationLine: 'underline' },
    qtext: { fontSize: ty.small, color: c.faint, marginTop: spacing.sm },
    passageCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.lg, gap: spacing.sm },
    passTitle: { fontSize: ty.tiny, fontWeight: '800', color: c.mute, letterSpacing: 1 },
    passBody: { fontSize: ty.body, color: c.ink2 },
    passBodyWrap: { marginTop: spacing.xs, gap: 4 },
    passBlank: { height: 8 },
    choiceTxtWrap: { flex: 1 },
    qtextBig: { fontSize: ty.h2, fontWeight: '700', color: c.ink },
    playBtn: { backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.choukai, paddingVertical: spacing.md, alignItems: 'center' },
    playBtnUsed: { opacity: 0.45, borderColor: c.line },
    playBtnOn: { backgroundColor: c.okBg, borderColor: c.green },
    playTxt: { fontSize: ty.body, fontWeight: '800', color: c.choukai },
    playTxtOn: { color: c.green },
    choices: { gap: spacing.sm },
    choice: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
      paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    },
    choiceCorrect: { borderColor: c.green, backgroundColor: c.okBg },
    choiceWrong: { borderColor: c.red, backgroundColor: c.ngBg },
    choiceTxt: { fontSize: ty.body, color: c.ink2, flex: 1 },
    mark: { color: c.green, fontWeight: '800', fontSize: ty.h2 },
    myListBtn: { alignSelf: 'center', marginTop: spacing.xs },
    cta: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
    ctaTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
    hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
    // result
    resultHero: { backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.xl, alignItems: 'center' },
    resultPct: { fontSize: 64, fontWeight: '800', color: c.ink, lineHeight: 70 },
    resultTrue: { fontSize: ty.body, fontWeight: '800', color: c.blue, marginTop: 2 },
    resultMax: { fontSize: ty.h2, fontWeight: '800', color: c.faint },
    resultFrac: { fontSize: ty.body, color: c.mute, marginTop: spacing.xs },
    resultCap: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.xs, letterSpacing: 1 },
    resultDelta: { fontSize: ty.small, color: c.mute, fontWeight: '700', marginTop: spacing.sm },
    sectionH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.sm },
    heatCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    barLabel: { fontSize: ty.small, color: c.ink2, width: 76 },
    barTrack: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: c.bgSoft, overflow: 'hidden' },
    barFill: { height: 10, borderRadius: radius.pill },
    barPct: { fontSize: ty.small, fontWeight: '800', width: 38, textAlign: 'right' },
    barFrac: { fontSize: ty.tiny, color: c.faint, width: 34, textAlign: 'right' },
    allOk: { fontSize: ty.body, fontWeight: '700', color: c.green, textAlign: 'center', marginTop: spacing.sm },
    ghost: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
    ghostTxt: { color: c.mute, fontSize: ty.body, fontWeight: '700' },
  });
