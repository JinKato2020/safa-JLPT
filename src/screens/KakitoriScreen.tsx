// 漢字書き取り(級別・3ステップ)。描画/採点/書き順はエンジンWebView(HanziWriter同梱)に委譲。
// フロー: 各字を なぞり(外形+アニメ)→見ながら書く→見ないで書く の3段。前進は全て手動[次へ]
//   (自動前進しない=本人のペース。見ないでは[次へ]まで何度でも書き直せる)。[スキップ]で字ごと飛ばし。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { kanjiListFor, kanjiInfo } from '../kakitori/list';
import { romajiOf, KANA_ROWS, kanaRowChars } from '../words/kana';
import { buildEngineHtml } from '../kakitori/engineHtml';
import { fetchCharData } from '../kakitori/charData';
import { scoreForMistakes } from '../kakitori/scoring';
import { kakitoriDueToday } from '../kakitori/srs';
import { kakitoriDrillQueue } from '../kakitori/queue';
import levelReadings from '../data/dict/kanjiLevelReadings.json';
import kanjiDrillReps from '../data/words/kanjiDrillReps.json';
import { playVocab, playKanjiRep } from '../data/vocabAudio';
import { vocabIdForWord } from '../words/vocabIndex';
import type { RootStackParamList } from '../navigation/types';
import type { Level } from '../engine/engine';
import { useT } from '../i18n';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

const STEP_KEYS = ['kakitori.step_trace', 'kakitori.step_guided', 'kakitori.step_recall'];
const SET_SIZE = 5; // 1セット=5字。5字を練習(3段)→同じ5字をヒント無しテスト→セッション終了。
const GRIDS = ['ta', 'kome', 'none'] as const;

