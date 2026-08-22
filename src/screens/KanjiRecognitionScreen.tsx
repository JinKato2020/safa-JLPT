// 漢字認識テスト(モーダル)。字を単独提示→意味/読みを4択(文脈文なし)。設計正本=段階B①。
// 音声なし。結果は char の mean/read 面へ計上(quizAnswer の answerId=`${char}#krecog_*`→facetMap)。
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import type { SaveRef } from '../store/state';
import { progressSnapshot } from '../store/selectors';
import AfterStudyReward from '../components/AfterStudyReward';
import AnswerFooter from '../components/AnswerFooter';
import { walletPoints } from '../store/wallet';
import { resolveStudiedWords } from '../data/studiedWords';
import { KANJI, cardFaceReadings, meaningIn } from '../data';
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
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const state = useAppState();
  const actions = useAppActions();
  const c = useColors();
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
      const readings = cardFaceReadings(k.char, level).map((r) => ({ type: r.type, reading: r.reading }));
      pool.push({ char: k.char, meaning, meaningClear: FLAGS[k.char]?.meaningClear ?? false, readings });
      charById.set(k.char, k.id);
    }
    const qs = buildKanjiRecognitionQuiz(pool, COUNT, Math.random);
    return { questions: qs, charOf: charById };
  }, [level, l1, jft]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><Text style={s.headTitle}>{idx + 1} / {questions.length}</Text><View style={{ width: 30 }} /></View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.prompt}>{t(q.kind === 'mean' ? 'krecog.prompt_mean' : 'krecog.prompt_read')}</Text>
        <View style={s.charCard}><Text style={s.bigChar}>{q.char}</Text></View>
        <View style={s.choices}>
          {q.choices.map((ch, i) => {
            const isAns = i === q.answerIndex; const isPk = i === picked;
            return (
              <Pressable key={i} onPress={() => onPick(i)} disabled={reveal} style={[s.choice, reveal && isAns && s.choiceOk, reveal && isPk && !isAns && s.choiceNg]}>
                <Text style={s.choiceTxt}>{ch}</Text>
                {reveal && isAns ? <Text style={s.mark}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {reveal && <AnswerFooter correct={picked === q.answerIndex} onNext={advance} nextKind={idx + 1 >= questions.length ? 'finish' : 'next'} />}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    headTitle: { fontSize: ty.small, fontWeight: '700', color: c.mute },
    close: { fontSize: 30, color: c.mute, fontWeight: '700' },
    body: { padding: spacing.lg, gap: spacing.sm },
    doneBody: { padding: spacing.xl, gap: spacing.sm, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    prompt: { fontSize: ty.body, fontWeight: '700', color: c.ink, textAlign: 'center' },
    charCard: { alignSelf: 'center', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.xl, paddingHorizontal: spacing.xl, marginVertical: spacing.sm, minWidth: 160, alignItems: 'center' },
    bigChar: { fontSize: 96, fontWeight: '800', color: c.ink, lineHeight: 104, textAlign: 'center' },
    choices: { gap: spacing.sm + 2, marginTop: spacing.sm },
    choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    choiceOk: { borderColor: c.green, backgroundColor: c.okBg },
    choiceNg: { borderColor: c.red, backgroundColor: c.ngBg },
    choiceTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink2, flex: 1 },
    mark: { color: c.green, fontWeight: '800', fontSize: ty.h2 },
    cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm, width: '100%' },
    ctaTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
  });
