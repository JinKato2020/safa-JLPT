// ミニ読解。お知らせ/メール/メモ等の本文を読み、4択で自動採点(重み3=mini)→読解リング点灯。
// 採点は quizAnswer(設問id) を流用。間違いの解説つき。掲示板§4(読解)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { useT } from '../i18n';
import { progressSnapshot } from '../store/selectors';
import SessionSummary from '../components/SessionSummary';
import { readingItemsFor, type ReadingItem, type PassageQuestion } from '../data';
import { sample, reinsertForRelearn, shuffleChoices } from '../quiz/quiz';
import { effectiveP } from '../engine/engine';

const SESSION_PASSAGES = 3;
const RELEARN_GAP = 2;   // 不正解を何問後に戻すか
const MAX_STEPS = 24;    // 再挿入の暴走防止

interface Step { passage: ReadingItem; q: PassageQuestion; qNum: number; qTotal: number; }

export default function ReadingScreen() {
  const nav = useNavigation();
  const state = useAppState();
  const { quizAnswer } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();

  const [steps, setSteps] = useState<Step[]>(() => {
    const now = Date.now();
    const all = readingItemsFor(state.settings.level);
    // 未習得(未回答 or p<0.6)の設問を含むパッセージを優先→カバー率が確実に進みリングが満ちる。
    const needy = all.filter((p) => p.questions.some((q) => { const st = state.items[q.id]; return !st || effectiveP(st, now) < 0.6; }));
    const rest = all.filter((p) => !needy.includes(p));
    const passages = [...sample(needy, SESSION_PASSAGES), ...sample(rest, SESSION_PASSAGES)].slice(0, SESSION_PASSAGES);
    return passages.flatMap((p) => p.questions.map((q, i) => ({ passage: p, q: { ...q, ...shuffleChoices(q.choices, q.answerIndex) }, qNum: i + 1, qTotal: p.questions.length })));
  });
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));

  const step = steps[idx];

  // 解答後に自動で次へ(本文は読了済み。正解を見せて少し長め)。
  useEffect(() => {
    if (picked === null || !step) return;
    const isCorrect = picked === step.q.answerIndex;
    const t = setTimeout(() => {
      setPicked(null);
      setIdx((i) => i + 1);
    }, isCorrect ? 2000 : 3200);
    return () => clearTimeout(t);
  }, [picked]);

  if (!step) {
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.doneBody}>
          <Text style={s.bigEmoji}>🎉</Text>
          <Text style={s.doneTitle}>{t('reading.sessionComplete')}</Text>
          <Text style={s.doneSub}>{t('reading.scoreResult', { answered, correct })}</Text>
          <SessionSummary before={before} after={progressSnapshot(state, Date.now())} streak={state.streak.current} />
          <Pressable style={s.cta} onPress={() => nav.goBack()}>
            <Text style={s.ctaTxt}>{t('reading.backToHome')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const onPick = (i: number) => {
    if (picked !== null) return;
    const ok = i === step.q.answerIndex;
    setPicked(i);
    quizAnswer(step.q.id, ok);
    setAnswered((a) => a + 1);
    if (ok) setCorrect((x) => x + 1);
    else if (steps.length < MAX_STEPS) {
      // 不正解は正解するまで後ろに戻す(語彙・文法と同じ復習ループ→読解リングが埋まる)
      setSteps((q) => {
        const head = q.slice(0, idx + 1);
        const tail = reinsertForRelearn(q.slice(idx + 1), step, RELEARN_GAP);
        return [...head, ...tail];
      });
    }
  };
  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.top}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={s.close}>✕</Text>
          </Pressable>
          <Text style={s.progress}>{idx + 1} / {steps.length}</Text>
        </View>

        <View style={s.passageCard}>
          <Text style={s.fmtTag}>{step.passage.format}</Text>
          <Text style={s.passageTitle}>{step.passage.title}</Text>
          <Text style={s.passageBody}>{step.passage.body}</Text>
        </View>

        <Text style={s.qLabel}>{t('reading.questionLabel', { n: step.qNum, m: step.qTotal })}</Text>
        <Text style={s.qText}>{step.q.q}</Text>
        <View style={s.choices}>
          {step.q.choices.map((ch, i) => {
            const isAnswer = i === step.q.answerIndex;
            const isPicked = i === picked;
            const reveal = picked !== null;
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

        {picked !== null ? (
          <>
            <View style={s.explainBox}>
              <Text style={s.explainTxt}>{step.q.explain}</Text>
            </View>
            <Text style={s.autoNext}>{idx + 1 >= steps.length ? t('reading.autoResult') : t('reading.autoNext')}</Text>
          </>
        ) : (
          <Text style={s.hint}>{t('reading.hint')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  body: { padding: spacing.lg, gap: spacing.md },
  doneBody: { padding: spacing.xl, gap: spacing.sm, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { fontSize: ty.h2, color: c.mute },
  progress: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
  passageCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  fmtTag: { fontSize: ty.tiny, fontWeight: '800', color: c.dokkai, letterSpacing: 1 },
  passageTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  passageBody: { fontSize: ty.body, color: c.ink2, lineHeight: 26, marginTop: spacing.xs },
  qLabel: { fontSize: ty.tiny, fontWeight: '700', color: c.mute, letterSpacing: 1 },
  qText: { fontSize: ty.h2, fontWeight: '700', color: c.ink },
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
  explainBox: { backgroundColor: c.bgSoft, borderRadius: radius.md, padding: spacing.md },
  explainTxt: { fontSize: ty.small, color: c.ink2, lineHeight: 20 },
  cta: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  ctaTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
  autoNext: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.xs },
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
