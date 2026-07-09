// 聞き取りドリル(モーダル)。学習(10件予習)→テスト(音声4択)→スコア。語彙=意味/漢字=字。
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { levelListFor } from '../words/levelList';
import { KANJI, meaningIn } from '../data';
import { playVocab, playKanjiRep } from '../data/vocabAudio';
import kanjiDrillReps from '../data/kanjiDrillReps.json';
import { pickItems, buildVocabQuiz, buildKanjiQuiz, type LQItem, type KanjiRep } from '../listening/listeningQuiz';
import type { RootStackParamList } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const COUNT = 10;
type StudyRow = { key: string; main: string; sub: string; meaning: string; play: () => void };

export default function ListeningQuizScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'ListeningQuiz'>>();
  const kind = route.params?.kind ?? 'vocab';
  const state = useAppState();
  const actions = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const l1 = state.settings.l1;
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
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><Text style={s.headTitle}>{t(kind === 'vocab' ? 'listening2.vocab_title' : 'listening2.kanji_title')}</Text><View style={{ width: 30 }} /></View>
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.studyH}>{t('listening2.study_title')}</Text>
          {rows.map((r) => (
            <View key={r.key} style={s.studyRow}>
              <View style={{ flex: 1 }}><Text style={s.studySub}>{r.sub}</Text><Text style={s.studyMain}>{r.main}</Text><Text style={s.studyMeaning}>{r.meaning}</Text></View>
              <Pressable style={s.studyPlay} hitSlop={8} onPress={r.play}><Ionicons name="play" size={22} color={c.blue} /></Pressable>
            </View>
          ))}
          <Pressable style={s.cta} onPress={() => { setPhase('quiz'); setIdx(0); setPicked(null); }}><Text style={s.ctaTxt}>{t('listening2.start_btn')}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'done') {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><View style={{ width: 30 }} /></View>
        <View style={s.center}><Text style={s.bigEmoji}>🎧</Text><Text style={s.doneTitle}>{t('listening2.done_title')}</Text><Text style={s.doneScore}>{t('listening2.score', { correct, total: questions.length })}</Text><Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('listening2.close')}</Text></Pressable></View>
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
  };
  const advance = () => { if (idx + 1 >= questions.length) { setPhase('done'); return; } setIdx((i) => i + 1); setPicked(null); };
  const bigChoice = kind === 'kanji';

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><Text style={s.headTitle}>{idx + 1} / {questions.length}</Text><View style={{ width: 30 }} /></View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.prompt}>{t(kind === 'vocab' ? 'listening2.prompt_vocab' : 'listening2.prompt_kanji')}</Text>
        <Pressable style={s.playBig} onPress={() => play(q.audioVocabId, q.audioReading, q.audioChar)}><Ionicons name="volume-high" size={40} color="#fff" /></Pressable>
        <Pressable style={s.playAgain} hitSlop={8} onPress={() => play(q.audioVocabId, q.audioReading, q.audioChar)}><Text style={s.playAgainTxt}>{t('listening2.again')}</Text></Pressable>
        <View style={s.choices}>
          {q.choices.map((ch, i) => {
            const reveal = picked !== null; const isAns = i === q.answerIndex; const isPk = i === picked;
            return (
              <Pressable key={i} onPress={() => onPick(i)} disabled={reveal} style={[bigChoice ? s.choiceKanji : s.choice, reveal && isAns && s.choiceOk, reveal && isPk && !isAns && s.choiceNg]}>
                <Text style={bigChoice ? s.choiceKanjiTxt : s.choiceTxt}>{ch}</Text>
              </Pressable>
            );
          })}
        </View>
        {picked !== null ? (
          <>
            <Text style={[s.judge, picked === q.answerIndex ? s.judgeOk : s.judgeNg]}>{picked === q.answerIndex ? t('listening2.correct') : t('listening2.wrong')}</Text>
            <Pressable style={s.cta} onPress={advance}><Text style={s.ctaTxt}>{idx + 1 >= questions.length ? t('listening2.close') : t('listening2.next')}</Text></Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    headTitle: { fontSize: ty.small, fontWeight: '700', color: c.mute },
    close: { fontSize: 30, color: c.mute, fontWeight: '700' },
    body: { padding: spacing.lg, gap: spacing.md },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    studyH: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    studyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    studySub: { fontSize: ty.tiny, color: c.mute },
    studyMain: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    studyMeaning: { fontSize: ty.small, color: c.ink2 },
    studyPlay: { padding: spacing.sm },
    prompt: { fontSize: ty.body, fontWeight: '700', color: c.ink, textAlign: 'center' },
    playBig: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md },
    playAgain: { alignSelf: 'center' },
    playAgainTxt: { fontSize: ty.small, color: c.blue, fontWeight: '700' },
    choices: { gap: spacing.sm + 2, marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    choice: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, alignItems: 'center', width: '100%' },
    choiceKanji: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', width: '46%', aspectRatio: 1 },
    choiceOk: { borderColor: c.green, backgroundColor: c.okBg },
    choiceNg: { borderColor: c.red, backgroundColor: c.bgSoft },
    choiceTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink },
    choiceKanjiTxt: { fontSize: 48, fontWeight: '800', color: c.ink },
    judge: { fontSize: ty.h2, fontWeight: '800', textAlign: 'center', marginTop: spacing.md },
    judgeOk: { color: c.green }, judgeNg: { color: c.red },
    cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg, width: '100%' },
    ctaTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
    bigEmoji: { fontSize: 56 }, doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink }, doneScore: { fontSize: ty.h2, fontWeight: '700', color: c.ink2 },
  });
