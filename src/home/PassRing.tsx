// 合格リング(react-native-svg)。外=5科目カバー率の発光弧／中=総合正答の光弧／中央=呼吸する発光ディスク＋金の称号。
// Skiaは newArchEnabled 下で起動クラッシュの実績があり、既存の react-native-svg(実績あり)へ移行。
// アニメは React状態＋requestAnimationFrame(弧の伸び/中央の呼吸/金装飾の微回転)。見出し・称号は RN Text を重ねる。
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Circle, Path, Defs, RadialGradient, LinearGradient, Stop } from 'react-native-svg';
import { arcPath, C, R_OUT, R_MID, R_IN, SEG, GAP } from './ringGeometry';
import type { PassRingData } from './passRingData';

const OUT_W = 14, MID_W = 11;

export function PassRing({ data, size }: { data: PassRingData; size: number }) {
  const [progress, setProgress] = useState(0); // 弧の伸び 0→1
  const [phase, setPhase] = useState(0); // 連続位相(呼吸/回転)
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const el = t - startRef.current;
      setProgress(Math.min(1, el / 1200));
      setPhase(el / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const breathe = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(phase * 1.7));
  const rotateDeg = (phase * 6) % 360;

  // 部分弧を安全に描く(伸びが極小なら描かない=退化パス回避)。
  const partial = (r: number, a0: number, a1: number, frac: number): string | null => {
    const f = Math.max(0, Math.min(1, frac));
    if (f <= 0.002) return null;
    return arcPath(r, a0, a0 + (a1 - a0) * f);
  };

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 400 400">
        <Defs>
          <RadialGradient id="pr-center" cx={C} cy={C - 18} r={R_IN} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#fff0f6" />
            <Stop offset="0.55" stopColor="#f5b8d2" />
            <Stop offset="1" stopColor="#7b4f9c" />
          </RadialGradient>
          <RadialGradient id="pr-halo" cx={C} cy={C - 20} r={R_IN + 34} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#fff0f6" stopOpacity="0.9" />
            <Stop offset="0.6" stopColor="#f5b8d2" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#7b4f9c" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="pr-energy" x1="60" y1="60" x2="340" y2="340" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#8fe6ff" />
            <Stop offset="1" stopColor="#c9a0ff" />
          </LinearGradient>
        </Defs>

        {/* 中央: 呼吸する発光(halo)＋ディスク＋金縁 */}
        <Circle cx={C} cy={C} r={R_IN + 22} fill="url(#pr-halo)" opacity={breathe} />
        <Circle cx={C} cy={C} r={R_IN} fill="url(#pr-center)" />
        <Circle cx={C} cy={C} r={R_IN} fill="none" stroke="#e7c877" strokeWidth={2} opacity={0.85} />

        {/* 外リング: 5科目カバー率(トラック＋グロー＋シャープ) */}
        {data.categories.map((cat, i) => {
          const a0 = i * SEG + GAP / 2, a1 = i * SEG + SEG - GAP / 2;
          const d = partial(R_OUT, a0, a1, progress * (cat.coveragePct / 100));
          return (
            <G key={cat.key}>
              <Path d={arcPath(R_OUT, a0, a1)} stroke="rgba(255,255,255,0.12)" strokeWidth={OUT_W} strokeLinecap="round" fill="none" />
              {d ? <Path d={d} stroke={cat.color} strokeWidth={OUT_W + 5} strokeLinecap="round" fill="none" opacity={0.28} /> : null}
              {d ? <Path d={d} stroke={cat.color} strokeWidth={OUT_W} strokeLinecap="round" fill="none" /> : null}
            </G>
          );
        })}

        {/* 中リング: 総合正答(エネルギーの光弧) */}
        <Path d={arcPath(R_MID, 4, 356)} stroke="rgba(255,255,255,0.12)" strokeWidth={MID_W} strokeLinecap="round" fill="none" />
        {(() => {
          const d = partial(R_MID, 4, 356, progress * (data.overallAccuracyPct / 100));
          return d ? <Path d={d} stroke="url(#pr-energy)" strokeWidth={MID_W} strokeLinecap="round" fill="none" /> : null;
        })()}

        {/* 金の装飾(微回転) */}
        <G rotation={rotateDeg} originX={C} originY={C}>
          <Circle cx={C} cy={C} r={R_OUT + 11} fill="none" stroke="#e7c877" strokeWidth={1.5} strokeDasharray="2 10" opacity={0.5} />
          <Circle cx={C} cy={C} r={R_OUT - 11} fill="none" stroke="#b8924a" strokeWidth={1} opacity={0.5} />
        </G>
      </Svg>

      {/* 見出し・称号(RN Text オーバーレイ) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Overlay top={0.115} size={size} main={'知の精進'} />
        <Overlay top={0.155} size={size} rich={`${data.level} 合格可能性 `} val={`${data.passPct}%`} />
        <Overlay top={0.27} size={size} main={'試験の実力'} small />
        <Overlay top={0.31} size={size} rich={'総合 '} val={`${data.overallAccuracyPct}%`} />
        <Overlay top={0.385} size={size} main={'心の準備'} small />
        <Text style={[styles.center, { top: size * 0.44, fontSize: size * 0.14 }]}>{data.tier}</Text>
      </View>
    </View>
  );
}

function Overlay({ top, size, main, small, rich, val }: { top: number; size: number; main?: string; small?: boolean; rich?: string; val?: string }) {
  return (
    <View style={[styles.row, { top: top * size }]} pointerEvents="none">
      {main ? <Text style={[styles.head, { fontSize: size * (small ? 0.037 : 0.04) }]}>{main}</Text> : null}
      {rich ? (
        <Text style={[styles.headSm, { fontSize: size * 0.03 }]}>
          {rich}<Text style={[styles.val, { fontSize: size * 0.036 }]}>{val}</Text>
        </Text>
      ) : null}
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 } as const;
const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  head: { color: '#f3e9d8', fontWeight: '800', letterSpacing: 1, ...shadow },
  headSm: { color: '#e4d7ef', fontWeight: '700', ...shadow },
  val: { color: '#ffe6a3', fontWeight: '900' },
  center: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#ffe6a3', fontWeight: '900', fontFamily: 'ShipporiMincho-Bold', ...shadow },
});
