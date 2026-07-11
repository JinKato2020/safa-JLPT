// 連続学習→連続テスト の共通フロー（掲示板「学習フロー」）。
// ①まず batch(最大size件) を続けて「学習」(採点なし・各画面が renderLearnCard で表示)
// → ②同じ batch を続けて4択「テスト」(客観・重み3=recordQuiz)。間違いは分散再出題(relearn)。
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { progressSnapshot } from '../store/selectors';
import SessionSummary from './SessionSummary';
import { buildQueue, makeQuestion, reinsertForRelearn, EXAM_FORMATS } from '../quiz/quiz';
import type { StudyItem } from '../data';
import { useT } from '../i18n';

const RELEARN_GAP = 3;

interface Props {
  pool: StudyItem[];
  size: number;
  renderLearnCard: (item: StudyItem) => ReactNode;
  overrideBatch?: StudyItem[]; // 指定時はSRSキュー(buildQueue)を使わず、この項目群をそのままテスト対象にする(例: my単語帳の「復習する」= 保存済みを全件)
}

export default function LearnTestSession({ pool, size, renderLearnCard, overrideBatch }: Props) {
  const t = useT();
  const nav = useNavigation();
  const state = useAppState();
  const { items } = state;
  const { quizAnswer } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const maxCards = (overrideBatch ? overrideBatch.length : size) * 3 + 4; // relearn 再出題の上限
  const [batch] = useState<StudyItem[]>(() => overrideBatch ?? buildQueue(pool, items, Date.now(), size));
  const [phase, setPhase] = useState<'learn' | 'test'>('learn');
  const [learnIdx, setLearnIdx] = useState(0);
  const [testQueue, setTestQueue] = useState<StudyItem[]>(batch); // 学習と同じ batch をテスト
  const [testIdx, setTestIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));

  const testItem = testQueue[testIdx];
  const question = useMemo(() => (testItem ? makeQuestion(testItem, pool, Math.random, EXAM_FORMATS) : null), [testItem?.id, testIdx]);

  // テスト: 解答後に自動で次へ(正解は短め・不正解は正解を見せて長め)。
  useEffect(() => {
    if (phase !== 'test' || picked === null || !question) return;
    const isCorrect = picked === question.answerIndex;
    const t = setTimeout(() => {
      setPicked(null);
      setTestIdx((i) => i + 1);
    }, isCorrect ? 850 : 1600);
    return () => clearTimeout(t);
  }, [picked, phase, question]);

  // 対象なし（その区分を学習し尽くした / 未作成）
  if (batch.length === 0) {
    return (
      <SafeAreaView style={s.c}>
        <View style={s.center}>
          <Text style={s.bigEmoji}>✅</Text>
          <Text style={s.doneTitle}>{t('learntestsession.no_items_title')}</Text>
          <Text style={s.doneSub}>{t('learntestsession.no_items_sub')}</Text>
          <Pressable style={s.cta} onPress={() => nav.goBack()}>
            <Text style={s.ctaTxt}>{t('learntestsession.back_home')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ① 学習フェーズ（採点なし・続けて覚える）
  if (phase === 'learn') {
    const learnItem = batch[learnIdx];
    const last = learnIdx + 1 >= batch.length;
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.top}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12}>
              <Text style={s.close}>✕</Text>
            </Pressable>
            <Text style={s.progress}>{t('learntestsession.learn_progress', { n: learnIdx + 1, m: batch.length })}</Text>
          </View>
          <Text style={s.phase}>{t('learntestsession.learn_phase')}</Text>
          <View>{renderLearnCard(learnItem)}</View>
          <View style={s.navRow}>
            {learnIdx > 0 ? (
              <Pressable style={s.ctaBack} onPress={() => setLearnIdx((i) => Math.max(0, i - 1))}>
                <Text style={s.ctaBackTxt}>{t('learntestsession.back')}</Text>
              </Pressable>
            ) : null}
            <Pressable style={[s.cta, s.ctaFlex]} onPress={() => (last ? setPhase('test') : setLearnIdx((i) => i + 1))}>
              <Text style={s.ctaTxt}>{last ? t('learntestsession.go_test', { n: batch.length }) : t('learntestsession.next')}</Text>
            </Pressable>
          </View>
          {last ? <Text style={s.hint}>{t('learntestsession.learn_hint', { n: batch.length })}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // テスト完了
  if (!testItem || !question) {
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.doneBody}>
          <Text style={s.bigEmoji}>🎉</Text>
          <Text style={s.doneTitle}>{t('learntestsession.done_title')}</Text>
          <Text style={s.doneSub}>{t('learntestsession.done_score', { n: answered, m: correct })}</Text>
          <SessionSummary before={before} after={progressSnapshot(state, Date.now())} streak={state.streak.current} mode={pool[0]?.category ?? 'study'} />
          <Pressable style={s.cta} onPress={() => nav.goBack()}>
            <Text style={s.ctaTxt}>{t('learntestsession.back_home')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ② テストフェーズ（客観4択・自動採点・重み3）
  const onPick = (choiceIdx: number) => {
    if (picked !== null) return;
    const isCorrect = choiceIdx === question.answerIndex;
    setPicked(choiceIdx);
    quizAnswer(testItem.id, isCorrect);
    setAnswered((a) => a + 1);
    if (isCorrect) setCorrect((x) => x + 1);
    if (!isCorrect && testQueue.length < maxCards) {
      setTestQueue((q) => {
        const head = q.slice(0, testIdx + 1);
        const tail = reinsertForRelearn(q.slice(testIdx + 1), testItem, RELEARN_GAP);
        return [...head, ...tail];
      });
    }
  };
  const total = Math.min(testQueue.length, maxCards);
  const reveal = picked !== null;

  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.top}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={s.close}>✕</Text>
          </Pressable>
          <Text style={s.progress}>{t('learntestsession.test_progress', { n: testIdx + 1, m: total })}</Text>
        </View>
        <Text style={s.phase}>{t('learntestsession.test_phase')}</Text>

        <View style={s.promptCard}>
          <Text style={s.prompt}>{question.prompt}</Text>
          {question.example ? (
            <Text style={s.reading}>
              {question.example.map((sg, i) => (
                <Text key={i} style={sg.hit ? s.exHit : undefined}>{sg.text}</Text>
              ))}
            </Text>
          ) : question.reading ? (
            <Text style={s.reading}>{question.reading}</Text>
          ) : null}
          <Text style={s.qtext}>{question.question}</Text>
        </View>

        <View style={s.choices}>
          {question.choices.map((ch, i) => {
            const isAnswer = i === question.answerIndex;
            const isPicked = i === picked;
            return (
              <Pressable
                key={i}
                style={[s.choice, reveal && isAnswer && s.choiceCorrect, reveal && isPicked && !isAnswer && s.choiceWrong]}
                onPress={() => onPick(i)}
                disabled={reveal}
              >
                <Text style={s.choiceTxt}>{ch}</Text>
                {reveal && isAnswer ? <Text style={s.mark}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {reveal ? (
          <Text style={[s.judge, picked === question.answerIndex ? s.judgeOk : s.judgeNg]}>
            {picked === question.answerIndex ? t('learntestsession.correct') : t('learntestsession.wrong')}
          </Text>
        ) : (
          <Text style={s.hint}>{t('learntestsession.test_hint')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  body: { padding: spacing.lg, gap: spacing.md },
  doneBody: { padding: spacing.xl, gap: spacing.sm, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { fontSize: ty.h2, color: c.mute },
  progress: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
  phase: { fontSize: ty.small, fontWeight: '800', color: c.blue, letterSpacing: 1 },
  promptCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 140,
    justifyContent: 'center',
  },
  prompt: { fontSize: 34, fontWeight: '800', color: c.ink, textAlign: 'center' },
  reading: { fontSize: ty.small, color: c.mute },
  exHit: { color: c.ink, textDecorationLine: 'underline' },
  qtext: { fontSize: ty.small, color: c.faint, marginTop: spacing.xs },
  choices: { gap: spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  choiceCorrect: { borderColor: c.green, backgroundColor: c.okBg },
  choiceWrong: { borderColor: c.red, backgroundColor: c.ngBg },
  choiceTxt: { fontSize: ty.body, color: c.ink2, flex: 1 },
  mark: { color: c.green, fontWeight: '800', fontSize: ty.h2 },
  cta: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  ctaTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  navRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  ctaFlex: { flex: 1 },
  ctaBack: {
    borderWidth: 1, borderColor: c.line, borderRadius: radius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center',
  },
  ctaBackTxt: { color: c.ink2, fontSize: ty.body, fontWeight: '700' },
  judge: { fontSize: ty.h2, fontWeight: '800', textAlign: 'center', marginTop: spacing.sm },
  judgeOk: { color: c.green },
  judgeNg: { color: c.red },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
