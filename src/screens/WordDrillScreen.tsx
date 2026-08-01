// 単語タブ「新形式問題」画面(1画面3形式)。試験タブと独立した産出/受容ドリル。
//  ・vProduce  意味 → かなタイルで単語を組む(産出)
//  ・gOrder    全タイルを正しい順に並べる(完全並べ替え・産出)
//  ・gMeaning  文法点の意味を4択(受容)
// 結果は quizAnswer(itemId, correct) で記録 → 語彙/文法カバー率に反映。専門用語はUIに出さない。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { walletPoints } from '../store/wallet';
import { buildDrill, type DrillProblem } from '../ladder/wordDrill';
import { progressSnapshot } from '../store/selectors';
import AfterStudyReward, { type StudiedWord } from '../components/AfterStudyReward';
import AnswerFooter from '../components/AnswerFooter';
import { playVocab } from '../data/vocabAudio';
import RubyText from '../components/RubyText';
import { useT } from '../i18n';
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
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);

  const kind = route.params.kind;
  const level = route.params.level ?? (state.settings.level as 'N5' | 'N4' | 'N3');
  // seedは初回固定(再レンダで並びが変わらないように)。SRS=未習/低習得優先。
  const [seed] = useState(() => (Date.now() & 0xffff) | 1);
  const problems = useMemo(
    () => buildDrill(kind, level, 10, seed, state.items as Record<string, { p: number }>),
    [kind, level, seed], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [i, setI] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]); // vProduce/gOrder: 置いたタイルの原index列
  const [sel, setSel] = useState<number | null>(null); // gMeaning: 選んだ選択肢
  const [judged, setJudged] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({}); // itemId(#前)→正誤(学習後リストの参考表示用)
  const [before] = useState(() => progressSnapshot(state, Date.now())); // 完了画面の「伸び」表示用(試験タブと統一)
  const [walletStart] = useState(() => walletPoints(state)); // セッション開始時の桜貝残高(獲得数=終了時との差)

  // この回に学習した単語(重複除去)。毎問登録をやめ、最後にまとめて☑で私の単語帳へ。
  const studiedWords = useMemo<StudiedWord[]>(() => {
    const seen = new Set<string>();
    const out: StudiedWord[] = [];
    for (const pr of problems) {
      const id = pr.itemId.split('#')[0];
      const type = pr.kind === 'vProduce' ? ('vocab' as const) : ('grammar' as const);
      const key = type + id;
      if (seen.has(key)) continue;
      seen.add(key);
      const correct = results[id];
      if (pr.kind === 'vProduce') out.push({ ref: { type, id }, word: pr.hint ?? pr.reading, meaning: pr.prompt, correct });
      else if (pr.kind === 'gBuild') out.push({ ref: { type, id }, word: pr.reading, meaning: pr.hint, correct });
      else out.push({ ref: { type, id }, word: pr.hit ?? pr.prompt, correct });
    }
    return out;
  }, [problems, results]);

  const p = problems[i];

  const record = (correct: boolean, itemId: string) => {
    setJudged(correct);
    if (correct) setScore((n) => n + 1);
    actions.quizAnswer(itemId, correct);
    setResults((m) => ({ ...m, [itemId.split('#')[0]]: correct })); // 学習後リストの正誤参考表示
  };

  const next = () => {
    setPlaced([]);
    setSel(null);
    setJudged(null);
    setI((n) => n + 1);
  };

  const titleKey = kind === 'vProduce' ? 'worddrill.title_vProduce' : kind === 'gBuild' ? 'worddrill.title_gBuild' : kind === 'gMeaning' ? 'worddrill.title_gMeaning' : 'worddrill.title_mixed';
  // 問いかけは各問題の形式に依存(mixedでは問題ごとに変わる)。
  const askKeyFor = (k: DrillProblem['kind']) => k === 'vProduce' ? 'worddrill.produce_ask' : k === 'gBuild' ? 'worddrill.build_ask' : 'worddrill.meaning_ask';

  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  // ── 問題枯渇 / 終了 ──
  if (!problems.length) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <Header title={t(titleKey)} onClose={() => nav.goBack()} s={s} />
        <View style={s.center}><Text style={s.emptyTxt}>{t('worddrill.empty')}</Text></View>
      </SafeAreaView>
    );
  }
  if (i >= problems.length) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <Header title={t(titleKey)} onClose={() => nav.goBack()} s={s} />
        <ScrollView contentContainerStyle={s.doneBody}>
          <AfterStudyReward
            words={studiedWords}
            shellsEarned={Math.max(0, walletPoints(state) - walletStart)}
            scored={progressSnapshot(state, Date.now()).touched - before.touched}
            accuracy={problems.length ? Math.round((score / problems.length) * 100) : 0}
            correct={score}
            total={problems.length}
            mode={kind === 'vProduce' ? 'moji_goi' : 'bunpou'}
            seed={seed}
          />
          <Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('worddrill.finish')}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <Header title={t(titleKey)} onClose={() => nav.goBack()} s={s}
        progress={(i + (judged !== null ? 1 : 0)) / problems.length} count={`${i + 1}/${problems.length}`} />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.ask}>{t(askKeyFor(p.kind))}</Text>

        {(p.kind === 'vProduce' || p.kind === 'gBuild') && (
          <ProduceView p={p} placed={placed} setPlaced={setPlaced} judged={judged} record={record} s={s} c={c} t={t} />
        )}
        {p.kind === 'gMeaning' && (
          <MeaningView p={p} sel={sel} setSel={setSel} judged={judged} record={record} s={s} />
        )}
      </ScrollView>

      {/* 全ドリル共通の回答フッター(正誤＋次へ)。毎問登録は廃止(学習後にまとめて)。 */}
      {judged !== null && (
        <AnswerFooter correct={judged} onNext={next} nextKind="next" />
      )}
    </SafeAreaView>
  );
}

