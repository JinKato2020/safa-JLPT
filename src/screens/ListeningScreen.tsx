// ミニ聴解。会話/独話の音声(Google TTS生成)を聞いて4択で自動採点(重み3)→聴解リング点灯。
// スクリプトは既定で隠す(本物の聴解)。解答後に表示＋解説。採点は quizAnswer(設問id) 流用。掲示板§4(聴解)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { useT } from '../i18n';
import { progressSnapshot } from '../store/selectors';
import SessionSummary from '../components/SessionSummary';
import { listeningItemsFor, listeningAudioIdsFor, type ListeningItem, type PassageQuestion } from '../data';
import { listeningSource, listeningReady } from '../data/listeningAudio';
import ListeningDownloadGate from '../components/ListeningDownloadGate';
import { sample, reinsertForRelearn, shuffleChoices } from '../quiz/quiz';
import { effectiveP } from '../engine/engine';

const SESSION_CLIPS = 3;
const RELEARN_GAP = 2;
const MAX_STEPS = 24;

interface Step { clip: ListeningItem; q: PassageQuestion; qNum: number; qTotal: number; }

// 話者ターン(全角スペース区切り)ごとに改行して読みやすく。
function formatScript(s: string): string {
  return s.split('　').map((t) => t.trim()).filter(Boolean).join('\n');
}

export default function ListeningScreen() {
  const nav = useNavigation();
  const state = useAppState();
  const { quizAnswer } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();

  const [steps, setSteps] = useState<Step[]>(() => {
    const now = Date.now();
    const all = listeningItemsFor(state.settings.level);
    // 未習得(未回答 or p<0.6)の設問を含むクリップを優先→カバー率が確実に進みリングが満ちる。
    const needy = all.filter((cl) => cl.questions.some((q) => { const st = state.items[q.id]; return !st || effectiveP(st, now) < 0.6; }));
    const rest = all.filter((cl) => !needy.includes(cl));
    const clips = [...sample(needy, SESSION_CLIPS), ...sample(rest, SESSION_CLIPS)].slice(0, SESSION_CLIPS);
    return clips.flatMap((cl) => cl.questions.map((q, i) => ({ clip: cl, q: { ...q, ...shuffleChoices(q.choices, q.answerIndex) }, qNum: i + 1, qTotal: cl.questions.length })));
  });
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));
  const [showScript, setShowScript] = useState(false);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => undefined);
    return () => { soundRef.current?.unloadAsync().catch(() => undefined); };
  }, []);

  // 聴解音声がこのレベル分キャッシュ済みか確認。未DLなら開始前にDLゲート(聴解開始時のDL機会・スキップ可)。
  const [audioReady, setAudioReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    listeningReady(listeningAudioIdsFor(state.settings.level))
      .then((r) => { if (alive) setAudioReady(r); })
      .catch(() => { if (alive) setAudioReady(true); });
    return () => { alive = false; };
  }, [state.settings.level]);

  // 解答後は自動で次へ(正解1.5秒/不正解3秒)。※フックは必ず早期returnより前に置く(Rules of Hooks)。自己完結。
  useEffect(() => {
    if (picked === null) return;
    const st = steps[idx];
    if (!st) return;
    const ok = picked === st.q.answerIndex;
    const tmr = setTimeout(() => {
      soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
      setPlaying(false);
      setPicked(null);
      setShowScript(false);
      setIdx((i) => i + 1);
    }, ok ? 1500 : 3000);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, idx]);

  if (audioReady === null) {
    return <SafeAreaView style={s.c}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.blue} /></View></SafeAreaView>;
  }
  if (!audioReady) {
    return <ListeningDownloadGate level={state.settings.level} allowSkip onComplete={() => setAudioReady(true)} />;
  }

  const step = steps[idx];

  const stopSound = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    }
    setPlaying(false);
  };

  const play = async () => {
    if (!step) return;
    const src = await listeningSource(step.clip.id);
    if (!src) return;
    await stopSound();
    try {
      const { sound } = await Audio.Sound.createAsync(src, { shouldPlay: true });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => {
        if (st.isLoaded && st.didJustFinish) setPlaying(false);
      });
    } catch {
      setPlaying(false);
    }
  };

  if (!step) {
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.doneBody}>
          <Text style={s.bigEmoji}>🎉</Text>
          <Text style={s.doneTitle}>{t('listening.done_title')}</Text>
          <Text style={s.doneSub}>{t('listening.done_sub', { answered, correct })}</Text>
          <SessionSummary before={before} after={progressSnapshot(state, Date.now())} streak={state.streak.current} mode="choukai" />
          <Pressable style={s.cta} onPress={() => nav.goBack()}>
            <Text style={s.ctaTxt}>{t('listening.go_home')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const onPick = (i: number) => {
    if (picked !== null) return;
    const ok = i === step.q.answerIndex;
    setPicked(i);
    setShowScript(true); // 解答後にスクリプトを開示(復習用)
    quizAnswer(step.q.id, ok);
    setAnswered((a) => a + 1);
    if (ok) setCorrect((x) => x + 1);
    else if (steps.length < MAX_STEPS) {
      // 不正解は正解するまで後ろに戻す(聴解リングが確実に埋まる)
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
          <Pressable onPress={async () => { await stopSound(); nav.goBack(); }} hitSlop={12}>
            <Text style={s.close}>✕</Text>
          </Pressable>
          <Text style={s.progress}>{idx + 1} / {steps.length}</Text>
        </View>

        <View style={s.clipCard}>
          <Text style={s.clipTitle}>{step.clip.title}</Text>
          <Pressable style={[s.playBtn, playing && s.playBtnOn]} onPress={play}>
            <Text style={[s.playTxt, playing && s.playTxtOn]}>{playing ? t('listening.playing') : t('listening.play')}</Text>
          </Pressable>
          {showScript ? (
            <>
              <Text style={s.script}>{formatScript(step.clip.script)}</Text>
              <Pressable onPress={() => setShowScript(false)} hitSlop={8}>
                <Text style={s.scriptToggle}>{t('listening.script_hide')}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => setShowScript(true)} hitSlop={8}>
              <Text style={s.scriptToggle}>{t('listening.script_show')}</Text>
            </Pressable>
          )}
        </View>

        <Text style={s.qLabel}>{t('listening.q_label', { n: step.qNum, m: step.qTotal })}</Text>
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
          <View style={s.explainBox}>
            <Text style={s.explainTxt}>{step.q.explain}</Text>
          </View>
        ) : (
          <Text style={s.hint}>{t('listening.hint')}</Text>
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
  clipCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  clipTitle: { fontSize: ty.tiny, fontWeight: '800', color: c.choukai, letterSpacing: 1 },
  playBtn: {
    backgroundColor: c.bgSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.choukai,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  playBtnOn: { backgroundColor: c.okBg, borderColor: c.green },
  playTxt: { fontSize: ty.body, fontWeight: '800', color: c.choukai },
  playTxtOn: { color: c.green },
  script: { fontSize: ty.body, color: c.ink2, lineHeight: 26, marginTop: spacing.xs },
  scriptToggle: { fontSize: ty.small, color: c.blue, fontWeight: '700' },
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
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
