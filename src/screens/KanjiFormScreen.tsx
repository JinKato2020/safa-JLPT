import StudyLayout from '../components/StudyLayout';
import StudyChoiceList from '../components/StudyChoiceList';
import StudyPrompt, { StudyInstruction } from '../components/StudyPrompt';
// 漢字の「形の弁別」テスト(モーダル)。意味＋読みを手がかりに、似た字4択から正しい字を選ぶ。
// 音声なし。結果は char の form 面へ計上(quizAnswer の answerId=`${char}#kdiscrim_form`→facetMap)。
// 書き取り(産出)より易しい認識レベルで、"似た字の取り違え"だけを独立に測る踏み石。
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, type ThemeColors } from '../theme';
import { useStudyColors } from '../components/StudyPresentation';
import { useAppState, useAppActions } from '../store/store';
import type { SaveRef } from '../store/state';
import { progressSnapshot } from '../store/selectors';
import AfterStudyReward from '../components/AfterStudyReward';
import AnswerFooter from '../components/AnswerFooter';
import { walletPoints } from '../store/wallet';
import { resolveStudiedWords } from '../data/studiedWords';
import { KANJI, cardFaceReadings, meaningIn, formatKanjiReading } from '../data';
import kanjiSimilar from '../data/words/kanjiSimilar.json';
import { buildKanjiFormQuiz, type KFItem } from '../kanji/kanjiForm';
import type { RootStackParamList } from '../navigation/types';
import { useT, meaningL1 } from '../i18n';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const COUNT = 10;
const KSIM = kanjiSimilar as Record<string, { similar?: string[]; formMakeable?: boolean }>;

export default function KanjiFormScreen() {
  const nav = useNavigation<Nav>();
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const state = useAppState();
  const actions = useAppActions();
  const c = useStudyColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const l1 = meaningL1(state.settings);
  const level = state.settings.level;
  const jft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const inScope = (lv: string) => (jft ? lv === 'N5' || lv === 'N4' : lv === level);

  // 出題(セッション固定)。自レベルの漢字のうち、似た字が3つ揃う字(formMakeable)だけを出す。
  const { questions, charOf } = useMemo(() => {
    const pool: KFItem[] = [];
    const charById = new Map<string, string>();
    for (const k of KANJI) {
      if (k.type !== 'kanji' || !inScope(k.level)) continue;
      const sim = KSIM[k.char];
      if (!sim?.formMakeable || !(sim.similar?.length)) continue;
      const meaning = (l1 && l1 !== 'en' ? meaningIn(k.char, l1) : undefined) ?? k.meaning ?? '';
      // 手がかりの読み=訓を優先(送り仮名付きで分かりやすく)、無ければ一般的な音読み。
      const rs = cardFaceReadings(k.char, level);
      const kuns = rs.filter((r) => r.type === 'kun').sort((a, b) => b.reading.length - a.reading.length);
      const pick = kuns[0] ?? rs.find((r) => r.type === 'on') ?? rs[0];
      const rd = pick ? formatKanjiReading(k.char, pick.reading, pick.type) : '';
      const hint = rd ? `${meaning}　${rd}` : meaning; // 読みに（送り仮名）が入るので二重括弧を避け全角スペース区切り
      pool.push({ char: k.char, hint, similar: sim.similar! });
      charById.set(k.char, k.id);
    }
    const qs = buildKanjiFormQuiz(pool, COUNT, Math.random);
    return { questions: qs, charOf: charById };
  }, [level, l1, jft]); // eslint-disable-line react-hooks/exhaustive-deps

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState<'quiz' | 'done'>('quiz');
  const [before] = useState(() => progressSnapshot(state, Date.now()));
  const [walletStart] = useState(() => walletPoints(state));
  const [studiedRefs, setStudiedRefs] = useState<{ ref: SaveRef; correct: boolean }[]>([]);

  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  if (questions.length === 0) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><View style={{ width: 30 }} /></View>
        <View style={s.center}><Text style={s.prompt}>{t('kform.empty')}</Text><Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('listening2.close')}</Text></Pressable></View>
      </SafeAreaView>
    );
  }

  if (phase === 'done') {
    const after = progressSnapshot(state, Date.now());
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><View style={{ width: 30 }} /></View>
        <ScrollView contentContainerStyle={s.doneBody}>
          <AfterStudyReward
            words={resolveStudiedWords(studiedRefs, l1)}
            shellsEarned={Math.max(0, walletPoints(state) - walletStart)}
            scored={after.touched - before.touched}
            accuracy={questions.length ? Math.round((correct / questions.length) * 100) : 0}
            correct={correct}
            total={questions.length}
            mode="moji_goi"
          />
          <Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('listening2.close')}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const q = questions[idx];
  const reveal = picked !== null;
  const onPick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.answerIndex;
    if (ok) setCorrect((n) => n + 1);
    actions.quizAnswer(q.answerId, ok); // answerId=`${char}#kdiscrim_form`→ char の form 面へ加点
    const id = charOf.get(q.char);
    if (id) setStudiedRefs((prev) => [...prev, { ref: { type: 'kanji', id }, correct: ok }]);
  };
  const advance = () => { if (idx + 1 >= questions.length) { setPhase('done'); return; } setIdx((i) => i + 1); setPicked(null); };

  return (
    <StudyLayout title={t('cards.kanji_form')} current={idx + 1} total={questions.length} onClose={() => nav.goBack()}
      footer={picked !== null ? <AnswerFooter study correct={picked === q.answerIndex} onNext={advance} nextKind={idx + 1 >= questions.length ? 'finish' : 'next'} /> : null}>
        <StudyInstruction>{t('kform.prompt')}</StudyInstruction>
        <StudyPrompt><Text style={s.hintTxt}>{q.hint}</Text></StudyPrompt>
        <StudyChoiceList choices={q.choices} selectedIndex={picked} answerIndex={q.answerIndex} revealed={picked !== null} onSelect={onPick} layout="grid" />
    </StudyLayout>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    close: { fontSize: 30, color: c.mute, fontWeight: '700' },
    doneBody: { padding: spacing.xl, gap: spacing.sm, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    prompt: { fontSize: ty.body, fontWeight: '700', color: c.ink, textAlign: 'center' },
    hintTxt: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
    cta: { backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center' },
    ctaTxt: { color: '#fff', fontSize: ty.body, fontWeight: '800' },
  });