function Header({ title, onClose, progress, count, s }: { title: string; onClose: () => void; progress?: number; count?: string; s: Styles }) {
  return (
    <View style={s.header}>
      <Text style={s.hTitle}>{title}</Text>
      {progress != null ? (
        <>
          <View style={s.prog}><View style={[s.progFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
          <Text style={s.hCount}>{count}</Text>
        </>
      ) : <View style={{ flex: 1 }} />}
      <Pressable hitSlop={10} onPress={onClose} style={s.x}><Text style={s.xTxt}>✕</Text></Pressable>
    </View>
  );
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
  const vid = p.itemId.split('#')[0];
  return (
    <>
      <View style={s.prompt}>
        {p.kind === 'vProduce' ? (
          <>
            <Text style={s.promptEn}>{p.prompt}</Text>
            <Pressable style={s.listen} onPress={() => playVocab(vid)}>
              <Ionicons name="headset-outline" size={15} color={c.blueDark} />
              <Text style={s.listenTxt}>{t('worddrill.listen')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <RubyText text={p.prompt} style={s.promptJa} rubyStyle={{ color: c.mute }} center />
            {!!p.hint && <Text style={s.promptHint}>{p.hint}</Text>}
          </>
        )}
      </View>
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

// ── 文法 意味(4択) ──
function MeaningView({ p, sel, setSel, judged, record, s }: {
  p: Extract<DrillProblem, { kind: 'gMeaning' }>; sel: number | null; setSel: (v: number) => void;
  judged: null | boolean; record: (correct: boolean, id: string) => void; s: Styles;
}) {
  const CODE = ['A', 'B', 'C', 'D'];
  const tap = (k: number) => {
    if (judged !== null) return;
    setSel(k);
    record(k === p.answerIndex, p.itemId);
  };
  return (
    <>
      {/* 文法点は 漢字（かな） を含む(82/393)。RubyTextで漢字の上にルビ表示(カッコ生表示を回避)。 */}
      <View style={s.prompt}><RubyText text={p.prompt} style={s.promptPt} rubyStyle={s.exampleRuby} center /></View>
      {!!p.example && (
        <View style={s.exampleBox}>
          <RubyText text={p.example} target={p.hit} style={s.exampleTxt} hitStyle={s.exampleHit} rubyStyle={s.exampleRuby} center />
        </View>
      )}
      <View style={s.choices}>
        {p.choices.map((ch, k) => {
          const isAns = k === p.answerIndex;
          const picked = sel === k;
          return (
            <Pressable key={k} style={[s.choice, judged !== null && isAns && s.choiceOk, judged !== null && picked && !isAns && s.choiceNg]} onPress={() => tap(k)}>
              <View style={[s.cBadge, judged !== null && isAns && s.cBadgeOk, judged !== null && picked && !isAns && s.cBadgeNg]}>
                <Text style={s.cBadgeTxt}>{judged !== null && isAns ? '✓' : CODE[k]}</Text>
              </View>
              <Text style={s.choiceTxt}>{ch}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTxt: { fontSize: ty.body, color: c.mute, textAlign: 'center' },
  doneBody: { padding: spacing.lg, gap: spacing.lg, alignItems: 'center' },
  doneEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneScore: { fontSize: ty.h2, fontWeight: '800', color: c.blue },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.line },
  hTitle: { fontSize: ty.small, fontWeight: '800', color: c.blueDark },
  prog: { flex: 1, height: 5, borderRadius: 3, backgroundColor: c.bgSoft, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: c.blue, borderRadius: 3 },
  hCount: { fontSize: ty.tiny, fontWeight: '700', color: c.mute },
  x: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.bgSoft, alignItems: 'center', justifyContent: 'center' },
  xTxt: { fontSize: 13, color: c.ink2, fontWeight: '800' },
  ask: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  // prompt
  prompt: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  promptEn: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
  promptPt: { fontSize: ty.h1, fontWeight: '800', color: c.ink, textAlign: 'center' },
  // gMeaning: 文法点の用例(対象語に下線)。意味だけでは判別しづらいため併設。
  exampleBox: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  exampleTxt: { fontSize: ty.body, color: c.ink2, textAlign: 'center' },
  exampleHit: { color: c.blue, fontWeight: '800', textDecorationLine: 'underline' },
  exampleRuby: { color: c.mute },
  promptJa: { fontSize: ty.h2, fontWeight: '700', color: c.ink },
  promptHint: { fontSize: ty.small, color: c.mute, fontWeight: '700', marginTop: spacing.xs, textAlign: 'center' },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  listenTxt: { fontSize: ty.small, fontWeight: '800', color: c.blueDark },
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
  tileK: { paddingVertical: 9, paddingHorizontal: 12 },
  tileKTxt: { fontSize: 16, fontWeight: '700', color: c.ink },
  tileUsed: { opacity: 0.3 },
  // order rows
  orderRows: { gap: 8 },
  oslot: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderRadius: 11, borderWidth: 2, borderColor: c.line, borderStyle: 'dashed', paddingHorizontal: 12, gap: 9 },
  oslotFilled: { borderStyle: 'solid', borderColor: c.blue, backgroundColor: c.blueLight },
  oslotOk: { borderColor: c.green, backgroundColor: c.okBg },
  oslotNg: { borderColor: c.red, backgroundColor: c.ngBg },
  oNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, textAlign: 'center', lineHeight: 20, fontSize: 11, color: c.mute, fontWeight: '700', overflow: 'hidden' },
  oTileTxt: { fontSize: 16, fontWeight: '700', color: c.ink },
  oPlaceholder: { flex: 1 },
  // meaning choices
  choices: { gap: 9 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 14 },
  choiceOk: { borderColor: c.green, backgroundColor: c.okBg },
  choiceNg: { borderColor: c.red, backgroundColor: c.ngBg },
  cBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  cBadgeOk: { backgroundColor: c.green, borderColor: c.green },
  cBadgeNg: { backgroundColor: c.red, borderColor: c.red },
  cBadgeTxt: { fontSize: 12, fontWeight: '800', color: c.ink2 },
  choiceTxt: { flex: 1, fontSize: ty.body, fontWeight: '700', color: c.ink2 },
  // footer
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface },
  fbTxt: { fontSize: ty.h2, fontWeight: '800', flex: 1 },
  saveBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.bgSoft, alignItems: 'center', justifyContent: 'center' },
  cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
});
