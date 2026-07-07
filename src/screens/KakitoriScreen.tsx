// 漢字書き取り(サンプル10字)。3ステップ(なぞり→手本を見て書く→見ないで書く)で
// 指の軌跡を集め、手本への近さを採点(score.ts)。合格(70)でステップ/字が進む。星で進捗。
import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder, Dimensions, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { scoreStrokes, recognize, RECOGNIZE_FLOOR, type Pt } from '../kakitori/score';
import kakitoriSample from '../data/kakitoriSample.json';
import { KANJI } from '../data';
import { useT } from '../i18n';

const W = Math.min(300, Dimensions.get('window').width - 48);
const REF = 116; // 手本(別枠)のサイズ
const STEP_KEYS = ['kakitori.step_trace', 'kakitori.step_guided', 'kakitori.step_recall'];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pts2str = (pts: Pt[], size: number) => pts.map((p) => `${p[0] * size},${p[1] * size}`).join(' ');
const toStr = (pts: Pt[]) => pts2str(pts, W);

// 書き順の動的ガイド: 薄い全体+完了画+現在画を先頭ドットが始点→終点へ進む。番号は現在画のみ(重なり回避)。
function StrokeGuide({ strokes, size, color, faint, playToken }: { strokes: Pt[][]; size: number; color: string; faint: string; playToken: number }) {
  const lens = strokes.map((s) => s.length);
  const sum = lens.reduce((a, b) => a + b, 0);
  const [tick, setTick] = useState(sum); // 既定=完了(静止)。playTokenで先頭から1回だけ再生。
  useEffect(() => {
    setTick(0);
    const id = setInterval(() => setTick((x) => {
      if (x + 1 >= sum) { clearInterval(id); return sum; } // 最後まで来たら停止(繰り返さない)
      return x + 1;
    }), 70); // ゆっくり
    return () => clearInterval(id);
  }, [sum, playToken]);
  const animating = tick < sum;
  let si = strokes.length;
  let pi = 0;
  let q = tick;
  for (let i = 0; i < strokes.length; i++) {
    if (q < lens[i]) { si = i; pi = q; break; }
    q -= lens[i];
  }
  const cur = animating && si < strokes.length ? strokes[si] : null;
  const start = cur ? [cur[0][0] * size, cur[0][1] * size] : null;
  const head = cur ? [cur[Math.min(pi, cur.length - 1)][0] * size, cur[Math.min(pi, cur.length - 1)][1] * size] : null;
  return (
    <>
      {strokes.map((stk, i) => (
        <Polyline key={`gf${i}`} points={pts2str(stk, size)} fill="none" stroke={faint} strokeWidth={size * 0.03} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      ))}
      {strokes.map((stk, i) => (i < si ? (
        <Polyline key={`gd${i}`} points={pts2str(stk, size)} fill="none" stroke={color} strokeWidth={size * 0.038} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      ) : null))}
      {cur && pi > 0 ? (
        <Polyline points={pts2str(cur.slice(0, pi + 1), size)} fill="none" stroke={color} strokeWidth={size * 0.05} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {cur && start ? <Circle cx={start[0]} cy={start[1]} r={size * 0.042} fill={color} /> : null}
      {cur && start ? <SvgText x={start[0]} y={start[1] + size * 0.02} fontSize={size * 0.055} fill="#fff" fontWeight="bold" textAnchor="middle">{`${si + 1}`}</SvgText> : null}
      {cur && head ? <Circle cx={head[0]} cy={head[1]} r={size * 0.035} fill={color} /> : null}
    </>
  );
}

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
  const [last, setLast] = useState<{ as: string; ok: boolean; score: number } | null>(null);
  const [playToken, setPlayToken] = useState(0); // 書き順アニメの再生トリガ(字/ステップ変更・再生ボタンで+1)

  const done = idx >= kakitoriSample.length;
  const k = done ? null : kakitoriSample[idx];

  // 字・ステップが変わるたびに書き順アニメを頭から1回だけ再生。
  useEffect(() => { setPlayToken((x) => x + 1); }, [idx, step]);

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

  const showOverlay = step === 0; // なぞり=手本を重ねる / 見て書く・見ないで書く=キャンバスは白紙
  const showReference = step === 1; // 見て書く=別枠に手本＋書き順(動的)
  const stars = state.kakitori?.[k.char]?.stars ?? 0;
  // 見ないで書く(step2)は対象漢字を出さず、読みだけをヒントに(思い出して書く)。
  const info = KANJI.find((x) => x.char === k.char);
  const cue = (info?.on || info?.kun || '？').split(/[、,]/)[0].replace(/[.\-]/g, '');
  const allPts: Pt[] = [...strokes, cur].flat();

  const clear = () => { setStrokes([]); setCur([]); setLast(null); };
  const grade = () => {
    // 手書き認識: 描いた形を「画ごと・書き順どおり」に全10字テンプレと照合。
    // top1が対象字なら合格(位置・大小に不変・画数一致を要求)。
    const drawn: Pt[][] = strokes;
    const ranking = recognize(drawn, kakitoriSample as { char: string; strokes: number[][][] }[]);
    const top = ranking[0];
    const score = scoreStrokes(drawn, k.strokes as Pt[][]);
    const ok = !!top && top.char === k.char && top.score >= RECOGNIZE_FLOOR;
    setLast({ as: top?.char ?? '?', ok, score });
    if (ok) {
      recordKakitori(k.char, step + 1, score);
      setTimeout(() => {
        if (step < 2) { setStep(step + 1); clear(); }
        else { setIdx(idx + 1); setStep(0); clear(); }
      }, 700);
    }
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Text style={s.count}>{idx + 1} / {kakitoriSample.length}</Text>
        <Text style={s.stars}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.closeTxt}>×</Text></Pressable>
      </View>

      <Text style={s.char}>{step === 2 ? cue : k.char}</Text>
      <Text style={s.stepLabel}>{t(STEP_KEYS[step])}{step === 2 ? ` ・ ${t('kakitori.recall_hint')}` : ''}</Text>

      {step < 2 && (
        <Pressable onPress={() => setPlayToken((x) => x + 1)} style={({ pressed }) => [s.replay, pressed && s.pressed]}>
          <Text style={s.replayTxt}>↻ {t('kakitori.replay')}</Text>
        </Pressable>
      )}

      {showReference && (
        <View style={s.refWrap}>
          <Text style={s.refLabel}>{t('kakitori.model')}</Text>
          <Svg width={REF} height={REF} style={s.refSvg}>
            <StrokeGuide strokes={k.strokes as Pt[][]} size={REF} color={c.red} faint={c.trace} playToken={playToken} />
          </Svg>
        </View>
      )}

      <View style={s.canvasWrap}>
        <View style={[s.canvas, { width: W, height: W }]} {...pan.panHandlers}>
          <Svg width={W} height={W}>
            {showOverlay ? <StrokeGuide strokes={k.strokes as Pt[][]} size={W} color={c.red} faint={c.trace} playToken={playToken} /> : null}
            {[...strokes, cur].map((stk, i) => (
              stk.length > 1 ? <Polyline key={`u${i}`} points={toStr(stk)} fill="none" stroke={c.blue} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" /> : null
            ))}
          </Svg>
        </View>
      </View>

      {last != null && (
        <Text style={[s.score, { color: last.ok ? c.green : c.amber }]}>
          {last.ok ? t('kakitori.pass') : t('kakitori.recognized_as', { char: last.as })} ・ {t('kakitori.score', { n: last.score })}
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
  replay: { alignSelf: 'center', marginTop: spacing.xs, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
  replayTxt: { fontSize: ty.small, fontWeight: '800', color: c.blue },
  refWrap: { alignItems: 'center', marginTop: spacing.sm },
  refLabel: { fontSize: ty.tiny, fontWeight: '800', color: c.mute, marginBottom: 2, letterSpacing: 1 },
  refSvg: { backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line },
  canvasWrap: { alignItems: 'center', marginTop: spacing.sm },
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
