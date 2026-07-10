import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import AppButton from '../components/AppButton';
import { useAppState, useAppActions } from '../store/store';
import { progressSnapshot } from '../store/selectors';
import { useT } from '../i18n';
import SessionSummary from '../components/SessionSummary';
import { itemsFor, allWordsFor, rubyNeeded } from '../data';
import { buildQueue, buildUnitQueue, makeQuestion, reinsertForRelearn, EXAM_FORMATS } from '../quiz/quiz';
import { daimonUnitIds, questionForUnit, learnCardFor, expressionUnitIds, MOJI_DAIMON, BUNPOU_DAIMON, type LearnCard } from '../data/daimon';
import type { StudyItem } from '../data';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';
import RubyText from '../components/RubyText';
import ExplainL10n from '../components/ExplainL10n';

// 学習カードの例文を表示。ふりがな「漢字（かな）」はレベル適応ルビ、対象部「【…】」は括弧を外して下線に統一。
function LearnText({ text, target: explicitTarget, style, hitStyle, rubyStyle, rubyGate }: { text: string; target?: string; style: StyleProp<TextStyle>; hitStyle: StyleProp<TextStyle>; rubyStyle: StyleProp<TextStyle>; rubyGate: (run: string) => boolean }) {
  const hasFuri = /[（(][^）)]*[）)]/.test(text); // 全角・半角どちらのふりがな括弧も対象
  if (hasFuri) {
    const m = text.match(/【([\s\S]+?)】/);
    // 【…】があればそれを下線対象に、無ければ明示targetを使う(⑤用法=活用語も追従)。
    const target = m ? m[1].replace(/[（(][^）)]*[）)]/g, '') : (explicitTarget ?? ''); // 対象語のふりがなを除いた素の語でマッチ
    const body = text.replace(/[【】]/g, ''); // 括弧を外し、中身は下線対象(target)として渡す
    return <RubyText text={body} target={target} style={style} hitStyle={hitStyle} rubyStyle={rubyStyle} rubyGate={rubyGate} center />;
  }
  // ふりがな無し=従来Text。【…】は下線に。
  return <Text style={style}>{text.split(/【(.+?)】/).map((p, i) => (i % 2 === 1 ? <Text key={i} style={hitStyle}>{p}</Text> : p))}</Text>;
}

const SESSION_SIZE = 10;
const RELEARN_GAP = 3;
const MAX_QUESTIONS = 30; // 再挿入の上限(無限ループ防止)

