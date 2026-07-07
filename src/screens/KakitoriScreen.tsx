// 漢字書き取り(サンプル10字)。3ステップ(なぞり→手本を見て書く→見ないで書く)で
// 指の軌跡を集め、手本への近さを採点(score.ts)。合格(70)でステップ/字が進む。星で進捗。
import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder, Dimensions, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { scoreDrawing, PASS_SCORE, type Pt } from '../kakitori/score';
import kakitoriSample from '../data/kakitoriSample.json';
import { useT } from '../i18n';

const W = Math.min(320, Dimensions.get('window').width - 48);
const STEP_KEYS = ['kakitori.step_trace', 'kakitori.step_guided', 'kakitori.step_recall'];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const toStr = (pts: Pt[]) => pts.map((p) => `${p[0] * W},${p[1] * W}`).join(' ');

export default function KakitoriScreen() {
  const nav = useNavigation();
  const state = useAppState();
  const { recordKakitori } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);

  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0); // 0=trace,1=guided,2=recall
  const [strokes, setStrokes] = useState<Pt[][]>([]); // 確定した画
  const [cur, setCur] = useState<Pt[]>([]); // 描画中の画
  const [last, setLast] = useState<number | null>(null);

  const done = idx >= kakitoriSample.length;
  const k = done ? null : kakitoriSample[idx];

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          setCur([[clamp01(locationX / W), clamp01(locationY / W)]]);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          setCur((p) => [...p, [clamp01(locationX / W), clamp01(locationY / W)]]);
        },
        onPanResponderRelease: () => {
          setCur((p) => {
            if (p.length) setStrokes((st) => [...st, p]);
            return [];
          });
        },
      }),
    [],
  );

  if (done || !k) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.center}>
          <Text style={s.doneEmoji}>🎉</Text>
          <Text style={s.doneTxt}>{t('kakitori.mastered')}</Text>
          <Pressable style={s.closeBtn} onPress={() => nav.goBack()}><Text style={s.closeTxt}>×</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const modelOpacity = step === 0 ? 0.5 : step === 1 ? 0.18 : 0;
  const stars = state.kakitori?.[k.char]?.stars ?? 0;
  const allPts: Pt[] = [...strokes, cur].flat();

  const clear = () => { setStrokes([]); setCur([]); setLast(null); };
  const grade = () => {
    const user: Pt[] = strokes.flat();
    const sc = scoreDrawing(user, k.strokes as Pt[][]);
    setLast(sc);
    if (sc >= PASS_SCORE) {
      recordKakitori(k.char, step + 1, sc);
      setTimeout(() => {
        if (step < 2) { setStep(step + 1); clear(); }
        else { setIdx(idx + 1); setStep(0); clear(); }
      }, 650);
    }
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Text style={s.count}>{idx + 1} / {kakitoriSample.length}</Text>
        <Text style={s.stars}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.closeTxt}>×</Text></Pressable>
      </View>

      <Text style={s.char}>{k.char}</Text>
      <Text style={s.stepLabel}>{t(STEP_KEYS[step])}</Text>

      <View style={s.canvasWrap}>
        <View style={[s.canvas, { width: W, height: W }]} {...pan.panHandlers}>
          <Svg width={W} height={W}>
            {k.strokes.map((stk, i) => (
              <Polyline key={`m${i}`} points={toStr(stk as Pt[])} fill="none" stroke={c.trace} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={modelOpacity} />
            ))}
            {[...strokes, cur].map((stk, i) => (
              stk.length > 1 ? <Polyline key={`u${i}`} points={toStr(stk)} fill="none" stroke={c.blue} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" /> : null
            ))}
          </Svg>
        </View>
      </View>

      {last != null && (
        <Text style={[s.score, { color: last >= PASS_SCORE ? c.green : c.amber }]}>
          {t('kakitori.score', { n: last })} ・ {last >= PASS_SCORE ? t('kakitori.pass') : t('kakitori.retry')}
        </Text>
      )}

      <View style={s.btnRow}>
        <Pressable style={({ pressed }) => [s.btnGhost, pressed && s.pressed]} onPress={clear} disabled={!allPts.length}>
          <Text style={s.btnGhostTxt}>{t('kakitori.clear')}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [s.btnPrimary, pressed && s.pressed, !allPts.length && s.btnDisabled]} onPress={grade} disabled={!allPts.length}>
          <Text style={s.btnPrimaryTxt}>{t('kakitori.grade')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  doneEmoji: { fontSize: 56 },
  doneTxt: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  count: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  stars: { fontSize: ty.h2, color: c.amber, letterSpacing: 2 },
  closeBtn: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  closeTxt: { fontSize: 30, color: c.mute, fontWeight: '700' },
  char: { fontSize: 40, fontFamily: 'ShipporiMincho-Bold', color: c.ink, textAlign: 'center', marginTop: spacing.sm },
  stepLabel: { fontSize: ty.body, fontWeight: '700', color: c.blue, textAlign: 'center', marginTop: spacing.xs },
  canvasWrap: { alignItems: 'center', marginTop: spacing.md },
  canvas: { ...shadow(1), backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line },
  score: { fontSize: ty.body, fontWeight: '800', textAlign: 'center', marginTop: spacing.md },
  btnRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  btnGhost: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.bgSoft },
  btnGhostTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink2 },
  btnPrimary: { flex: 2, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.blue },
  btnPrimaryTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
