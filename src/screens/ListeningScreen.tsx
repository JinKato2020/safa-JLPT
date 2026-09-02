// ミニ聴解。会話/独話の音声(Google TTS生成)を聞いて4択で自動採点(重み3)→聴解リング点灯。
// スクリプトは既定で隠す(本物の聴解)。解答後に表示＋解説。採点は quizAnswer(設問id) 流用。掲示板§4(聴解)。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { useT, meaningL1 } from '../i18n';
import { progressSnapshot } from '../store/selectors';
import AfterStudyReward from '../components/AfterStudyReward';
import type { StudiedQuestion } from '../data/studiedWords';
import AnswerFooter from '../components/AnswerFooter';
import { walletPoints } from '../store/wallet';
import ExamHeader from '../components/ExamHeader';
import DevIdPicker from '../components/DevIdPicker';
import RubyText from '../components/RubyText';
import Slider from '../components/Slider';
import { listeningItemsFor, listeningItemsForSub, listeningSubtype, rubyNeeded, PASSAGE_TRANS_NE, PASSAGE_TRANS_EN, Q_TRANS_NE, Q_TRANS_EN, type ListeningItem, type PassageQuestion } from '../data';
import { practicePool } from '../listening/pool';
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
  const { quizAnswer, setSettings } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  // ルビ(ふりがな)は自レベル以上の漢字だけに出す(読解・単語と同じレベルゲート)。共通仕様§3。
  const rubyGate = (run: string) => rubyNeeded(run, state.settings.level);
  const route = useRoute<RouteProp<RootStackParamList, 'Listening'>>();
  const subtype = route.params?.subtype; // 学習タブの小区分から来た場合はその区分だけ出題

  const [steps, setSteps] = useState<ClipStep[]>(() => {
    const now = Date.now();
    const rawAll = subtype ? listeningItemsForSub(state.settings.level, subtype) : listeningItemsFor(state.settings.level);
    // ID帯で出題プールを制御: 模試帯(0701-)除外／予備帯(0501-)は一般帯を一巡したら解放。§src/listening/pool.ts
    const all = practicePool(rawAll, (qid) => !!state.items[qid]);
    // 未習得(未回答 or p<0.6)の設問を含むクリップを優先→カバー率が確実に進みリングが満ちる。
    const needy = all.filter((cl) => cl.questions.some((q) => { const st = state.items[q.id]; return !st || effectiveP(st, now) < 0.6; }));
    const rest = all.filter((cl) => !needy.includes(cl));
    const clips = [...sample(needy, SESSION_CLIPS), ...sample(rest, SESSION_CLIPS)].slice(0, SESSION_CLIPS);
    // 1クリップ＝1ページ。その音声の全設問をまとめて持つ。
    // 通常はテキスト4択をシャッフル。発話/即時(audioChoices)は選択肢が音声で順番に流れるため、番号と一致させるべくシャッフルしない。
    return clips.map((cl) => ({ clip: cl, qs: cl.questions.map((q) => (cl.audioChoices ? { ...q } : { ...q, ...shuffleChoices(q.choices, q.answerIndex) })) }));
  });
  const [idx, setIdx] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false); // 開発用: 問題IDタップで同じ大問の全問へジャンプ
  const [picked, setPicked] = useState<(number | null)[]>([]); // 現クリップの設問ごとの選択(qIndex→choiceIndex)
  const [showTrans, setShowTrans] = useState(false); // 回答後の対訳(台本/設問/選択肢)トグル。区分によっては訳が無い(hasTrans=false)。
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));
  const [walletStart] = useState(() => walletPoints(state));
  const [showScript, setShowScript] = useState(false);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playGen = useRef(0); // 再生の世代。新しいタップ/停止で+1し、進行中の古い再生を無効化(2度押しの音重なり防止)。

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

  const step = steps[idx];

  const stopSound = async () => {
    playGen.current++; // 進行中の再生(まだsoundRefに入っていない読込中のものも含む)を無効化
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    }
    setPlaying(false);
  };

  // 【開発用】同じ大問(小区分)の全問リストと、任意IDへのジャンプ。開発ビルド or バージョン7回タップで解禁した端末のみ。
  const devTools = __DEV__ || state.settings.devToolsUnlocked === true;
  const devSub = subtype ?? (step ? listeningSubtype(step.clip) : undefined);
  const devList = useMemo(
    () => (devTools ? (devSub ? listeningItemsForSub(state.settings.level, devSub) : listeningItemsFor(state.settings.level)) : []),
    [devTools, devSub, state.settings.level],
  );
  const devIds = useMemo(() => devList.map((cl) => cl.id), [devList]);
  const jumpTo = (id: string) => {
    const pos = devList.findIndex((cl) => cl.id === id);
    if (pos < 0) return;
    stopSound();
    // 一巡できるよう大問の全問を steps に載せ替え、選んだ問題へ移動(即時/発話は選択肢音声順のためシャッフルしない)。
    setSteps(devList.map((cl) => ({ clip: cl, qs: cl.questions.map((q) => (cl.audioChoices ? { ...q } : { ...q, ...shuffleChoices(q.choices, q.answerIndex) })) })));
    setIdx(pos);
    setPicked([]);
    setShowScript(false);
    setPickerOpen(false);
  };

  // 2度押し対策: タップの度に世代(playGen)を進め、直前の音を止めてから読み込む。読込/生成の途中で
  // 新しいタップ(または停止)が来たら、この再生は「古い」と判断して破棄する=最後に押したタップだけが鳴る。
  const play = async () => {
    if (!step) return;
    await stopSound();                 // 直前の音を停止(+世代を進めて進行中の再生を無効化)
    const myGen = playGen.current;      // このタップの世代を確定
    const src = await listeningSource(step.clip.id, { stream });
    if (!src || myGen !== playGen.current) return; // 読込中に新しいタップ/停止→破棄
    try {
      const rate = state.settings.listeningRate ?? 1;
      // shouldCorrectPitch=速度を変えても声の高さを保つ / High=iOSのSpectralアルゴリズム(声を最も自然に引き伸ばす。0.5倍でも人声の質感を維持)
      const { sound } = await Audio.Sound.createAsync(src, { shouldPlay: true, rate, shouldCorrectPitch: true, pitchCorrectionQuality: Audio.PitchCorrectionQuality.High });
      if (myGen !== playGen.current) { sound.unloadAsync().catch(() => undefined); return; } // 生成中に新タップ→即停止して捨てる
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
    const after = progressSnapshot(state, Date.now());
    // 問題の見直し(台本つき)。再挿入で重複したクリップは除外し、各設問に台本＋問題＋選択肢＋正誤を持たせて全画面へ。
    const seenClip = new Set<string>();
    const reviewList: StudiedQuestion[] = [];
    for (const st of steps) {
      if (seenClip.has(st.clip.id)) continue;
      seenClip.add(st.clip.id);
      for (const q of st.clip.questions) {
        reviewList.push({
          clipTitle: st.clip.title,
          script: st.clip.script,
          question: q.q ?? '',
          choices: q.choices,
          answerIndex: q.answerIndex,
          correct: (state.items[q.id]?.reps ?? 0) > 0,
          label: q.q && q.q.trim() ? q.q : st.clip.title,
        });
      }
    }
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.doneBody}>
          <AfterStudyReward
            reviewList={reviewList}
            shellsEarned={Math.max(0, walletPoints(state) - walletStart)}
            scored={after.touched - before.touched}
            accuracy={answered ? Math.round((correct / answered) * 100) : 0}
            correct={correct}
            total={answered}
            mode="choukai"
          />
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
    // スクリプトは自動表示しない。ユーザーが「スクリプトを見る」を押した時だけ開示する(ユーザー指定2026-07-31)。
    quizAnswer(q.id, ok);
    setAnswered((a) => a + 1);
    if (ok) setCorrect((x) => x + 1);
  };

  // クリップの全設問に答え終えたら「次へ」ボタンで手動前進(自動前進しない)。誤答があれば再挿入。
  const advance = async () => {
    await stopSound();
    const anyWrong = step.qs.some((q, qi) => picked[qi] !== q.answerIndex);
    if (anyWrong && steps.length < MAX_STEPS) {
      setSteps((arr) => { const head = arr.slice(0, idx + 1); const tail = reinsertForRelearn(arr.slice(idx + 1), step, RELEARN_GAP); return [...head, ...tail]; });
    }
    setPicked([]);
    setShowScript(false);
    setShowTrans(false);
    setIdx((i) => i + 1);
  };

  const isAudioChoices = !!step.clip.audioChoices; // 発話/即時=本文＋選択肢を音声で再生、画面は番号で選ぶ
  const isHatsuwa = !isAudioChoices && !!step.clip.illust; // (旧)発話表現=イラスト＋場面文、音声なし
  const isGaiyou = listeningSubtype(step.clip) === 'gaiyou'; // 概要も課題/ポイントと同じ音声再生UI(mp3未生成でも再生ボタンは出す)
  const anyPicked = picked.some((p) => p != null);
  const allDone = step.qs.length > 0 && step.qs.every((_, qi) => picked[qi] != null);
  // 回答後の対訳(課題理解ほか): 台本訳=PASSAGE_TRANS[clip.id](行配列)／設問・選択肢訳=Q_TRANS[設問id]。ne母語=ネパール語訳・他=英語訳。
  const useNe = meaningL1(state.settings) === 'ne';
  const scriptTrans = useNe ? PASSAGE_TRANS_NE[step.clip.id] : PASSAGE_TRANS_EN[step.clip.id];
  const qtr = useNe ? Q_TRANS_NE : Q_TRANS_EN;
  const hasTrans = !!scriptTrans || step.qs.some((q) => qtr[q.id]); // 訳が1つでもあればトグルを出す

  // スクリプトを行ごとにルビ付きで描画(空行は間隔)。話者ラベル「女1：」等もそのまま。
  const renderScript = (raw: string) =>
    formatScript(raw)
      .split('\n')
      .map((line, i) => (line ? <RubyText key={i} text={line} style={s.script} rubyStyle={s.scriptRuby} rubyGate={rubyGate} /> : <View key={i} style={s.scriptGap} />));
  // 「スクリプトを見る／隠す」トグル。課題/ポイント/概要/発話/即時で共通に使う(確認用)。
  const scriptBlock = showScript ? (
    <>
      <View style={s.scriptBox}>{renderScript(step.clip.script)}</View>
      {allDone && showTrans && scriptTrans?.length ? (
        <View style={s.scriptTransBox}>{scriptTrans.map((ln, i) => <Text key={i} style={s.scriptTransTxt}>{ln}</Text>)}</View>
      ) : null}
      <Pressable onPress={() => setShowScript(false)} hitSlop={8}><Text style={s.scriptToggle}>{t('listening.script_hide')}</Text></Pressable>
    </>
  ) : (
    <Pressable onPress={() => setShowScript(true)} hitSlop={8}><Text style={s.scriptToggle}>{t('listening.script_show')}</Text></Pressable>
  );
  // 音声スピード(設定と同じ0.5〜1.5倍・0.1刻み)。スクリプトトグルの下に置く。変更は次の再生から反映。
  const speedBar = (
    <View style={s.speedRow}>
      <Text style={s.speedLbl}>{t('listening.speed')}</Text>
      <Slider
        value={state.settings.listeningRate ?? 1}
        min={0.5}
        max={1.5}
        step={0.1}
        onChange={(v) => setSettings({ listeningRate: v })}
        trackColor={c.line}
        fillColor={c.blue}
        formatValue={(v) => `${v.toFixed(1)}×`}
      />
    </View>
  );
  const audioControls = (<>{scriptBlock}{speedBar}</>); // 音声のある区分=スクリプトトグル＋スピードバー

  return (
    <SafeAreaView style={s.c}>
      <ScrollView contentContainerStyle={s.body}>
        <ExamHeader title={route.params?.title} id={step?.clip.id} onClose={async () => { await stopSound(); nav.goBack(); }} count={`${idx + 1} / ${steps.length}`} onPressId={devTools ? () => setPickerOpen(true) : undefined} />
        {devTools ? <DevIdPicker visible={pickerOpen} ids={devIds} currentId={step?.clip.id} onPick={jumpTo} onClose={() => setPickerOpen(false)} /> : null}

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
              {audioControls}
            </>
          ) : isHatsuwa ? (
            <>
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={s.hatsuwaImg} resizeMode="contain" />
              ) : (
                <View style={s.hatsuwaImgPh}><ActivityIndicator color={c.blue} /></View>
              )}
              <RubyText text={step.clip.script} style={s.hatsuwaScene} rubyStyle={s.scriptRuby} rubyGate={rubyGate} />
            </>
          ) : (step.clip.audio || isGaiyou) ? (
            <>
              <Pressable style={[s.playBtn, playing && s.playBtnOn]} onPress={play}>
                <Text style={[s.playTxt, playing && s.playTxtOn]}>{playing ? t('listening.playing') : t('listening.play')}</Text>
              </Pressable>
              {audioControls}
            </>
          ) : (
            <>
              <Text style={s.devNote}>{t('listening.dev_text')}</Text>
              {scriptBlock}
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
              {q.q ? <RubyText text={q.q} style={s.qText} rubyStyle={s.scriptRuby} rubyGate={rubyGate} /> : null}
              {reveal && showTrans && qtr[q.id]?.q ? <Text style={s.qTransTxt}>{qtr[q.id]!.q}</Text> : null}
              <View style={s.choices}>
                {q.choices.map((ch, ci) => {
                  const isAnswer = ci === q.answerIndex;
                  const isPicked = ci === picked[qi];
                  // 選択肢はシャッフル表示だが Q_TRANS はデータ元順。元問題(step.clip.questions[qi])で ch の元indexを引いて訳を対応させる。
                  const ctr = reveal && showTrans ? qtr[q.id]?.choices[step.clip.questions[qi]?.choices.indexOf(ch) ?? -1] : undefined;
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
                          {reveal ? <View style={s.choiceTxtWrap}><RubyText text={ch} style={s.choiceTxt} rubyStyle={s.scriptRuby} rubyGate={rubyGate} />{ctr ? <Text style={s.choiceTransTxt}>{ctr}</Text> : null}</View> : null}
                        </View>
                      ) : (
                        <View style={s.choiceTxtWrap}><RubyText text={ch} style={s.choiceTxt} rubyStyle={s.scriptRuby} rubyGate={rubyGate} />{ctr ? <Text style={s.choiceTransTxt}>{ctr}</Text> : null}</View>
                      )}
                      {reveal && isAnswer ? <Text style={s.mark}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* 回答後の対訳トグル(台本/設問/選択肢)。訳がある区分(現状=課題理解)でのみ表示。 */}
        {allDone && hasTrans ? (
          <Pressable style={s.transBtn} onPress={() => setShowTrans((v) => !v)}>
            <Text style={s.transBtnTxt}>{showTrans ? t('passage.hideTrans') : t('passage.showTrans')}</Text>
          </Pressable>
        ) : null}

        {/* 全ドリル共通の回答フッター(セット型=正誤なし・次へのみ)。 */}
        {allDone ? <AnswerFooter onNext={advance} nextKind={idx + 1 >= steps.length ? 'result' : 'next'} /> : null}
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
  script: { fontSize: ty.body, color: c.ink2, lineHeight: 26 },
  scriptBox: { gap: 2, marginTop: spacing.xs },
  scriptGap: { height: spacing.sm, width: '100%' },
  scriptRuby: { fontSize: 10, color: c.mute },
  devNote: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.xs, fontStyle: 'italic' },
  hatsuwaImg: { width: '100%', maxWidth: 260, aspectRatio: 1, alignSelf: 'center', borderRadius: radius.md, backgroundColor: '#ffffff', marginTop: spacing.xs },
  hatsuwaImgPh: { width: '100%', maxWidth: 260, aspectRatio: 1, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  hatsuwaScene: { fontSize: ty.body, color: c.ink, lineHeight: 24, marginTop: spacing.sm },
  scriptToggle: { fontSize: ty.small, color: c.blue, fontWeight: '700' },
  scriptTransBox: { gap: 2, marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  scriptTransTxt: { fontSize: ty.small, color: c.mute, lineHeight: 22 },
  qTransTxt: { fontSize: ty.small, color: c.ink2, marginTop: 2 },
  choiceTransTxt: { fontSize: ty.small, color: c.mute, marginTop: 2 },
  transBtn: { alignSelf: 'center', marginTop: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  transBtnTxt: { fontSize: ty.small, color: c.blue, fontWeight: '700' },
  speedRow: { marginTop: spacing.sm, gap: 4 },
  speedLbl: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
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
  choiceTxt: { fontSize: ty.body, color: c.ink2 },
  choiceTxtWrap: { flex: 1 },
  mark: { color: c.green, fontWeight: '800', fontSize: ty.h2 },
  cta: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  ctaTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
