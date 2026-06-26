import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { progressSnapshot } from '../store/selectors';
import { useT } from '../i18n';
import SessionSummary from '../components/SessionSummary';
import { itemsFor, allWordsFor } from '../data';
import { buildQueue, makeQuestion, reinsertForRelearn, EXAM_FORMATS } from '../quiz/quiz';
import type { StudyItem } from '../data';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

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
  const state = useAppState();
  const { settings, items } = state;
  const { quizAnswer } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();

  // 誤答プール＆弱点ドリルの照合は全語(学習＋模試専用)。出題キュー(category)は学習のみ=poolFor。
  const pool = useMemo(() => [...allWordsFor(settings.level, 'moji_goi'), ...allWordsFor(settings.level, 'bunpou')], [settings.level]);
  const [queue, setQueue] = useState<StudyItem[]>(() => {
    if (itemIds && itemIds.length) {
      const byId = new Map(pool.map((i) => [i.id, i]));
      return itemIds.map((id) => byId.get(id)).filter((x): x is StudyItem => Boolean(x));
    }
    return category === 'all'
      ? buildAllQueue(settings.level, items, Date.now())
      : buildQueue(poolFor(settings.level, category), items, Date.now(), SESSION_SIZE);
  });
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));

  const item = queue[idx];
  const question = useMemo(() => (item ? makeQuestion(item, pool, Math.random, EXAM_FORMATS) : null), [item?.id, idx]);

  // 解答後に自動で次へ(正解は短め・不正解は正解を見せて長め)。
  useEffect(() => {
    if (picked === null || !question) return;
    const isCorrect = picked === question.answerIndex;
    const t = setTimeout(() => {
      setPicked(null);
      setIdx((i) => i + 1);
    }, isCorrect ? 850 : 1600);
    return () => clearTimeout(t);
  }, [picked, question]);

  if (!item || !question) {
    return (
      <SafeAreaView style={s.c}>
        <View style={s.center}>
          <Text style={s.bigEmoji}>🎉</Text>
          <Text style={s.doneTitle}>{t('quiz.session_done')}</Text>
          <Text style={s.doneSub}>{t('quiz.score', { answered, correct: correctCount })}</Text>
          <SessionSummary before={before} after={progressSnapshot(state, Date.now())} streak={state.streak.current} mode="quiz" />
          <Pressable style={s.cta} onPress={() => nav.goBack()}>
            <Text style={s.ctaTxt}>{t('quiz.see_results')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const onPick = (choiceIdx: number) => {
    if (picked !== null) return;
    const isCorrect = choiceIdx === question.answerIndex;
    setPicked(choiceIdx);
    quizAnswer(item.id, isCorrect);
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
            const reveal = picked !== null;
            const style = [
              s.choice,
              reveal && isAnswer && s.choiceCorrect,
              reveal && isPicked && !isAnswer && s.choiceWrong,
            ];
            return (
              <Pressable key={i} style={style} onPress={() => onPick(i)} disabled={reveal}>
                <Text style={s.choiceTxt}>{ch}</Text>
                {reveal && isAnswer ? <Text style={s.mark}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {picked !== null ? (
          <Text style={[s.judge, picked === question.answerIndex ? s.judgeOk : s.judgeNg]}>
            {picked === question.answerIndex ? t('quiz.correct') : t('quiz.wrong')}
          </Text>
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
  reading: { fontSize: ty.small, color: c.mute },
  exHit: { color: c.ink, textDecorationLine: 'underline' },
  qtext: { fontSize: ty.small, color: c.faint, marginTop: spacing.sm },
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
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
