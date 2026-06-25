// ミニ模試(言語知識20問) / フル模試(全区分=漢字語彙＋文法＋読解＋聴解)。本番形式・客観採点(重み5)。
// 採点後: 区分別の弱点ヒートマップ → 語彙/文法の弱点だけ復習(Quiz)へ。掲示板§5(UWorld閉ループ)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { useT } from '../i18n';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { guessCorrect, jftMockScore } from '../store/selectors';
import { dayStr } from '../store/state';
import { examWordsFor, allWordsFor, examReadingFor, examListeningFor } from '../data';
import { listeningSource } from '../data/listeningAudio';
import { sendMock } from '../telemetry/telemetry';
import { makeQuestion, sample, shuffleChoices, type ExampleHint } from '../quiz/quiz';
import type { StudyItem } from '../data';
import type { Level } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Sec = 'moji_goi' | 'bunpou' | 'dokkai' | 'choukai';
type Styles = ReturnType<typeof makeStyles>;

const MINI_SIZE = 20;
const VOCAB_RATIO = 0.6;
const SEC_ORDER: Sec[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const SEC_LABEL: Record<Sec, string> = { moji_goi: 'mock.sec_moji_goi', bunpou: 'mock.sec_bunpou', dokkai: 'mock.sec_dokkai', choukai: 'mock.sec_choukai' };
// JFTのセクション名(①文字と語彙②会話と表現③聴解④読解)。
const JFT_SEC_LABEL: Record<Sec, string> = { moji_goi: 'exam.jft_cat_moji', bunpou: 'exam.jft_cat_hyougen', dokkai: 'mock.sec_dokkai', choukai: 'mock.sec_choukai' };
// 1問あたりの持ち時間(秒)。本番のペースを縮約。フル模試(言語知識10+読解4+聴解4)=10×40+4×110+4×90=1200秒=20分。
// ※変更時は i18n の test.full_time / touroverlay.test_full_time(分表示)も合わせること。
const SEC_SECONDS: Record<Sec, number> = { moji_goi: 40, bunpou: 40, dokkai: 110, choukai: 90 };

interface MockItem {
  kind: 'word' | 'reading' | 'listening';
  id: string;
  section: Sec;
  question: string;
  choices: string[];
  answerIndex: number;
  prompt?: string;
  reading?: string;
  example?: ExampleHint;
  title?: string;
  body?: string;
  clipId?: string;
  script?: string;
  explain?: string;
}
interface Answer { id: string; section: Sec; correct: boolean; label: string; drillable: boolean; }

type Seen = Record<string, unknown>; // state.items(学習済の項目)

/** 未学習(初見)を優先して n 件抽出。足りなければ学習済で補充＝模試は「答えを知らない問題」を優先。 */
function pickFresh<T>(pool: T[], isSeen: (x: T) => boolean, n: number): T[] {
  const fresh = sample(pool.filter((x) => !isSeen(x)), n);
  if (fresh.length >= n) return fresh;
  return [...fresh, ...sample(pool.filter(isSeen), n - fresh.length)];
}
// levels: JLPT=[選択級] / JFT=['N5','N4'](A1+A2を難易度混在で出題)。
function wordItems(levels: Level[], n: number, seen: Seen): MockItem[] {
  const vocab = levels.flatMap((lv) => examWordsFor(lv, 'moji_goi')); // 模試専用(初見)
  const gram = levels.flatMap((lv) => examWordsFor(lv, 'bunpou'));
  const nV = Math.round(n * VOCAB_RATIO);
  const picked: StudyItem[] = [
    ...pickFresh(vocab, (i) => !!seen[i.id], nV),
    ...pickFresh(gram, (i) => !!seen[i.id], n - nV),
  ];
  const all = levels.flatMap((lv) => [...allWordsFor(lv, 'moji_goi'), ...allWordsFor(lv, 'bunpou')]); // 誤答候補は全語から
  return sample(picked, picked.length).map((item) => {
    const q = makeQuestion(item, all);
    return {
      kind: 'word', id: item.id, section: item.category as Sec,
      question: q.question, choices: q.choices, answerIndex: q.answerIndex, prompt: q.prompt, reading: q.reading, example: q.example,
    };
  });
}
function readingItems(levels: Level[], nPassages: number, seen: Seen): MockItem[] {
  const picked = pickFresh(levels.flatMap((lv) => examReadingFor(lv)), (p) => p.questions.some((q) => !!seen[q.id]), nPassages);
  return picked.flatMap((p) =>
    p.questions.map((q) => {
      const sc = shuffleChoices(q.choices, q.answerIndex);
      return {
        kind: 'reading' as const, id: q.id, section: 'dokkai' as Sec,
        title: p.title, body: p.body, question: q.q, choices: sc.choices, answerIndex: sc.answerIndex, explain: q.explain,
      };
    }),
  );
}
function listeningItems(levels: Level[], nClips: number, seen: Seen): MockItem[] {
  const picked = pickFresh(levels.flatMap((lv) => examListeningFor(lv)), (cl) => cl.questions.some((q) => !!seen[q.id]), nClips);
  return picked.flatMap((cl) =>
    cl.questions.map((q) => {
      const sc = shuffleChoices(q.choices, q.answerIndex);
      return {
        kind: 'listening' as const, id: q.id, section: 'choukai' as Sec,
        title: cl.title, clipId: cl.id, script: cl.script, question: q.q, choices: sc.choices, answerIndex: sc.answerIndex, explain: q.explain,
      };
    }),
  );
}
// JFT模試は4セクションを必ず含む＝本番構成。出題はJFT公式順 ①文字と語彙②会話と表現③聴解④読解 にグループ化(セクション不可逆の本番再現)。
const JFT_SEC_ORDER: Record<Sec, number> = { moji_goi: 0, bunpou: 1, choukai: 2, dokkai: 3 };
function buildExam(levels: Level[], full: boolean, jft: boolean, seen: Seen): MockItem[] {
  if (jft) {
    const items = [...wordItems(levels, 12, seen), ...readingItems(levels, 4, seen), ...listeningItems(levels, 4, seen)];
    return items.sort((a, b) => JFT_SEC_ORDER[a.section] - JFT_SEC_ORDER[b.section]); // セクション順(安定ソート=区分内は維持)
  }
  if (!full) return wordItems(levels, MINI_SIZE, seen);
  return [...wordItems(levels, 10, seen), ...readingItems(levels, 2, seen), ...listeningItems(levels, 2, seen)];
}

function mmss(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function formatScript(s: string): string {
  return s.split('　').map((t) => t.trim()).filter(Boolean).join('\n');
}

export default function MockScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Mock'>>();
  const full = route.params?.full ?? false;
  const state = useAppState();
  const { mockAnswer, recordMockResult } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);

  const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const [exam] = useState<MockItem[]>(() => buildExam(isJft ? ['N5', 'N4'] : [state.settings.level], full, isJft, state.items));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [phase, setPhase] = useState<'exam' | 'result'>('exam');
  const [playing, setPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0); // 現在の聴解問題の再生回数(JFTは2回まで)
  const [reveal2, setReveal2] = useState(false); // 解答後のスクリプト/解説
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordedRef = useRef(false);
  const [prevMock] = useState(() => {
    const h = (state.mockHistory ?? []).filter((m) => m.full === full);
    return h.length ? h[h.length - 1] : null;
  });

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => undefined);
    return () => { soundRef.current?.unloadAsync().catch(() => undefined); };
  }, []);

  // 結果到達時に採点を1回だけ記録(成長可視化用)。
  useEffect(() => {
    if (phase !== 'result' || recordedRef.current || answers.length === 0) return;
    recordedRef.current = true;
    const correctN = answers.filter((a) => a.correct).length;
    const now = Date.now();
    recordMockResult({ ts: now, day: dayStr(now), pct: Math.round((100 * correctN) / answers.length), correct: correctN, total: answers.length, full });
    // 匿名計測: 模試結果(区分別%・タイムオーバー・所要)を送信。
    const byc: Record<string, { c: number; t: number }> = {};
    for (const a of answers) { (byc[a.section] ||= { c: 0, t: 0 }).t++; if (a.correct) byc[a.section].c++; }
    const sections: Record<string, number | null> = {};
    for (const k of ['moji_goi', 'bunpou', 'dokkai', 'choukai']) sections[k] = byc[k] ? Math.round((100 * byc[k].c) / byc[k].t) : null;
    void sendMock({ level: state.settings.level, full, pct: Math.round((100 * correctN) / answers.length), sections, timedOut, elapsedSec: Math.round(((endedAt ?? now) - startedAt) / 1000) });
  }, [phase]);

  const cur = exam[idx];
  useEffect(() => { setPlayCount(0); }, [idx]); // 問題が変わったら再生回数リセット
  const byCat = useMemo(() => {
    const out: Record<string, { c: number; t: number }> = {};
    for (const a of answers) { (out[a.section] ||= { c: 0, t: 0 }).t++; if (a.correct) out[a.section].c++; }
    return out;
  }, [answers]);

  // 解答後に自動で次へ(語=短め / 読解=正解を見せて長め)。聴解は再生・スクリプト確認のため手動。
  useEffect(() => {
    if (phase !== 'exam' || picked === null || !cur || cur.kind === 'listening') return;
    const isCorrect = picked === cur.answerIndex;
    const delay = cur.kind === 'word' ? (isCorrect ? 850 : 1600) : isCorrect ? 2000 : 3200;
    const t = setTimeout(() => {
      setPicked(null);
      setReveal2(false);
      if (idx + 1 >= exam.length) { setEndedAt(Date.now()); setPhase('result'); } else setIdx((i) => i + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [picked]);

  const stopSound = async () => {
    if (soundRef.current) { await soundRef.current.unloadAsync().catch(() => undefined); soundRef.current = null; }
    setPlaying(false);
  };
  const JFT_LISTEN_MAX = 2; // JFT本番=聴解は2回まで再生
  const play = async () => {
    if (!cur || !cur.clipId) return;
    if (isJft && cur.kind === 'listening' && playCount >= JFT_LISTEN_MAX) return; // 2回制限
    const src = await listeningSource(cur.clipId);
    if (!src) return;
    await stopSound();
    try {
      const { sound } = await Audio.Sound.createAsync(src, { shouldPlay: true });
      soundRef.current = sound;
      setPlaying(true);
      setPlayCount((n) => n + 1);
      sound.setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => { if (st.isLoaded && st.didJustFinish) setPlaying(false); });
    } catch { setPlaying(false); }
  };

  // 制限時間カウントダウン＋タイムオーバー(時間切れ＝未解答を不正解として自動採点→結果へ)。本番形式の時間制約。
  const limitMs = useMemo(() => exam.reduce((acc, it) => acc + (SEC_SECONDS[it.section] ?? 60) * 1000, 0), [exam]);
  const [remainingMs, setRemainingMs] = useState(limitMs);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (phase !== 'exam') return;
    const deadline = startedAt + limitMs;
    const tick = () => {
      const r = deadline - Date.now();
      if (r > 0) { setRemainingMs(r); return; }
      setRemainingMs(0);
      setTimedOut(true);
      void stopSound();
      setAnswers((prev) => {
        const done = new Set(prev.map((a) => a.id));
        const miss = exam
          .filter((it) => !done.has(it.id))
          .map((it) => ({ id: it.id, section: it.section, correct: false, label: it.prompt ?? it.title ?? '', drillable: it.kind === 'word' }));
        return [...prev, ...miss];
      });
      setEndedAt(Date.now());
      setPhase('result');
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'result' || !cur) {
    const correct = answers.filter((a) => a.correct).length;
    const pct = Math.round((100 * correct) / (answers.length || 1));
    const pctTrue = Math.round(100 * guessCorrect(pct / 100)); // 当て推量補正後の実力(4択偶然25%を除去)
    const jftSc = isJft ? jftMockScore(answers.map((a) => ({ id: a.id, section: a.section, correct: a.correct }))) : null;
    const wrongDrill = answers.filter((a) => !a.correct && a.drillable);
    const elapsed = (endedAt ?? Date.now()) - startedAt;
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.top}>
            <Pressable onPress={async () => { await stopSound(); nav.goBack(); }} hitSlop={12}>
              <Text style={s.close}>✕</Text>
            </Pressable>
            <Text style={s.progress}>{t('mock.result_label')}</Text>
          </View>
          <View style={s.resultHero}>
            {isJft && jftSc ? (
              <>
                <Text style={s.resultPct}>{jftSc.total}<Text style={s.resultMax}> / 250</Text></Text>
                <Text style={[s.resultTrue, jftSc.pass && { color: c.green }]}>{t(jftSc.bandKey)}{jftSc.pass ? '' : ` ・ ${t('mock.jft_pass_at')}`}</Text>
              </>
            ) : (
              <>
                <Text style={s.resultPct}>{pct}%</Text>
                <Text style={s.resultTrue}>{t('mock.result_true', { n: pctTrue })}</Text>
              </>
            )}
            <Text style={s.resultFrac}>{t('mock.result_frac', { n: correct, m: answers.length, t: mmss(elapsed) })}</Text>
            <Text style={s.resultCap}>{full ? t('mock.full_exam') : t('mock.mini_exam')}</Text>
            {timedOut ? <Text style={s.timeup}>{t('mock.timeup')}</Text> : null}
            {prevMock ? (
              <Text style={[s.resultDelta, { color: pct - prevMock.pct > 0 ? c.green : pct - prevMock.pct < 0 ? c.red : c.mute }]}>
                {t('mock.result_delta_base', { n: prevMock.pct, m: pct })}
                {pct - prevMock.pct > 0
                  ? t('mock.result_delta_up', { n: pct - prevMock.pct })
                  : pct - prevMock.pct < 0
                    ? t('mock.result_delta_down', { n: prevMock.pct - pct })
                    : t('mock.result_delta_same')}
              </Text>
            ) : null}
          </View>

          <Text style={s.sectionH}>{t('mock.section_weakness')}</Text>
          <View style={s.heatCard}>
            {SEC_ORDER.filter((k) => byCat[k]).map((k) => (
              <Bar key={k} label={SEC_LABEL[k]} correct={byCat[k].c} total={byCat[k].t} tc={c} s={s} />
            ))}
          </View>

          {wrongDrill.length > 0 ? (
            <Pressable
              style={s.cta}
              onPress={() => nav.replace('Quiz', { itemIds: wrongDrill.map((w) => w.id), title: '弱点ドリル' })}
            >
              <Text style={s.ctaTxt}>{t('mock.drill_cta', { n: wrongDrill.length })}</Text>
            </Pressable>
          ) : (
            <Text style={s.allOk}>{t('mock.all_ok')}</Text>
          )}
          <Pressable style={s.ghost} onPress={() => nav.goBack()}>
            <Text style={s.ghostTxt}>{t('mock.close')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const onPick = (choiceIdx: number) => {
    if (picked !== null) return;
    const isCorrect = choiceIdx === cur.answerIndex;
    setPicked(choiceIdx);
    if (cur.kind !== 'word') setReveal2(true);
    mockAnswer(cur.id, isCorrect);
    setAnswers((a) => [
      ...a,
      { id: cur.id, section: cur.section, correct: isCorrect, label: cur.prompt ?? cur.title ?? '', drillable: cur.kind === 'word' },
    ]);
  };
  const next = async () => {
    await stopSound();
    setPicked(null);
    setReveal2(false);
    if (idx + 1 >= exam.length) { setEndedAt(Date.now()); setPhase('result'); } else setIdx((i) => i + 1);
  };

  const reveal = picked !== null;

  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.top}>
          <Pressable onPress={async () => { await stopSound(); nav.goBack(); }} hitSlop={12}>
            <Text style={s.close}>✕</Text>
          </Pressable>
          <Text style={[s.timer, remainingMs <= 60000 ? s.timerLow : null]}>⏱ {mmss(remainingMs)}</Text>
          <Text style={s.progress}>{idx + 1} / {exam.length}</Text>
        </View>
        <Text style={s.secTag}>{t((isJft ? JFT_SEC_LABEL : SEC_LABEL)[cur.section])}</Text>

        {cur.kind === 'word' ? (
          <View style={s.promptCard}>
            <Text style={s.prompt}>{cur.prompt}</Text>
            {cur.example ? (
              <Text style={s.readingHint}>
                {cur.example.map((sg, i) => (
                  <Text key={i} style={sg.hit ? s.exHit : undefined}>{sg.text}</Text>
                ))}
              </Text>
            ) : cur.reading ? (
              <Text style={s.readingHint}>{cur.reading}</Text>
            ) : null}
            <Text style={s.qtext}>{cur.question}</Text>
          </View>
        ) : cur.kind === 'reading' ? (
          <View style={s.passageCard}>
            <Text style={s.passTitle}>{cur.title}</Text>
            <Text style={s.passBody}>{cur.body}</Text>
          </View>
        ) : (
          <View style={s.passageCard}>
            <Text style={s.passTitle}>{cur.title}</Text>
            {(() => {
              const used = isJft && playCount >= JFT_LISTEN_MAX;
              return (
                <Pressable style={[s.playBtn, playing && s.playBtnOn, used && !playing && s.playBtnUsed]} onPress={play} disabled={used && !playing}>
                  <Text style={[s.playTxt, playing && s.playTxtOn]}>
                    {playing ? t('mock.playing') : isJft ? (used ? t('mock.play_used') : t('mock.play_jft', { n: JFT_LISTEN_MAX - playCount })) : t('mock.play_audio')}
                  </Text>
                </Pressable>
              );
            })()}
            {reveal2 ? <Text style={s.passBody}>{formatScript(cur.script ?? '')}</Text> : null}
          </View>
        )}

        {cur.kind !== 'word' ? <Text style={s.qtextBig}>{cur.question}</Text> : null}

        <View style={s.choices}>
          {cur.choices.map((ch, i) => {
            const isAnswer = i === cur.answerIndex;
            const isPicked = i === picked;
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

        {reveal ? (
          <>
            {cur.explain ? <View style={s.explainBox}><Text style={s.explainTxt}>{cur.explain}</Text></View> : null}
            {cur.kind === 'listening' ? (
              <Pressable style={s.cta} onPress={next}>
                <Text style={s.ctaTxt}>{idx + 1 >= exam.length ? t('mock.see_result') : t('mock.next')}</Text>
              </Pressable>
            ) : (
              <Text style={s.autoNext}>{idx + 1 >= exam.length ? t('mock.auto_result') : t('mock.auto_next')}</Text>
            )}
          </>
        ) : (
          <Text style={s.hint}>{t('mock.hint')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Bar({ label, correct, total, tc, s }: { label: string; correct: number; total: number; tc: ThemeColors; s: Styles }) {
  const t = useT();
  const pct = total ? Math.round((100 * correct) / total) : 0;
  const color = pct >= 80 ? tc.green : pct >= 50 ? tc.amber : tc.red;
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{t(label)}</Text>
      <View style={s.barTrack}><View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
      <Text style={[s.barPct, { color }]}>{pct}%</Text>
      <Text style={s.barFrac}>{correct}/{total}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.md },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    close: { fontSize: ty.h2, color: c.mute },
    progress: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
    timer: { fontSize: ty.small, color: c.ink2, fontWeight: '800' },
    timerLow: { color: c.red },
    timeup: { fontSize: ty.small, color: c.red, fontWeight: '800', marginTop: spacing.xs },
    secTag: { fontSize: ty.tiny, fontWeight: '800', color: c.blue, letterSpacing: 1 },
    promptCard: {
      backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
      paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.xs, minHeight: 130, justifyContent: 'center',
    },
    prompt: { fontSize: 30, fontWeight: '800', color: c.ink, textAlign: 'center' },
    readingHint: { fontSize: ty.small, color: c.mute },
    exHit: { color: c.ink, textDecorationLine: 'underline' },
    qtext: { fontSize: ty.small, color: c.faint, marginTop: spacing.sm },
    passageCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.lg, gap: spacing.sm },
    passTitle: { fontSize: ty.tiny, fontWeight: '800', color: c.mute, letterSpacing: 1 },
    passBody: { fontSize: ty.body, color: c.ink2, lineHeight: 26 },
    qtextBig: { fontSize: ty.h2, fontWeight: '700', color: c.ink },
    playBtn: { backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.choukai, paddingVertical: spacing.md, alignItems: 'center' },
    playBtnUsed: { opacity: 0.45, borderColor: c.line },
    playBtnOn: { backgroundColor: c.okBg, borderColor: c.green },
    playTxt: { fontSize: ty.body, fontWeight: '800', color: c.choukai },
    playTxtOn: { color: c.green },
    choices: { gap: spacing.sm },
    choice: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
      paddingVertical: spacing.md, paddingHorizontal: spacing.md,
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
    autoNext: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.xs },
    // result
    resultHero: { backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.xl, alignItems: 'center' },
    resultPct: { fontSize: 64, fontWeight: '800', color: c.ink, lineHeight: 70 },
    resultTrue: { fontSize: ty.body, fontWeight: '800', color: c.blue, marginTop: 2 },
    resultMax: { fontSize: ty.h2, fontWeight: '800', color: c.faint },
    resultFrac: { fontSize: ty.body, color: c.mute, marginTop: spacing.xs },
    resultCap: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.xs, letterSpacing: 1 },
    resultDelta: { fontSize: ty.small, color: c.mute, fontWeight: '700', marginTop: spacing.sm },
    sectionH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.sm },
    heatCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    barLabel: { fontSize: ty.small, color: c.ink2, width: 76 },
    barTrack: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: c.bgSoft, overflow: 'hidden' },
    barFill: { height: 10, borderRadius: radius.pill },
    barPct: { fontSize: ty.small, fontWeight: '800', width: 38, textAlign: 'right' },
    barFrac: { fontSize: ty.tiny, color: c.faint, width: 34, textAlign: 'right' },
    allOk: { fontSize: ty.body, fontWeight: '700', color: c.green, textAlign: 'center', marginTop: spacing.sm },
    ghost: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
    ghostTxt: { color: c.mute, fontSize: ty.body, fontWeight: '700' },
  });
