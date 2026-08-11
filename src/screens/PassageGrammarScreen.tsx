// 文章の文法(大問⑧・セット形式)。1文章＋5設問(空欄5〜9)を PassageSetPlayer に一括提示(本文+全設問→一括採点)。
// 旧知識バンク(passage_grammar daimon)から passageGrammar.json(セット形式)へ移行(Task 5・daimon.tsのBANKからは除外済)。
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
import { resolveStudiedWords } from '../data/studiedWords';
import ExamHeader from '../components/ExamHeader';
import type { RootStackParamList } from '../navigation/types';
import { passageGrammarSetsFor } from '../data';
import PassageSetPlayer from '../components/PassageSetPlayer';
import { type PassageSet } from '../quiz/passageSet';
import { sample } from '../quiz/quiz';
import { effectiveP } from '../engine/engine';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

const SESSION_SETS = 3;

export default function PassageGrammarScreen() {
  const nav = useNavigation();
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const route = useRoute<RouteProp<RootStackParamList, 'PassageGrammar'>>();
  const state = useAppState();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();

  const [sets] = useState<PassageSet[]>(() => {
    const now = Date.now();
    const all = passageGrammarSetsFor(state.settings.level);
    // 未習得(未回答 or p<0.6)の設問を含むセットを優先→カバー率が確実に進みリングが満ちる。
    const needy = all.filter((set) => set.questions.some((q) => { const st = state.items[q.id]; return !st || effectiveP(st, now) < 0.6; }));
    const rest = all.filter((set) => !needy.includes(set));
    const picked = [...sample(needy, SESSION_SETS), ...sample(rest, SESSION_SETS)].slice(0, SESSION_SETS);
    return picked;
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
    // 文章の文法=各設問に文法点(pointId)。学習した文法を正誤(reps>0)付きでまとめて私の単語帳へ。
    const studiedRefs = sets.flatMap((st) => st.questions).filter((q) => q.pointId).map((q) => ({ ref: { type: 'grammar' as const, id: q.pointId! }, correct: (state.items[q.id]?.reps ?? 0) > 0 }));
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.doneBody}>
          <AfterStudyReward
            words={resolveStudiedWords(studiedRefs, meaningL1(state.settings))}
            shellsEarned={Math.max(0, walletPoints(state) - walletStart)}
            scored={after.touched - before.touched}
            accuracy={answered ? Math.round((correct / answered) * 100) : 0}
            correct={correct}
            total={answered}
            mode="passage_grammar"
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
