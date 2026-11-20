import StudyLayout from '../components/StudyLayout';
import StudyChoiceList from '../components/StudyChoiceList';
import StudyPrompt, { StudyInstruction } from '../components/StudyPrompt';
// 単語タブ「新形式問題」画面(1画面3形式)。試験タブと独立した産出/受容ドリル。
//  ・vProduce  意味 → かなタイルで単語を組む(産出)
//  ・gOrder    全タイルを正しい順に並べる(完全並べ替え・産出)
//  ・gMeaning  文法点の意味を4択(受容)
// 結果は quizAnswer(itemId, correct) で記録 → 語彙/文法カバー率に反映。専門用語はUIに出さない。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { spacing, radius, type as ty, shadow, type ThemeColors } from '../theme';
import { useStudyColors } from '../components/StudyPresentation';
import { useAppState, useAppActions } from '../store/store';
import { walletPoints } from '../store/wallet';
import { buildDrill, type DrillProblem } from '../ladder/wordDrill';
import { buildPracticeMix, type PracticeChoice } from '../ladder/practiceMix';
import { buildExamMix, buildWeaknessMix, type MixedProblem } from '../ladder/examMix';
import { playKanjiRep, playVocab, stopVocab } from '../data/vocabAudio';
import { resolveStudiedWords, type StudiedQuestion } from '../data/studiedWords';
import { progressSnapshot } from '../store/selectors';
import AfterStudyReward, { type StudiedWord } from '../components/AfterStudyReward';
import AnswerFooter from '../components/AnswerFooter';
import ExamHeader from '../components/ExamHeader';
import StudyAudioButton from '../components/StudyAudioButton';
import MixedExamQuestion from '../components/MixedExamQuestion';
import RubyText from '../components/RubyText';
import { meaningL1, useT } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'WordDrill'>;
type Styles = ReturnType<typeof makeStyles>;

