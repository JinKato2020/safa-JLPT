// 漢字書き取り(級別・3ステップ)。描画/採点/書き順はエンジンWebView(HanziWriter同梱)に委譲。
// フロー: 各字を なぞり(外形+アニメ)→見ながら書く→見ないで書く の3段。前進は全て手動[次へ]
//   (自動前進しない=本人のペース。見ないでは[次へ]まで何度でも書き直せる)。[スキップ]で字ごと飛ばし。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
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
const KOME_SIDE = 64; // お手本の米マスセルの一辺(px)。

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

// お手本の文字を「米マス(格子＋枠)」の中に表示する小セル。書き取りキャンバスと同じ見た目でお手本を示す。
// 縦横の中心線＋2本の対角線(＝米)を薄く敷き、枠(border)で囲う。
function KomeCell({ ch, s }: { ch: string; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.komeCell}>
      <View style={s.komeLineV} />
      <View style={s.komeLineH} />
      <View style={[s.komeDiag, s.komeDiag1]} />
      <View style={[s.komeDiag, s.komeDiag2]} />
      <Text style={s.komeChar}>{ch}</Text>
    </View>
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
  const { recordKakitori } = useAppActions();
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
  // 仮名: 練習する行(あ〜ぱ)。漢字では未使用。chars useMemo より前に宣言する。
  const [rowKey, setRowKey] = useState('a');
  // 復習キューはセッション開始時のスナップショットで固定する。
  // mastering中に state.kakitori が変わっても due リストを揺らさない(idxズレ防止)。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chars = useMemo(() => {
    if (singleChar) return [singleChar];
    // 仮名=選んだ行の文字だけ。漢字=級別リストをSRSキューで先頭5字ずつ。
    if (isKana) return kanaRowChars(script as 'hiragana' | 'katakana', rowKey);
    const source = kanjiListFor(level);
    if (mode === 'review') { const d = kakitoriDueToday(state.kakitori, dayOf(Date.now())); return (d.length ? d : source).slice(0, SET_SIZE); }
    return kakitoriDrillQueue(state.kakitori, source, dayOf(Date.now())).slice(0, SET_SIZE);
  }, [mode, level, script, rowKey]);

  const grid = 'kome' as const; // お手本/キャンバスとも米マスに固定(選択UIは廃止・ユーザー要望)。
  const speed = state.settings.kakitoriSpeed ?? 'normal';
  const sound = state.settings.kakitoriSound ?? true;
  const [free] = useState(!!singleChar); // 自由練習は単字(辞書から)のみ。ドリル画面はドリル固定(トグル廃止)。
  // 自由練習内の3モード選択(なぞり/見て書く/見ないで書く)。採点/前進には関与しない=セッション内stateのみ。
  const [freeStep, setFreeStepState] = useState(0);
  const readyRef = useRef(false);

  const [idx, setIdx] = useState(0);
  // 2ターン制: 学習ターン(5字を1字ずつ「なぞり/見て書く」から選んで練習)→テストターン(同じ5字を見ずに書いて採点)。
  const [turn, setTurn] = useState<'learn' | 'test'>('learn');
  const [learnMode, setLearnMode] = useState(0); // 学習ターンの書き方: 0=なぞり / 1=手本を見て書く(スイッチ)。
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const done = !free && turn === 'test' && idx >= chars.length; // テスト5字完了で終了(自由練習は終了しない)。
  const char = idx < chars.length ? chars[idx] : '';
  const info = char ? kanjiInfo(char) : undefined;
  // 実効ステップ(WebViewへ渡す): 自由練習=freeStep / 学習ターン=選択中の書き方 / テストターン=見ないで(2)。
  const effStep = free ? freeStep : (turn === 'learn' ? learnMode : 2);
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
  // 仮名: 行を切り替えたら先頭字・学習ターンのなぞりから。
  useEffect(() => {
    if (singleChar || !isKana) return;
    setIdx(0); setTurn('learn'); setLearnMode(0);
    if (readyRef.current && chars.length) loadChar(chars[0], 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey]);

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

  // 前進は全て手動([次へ]/[スキップ])。
  // 学習ターン: 選んだ書き方(なぞり/見て書く)で1字ずつ練習→[次へ]で次字。5字終わったらテストターンへ。
  // テストターン: 見ずに1字ずつ書いて採点→[次へ]で次字。5字終わったら done。
  const advance = () => {
    if (free) return;
    if (turn === 'learn') {
      if (idx + 1 < chars.length) { setIdx(idx + 1); loadChar(chars[idx + 1], learnMode); }
      else { setTurn('test'); setIdx(0); loadChar(chars[0], 2); } // 学習5字完了 → 見ずにテストへ
      return;
    }
    if (idx + 1 < chars.length) { setIdx(idx + 1); loadChar(chars[idx + 1], 2); }
    else setIdx(chars.length); // テスト5字完了 → done画面へ
  };
  const skipChar = () => { if (!free) advance(); }; // スキップ=このターンの次の字へ
  // 自由練習: 3モード(なぞり/見て/見ないで)を直接選ぶ。学習ターン: なぞり↔見て書くのスイッチ。
  const goStep = (i: number) => {
    if (free) { setFreeStepState(i); return; }
    if (done || turn !== 'learn') return; // テストターンは見ずに固定=切替不可
    setLearnMode(i);
    if (readyRef.current) loadChar(char, i);
  };

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
      // テストターン(見ずに書く)の完成だけを採点・記録=SRSスケジュール＋write面(step3)へ底上げ。
      // 学習ターン(なぞり/見て書く)は練習なので記録しない(何度でも書き直せる)。前進は[次へ]で本人が選ぶ。
      if (turn === 'test') {
        const score = scoreForMistakes(m.mistakes ?? 0);
        recordKakitori(char, 3, score, { skipped: false, now: Date.now() });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // 書き切ったら少し見せてから青線を自動クリア＝続けて練習できる。
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
          {/* お手本の文字は米マス(格子＋枠)の中に表示。見ないで段(effStep2)ではお手本を隠す=？。 */}
          <KomeCell ch={effStep === 2 ? '？' : char} s={s} />
          <View style={{ flex: 1 }}>
            <Text style={s.infoReading}>{isKana ? romajiOf(char) : readingLine(char)}</Text>
            <Text style={s.infoMeaning} numberOfLines={1}>{isKana ? t(script === 'hiragana' ? 'common.hiragana' : 'common.katakana') : (info?.meaning ?? '')}</Text>
            {!isKana && !!exampleWord(char) && effStep !== 2 && <Text style={s.infoExample}>{t('kakitori.model')}: {exampleWord(char)}</Text>}
          </View>
          <Pressable onPress={() => (isKana ? (Speech.stop(), Speech.speak(char, { language: 'ja-JP' })) : speak(char, { manual: true }))} hitSlop={10}><Ionicons name="headset-outline" size={26} color={c.blue} /></Pressable>
        </View>

        {/* 自由練習=3モード直接選択。ドリル/仮名=2ターン制。学習ターンは「なぞり/見て書く」をスイッチで選び、
            テストターンは見ずに書く固定。 */}
        {free ? (
          <View style={s.dots}>
            {[0, 1, 2].map((i) => (
              <Pressable key={i} style={s.dotWrap} onPress={() => goStep(i)} hitSlop={6}>
                <View style={[s.dot, i === effStep && s.dotOn]} />
                <Text style={[s.dotLabel, i === effStep && s.dotLabelOn]}>{t(STEP_KEYS[i])}</Text>
              </Pressable>
            ))}
          </View>
        ) : turn === 'learn' ? (
          <View style={s.turnBox}>
            <Text style={s.turnLabel}>① {t('kakitori.turn_learn')}　{idx + 1} / {chars.length}</Text>
            <View style={s.switchRow}>
              {[0, 1].map((i) => (
                <Pressable key={i} style={[s.switchBtn, i === learnMode && s.switchBtnOn]} onPress={() => goStep(i)}>
                  <Text style={[s.switchTxt, i === learnMode && s.switchTxtOn]}>{t(STEP_KEYS[i])}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={s.turnBox}>
            <Text style={s.turnLabelTest}>② {t('kakitori.turn_test')}・{t('kakitori.step_recall')}　{idx + 1} / {chars.length}</Text>
          </View>
        )}

        <View style={s.canvas}>
          <WebView ref={webRef} originWhitelist={['*']} source={{ html }} onMessage={onMessage}
            style={s.web} scrollEnabled={false} javaScriptEnabled domStorageEnabled />
          {loading && <View style={s.loader}><ActivityIndicator color={c.blue} /><Text style={s.loaderTxt}>{t('kakitori.loading_char')}</Text></View>}
          {error && <View style={s.loader}><Text style={s.loaderTxt}>{t('kakitori.load_error')}</Text>
            <Pressable style={s.doneBtn} onPress={() => loadChar(char, effStep)}><Text style={s.doneBtnTxt}>{t('kakitori.retry')}</Text></Pressable></View>}
        </View>

        {/* お手本を見る/クリア。米マスグリッドは常時(選択UIは廃止)。仮名の見て書く/見ないでランダムも廃止=上の見出しタップで切替。 */}
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
            <Pressable style={[s.actBtn, s.actPrimary]} onPress={advance}><Text style={s.actPrimaryTxt}>{(turn === 'learn' && idx + 1 >= chars.length) ? t('kakitori.to_test') : t('kakitori.next')} →</Text></Pressable>
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
  // お手本の米マスセル(枠＋縦横中心線＋2本の対角線)。文字はセル中央に重ねる。
  komeCell: { width: KOME_SIDE, height: KOME_SIDE, borderRadius: 6, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  komeLineV: { position: 'absolute', left: KOME_SIDE / 2 - 0.5, top: 0, bottom: 0, width: 1, backgroundColor: c.mute, opacity: 0.4 },
  komeLineH: { position: 'absolute', top: KOME_SIDE / 2 - 0.5, left: 0, right: 0, height: 1, backgroundColor: c.mute, opacity: 0.4 },
  komeDiag: { position: 'absolute', left: KOME_SIDE / 2 - 0.5, top: (KOME_SIDE - 91) / 2, width: 1, height: 91, backgroundColor: c.mute, opacity: 0.28 },
  komeDiag1: { transform: [{ rotate: '45deg' }] },
  komeDiag2: { transform: [{ rotate: '-45deg' }] },
  komeChar: { fontSize: 38, fontWeight: '800', color: c.ink },
  infoReading: { fontSize: ty.body, fontWeight: '700', color: c.ink }, infoMeaning: { fontSize: ty.small, color: c.mute },
  infoExample: { fontSize: ty.small, color: c.blue }, speak: { fontSize: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  dotWrap: { alignItems: 'center', gap: 4 }, dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.line },
  dotOn: { backgroundColor: c.blue }, dotLabel: { fontSize: ty.small, color: c.mute }, dotLabelOn: { color: c.blue, fontWeight: '800' },
  // 2ターン制の見出し＋学習ターンの書き方スイッチ(なぞり/見て書く)。
  turnBox: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  turnLabel: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  turnLabelTest: { fontSize: ty.body, fontWeight: '800', color: c.blue },
  switchRow: { flexDirection: 'row', gap: spacing.sm, backgroundColor: c.bgSoft, borderRadius: radius.pill, padding: 3, borderWidth: 1, borderColor: c.line },
  switchBtn: { paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  switchBtnOn: { backgroundColor: c.blue },
  switchTxt: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
  switchTxtOn: { color: '#fff' },
  canvas: { alignSelf: 'center', width: SIZE, height: SIZE, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, overflow: 'hidden', marginTop: spacing.md },
  web: { flex: 1, backgroundColor: 'transparent' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: c.surface },
  loaderTxt: { fontSize: ty.small, color: c.mute },
  toolbar: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.lg },
  tool: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
  toolOn: { backgroundColor: c.blue, borderColor: c.blue }, toolTxt: { fontSize: ty.small, fontWeight: '700', color: c.ink }, toolTxtOn: { color: '#fff' },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  actBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  actGhost: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line }, actGhostTxt: { fontSize: ty.body, fontWeight: '800', color: c.mute },
  actPrimary: { backgroundColor: c.blue }, actPrimaryTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
});
const SIZE = 320;
