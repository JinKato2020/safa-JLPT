// ミニ聴解。会話/独話の音声(Google TTS生成)を聞いて4択で自動採点(重み3)→聴解リング点灯。
// スクリプトは既定で隠す(本物の聴解)。解答後に表示＋解説。採点は quizAnswer(設問id) 流用。掲示板§4(聴解)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { useT } from '../i18n';
import { progressSnapshot } from '../store/selectors';
import SessionSummary from '../components/SessionSummary';
import { listeningItemsFor, listeningItemsForSub, type ListeningItem, type PassageQuestion } from '../data';
import type { RootStackParamList } from '../navigation/types';
import { listeningSource } from '../data/listeningAudio';
import { illustSource } from '../data/listeningImage';
import { sample, reinsertForRelearn, shuffleChoices } from '../quiz/quiz';
import { effectiveP } from '../engine/engine';

const SESSION_CLIPS = 3;
const RELEARN_GAP = 2;
const MAX_STEPS = 24;

interface ClipStep { clip: ListeningItem; qs: PassageQuestion[]; } // 1音声＝1ページ。その音声の全設問を同ページに。

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
  const route = useRoute<RouteProp<RootStackParamList, 'Listening'>>();
  const subtype = route.params?.subtype; // 学習タブの小区分から来た場合はその区分だけ出題

  const [steps, setSteps] = useState<ClipStep[]>(() => {
    const now = Date.now();
    const all = subtype ? listeningItemsForSub(state.settings.level, subtype) : listeningItemsFor(state.settings.level);
    // 未習得(未回答 or p<0.6)の設問を含むクリップを優先→カバー率が確実に進みリングが満ちる。
    const needy = all.filter((cl) => cl.questions.some((q) => { const st = state.items[q.id]; return !st || effectiveP(st, now) < 0.6; }));
    const rest = all.filter((cl) => !needy.includes(cl));
    const clips = [...sample(needy, SESSION_CLIPS), ...sample(rest, SESSION_CLIPS)].slice(0, SESSION_CLIPS);
    // 1クリップ＝1ページ。その音声の全設問をまとめて持つ。
    // 通常はテキスト4択をシャッフル。発話/即時(audioChoices)は選択肢が音声で順番に流れるため、番号と一致させるべくシャッフルしない。
    return clips.map((cl) => ({ clip: cl, qs: cl.questions.map((q) => (cl.audioChoices ? { ...q } : { ...q, ...shuffleChoices(q.choices, q.answerIndex) })) }));
  });
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>([]); // 現クリップの設問ごとの選択(qIndex→choiceIndex)
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

  // 聴解音声の取得方式: 配信(都度ストリーミング)/一括DL(オフライン)。未設定→download(従来挙動)。
  const stream = state.settings.listeningAudioMode === 'stream';

  // 音声は「問題ごとに再生時オンデマンドDL＋キャッシュ」。事前一括DLゲートは出さない。

  // 発話表現イラスト: 問題表示時にオンデマンドDL→キャッシュ(同梱しない)。
  const [imgUri, setImgUri] = useState<string | null>(null);
  useEffect(() => {
    const clip = steps[idx]?.clip;
    if (!clip?.illust) { setImgUri(null); return; }
    let alive = true;
    setImgUri(null);
    illustSource(clip.illust).then((u) => { if (alive) setImgUri(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, [idx, steps]);

  // クリップの全設問に答えたら自動で次へ(全問正解1.5秒/誤答あり3秒)。※フックは早期returnの前(Rules of Hooks)。
  useEffect(() => {
    const st = steps[idx];
    if (!st || st.qs.length === 0) return;
    const allDone = st.qs.every((_, qi) => picked[qi] != null);
    if (!allDone) return;
    const anyWrong = st.qs.some((q, qi) => picked[qi] !== q.answerIndex);
    const tmr = setTimeout(() => {
      soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
      setPlaying(false);
      if (anyWrong && steps.length < MAX_STEPS) {
        // 誤答があったクリップは後ろに再挿入(できるまで)。
        setSteps((arr) => { const head = arr.slice(0, idx + 1); const tail = reinsertForRelearn(arr.slice(idx + 1), st, RELEARN_GAP); return [...head, ...tail]; });
      }
      setPicked([]);
      setShowScript(false);
      setIdx((i) => i + 1);
    }, anyWrong ? 3000 : 1500);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, idx]);

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
    const src = await listeningSource(step.clip.id, { stream });
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

  // 設問qiの選択ci。同ページの各設問を個別にタップ。再挿入はクリップ完了時(effect)でまとめて判定。
  const onPick = (qi: number, ci: number) => {
    if (picked[qi] != null) return;
    const q = step.qs[qi];
    const ok = ci === q.answerIndex;
    setPicked((p) => { const n = [...p]; n[qi] = ci; return n; });
    setShowScript(true); // 解答後にスクリプト開示(復習用)
    quizAnswer(q.id, ok);
    setAnswered((a) => a + 1);
    if (ok) setCorrect((x) => x + 1);
  };

  const isAudioChoices = !!step.clip.audioChoices; // 発話/即時=本文＋選択肢を音声で再生、画面は番号で選ぶ
  const isHatsuwa = !isAudioChoices && !!step.clip.illust; // (旧)発話表現=イラスト＋場面文、音声なし
  const anyPicked = picked.some((p) => p != null);

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
          {isAudioChoices ? (
            <>
              {step.clip.illust ? (
                imgUri ? (
                  <Image source={{ uri: imgUri }} style={s.hatsuwaImg} resizeMode="contain" />
                ) : (
                  <View style={s.hatsuwaImgPh}><ActivityIndicator color={c.blue} /></View>
                )
              ) : null}
              <Pressable style={[s.playBtn, playing && s.playBtnOn]} onPress={play}>
                <Text style={[s.playTxt, playing && s.playTxtOn]}>{playing ? t('listening.playing') : t('listening.play')}</Text>
              </Pressable>
              {anyPicked ? <Text style={s.script}>{step.clip.script}</Text> : null}
            </>
          ) : isHatsuwa ? (
            <>
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={s.hatsuwaImg} resizeMode="contain" />
              ) : (
                <View style={s.hatsuwaImgPh}><ActivityIndicator color={c.blue} /></View>
              )}
              <Text style={s.hatsuwaScene}>{step.clip.script}</Text>
            </>
          ) : step.clip.audio ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={s.devNote}>{t('listening.dev_text')}</Text>
              <Text style={s.script}>{formatScript(step.clip.script)}</Text>
            </>
          )}
        </View>

        {step.qs.length === 0 || picked.length === 0 ? <Text style={s.hint}>{t(isHatsuwa ? 'listening.hint_hatsuwa' : step.clip.audio ? 'listening.hint' : 'listening.dev_text')}</Text> : null}
        {/* 1音声の全設問を同ページに。各設問を個別タップ→正誤表示→全問終わると自動で次へ。 */}
        {step.qs.map((q, qi) => {
          const reveal = picked[qi] != null;
          return (
            <View key={qi} style={s.qBlock}>
              {step.qs.length > 1 ? <Text style={s.qLabel}>{t('listening.q_label', { n: qi + 1, m: step.qs.length })}</Text> : null}
              {q.q ? <Text style={s.qText}>{q.q}</Text> : null}
              <View style={s.choices}>
                {q.choices.map((ch, ci) => {
                  const isAnswer = ci === q.answerIndex;
                  const isPicked = ci === picked[qi];
                  return (
                    <Pressable
                      key={ci}
                      style={[s.choice, isAudioChoices && !reveal && s.choiceNum, reveal && isAnswer && s.choiceCorrect, reveal && isPicked && !isAnswer && s.choiceWrong]}
                      onPress={() => onPick(qi, ci)}
                      disabled={reveal}
                    >
                      {isAudioChoices ? (
                        <View style={s.numRow}>
                          <Text style={s.numBadge}>{ci + 1}</Text>
                          {reveal ? <Text style={s.choiceTxt}>{ch}</Text> : null}
                        </View>
                      ) : (
                        <Text style={s.choiceTxt}>{ch}</Text>
                      )}
                      {reveal && isAnswer ? <Text style={s.mark}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
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
  devNote: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.xs, fontStyle: 'italic' },
  hatsuwaImg: { width: '100%', maxWidth: 260, aspectRatio: 1, alignSelf: 'center', borderRadius: radius.md, backgroundColor: '#ffffff', marginTop: spacing.xs },
  hatsuwaImgPh: { width: '100%', maxWidth: 260, aspectRatio: 1, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  hatsuwaScene: { fontSize: ty.body, color: c.ink, lineHeight: 24, marginTop: spacing.sm },
  scriptToggle: { fontSize: ty.small, color: c.blue, fontWeight: '700' },
  qBlock: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
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
  choiceNum: { justifyContent: 'center', paddingVertical: spacing.lg }, // 番号のみ表示時は中央・やや高め
  numRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  numBadge: { fontSize: ty.h1, fontWeight: '800', color: c.choukai, minWidth: 28, textAlign: 'center' },
  choiceCorrect: { borderColor: c.green, backgroundColor: c.okBg },
  choiceWrong: { borderColor: c.red, backgroundColor: c.ngBg },
  choiceTxt: { fontSize: ty.body, color: c.ink2, flex: 1 },
  mark: { color: c.green, fontWeight: '800', fontSize: ty.h2 },
  cta: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  ctaTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