function poolFor(level: 'N5' | 'N4' | 'N3', cat: Category | 'all'): StudyItem[] {
  if (cat === 'all') return [...itemsFor(level, 'moji_goi'), ...itemsFor(level, 'bunpou')];
  return itemsFor(level, cat);
}
// 「全区分の復習」は区分ごとにキューを作り交互に混ぜる(SRS期限切れが1区分に偏らない=本当に全区分から出す)。
function buildAllQueue(level: 'N5' | 'N4' | 'N3', items: Parameters<typeof buildQueue>[1], now: number): StudyItem[] {
  const a = buildQueue(itemsFor(level, 'moji_goi'), items, now, SESSION_SIZE);
  const b = buildQueue(itemsFor(level, 'bunpou'), items, now, SESSION_SIZE);
  const out: StudyItem[] = [];
  for (let i = 0; out.length < SESSION_SIZE && (i < a.length || i < b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (out.length < SESSION_SIZE && i < b.length) out.push(b[i]);
  }
  return out;
}

export default function QuizScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Quiz'>>();
  const category = route.params?.category ?? 'all';
  const itemIds = route.params?.itemIds;
  const title = route.params?.title;
  const daimon = route.params?.daimon; // 大問学習(本番の大問を固定形式で連続出題・状態は「項目#大問」キー)
  const expression = route.params?.expression; // JFT会話と表現(場面→適切な表現)
  const state = useAppState();
  const { settings, items } = state;
  const { quizAnswer } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  // レベル適応ルビ: ユーザーのレベル以上(同レベル含む)の漢字群にだけ読みを振る。
  const rubyGate = (run: string) => rubyNeeded(run, settings.level);

  // 誤答プール＆弱点ドリルの照合は全語(学習＋模試専用)。出題キュー(category)は学習のみ=poolFor。
  const pool = useMemo(() => [...allWordsFor(settings.level, 'moji_goi'), ...allWordsFor(settings.level, 'bunpou')], [settings.level]);
  // 大問モードはユニットid(string)、それ以外はStudyItemのキュー。
  const [queue, setQueue] = useState<(StudyItem | string)[]>(() => {
    if (expression) return buildUnitQueue(expressionUnitIds(), items, Date.now(), SESSION_SIZE);
    if (daimon) return buildUnitQueue(daimonUnitIds(settings.level, daimon, 'learn'), items, Date.now(), SESSION_SIZE);
    if (itemIds && itemIds.length) {
      const byId = new Map(pool.map((i) => [i.id, i]));
      return itemIds.map((id) => byId.get(id)).filter((x): x is StudyItem => Boolean(x));
    }
    // 学習(バランス/カテゴリ)も検証済の大問バンクから出題(makeQuestionの曖昧な意味当てクイズを廃止＝一意性確保)。
    const daimons = category === 'moji_goi' ? MOJI_DAIMON : category === 'bunpou' ? BUNPOU_DAIMON : [...MOJI_DAIMON, ...BUNPOU_DAIMON];
    return buildUnitQueue(daimons.flatMap((d) => daimonUnitIds(settings.level, d, 'learn')), items, Date.now(), SESSION_SIZE);
  });
  // 大問モード=4択の前に「学習カード」で自習(スキップ可)。学習する語=初期キューと同じ。
  const [learnList] = useState<{ unit: string; card: LearnCard }[]>(() =>
    daimon
      ? (queue.filter((x): x is string => typeof x === 'string'))
          .map((u) => ({ unit: u, card: learnCardFor(u) }))
          .filter((x): x is { unit: string; card: LearnCard } => !!x.card)
      : [],
  );
  const [phase, setPhase] = useState<'learn' | 'test'>(() => (daimon && learnList.length ? 'learn' : 'test'));
  const [learnIdx, setLearnIdx] = useState(0);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));

  const item = queue[idx];
  const answerId = typeof item === 'string' ? item : item?.id; // quizAnswer/SRSのキー(大問=項目#大問)
  const question = useMemo(
    () => (!item ? null : typeof item === 'string' ? questionForUnit(item) : makeQuestion(item, pool, Math.random, EXAM_FORMATS)),
    [answerId, idx], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 解答後は自動で進めず、解説を確認してから「次へ」で進む(ユーザー要望: 回答後に解説を読める)。
  const advance = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };

  // 学習フェーズ: 大問の4択に入る前にカードで自習。「テストへ進む」でスキップ可。
  if (phase === 'learn') {
    const lc = learnList[learnIdx]?.card;
    const last = learnIdx >= learnList.length - 1;
    const goTest = () => setPhase('test');
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.top}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12}>
              <Text style={s.close}>✕</Text>
            </Pressable>
            <Text style={s.progress}>{t('quiz.learn_tag')} {learnIdx + 1} / {learnList.length}</Text>
          </View>
          {title ? <Text style={s.drillTitle}>{title}</Text> : null}
          <View style={s.promptCard}>
            {lc?.title ? <LearnText text={lc.title} style={[s.prompt, lc.title.length > 10 && s.promptLong]} hitStyle={s.learnHit} rubyStyle={s.promptRuby} rubyGate={rubyGate} /> : null}
            {lc?.sub ? <Text style={s.reading}>{lc.sub}</Text> : null}
            {lc?.body ? <LearnText text={lc.body} target={lc.hit} style={s.learnBody} hitStyle={s.learnHit} rubyStyle={s.learnRuby} rubyGate={rubyGate} /> : null}
            {lc?.note ? <LearnText text={lc.note} style={s.learnNote} hitStyle={s.learnHit} rubyStyle={s.learnRuby} rubyGate={rubyGate} /> : null}
          </View>
          <AppButton label={last ? t('quiz.learn_start') : t('quiz.learn_next')} onPress={() => (last ? goTest() : setLearnIdx((i) => i + 1))} />
          <Pressable onPress={goTest} hitSlop={8}><Text style={s.learnSkip}>{t('quiz.learn_skip')}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!item || !question) {
    return (
      <SafeAreaView style={s.c}>
        <View style={s.center}>
          <Text style={s.bigEmoji}>🎉</Text>
          <Text style={s.doneTitle}>{t('quiz.session_done')}</Text>
          <Text style={s.doneSub}>{t('quiz.score', { answered, correct: correctCount })}</Text>
          <SessionSummary before={before} after={progressSnapshot(state, Date.now())} streak={state.streak.current} mode="quiz" />
          <AppButton label={t('quiz.see_results')} onPress={() => nav.goBack()} full={false} style={{ marginTop: spacing.sm }} />
        </View>
      </SafeAreaView>
    );
  }

  const onPick = (choiceIdx: number) => {
    if (picked !== null) return;
    const isCorrect = choiceIdx === question.answerIndex;
    setPicked(choiceIdx);
    if (answerId) quizAnswer(answerId, isCorrect);
    setAnswered((a) => a + 1);
    if (isCorrect) setCorrectCount((c) => c + 1);
    // 不正解は数問後に再挿入(分散学習)
    if (!isCorrect && queue.length < MAX_QUESTIONS) {
      setQueue((q) => {
        const head = q.slice(0, idx + 1);
        const tail = reinsertForRelearn(q.slice(idx + 1), item, RELEARN_GAP);
        return [...head, ...tail];
      });
    }
  };

  const total = Math.min(queue.length, MAX_QUESTIONS);

  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.top}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={s.close}>✕</Text>
          </Pressable>
          <Text style={s.progress}>
            {idx + 1} / {total}
          </Text>
        </View>
        {title ? <Text style={s.drillTitle}>{title}</Text> : null}

        <View style={s.promptCard}>
          {question.furi ? (
            // ふりがな付き問題文=レベル適応ルビ(同レベル以上の漢字のみ)。①漢字読みは対象語のルビを抑止。
            <RubyText text={question.furi} target={question.furiTarget} style={s.sentence} hitStyle={s.exHit} rubyStyle={s.qRuby} rubyGate={rubyGate} noRubyOnHit={question.noTargetRuby} center />
          ) : (
            <>
              {question.prompt ? <Text style={[s.prompt, question.prompt.length > 10 && s.promptLong]}>{question.prompt}</Text> : null}
              {question.example ? (
                <Text style={question.prompt ? s.reading : s.sentence}>
                  {question.example.map((sg, i) => (
                    <Text key={i} style={sg.hit ? s.exHit : undefined}>{sg.text}</Text>
                  ))}
                </Text>
              ) : question.reading ? (
                <Text style={s.reading}>{question.reading}</Text>
              ) : null}
            </>
          )}
          <Text style={s.qtext}>{question.question}</Text>
        </View>

        <View style={s.choices}>
          {question.choices.map((ch, i) => {
            const isAnswer = i === question.answerIndex;
            const isPicked = i === picked;
            const reveal = picked !== null;
            const showOk = reveal && isAnswer;
            const showNg = reveal && isPicked && !isAnswer;
            return (
              <Pressable
                key={i}
                onPress={() => onPick(i)}
                disabled={reveal}
                style={({ pressed }) => [
                  s.choice,
                  shadow(1),
                  pressed && !reveal && s.choicePressed,
                  showOk && s.choiceCorrect,
                  showNg && s.choiceWrong,
                ]}
              >
                <View style={[s.cbadge, showOk && s.cbadgeOk, showNg && s.cbadgeNg]}>
                  <Text style={[s.cbadgeTxt, (showOk || showNg) && s.cbadgeTxtOn]}>
                    {showOk ? '✓' : showNg ? '✕' : String(i + 1)}
                  </Text>
                </View>
                <Text style={s.choiceTxt}>{ch}</Text>
              </Pressable>
            );
          })}
        </View>

        {picked !== null ? (
          <>
            <Text style={[s.judge, picked === question.answerIndex ? s.judgeOk : s.judgeNg]}>
              {picked === question.answerIndex ? t('quiz.correct') : t('quiz.wrong')}
            </Text>
            {question.explain ? (
              <View style={s.explainBox}>
                <Text style={s.explainLabel}>{t('quiz.explain_label')}</Text>
                <LearnText text={question.explain} style={s.explainTxt} hitStyle={s.learnHit} rubyStyle={s.learnRuby} rubyGate={rubyGate} />
                {question.itemId ? <ExplainL10n id={question.itemId} l1={settings.l1} /> : null}
              </View>
            ) : null}
            <AppButton label={idx + 1 >= total ? t('quiz.see_results') : t('quiz.learn_next')} onPress={advance} />
          </>
        ) : (
          <Text style={s.hint}>{t('quiz.hint')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  body: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { fontSize: ty.h2, color: c.mute },
  progress: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
  drillTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink, textAlign: 'center' },
  promptCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  prompt: { fontSize: 34, fontWeight: '800', color: c.ink },
  promptLong: { fontSize: ty.h2, lineHeight: 30, textAlign: 'left', alignSelf: 'stretch' }, // 穴埋め/バンク=長文プロンプト

  reading: { fontSize: ty.small, color: c.mute },
  sentence: { fontSize: ty.h2, lineHeight: 32, color: c.ink, textAlign: 'left', alignSelf: 'stretch' }, // 言い換え=文＋下線を主表示

  learnBody: { fontSize: ty.body, color: c.ink2, marginTop: spacing.xs, textAlign: 'center', lineHeight: 22 },
  learnNote: { fontSize: ty.small, color: c.ink, marginTop: spacing.sm, textAlign: 'center', lineHeight: 22 },
  learnHit: { color: c.ink, fontWeight: '800', textDecorationLine: 'underline' },
  learnRuby: { fontSize: 9, lineHeight: 11, color: c.mute, textAlign: 'center' },
  promptRuby: { fontSize: 12, lineHeight: 14, color: c.mute, textAlign: 'center' }, // 見出し(title)のルビ(大きめ本文用)
  learnSkip: { fontSize: ty.small, color: c.mute, fontWeight: '700', textAlign: 'center', marginTop: spacing.xs, textDecorationLine: 'underline' },
  exHit: { color: c.ink, textDecorationLine: 'underline' },
  qRuby: { fontSize: 10, lineHeight: 12, color: c.mute, textAlign: 'center' },
  qtext: { fontSize: ty.small, color: c.faint, marginTop: spacing.sm },
  choices: { gap: spacing.sm + 2 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  choicePressed: { transform: [{ scale: 0.98 }], backgroundColor: c.bgSoft, borderColor: c.trace },
  choiceCorrect: { borderColor: c.green, backgroundColor: c.okBg },
  choiceWrong: { borderColor: c.red, backgroundColor: c.ngBg },
  choiceTxt: { fontSize: ty.body, color: c.ink2, flex: 1, fontWeight: '600' },
  // 選択肢先頭の丸バッジ(番号→正誤で✓✕)
  cbadge: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line,
  },
  cbadgeOk: { backgroundColor: c.green, borderColor: c.green },
  cbadgeNg: { backgroundColor: c.red, borderColor: c.red },
  cbadgeTxt: { fontSize: ty.body, fontWeight: '800', color: c.mute },
  cbadgeTxtOn: { color: '#ffffff' },
  cta: {
    marginTop: spacing.sm,
    backgroundColor: c.blue,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  ctaTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.sm },
  judge: { fontSize: ty.h2, fontWeight: '800', textAlign: 'center', marginTop: spacing.sm },
  judgeOk: { color: c.green },
  judgeNg: { color: c.red },
  explainBox: { backgroundColor: c.bgSoft, borderRadius: radius.md, padding: spacing.md, gap: 4, marginTop: spacing.xs },
  explainLabel: { fontSize: ty.tiny, fontWeight: '800', color: c.mute, letterSpacing: 1 },
  explainTxt: { fontSize: ty.small, color: c.ink2, lineHeight: 20 },
  explainNe: { fontSize: ty.small, color: c.blue, lineHeight: 20, marginTop: 4 },
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
