// ミニ読解。お知らせ/メール/メモ等の本文を読み、4択で自動採点(重み3=mini)→読解リング点灯。
// 1パッセージ=1セットとして PassageSetPlayer に一括提示(本文+全設問→一括採点)。掲示板§4(読解)。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { useT, meaningL1 } from '../i18n';
import { progressSnapshot } from '../store/selectors';
import AfterStudyReward from '../components/AfterStudyReward';
import { walletPoints } from '../store/wallet';
import { resolveStudiedWords, type StudiedQuestion } from '../data/studiedWords';
import ExamHeader from '../components/ExamHeader';
import { readingItemsFor, readingItemsForSub } from '../data';
import PassageSetPlayer from '../components/PassageSetPlayer';
import { readingToSet, type PassageSet } from '../quiz/passageSet';
import type { RootStackParamList } from '../navigation/types';
import { sample } from '../quiz/quiz';
import { effectiveP } from '../engine/engine';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

const SESSION_PASSAGES = 3;

export default function ReadingScreen() {
  const nav = useNavigation();
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const state = useAppState();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();

  const route = useRoute<RouteProp<RootStackParamList, 'Reading'>>();
  const sub = route.params?.subtype;

  const [sets] = useState<PassageSet[]>(() => {
    const now = Date.now();
    const all = sub ? readingItemsForSub(state.settings.level, sub) : readingItemsFor(state.settings.level);
    // 未習得(未回答 or p<0.6)の設問を含むパッセージを優先→カバー率が確実に進みリングが満ちる。
    const needy = all.filter((p) => p.questions.some((q) => { const st = state.items[q.id]; return !st || effectiveP(st, now) < 0.6; }));
    const rest = all.filter((p) => !needy.includes(p));
    const passages = [...sample(needy, SESSION_PASSAGES), ...sample(rest, SESSION_PASSAGES)].slice(0, SESSION_PASSAGES);
    return passages.map(readingToSet);
  });
  const [idx, setIdx] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));
  const [walletStart] = useState(() => walletPoints(state));

  const set = sets[idx];

  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  if (!set) {
    // セッション内で回答した全設問のうち、最終的に正解だった数(reps>0=直近の quizAnswer が正解=SRSのgood判定)。
    const allQuestionIds = sets.flatMap((st) => st.questions.map((q) => q.id));
    const answered = allQuestionIds.length;
    const correct = allQuestionIds.filter((id) => (state.items[id]?.reps ?? 0) > 0).length;
    const after = progressSnapshot(state, Date.now());
    // 読解の設問に文法点(pointId)があれば学習語として拾う(正誤=reps>0。無ければ単語リストは空=同UI)。
    const studiedRefs = sets.flatMap((st) => st.questions).filter((q) => q.pointId).map((q) => ({ ref: { type: 'grammar' as const, id: q.pointId! }, correct: (state.items[q.id]?.reps ?? 0) > 0 }));
    // 問題の見直し(本文つき)。設問ごとに本文＋問題＋選択肢＋正誤を持たせて全画面へ。
    const reviewList: StudiedQuestion[] = sets.flatMap((st) => {
      const passage = st.passages.map((p) => (p.title ? p.title + '\n' : '') + (p.body ?? '')).join('\n\n').trim();
      return st.questions.map((q, qi) => ({
        passage: passage || undefined,
        question: q.q ?? '',
        choices: q.choices,
        answerIndex: q.answerIndex,
        explain: q.explain,
        correct: (state.items[q.id]?.reps ?? 0) > 0,
        label: q.q && q.q.trim() ? q.q : st.passages[0]?.title || `問題 ${qi + 1}`,
      }));
    });
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.doneBody}>
          <AfterStudyReward
            words={resolveStudiedWords(studiedRefs, meaningL1(state.settings))}
            reviewList={reviewList}
            shellsEarned={Math.max(0, walletPoints(state) - walletStart)}
            scored={after.touched - before.touched}
            accuracy={answered ? Math.round((correct / answered) * 100) : 0}
            correct={correct}
            total={answered}
            mode="dokkai"
          />
          <Pressable style={s.cta} onPress={() => nav.goBack()}>
            <Text style={s.ctaTxt}>{t('reading.backToHome')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c}>
      <ExamHeader title={route.params?.title} id={set.id} onClose={() => nav.goBack()} count={`${idx + 1} / ${sets.length}`} />
      <PassageSetPlayer key={set.id} set={set} isLast={idx + 1 >= sets.length} onNext={() => setIdx((i) => i + 1)} />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  doneBody: { padding: spacing.xl, gap: spacing.sm, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  close: { fontSize: ty.h2, color: c.mute },
  progress: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
  cta: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  ctaTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
