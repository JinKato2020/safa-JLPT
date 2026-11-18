import StudyAudioButton from '../components/StudyAudioButton';
import { useStudyColors } from '../components/StudyPresentation';
import StudyLayout from '../components/StudyLayout';
import StudyChoiceList from '../components/StudyChoiceList';
import { StudyInstruction } from '../components/StudyPrompt';
// 聞き取りドリル(モーダル)。学習(10件予習)→テスト(音声4択)→スコア。語彙=意味/漢字=字。
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { spacing, radius, type as ty, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { type SaveRef } from '../store/state';
import { progressSnapshot } from '../store/selectors';
import AfterStudyReward from '../components/AfterStudyReward';
import AnswerFooter from '../components/AnswerFooter';
import { walletPoints } from '../store/wallet';
import { resolveStudiedWords } from '../data/studiedWords';
import { levelListFor } from '../words/levelList';
import { KANJI, meaningIn } from '../data';
import { playVocab, playKanjiRep } from '../data/vocabAudio';
import kanjiDrillReps from '../data/words/kanjiDrillReps.json';
import { pickItems, buildVocabQuiz, buildKanjiQuiz, type LQItem, type KanjiRep } from '../listening/listeningQuiz';
import type { RootStackParamList } from '../navigation/types';
import { useT, meaningL1 } from '../i18n';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const COUNT = 10;
type StudyRow = { key: string; main: string; sub: string; meaning: string; play: () => void };

export default function ListeningQuizScreen() {
  const nav = useNavigation<Nav>();
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const route = useRoute<RouteProp<RootStackParamList, 'ListeningQuiz'>>();
  const kind = route.params?.kind ?? 'vocab';
  const state = useAppState();
  const actions = useAppActions();
  const c = useStudyColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const l1 = meaningL1(state.settings);
  const level = state.settings.level;

  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);

  // 1問がvocabIdとkanji char(mp3)を両方持つことは無い(kanji mp3は語彙に無い158字のみ収録)ため、
  // 下のvocab→TTS / kanji→TTSの分岐は排他的であり、フォールバック先のTTSが常に最終段として正しい。
  const play = (vocabId: string | null, reading: string, char?: string) => {
    const fallback = () => { Speech.stop(); if (reading) Speech.speak(reading, { language: 'ja-JP' }); };
    Speech.stop(); // 連打による発話の重なり・キューイングを防止
    if (vocabId) playVocab(vocabId).then((ok) => { if (!ok) fallback(); });
    else if (char) playKanjiRep(char).then((ok) => { if (!ok) fallback(); });
    else fallback();
  };

  // 出題(セッション固定)。学習行＋テスト問題を同一10件から生成。学習行の再生は対応する設問と同じ音声(questions[i])を使う。
  const built = useMemo(() => {
    if (kind === 'vocab') {
      const pool: LQItem[] = (levelListFor('vocab', level) as { id: string; word: string; reading: string; meaning: string }[])
        .filter((v) => !/[～~]/.test(v.word) && v.word !== 'では') // 非自立語(接辞/助詞)は音声出題に不適
        .map((v) => ({ id: v.id, word: v.word, reading: v.reading, meaning: (l1 && l1 !== 'en' ? meaningIn(v.id, l1) : undefined) ?? v.meaning }));
      const items = pickItems(pool, COUNT, Math.random);
      const questions = buildVocabQuiz(items, pool, Math.random);
      const rows: StudyRow[] = items.map((it, i) => ({ key: it.id, main: it.word, sub: it.reading, meaning: it.meaning, play: () => play(questions[i].audioVocabId, questions[i].audioReading, questions[i].audioChar) }));
      return { questions, rows };
    }
    const reps = kanjiDrillReps as Record<string, { level: string; bound: boolean; word: string; reading: string }>;
    const pool: KanjiRep[] = KANJI.filter((k) => k.type === 'kanji' && k.level === level && reps[k.char])
      .map((k) => ({ id: k.id, char: k.char, level: k.level, bound: reps[k.char].bound, word: reps[k.char].word, reading: reps[k.char].reading }));
    const items = pickItems(pool, COUNT, Math.random);
    const questions = buildKanjiQuiz(items, pool, Math.random);
    const meaningOf = (id: string, ch: string) => (l1 && l1 !== 'en' ? meaningIn(ch, l1) : undefined) ?? (KANJI.find((k) => k.id === id)?.meaning ?? '');
    const rows: StudyRow[] = items.map((it, i) => ({
      key: it.id,
      main: it.char,
      sub: it.bound ? it.reading : `${it.word}（${it.reading}）`,
      meaning: meaningOf(it.id, it.char),
      play: () => play(questions[i].audioVocabId, questions[i].audioReading, questions[i].audioChar),
    }));
    return { questions, rows };
  }, [kind, level, l1]);

  const questions = built.questions;
  const rows = built.rows;
  const [phase, setPhase] = useState<'study' | 'quiz' | 'done'>('study');
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));
  const [walletStart] = useState(() => walletPoints(state));
  const [studiedRefs, setStudiedRefs] = useState<{ ref: SaveRef; correct: boolean }[]>([]); // この回の学習語＋正誤(終了時にまとめて私の単語帳へ)

  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  if (questions.length === 0) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><View style={{ width: 30 }} /></View>
        <View style={s.center}><Text style={s.prompt}>{t('listening2.done_title')}</Text><Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('listening2.close')}</Text></Pressable></View>
      </SafeAreaView>
    );
  }

  if (phase === 'study') {
    return (
      <StudyLayout title={t(kind === 'vocab' ? 'listening2.vocab_title' : 'listening2.kanji_title')} current={0} total={rows.length}
        scrollKey="preview" onClose={() => nav.goBack()}
        footer={<AnswerFooter study label={t('listening2.start_btn')} onNext={() => { setPhase('quiz'); setIdx(0); setPicked(null); }} />}>
          <Text style={s.studyH}>{t('listening2.study_title')}</Text>
          {rows.map((r) => {
            const inner = (
              <>
                <View style={{ flex: 1 }}><Text style={s.studySub}>{r.sub}</Text><Text style={s.studyMain}>{r.main}</Text><Text style={s.studyMeaning}>{r.meaning}</Text></View>
                <Pressable style={s.studyPlay} hitSlop={8} onPress={r.play}><Ionicons name="play" size={22} color={c.blue} /></Pressable>
                {kind === 'kanji' ? <Ionicons name="chevron-forward" size={18} color={c.faint} /> : null}
              </>
            );
            // 漢字の聞き取りは学習カードのタップで漢字詳細(全読み・例語・書き取り導線)へ。再生ボタンは入れ子Pressableで別動作。
            return kind === 'kanji' ? (
              <Pressable key={r.key} style={s.studyRow} onPress={() => nav.navigate('KanjiDetail', { char: r.main })}>{inner}</Pressable>
            ) : (
              <View key={r.key} style={s.studyRow}>{inner}</View>
            );
          })}
      </StudyLayout>
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
  const onPick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.answerIndex;
    if (ok) setCorrect((n) => n + 1);
    actions.quizAnswer(q.answerId, ok);
    const r = rows[idx];
    if (r?.key) setStudiedRefs((prev) => [...prev, { ref: { type: kind === 'vocab' ? 'vocab' : 'kanji', id: r.key }, correct: ok }]); // 学習語＋正誤を蓄積
  };
  const advance = () => { if (idx + 1 >= questions.length) { setPhase('done'); return; } setIdx((i) => i + 1); setPicked(null); };
  const bigChoice = kind === 'kanji';

  return (
    <StudyLayout title={t('cards.listening')} current={idx + 1} total={questions.length} onClose={() => nav.goBack()}
      footer={picked !== null ? <AnswerFooter study correct={picked === q.answerIndex} onNext={advance} nextKind={idx + 1 >= questions.length ? 'finish' : 'next'} /> : null}>
        <StudyInstruction>{t(kind === 'vocab' ? 'listening2.prompt_vocab' : 'listening2.prompt_kanji')}</StudyInstruction>
        <StudyAudioButton label={t('listening.play')} onPress={() => play(q.audioVocabId, q.audioReading, q.audioChar)} />
        <Pressable style={s.playAgain} hitSlop={8} onPress={() => play(q.audioVocabId, q.audioReading, q.audioChar)}><Text style={s.playAgainTxt}>{t('listening2.again')}</Text></Pressable>
        <StudyChoiceList choices={q.choices} selectedIndex={picked} answerIndex={q.answerIndex} revealed={picked !== null} onSelect={onPick} layout={bigChoice ? 'grid' : 'list'} />
        {picked !== null && rows[idx] ? (
          <Text style={s.reveal}>✓ {rows[idx].main && rows[idx].main !== rows[idx].sub ? `${rows[idx].main}（${rows[idx].sub}）` : rows[idx].sub}</Text>
        ) : null}
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
    studyH: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    studyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    studySub: { fontSize: ty.tiny, color: c.mute },
    studyMain: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    studyMeaning: { fontSize: ty.small, color: c.ink2 },
    studyPlay: { padding: spacing.sm },
    prompt: { fontSize: ty.body, fontWeight: '700', color: c.ink, textAlign: 'center' },
    playAgain: { alignSelf: 'center' },
    playAgainTxt: { fontSize: ty.small, color: c.blue, fontWeight: '700' },
    reveal: { fontSize: ty.h2, fontWeight: '800', color: c.green, textAlign: 'center' },
    cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm, width: '100%' },
    ctaTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
  });