export default function WordDrillScreen() {
  const nav = useNavigation<Nav>();
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const route = useRoute<Rt>();
  const state = useAppState();
  const actions = useAppActions();
  const c = useStudyColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);

  const kind = route.params.kind;
  const level = route.params.level ?? (state.settings.level as 'N5' | 'N4' | 'N3');
  const l1 = meaningL1(state.settings);
  // seedは初回固定(再レンダで並びが変わらないように)。SRS=未習/低習得優先。
  const [seed] = useState(() => (Date.now() & 0xffff) | 1);
  const [problems] = useState<MixedProblem[]>(() => {
    const now = Date.now();
    if (kind === 'examMix') return buildExamMix(level, state, now);
    if (kind === 'weaknessMix') return buildWeaknessMix(level, l1, state, now);
    if (kind === 'practiceMix') return buildPracticeMix(level, l1, state.mastery ?? {}, now, state.items);
    return buildDrill(kind, level, 10, seed, state.items);
  });

  const [i, setI] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]); // vProduce/gOrder: 置いたタイルの原index列
  const [sel, setSel] = useState<number | null>(null); // gMeaning: 選んだ選択肢
  const [judged, setJudged] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [examReview, setExamReview] = useState<StudiedQuestion[]>([]);
  const [before] = useState(() => progressSnapshot(state, Date.now())); // 完了画面の「伸び」表示用(試験タブと統一)
  const [walletStart] = useState(() => walletPoints(state)); // セッション開始時の桜貝残高(獲得数=終了時との差)

  // この回に学習した単語(重複除去)。毎問登録をやめ、最後にまとめて☑で私の単語帳へ。
  const studiedWords = useMemo<StudiedWord[]>(() => {
    const seen = new Set<string>();
    const out: StudiedWord[] = [];
    for (const pr of problems) {
      if (pr.kind === 'examChoice') {
        if (pr.question.saveRef) out.push(...resolveStudiedWords([{ ref: pr.question.saveRef, correct: results[pr.itemId] }], l1)
          .filter(word => {
            const key = word.ref.type + word.ref.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }));
        continue;
      }
      if (pr.kind === 'practiceChoice') {
        const key = pr.ref.type + pr.ref.id;
        if (!seen.has(key)) {
          const related = problems.filter(q => q.kind === 'practiceChoice' && q.ref.id === pr.ref.id);
          out.push(...resolveStudiedWords([{ ref: pr.ref, correct: related.every(q => results[q.itemId]) }], l1));
          seen.add(key);
        }
        continue;
      }
      const id = pr.itemId.split('#')[0];
      const type = pr.kind === 'vProduce' || pr.kind === 'vMeaning' || pr.kind === 'vReading' || pr.kind === 'vWriting' ? ('vocab' as const) : ('grammar' as const);
      const key = type + id;
      if (seen.has(key)) continue;
      seen.add(key);
      const correct = results[pr.itemId];
      if (pr.kind === 'vProduce') out.push({ ref: { type, id }, word: pr.hint ?? pr.reading, meaning: pr.prompt, correct });
      else if (pr.kind === 'gBuild') out.push({ ref: { type, id }, word: pr.reading, meaning: pr.hint, correct });
      else if (pr.kind === 'vMeaning') out.push({ ref: { type, id }, word: pr.prompt, meaning: pr.choices[pr.answerIndex], correct });
      else if (pr.kind === 'vReading') out.push({ ref: { type, id }, word: `${pr.prompt}（${pr.choices[pr.answerIndex]}）`, meaning: pr.meaning, correct });
      else if (pr.kind === 'vWriting') out.push({ ref: { type, id }, word: `${pr.choices[pr.answerIndex]}（${pr.reading}）`, meaning: pr.prompt, correct });
      else out.push({ ref: { type, id }, word: pr.hit ?? pr.prompt, correct });
    }
    return out;
  }, [problems, results, l1]);

  const p = problems[i];

  const record = (correct: boolean, itemId: string) => {
    setJudged(correct);
    if (correct) setScore((n) => n + 1);
    actions.quizAnswer(itemId, correct);
    setResults((m) => ({ ...m, [itemId]: correct }));
  };

  const next = () => {
    setPlaced([]);
    setSel(null);
    setJudged(null);
    setI((n) => n + 1);
  };

  const titleKey = kind === 'weaknessMix' ? 'cards.reco' :
    kind === 'practiceMix' || kind === 'examMix' ? 'cards.practice_mix' : `worddrill.title_${kind}`;
  // 問いかけは各問題の形式に依存(mixedでは問題ごとに変わる)。
  const askKeyFor = (k: DrillProblem['kind']) => k === 'vProduce' ? 'worddrill.produce_ask' : k === 'gBuild' ? 'worddrill.build_ask' : k === 'vMeaning' ? 'worddrill.vmeaning_ask' : k === 'vReading' ? 'worddrill.vreading_ask' : k === 'vWriting' ? 'worddrill.vwriting_ask' : 'worddrill.meaning_ask';

  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  // ── 問題枯渇 / 終了 ──
  if (!problems.length) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={{ padding: spacing.lg }}><ExamHeader study title={t(titleKey)} onClose={() => nav.goBack()} /></View>
        <View style={s.center}><Text style={s.emptyTxt}>{t('worddrill.empty')}</Text></View>
      </SafeAreaView>
    );
  }
  if (i >= problems.length) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={{ padding: spacing.lg }}><ExamHeader study title={t(titleKey)} onClose={() => nav.goBack()} /></View>
        <ScrollView contentContainerStyle={s.doneBody}>
          <AfterStudyReward
            words={studiedWords}
            reviewList={examReview}
            shellsEarned={Math.max(0, walletPoints(state) - walletStart)}
            scored={progressSnapshot(state, Date.now()).touched - before.touched}
            accuracy={problems.length ? Math.round((score / problems.length) * 100) : 0}
            correct={score}
            total={problems.length}
            mode={kind === 'examMix' || kind === 'weaknessMix' ? kind :
              kind === 'practiceMix' || kind.startsWith('v') ? 'moji_goi' : 'bunpou'}
            seed={seed}
          />
          <Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('worddrill.finish')}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <StudyLayout title={t(titleKey)} current={i + 1} total={problems.length} onClose={() => nav.goBack()}
      footer={judged !== null ? <AnswerFooter study correct={judged} onNext={next} nextKind={i + 1 >= problems.length ? 'finish' : 'next'} /> : null}>
        {p.kind === 'examChoice' ? (
          <MixedExamQuestion key={p.itemId} problem={p} level={level} selected={sel}
            onSelect={index => {
              if (judged !== null) return;
              const q = p.question;
              const correct = index === q.answerIndex;
              setSel(index);
              setExamReview(list => [...list, {
                ...q, picked: index,
                explain: q.orderSentence ?? q.explain, correct,
              }]);
              record(correct, p.itemId);
            }} />
        ) : <StudyInstruction>{t(p.kind === 'practiceChoice' ? p.instruction : askKeyFor(p.kind))}</StudyInstruction>}

        {p.kind === 'practiceChoice' && (
          <MixedChoice key={p.itemId} p={p} sel={sel} revealed={judged !== null} s={s} onSelect={index => {
            if (judged !== null) return;
            setSel(index);
            record(index === p.answerIndex, p.itemId);
          }} />
        )}

        {(p.kind === 'vProduce' || p.kind === 'gBuild') && (
          <ProduceView p={p} placed={placed} setPlaced={setPlaced} judged={judged} record={record} s={s} c={c} t={t} />
        )}
        {(p.kind === 'gMeaning' || p.kind === 'vMeaning' || p.kind === 'vReading' || p.kind === 'vWriting') && (
          <MeaningView p={p} sel={sel} setSel={setSel} judged={judged} record={record} s={s} />
        )}
    </StudyLayout>
  );
}

