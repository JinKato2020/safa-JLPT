// 漢字書き取り(級別・3ステップ)。描画/採点/書き順はエンジンWebView(HanziWriter同梱)に委譲。
// フロー: なぞり(外形+アニメ)→見て書く→見ないで書く。自動合格＋常時[次へ/スキップ]で詰み防止。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { kanjiListFor, kanjiInfo } from '../kakitori/list';
import { buildEngineHtml } from '../kakitori/engineHtml';
import { fetchCharData } from '../kakitori/charData';
import { scoreForMistakes } from '../kakitori/scoring';
import { kakitoriDueToday } from '../kakitori/srs';
import levelReadings from '../data/kanjiLevelReadings.json';
import type { RootStackParamList } from '../navigation/types';
import type { Level } from '../engine/engine';
import { useT } from '../i18n';

const STEP_KEYS = ['kakitori.step_trace', 'kakitori.step_guided', 'kakitori.step_recall'];
const GRIDS = ['ta', 'kome', 'none'] as const;
const SPEEDS = ['slow', 'normal', 'fast'] as const;

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
  // 復習キューはセッション開始時のスナップショットで固定する。
  // mastering中に state.kakitori が変わっても due リストを揺らさない(idxズレ防止)。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chars = useMemo(() => {
    if (mode === 'review') { const d = kakitoriDueToday(state.kakitori, dayOf(Date.now())); return d.length ? d : kanjiListFor(level); }
    return kanjiListFor(level);
  }, [mode, level]);

  const grid = state.settings.kakitoriGrid ?? 'kome';
  const speed = state.settings.kakitoriSpeed ?? 'normal';
  const sound = state.settings.kakitoriSound ?? true;
  const [free, setFree] = useState(state.settings.kakitoriMode === 'free');
  const readyRef = useRef(false);

  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const done = idx >= chars.length;
  const char = done ? '' : chars[idx];
  const info = char ? kanjiInfo(char) : undefined;
  const stars = char ? (state.kakitori?.[char]?.stars ?? 0) : 0;

  const inject = (code: string) => { webRef.current?.injectJavaScript(`try{${code}}catch(e){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:String(e)}))}; true;`); };

  // 指定字をロード→現モードで開始。字形データはRNが取得しWebViewへ注入。
  const loadChar = async (ch: string, st: number) => {
    if (!ch || !readyRef.current) return;
    setLoading(true); setError(false);
    try {
      const data = await fetchCharData(ch);
      inject(`KW.setColors(${JSON.stringify({ stroke: c.blue, outline: c.line, grid: c.mute, highlight: '#22c55e' })}); KW.setGrid(${JSON.stringify(grid)}); KW.setSpeed(${JSON.stringify(speed)}); KW.load(${JSON.stringify(ch)}, ${JSON.stringify(data)});`);
      if (free) inject('KW.setFree(true)'); else inject(`KW.setStep(${st})`);
      setLoading(false);
    } catch { setLoading(false); setError(true); }
  };

  useEffect(() => { if (readyRef.current && !done) loadChar(char, step); }, [grid, speed, free]);

  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);

  const speakReading = (ch: string): string => {
    const r = readingLine(ch);
    if (r) return r.split('・')[0];
    const info = kanjiInfo(ch);            // 読み欠けは kanji.json の音/訓 先頭へフォールバック
    const on = (info?.on ?? '').split('、')[0].split('・')[0];
    const kun = (info?.kun ?? '').split('、')[0].split('.')[0];
    return on || kun || '';
  };
  const speak = (ch: string, opts?: { manual?: boolean }) => {
    if (!opts?.manual && !sound) return;   // 自動読み上げのみ設定に従う。手動🔊は常時
    const r = speakReading(ch);
    if (r) Speech.speak(r, { language: 'ja-JP' });
  };

  // 自動/手動を単一の前進関数に集約(タイミング競合を断つ)。
  const advance = () => {
    if (free) return;
    if (step < 2) { const ns = step + 1; setStep(ns); loadChar(char, ns); return; }
    const ni = idx + 1; setIdx(ni); setStep(0);
    if (ni < chars.length) loadChar(chars[ni], 0);
  };
  const skipChar = () => { const ni = idx + 1; setIdx(ni); setStep(0); if (ni < chars.length) loadChar(chars[ni], 0); };

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; mistakes?: number };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') { readyRef.current = true; if (!done) loadChar(char, step); return; }
    if (m.type === 'mistake') { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); return; }
    if (m.type === 'complete') {
      const score = scoreForMistakes(m.mistakes ?? 0);
      recordKakitori(char, step + 1, score, { skipped: false, now: Date.now() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (step >= 2) speak(char);
      setTimeout(advance, 700);
    }
  };

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
        <View style={s.center}><Text style={s.doneEmoji}>🎉</Text><Text style={s.doneTxt}>{t('kakitori.mastered')}</Text>
          <Pressable style={s.doneBtn} onPress={() => nav.goBack()}><Text style={s.doneBtnTxt}>{t('kakitori.clear')}</Text></Pressable></View>
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
        <View style={s.infoRow}>
          <Text style={s.infoChar}>{step === 2 && !free ? '？' : char}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.infoReading}>{readingLine(char)}</Text>
            <Text style={s.infoMeaning} numberOfLines={1}>{info?.meaning ?? ''}</Text>
            {!!exampleWord(char) && <Text style={s.infoExample}>{t('kakitori.model')}: {exampleWord(char)}</Text>}
          </View>
          <Pressable onPress={() => speak(char, { manual: true })} hitSlop={10}><Text style={s.speak}>🔊</Text></Pressable>
        </View>

        {!free && (
          <View style={s.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.dotWrap}>
                <View style={[s.dot, i <= step && s.dotOn]} />
                <Text style={[s.dotLabel, i === step && s.dotLabelOn]}>{t(STEP_KEYS[i])}</Text>
              </View>
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

        <View style={s.toolbar}>
          <Dropdown value={grid} options={GRIDS} labelFor={(g) => t('kakitori.grid_' + g)} onSelect={(g) => setSettings({ kakitoriGrid: g })} s={s} />
          <Dropdown value={speed} options={SPEEDS} labelFor={(sp) => t('kakitori.speed_' + sp)} onSelect={(sp) => setSettings({ kakitoriSpeed: sp })} s={s} />
          <Pressable
            onPress={() => { const nf = !free; setSettings({ kakitoriMode: nf ? 'free' : 'drill' }); setFree(nf); }}
            style={[s.tool, free && s.toolOn]}
          >
            <Text style={[s.toolTxt, free && s.toolTxtOn]}>{t(free ? 'kakitori.free_mode' : 'kakitori.drill_mode')}</Text>
          </Pressable>
        </View>
        <View style={s.toolbar}>
          <Pressable onPress={() => { if (readyRef.current) inject('KW.showAnswer()'); }} style={s.tool}><Text style={s.toolTxt}>↻ {t('kakitori.show_model')}</Text></Pressable>
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
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  infoChar: { fontSize: 40, fontFamily: 'ShipporiMincho-Bold', color: c.ink },
  infoReading: { fontSize: ty.body, fontWeight: '700', color: c.ink }, infoMeaning: { fontSize: ty.small, color: c.mute },
  infoExample: { fontSize: ty.small, color: c.blue }, speak: { fontSize: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  dotWrap: { alignItems: 'center', gap: 4 }, dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.line },
  dotOn: { backgroundColor: c.blue }, dotLabel: { fontSize: ty.small, color: c.mute }, dotLabelOn: { color: c.blue, fontWeight: '800' },
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