function readingLine(char: string): string {
  const arr = (levelReadings as Record<string, Array<{ reading: string }>>)[char];
  return arr?.slice(0, 3).map((r) => r.reading).join('・') ?? '';
}
function exampleWord(char: string): string {
  const arr = (levelReadings as unknown as Record<string, Array<{ examples?: [string, string][] }>>)[char];
  const ex = arr?.find((r) => r.examples && r.examples.length)?.examples?.[0];
  return ex ? `${ex[0]}（${ex[1]}）` : '';
}
function dayOf(now: number): string { const d = new Date(now); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${d.getFullYear()}-${m}-${day}`; }

// 軽量な自作プルダウン(グリッド/速度で共通利用)。押すと透明Modalで選択肢を表示。
function Dropdown<T extends string>({ value, options, labelFor, onSelect, s }: {
  value: T; options: readonly T[]; labelFor: (v: T) => string; onSelect: (v: T) => void; s: ReturnType<typeof makeStyles>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.tool}>
        <Text style={s.toolTxt}>{labelFor(value)} ▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.menuBackdrop} onPress={() => setOpen(false)}>
          <View style={s.menu}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => { onSelect(opt); setOpen(false); }}
                style={[s.tool, s.menuItem, value === opt && s.toolOn]}
              >
                <Text style={[s.toolTxt, value === opt && s.toolTxtOn]}>{labelFor(opt)}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function KakitoriScreen() {
  const nav = useNavigation();
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const route = useRoute<RouteProp<RootStackParamList, 'Kakitori'>>();
  const state = useAppState();
  const { recordKakitori, setSettings } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = makeStyles(c);
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildEngineHtml(), []);

  const level = (route.params?.level ?? state.settings.level) as Level;
  const mode = route.params?.mode ?? 'drill';
  const script = route.params?.script ?? 'kanji'; // kanji / hiragana / katakana
  const isKana = script !== 'kanji';
  const singleChar = route.params?.char;
  // 仮名: 練習する行(あ〜ぱ)と「見ないで(ランダム)」モード。漢字では未使用。chars useMemo より前に宣言する。
  const [rowKey, setRowKey] = useState('a');
  const [blind, setBlind] = useState(false);
  // 復習キューはセッション開始時のスナップショットで固定する。
  // mastering中に state.kakitori が変わっても due リストを揺らさない(idxズレ防止)。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chars = useMemo(() => {
    if (singleChar) return [singleChar];
    // 仮名=選んだ行の文字だけ(見ないでモードはランダム順)。漢字=級別リストをSRSキューで先頭5字ずつ。
    if (isKana) {
      const row = kanaRowChars(script as 'hiragana' | 'katakana', rowKey);
      if (!blind) return row;
      const a = [...row];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    const source = kanjiListFor(level);
    if (mode === 'review') { const d = kakitoriDueToday(state.kakitori, dayOf(Date.now())); return (d.length ? d : source).slice(0, SET_SIZE); }
    return kakitoriDrillQueue(state.kakitori, source, dayOf(Date.now())).slice(0, SET_SIZE);
  }, [mode, level, script, rowKey, blind]);

  const grid = state.settings.kakitoriGrid ?? 'kome';
  const speed = state.settings.kakitoriSpeed ?? 'normal';
  const sound = state.settings.kakitoriSound ?? true;
  const [free] = useState(!!singleChar); // 自由練習は単字(辞書から)のみ。ドリル画面はドリル固定(トグル廃止)。
  // 自由練習内の3モード選択(なぞり/見て書く/見ないで書く)。採点/前進には関与しない=セッション内stateのみ。
  const [freeStep, setFreeStepState] = useState(0);
  const readyRef = useRef(false);

  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0); // 0=なぞり / 1=見ながら / 2=見ないで(各字この3段を手動[次へ]で進む)。
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const done = idx >= chars.length;
  const char = done ? '' : chars[idx];
  const info = char ? kanjiInfo(char) : undefined;
  const effStep = free ? freeStep : blind ? 2 : step; // 見ないで=常に想起段(？＋ローマ字だけ)
  const stars = char ? (state.kakitori?.[char]?.stars ?? 0) : 0;

  const inject = (code: string) => { webRef.current?.injectJavaScript(`try{${code}}catch(e){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:String(e)}))}; true;`); };

  // 書き切ったら少し見せてから青線を自動クリア＝同じ段の練習を続けられる(自動前進はしない/ユーザー要望)。
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelReset = () => { if (resetTimer.current) { clearTimeout(resetTimer.current); resetTimer.current = null; } };
  const scheduleReset = () => { cancelReset(); resetTimer.current = setTimeout(() => { resetTimer.current = null; if (readyRef.current) inject('KW.clear()'); }, 700); };
  useEffect(() => cancelReset, []);

  // 指定字をロード→現モードで開始。字形データはRNが取得しWebViewへ注入。
  const loadChar = async (ch: string, st: number) => {
    if (!ch || !readyRef.current) return;
    cancelReset(); // 別の字/段へ移る時は保留中の自動クリアを取り消す(次字を消さない)。
    setLoading(true); setError(false);
    try {
      const data = await fetchCharData(ch);
      inject(`KW.setColors(${JSON.stringify({ stroke: c.blue, outline: c.line, grid: c.mute, highlight: '#22c55e' })}); KW.setGrid(${JSON.stringify(grid)}); KW.setSpeed(${JSON.stringify(speed)}); KW.load(${JSON.stringify(ch)}, ${JSON.stringify(data)});`);
      if (free) inject(`KW.setFreeStep(${st})`); else inject(`KW.setStep(${st})`);
      setLoading(false);
    } catch { setLoading(false); setError(true); }
  };

  useEffect(() => { if (readyRef.current && !done) loadChar(char, effStep); }, [grid, speed, free, freeStep]);
  // 仮名: 行/「見ないで」を切り替えたら先頭字から。
  useEffect(() => {
    if (singleChar || !isKana) return;
    setIdx(0); setStep(0);
    if (readyRef.current && chars.length) loadChar(chars[0], blind ? 2 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey, blind]);

  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);

  const speakReading = (ch: string): string => {
    // 発話は curated 代表(自然)読みを優先。雨→あめ(×ウ「う」)。全612件がひらがな自然読みで音読み単発を回避。
    const rep = (kanjiDrillReps as Record<string, { reading: string }>)[ch]?.reading;
    if (rep) return rep;
    const r = readingLine(ch);
    if (r) return r.split('・')[0];
    const info = kanjiInfo(ch);            // 読み欠けは kanji.json の音/訓 先頭へフォールバック
    const on = (info?.on ?? '').split('、')[0].split('・')[0];
    const kun = (info?.kun ?? '').split('、')[0].split('.')[0];
    return on || kun || '';
  };
  // 音声は「漢字聞き取り」と同一: playVocab(配信mp3) → playKanjiRep(kanji/<字>.mp3) → TTSフォールバック(自然読み)。
  const speak = (ch: string, opts?: { manual?: boolean }) => {
    if (!opts?.manual && !sound) return;   // 自動読み上げのみ設定に従う。手動🎧は常時
    const rep = (kanjiDrillReps as Record<string, { word: string; reading: string }>)[ch];
    const reading = rep?.reading || speakReading(ch);
    const vocabId = rep?.word && rep?.reading ? vocabIdForWord(rep.word, rep.reading) : null;
    const fallback = () => { if (reading) Speech.speak(reading, { language: 'ja-JP' }); };
    Speech.stop();
    if (vocabId) playVocab(vocabId).then((ok) => { if (!ok) fallback(); });
    else playKanjiRep(ch).then((ok) => { if (!ok) fallback(); });
  };

  // 前進は全て手動([次へ]/[スキップ])。各字を なぞり→見ながら→見ないで の3段で進め、
  // 見ないで(step2)で[次へ]を押すと次の字へ。最後の字の[次へ]で done(=セッション終了)。
  const nextChar = () => {
    if (idx + 1 < chars.length) { setIdx(idx + 1); setStep(0); loadChar(chars[idx + 1], blind ? 2 : 0); }
    else setIdx(chars.length); // 5字め完了 → done画面へ
  };
  const advance = () => {
    if (free) return;
    if (blind) { nextChar(); return; } // 見ないで=1回書いたら次の字へ(3段なし)
    if (step < 2) { const ns = step + 1; setStep(ns); loadChar(char, ns); return; } // 同じ字の次の段へ
    nextChar(); // 見ないで完了 → 次の字(または終了)
  };
  const skipChar = () => { if (!free) nextChar(); }; // 字ごとスキップ(3段飛ばして次字)

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; mistakes?: number };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') { readyRef.current = true; if (!done) loadChar(char, effStep); return; }
    if (m.type === 'mistake') { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); return; }
    // 自由練習(なぞり/見て書く/見ないで)の完了: 記録も前進もせず、青線だけ自動リセット＝続けて練習可。
    if (m.type === 'freeComplete') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      scheduleReset();
      return;
    }
    if (m.type === 'complete') {
      if (free) return;
      // 書けたら記録＋フィードバック。ただし自動前進しない=[次へ]は本人が選ぶ
      // (見ないで(step2)は[次へ]を押すまで何度でも書き直せる)。
      const score = scoreForMistakes(m.mistakes ?? 0);
      recordKakitori(char, step + 1, score, { skipped: false, now: Date.now() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // 書き切ったら少し見せてから青線を自動クリア＝同じ字/段を続けて練習できる。前進は[次へ]で本人が選ぶ。
      scheduleReset();
      // 完了後の自動発音は行わない(ユーザー要望)。読み上げは手動🎧のみ。
    }
  };

  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.center}><Text style={s.doneEmoji}>✍️</Text><Text style={s.doneTxt}>{t('kakitori.web_only')}</Text>
          <Pressable style={s.doneBtn} onPress={() => nav.goBack()}><Text style={s.doneBtnTxt}>{t('kakitori.clear')}</Text></Pressable></View>
      </SafeAreaView>
    );
  }
  if (done) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.center}><Text style={s.doneEmoji}>🎉</Text><Text style={s.doneTxt}>{t('learntestsession.done_title')}</Text>
          <Pressable style={s.doneBtn} onPress={() => nav.goBack()}><Text style={s.doneBtnTxt}>{t('learntestsession.back_home')}</Text></Pressable></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable>
        <Text style={s.count}>{idx + 1} / {chars.length}</Text>
        <Text style={s.stars}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {isKana && !singleChar && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rowSel}>
            {KANA_ROWS.map((r) => (
              <Pressable key={r.key} onPress={() => setRowKey(r.key)} style={[s.rowChip, rowKey === r.key && s.rowChipOn]}>
                <Text style={[s.rowChipTxt, rowKey === r.key && s.rowChipTxtOn]}>{r.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={s.infoRow}>
          <Text style={s.infoChar}>{effStep === 2 ? '？' : char}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.infoReading}>{isKana ? romajiOf(char) : readingLine(char)}</Text>
            <Text style={s.infoMeaning} numberOfLines={1}>{isKana ? (script === 'hiragana' ? 'ひらがな' : 'カタカナ') : (info?.meaning ?? '')}</Text>
            {!isKana && !!exampleWord(char) && effStep !== 2 && <Text style={s.infoExample}>{t('kakitori.model')}: {exampleWord(char)}</Text>}
          </View>
          <Pressable onPress={() => (isKana ? (Speech.stop(), Speech.speak(char, { language: 'ja-JP' })) : speak(char, { manual: true }))} hitSlop={10}><Ionicons name="headset-outline" size={26} color={c.blue} /></Pressable>
        </View>

        {!free && !blind && (
          <View style={s.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.dotWrap}>
                <View style={[s.dot, i <= step && s.dotOn]} />
                <Text style={[s.dotLabel, i === step && s.dotLabelOn]}>{t(STEP_KEYS[i])}</Text>
              </View>
            ))}
          </View>
        )}
        {free && (
          <View style={s.toolbar}>
            {[0, 1, 2].map((i) => (
              <Pressable
                key={i}
                onPress={() => setFreeStepState(i)}
                style={[s.tool, freeStep === i && s.toolOn]}
              >
                <Text style={[s.toolTxt, freeStep === i && s.toolTxtOn]}>{t(STEP_KEYS[i])}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={s.canvas}>
          <WebView ref={webRef} originWhitelist={['*']} source={{ html }} onMessage={onMessage}
            style={s.web} scrollEnabled={false} javaScriptEnabled domStorageEnabled />
          {loading && <View style={s.loader}><ActivityIndicator color={c.blue} /><Text style={s.loaderTxt}>{t('kakitori.loading_char')}</Text></View>}
          {error && <View style={s.loader}><Text style={s.loaderTxt}>{t('kakitori.load_error')}</Text>
            <Pressable style={s.doneBtn} onPress={() => loadChar(char, step)}><Text style={s.doneBtnTxt}>{t('kakitori.retry')}</Text></Pressable></View>}
        </View>

        {/* 漢字=グリッドのみ(スピード/ドリルトグルは削除)。仮名=グリッド＋「見て書く / 見ないで(ランダム)」。 */}
        <View style={s.toolbar}>
          <Dropdown value={grid} options={GRIDS} labelFor={(g) => t('kakitori.grid_' + g)} onSelect={(g) => setSettings({ kakitoriGrid: g })} s={s} />
          {isKana && (
            <>
              <Pressable onPress={() => setBlind(false)} style={[s.tool, !blind && s.toolOn]}><Text style={[s.toolTxt, !blind && s.toolTxtOn]}>{t('kakitori.kana_see')}</Text></Pressable>
              <Pressable onPress={() => setBlind(true)} style={[s.tool, blind && s.toolOn]}><Text style={[s.toolTxt, blind && s.toolTxtOn]}>{t('kakitori.kana_blind')}</Text></Pressable>
            </>
          )}
        </View>
        <View style={s.toolbar}>
          {/* お手本はヒント。見ないで(step2)では隠してヒント無しにする。 */}
          {effStep !== 2 && (
            <Pressable onPress={() => { if (readyRef.current) inject('KW.showAnswer()'); }} style={s.tool}><Text style={s.toolTxt}>↻ {t('kakitori.show_model')}</Text></Pressable>
          )}
          <Pressable onPress={() => { if (readyRef.current) inject('KW.clear()'); }} style={s.tool}><Text style={s.toolTxt}>{t('kakitori.clear')}</Text></Pressable>
        </View>

        {!free && (
          <View style={s.actions}>
            <Pressable style={[s.actBtn, s.actGhost]} onPress={skipChar}><Text style={s.actGhostTxt}>{t('kakitori.skip')}</Text></Pressable>
            <Pressable style={[s.actBtn, s.actPrimary]} onPress={advance}><Text style={s.actPrimaryTxt}>{t('kakitori.next')} →</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  doneEmoji: { fontSize: 56 }, doneTxt: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
  doneBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: c.blue },
  doneBtnTxt: { color: '#fff', fontWeight: '800', fontSize: ty.body },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  close: { fontSize: 30, color: c.mute, fontWeight: '700' }, count: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  stars: { fontSize: ty.h2, color: c.amber, letterSpacing: 2 },
  body: { paddingBottom: spacing.xl },
  rowSel: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  rowChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, marginRight: 6 },
  rowChipOn: { borderColor: c.blue, backgroundColor: c.blueLight },
  rowChipTxt: { fontSize: ty.body, fontWeight: '800', color: c.ink2 },
  rowChipTxtOn: { color: c.blueDark },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  infoChar: { fontSize: 40, fontWeight: '800', color: c.ink },
  infoReading: { fontSize: ty.body, fontWeight: '700', color: c.ink }, infoMeaning: { fontSize: ty.small, color: c.mute },
  infoExample: { fontSize: ty.small, color: c.blue }, speak: { fontSize: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  dotWrap: { alignItems: 'center', gap: 4 }, dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.line },
  dotOn: { backgroundColor: c.blue }, dotLabel: { fontSize: ty.small, color: c.mute }, dotLabelOn: { color: c.blue, fontWeight: '800' },
  testBanner: { alignItems: 'center', gap: 2, marginTop: spacing.md },
  testPhase: { fontSize: ty.body, fontWeight: '800', color: c.blue },
  testProg: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  canvas: { alignSelf: 'center', width: SIZE, height: SIZE, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, overflow: 'hidden', marginTop: spacing.md },
  web: { flex: 1, backgroundColor: 'transparent' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: c.surface },
  loaderTxt: { fontSize: ty.small, color: c.mute },
  toolbar: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.lg },
  tool: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
  toolOn: { backgroundColor: c.blue, borderColor: c.blue }, toolTxt: { fontSize: ty.small, fontWeight: '700', color: c.ink }, toolTxtOn: { color: '#fff' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  menu: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.sm, gap: spacing.xs, minWidth: 160 },
  menuItem: { alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  actBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  actGhost: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line }, actGhostTxt: { fontSize: ty.body, fontWeight: '800', color: c.mute },
  actPrimary: { backgroundColor: c.blue }, actPrimaryTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
});
const SIZE = 320;