function MixedChoice({ p, sel, revealed, s, onSelect }: {
  p: PracticeChoice; sel: number | null; revealed: boolean; s: Styles; onSelect: (index: number) => void;
}) {
  const t = useT();
  const playback = useRef(0);
  const audio = p.audio;
  useEffect(() => {
    if (!audio) return;
    void Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    return () => {
      playback.current++;
      void stopVocab();
      void Speech.stop();
    };
  }, [audio]);
  const play = async () => {
    if (!audio) return;
    const tap = ++playback.current;
    void Speech.stop();
    const ok = await (audio.audioVocabId ? playVocab(audio.audioVocabId) :
      audio.audioChar ? playKanjiRep(audio.audioChar) : Promise.resolve(false)).catch(() => false);
    if (!ok && tap === playback.current && audio.audioReading) {
      Speech.speak(audio.audioReading, { language: 'ja-JP' });
    }
  };
  return <>
    {audio && <StudyAudioButton label={t('listening.play')} onPress={play} />}
    {p.prompt && <StudyPrompt><Text style={s.promptPt}>{p.prompt}</Text></StudyPrompt>}
    <StudyChoiceList choices={p.choices} selectedIndex={sel} answerIndex={p.answerIndex}
      revealed={revealed} onSelect={onSelect} />
    {revealed && p.feedback && <Text style={s.answerHint}>{p.feedback}</Text>}
  </>;
}

