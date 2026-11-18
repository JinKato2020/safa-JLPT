import StudyLayout from '../components/StudyLayout';
import StudyChoiceList from '../components/StudyChoiceList';
import StudyPrompt, { StudyInstruction } from '../components/StudyPrompt';
// 漢字認識テスト(モーダル)。字を単独提示→意味/読みを4択(文脈文なし)。設計正本=段階B①。
// 音声なし。結果は char の mean/read 面へ計上(quizAnswer の answerId=`${char}#krecog_*`→facetMap)。
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
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
import kanjiFacetFlags from '../data/words/kanjiFacets.json';
import { buildKanjiRecognitionQuiz, type KRItem } from '../kanji/kanjiRecognition';
import type { RootStackParamList } from '../navigation/types';
import { useT, meaningL1 } from '../i18n';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const COUNT = 10;
const FLAGS = kanjiFacetFlags as Record<string, { meaningClear?: boolean }>;

export default function KanjiRecognitionScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'KanjiRecognition'>>();
  const mode = route.params?.mode; // 'mean'=意味だけ / 'read'=読みだけ / undefined=両方(旧挙動)
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
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
  const inScope = (lv: string) => (jft ? lv === 'N5' || lv === 'N4' : lv === level); // カバー率の母数と同じ範囲

  // 出題(セッション固定)。カバー率の母数=自レベルの漢字から、意味/読みを問える字だけを出す。
  const { questions, charOf } = useMemo(() => {
    const pool: KRItem[] = [];
    const charById = new Map<string, string>(); // kanji.json id ← char(私の単語帳保存用)
    for (const k of KANJI) {
      if (k.type !== 'kanji' || !inScope(k.level)) continue;
      const meaning = (l1 && l1 !== 'en' ? meaningIn(k.char, l1) : undefined) ?? k.meaning ?? '';
      const readings = cardFaceReadings(k.char, level).map((r) => ({ type: r.type, reading: r.reading, display: formatKanjiReading(k.char, r.reading, r.type) }));
      pool.push({ char: k.char, meaning, meaningClear: FLAGS[k.char]?.meaningClear ?? false, readings });
      charById.set(k.char, k.id);
    }
    const qs = buildKanjiRecognitionQuiz(pool, COUNT, Math.random, mode);
    return { questions: qs, charOf: charById };
  }, [level, l1, jft, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState<'quiz' | 'done'>('quiz');
  const [before] = useState(() => progressSnapshot(state, Date.now()));
  const [walletStart] = useState(() => walletPoints(state));
  const [studiedRefs, setStudiedRefs] = useState<{ ref: SaveRef; correct: boolean }[]>([]); // 出題字＋正誤(終了時にまとめて私の単語帳へ)

  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  if (questions.length === 0) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><View style={{ width: 30 }} /></View>
        <View style={s.center}><Text style={s.prompt}>{t('krecog.empty')}</Text><Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('listening2.close')}</Text></Pressable></View>
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
    actions.quizAnswer(q.answerId, ok); // answerId=`${char}#krecog_mean|read`→ char の mean/read 面へ加点
    const id = charOf.get(q.char);
    if (id) setStudiedRefs((prev) => [...prev, { ref: { type: 'kanji', id }, correct: ok }]);
  };
  const advance = () => { if (idx + 1 >= questions.length) { setPhase('done'); return; } setIdx((i) => i + 1); setPicked(null); };

  return (
    <StudyLayout title={t(q.kind === 'mean' ? 'cards.kanji_mean' : 'cards.kanji_read')} current={idx + 1} total={questions.length} onClose={() => nav.goBack()}
      footer={picked !== null ? <AnswerFooter study correct={picked === q.answerIndex} onNext={advance} nextKind={idx + 1 >= questions.length ? 'finish' : 'next'} /> : null}>
        <StudyInstruction>{t(q.kind === 'mean' ? 'krecog.prompt_mean' : 'krecog.prompt_read')}</StudyInstruction>
        <StudyPrompt style={{ alignItems: 'center' }}><Text style={s.bigChar}>{q.char}</Text></StudyPrompt>
        <StudyChoiceList choices={q.choices} selectedIndex={picked} answerIndex={q.answerIndex} revealed={picked !== null} onSelect={onPick} />
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
    bigChar: { fontSize: 96, fontWeight: '800', color: c.ink, lineHeight: 104, textAlign: 'center' },
    cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm, width: '100%' },
    ctaTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
  });