// ── 産出(かなタイル): 語彙 意味→単語 / 文法 例文の空所に文法語を作る ──
function ProduceView({ p, placed, setPlaced, judged, record, s, c, t }: {
  p: Extract<DrillProblem, { kind: 'vProduce' | 'gBuild' }>; placed: number[]; setPlaced: (v: number[]) => void;
  judged: null | boolean; record: (correct: boolean, id: string) => void; s: Styles; c: ThemeColors; t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const slotCount = p.answer.length;
  const tapTile = (idx: number) => {
    if (judged !== null || placed.includes(idx) || placed.length >= slotCount) return;
    const nextPlaced = [...placed, idx];
    setPlaced(nextPlaced);
    if (nextPlaced.length === slotCount) {
      const built = nextPlaced.map((k) => p.tiles[k]).join('');
      record(built === p.reading, p.itemId);
    }
  };
  return (
    <>
      <StudyPrompt>
        {p.kind === 'vProduce' ? (
          // 音声再生は置かない(読みを聞けると産出の答えになるため。ユーザー指示2026-08-22)。
          <Text style={s.promptEn}>{p.prompt}</Text>
        ) : (
          <>
            <RubyText text={p.prompt} style={s.promptJa} rubyStyle={{ color: c.mute }} center />
            {!!p.hint && <Text style={s.promptHint}>{p.hint}</Text>}
          </>
        )}
      </StudyPrompt>
      {p.kind === 'vProduce' && !!p.example && (
        <View style={s.exampleBox}>
          <RubyText text={p.example} style={s.exampleTxt} rubyStyle={s.exampleRuby} center />
        </View>
      )}
      <View style={s.slots}>
        {Array.from({ length: slotCount }).map((_, k) => {
          const tileIdx = placed[k];
          const filled = tileIdx != null;
          return (
            <Pressable key={k} style={[s.slot, filled && s.slotFilled, judged === true && s.slotOk, judged === false && s.slotNg]}
              onPress={() => { if (judged === null && filled) setPlaced(placed.filter((x) => x !== tileIdx)); }}>
              <Text style={s.slotTxt}>{filled ? p.tiles[tileIdx] : ''}</Text>
            </Pressable>
          );
        })}
      </View>
      {judged !== null && <Text style={s.answerHint}>{t('worddrill.answer_is', { a: p.kind === 'vProduce' && p.hint && p.hint !== p.reading ? `${p.hint}（${p.reading}）` : p.reading })}</Text>}
      <Text style={s.bankLbl}>{t('worddrill.tap_kana')}</Text>
      <View style={s.bank}>
        {p.tiles.map((tl, idx) => (
          <Pressable key={idx} style={[s.tile, placed.includes(idx) && s.tileUsed]} onPress={() => tapTile(idx)}>
            <Text style={s.tileTxt}>{tl}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// ── 意味/読み/表記(4択)受容: 文法点の意味 / 語→意味 / 語→読み / 意味→表記(かたち) ──
function MeaningView({ p, sel, setSel, judged, record, s }: {
  p: Extract<DrillProblem, { kind: 'gMeaning' | 'vMeaning' | 'vReading' | 'vWriting' }>; sel: number | null; setSel: (v: number) => void;
  judged: null | boolean; record: (correct: boolean, id: string) => void; s: Styles;
}) {
  const tap = (k: number) => {
    if (judged !== null) return;
    setSel(k);
    record(k === p.answerIndex, p.itemId);
  };
  return (
    <>
      {/* 提示: 読み認識=語をルビ無しで(ルビ=答え)／表記認識(かたち)=意味を提示／他は漢字＋ルビ。 */}
      <StudyPrompt>
        {p.kind === 'vReading' || p.kind === 'vWriting'
          ? <Text style={s.promptPt}>{p.prompt}</Text>
          : <RubyText text={p.prompt} style={s.promptPt} rubyStyle={s.exampleRuby} center />}
      </StudyPrompt>
      {p.kind === 'gMeaning' && !!p.example && (
        <View style={s.exampleBox}>
          <RubyText text={p.example} target={p.hit} style={s.exampleTxt} hitStyle={s.exampleHit} rubyStyle={s.exampleRuby} center />
        </View>
      )}
      {/* 採点後の補足: 意味認識→読み・読み認識→意味・表記認識(かたち)→読み を出して面を結びつける。 */}
      {p.kind === 'vMeaning' && judged !== null && (
        <Text style={s.answerHint}>{p.reading}</Text>
      )}
      {p.kind === 'vReading' && judged !== null && (
        <Text style={s.answerHint}>{p.meaning}</Text>
      )}
      {p.kind === 'vWriting' && judged !== null && (
        <Text style={s.answerHint}>{p.reading}</Text>
      )}
      <StudyChoiceList choices={p.choices} selectedIndex={sel} answerIndex={p.answerIndex} revealed={judged !== null} onSelect={tap} />
    </>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTxt: { fontSize: ty.body, color: c.mute, textAlign: 'center' },
  doneBody: { padding: spacing.lg, gap: spacing.lg, alignItems: 'center' },
  promptEn: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
  promptPt: { fontSize: ty.h1, fontWeight: '800', color: c.ink, textAlign: 'center' },
  // gMeaning: 文法点の用例(対象語に下線)。意味だけでは判別しづらいため併設。
  exampleBox: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  exampleTxt: { fontSize: ty.body, color: c.ink2, textAlign: 'center' },
  exampleHit: { color: c.blue, fontWeight: '800', textDecorationLine: 'underline' },
  exampleRuby: { color: c.mute },
  promptJa: { fontSize: ty.h2, fontWeight: '700', color: c.ink },
  promptHint: { fontSize: ty.small, color: c.mute, fontWeight: '700', marginTop: spacing.xs, textAlign: 'center' },
  // produce slots
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  slot: { width: 46, height: 52, borderRadius: 11, borderWidth: 2, borderColor: c.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  slotFilled: { borderStyle: 'solid', borderColor: c.blue, backgroundColor: c.blueLight },
  slotOk: { borderColor: c.green, backgroundColor: c.okBg },
  slotNg: { borderColor: c.red, backgroundColor: c.ngBg },
  slotTxt: { fontSize: 22, fontWeight: '800', color: c.ink },
  answerHint: { fontSize: ty.body, fontWeight: '800', color: c.green, textAlign: 'center' },
  bankLbl: { fontSize: ty.tiny, color: c.faint, fontWeight: '700' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tile: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 14, ...shadow(1) },
  tileTxt: { fontSize: 20, fontWeight: '800', color: c.ink },
  tileUsed: { opacity: 0.3 },
  cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
});
