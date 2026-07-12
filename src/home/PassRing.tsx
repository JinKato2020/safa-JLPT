// 合格リング(Skia)。外=5科目カバー率の発光弧／中=総合正答の光弧／中央=呼吸する発光ディスク＋金の称号。
// reanimated は使わず、React状態＋requestAnimationFrame でアニメ(弧の伸び/中央の呼吸/金装飾の微回転)。
// 見出し・称号テキストは RN Text をキャンバス上に重ねる(フォント一貫・多言語・可読性の影)。
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, Circle, Group, RadialGradient, LinearGradient, Blur, DashPathEffect, vec } from '@shopify/react-native-skia';
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
  const rotate = phase * 0.1;
  const s = size / 400; // 400 viewBox → 実サイズ

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ scale: s }]}>
          {/* 中央: 呼吸する発光＋ディスク＋金縁 */}
          <Circle cx={C} cy={C} r={R_IN + 16} opacity={breathe}>
            <RadialGradient c={vec(C, C - 20)} r={R_IN + 34} colors={['#fff0f6', '#f5b8d2', '#7b4f9c']} />
            <Blur blur={12} />
          </Circle>
          <Circle cx={C} cy={C} r={R_IN}>
            <RadialGradient c={vec(C, C - 18)} r={R_IN} colors={['#fff0f6', '#f5b8d2', '#7b4f9c']} />
          </Circle>
          <Circle cx={C} cy={C} r={R_IN} style="stroke" strokeWidth={2} color="#e7c877" opacity={0.85} />

          {/* 外リング: 5科目カバー率(トラック＋グロー＋シャープ) */}
          {data.categories.map((cat, i) => {
            const a0 = i * SEG + GAP / 2, a1 = i * SEG + SEG - GAP / 2;
            const p = arcPath(R_OUT, a0, a1);
            const end = progress * (cat.coveragePct / 100);
            return (
              <Group key={cat.key}>
                <Path path={p} style="stroke" strokeWidth={OUT_W} strokeCap="round" color="rgba(255,255,255,0.10)" />
                <Path path={p} style="stroke" strokeWidth={OUT_W + 4} strokeCap="round" color={cat.color} start={0} end={end} opacity={0.5}>
                  <Blur blur={5} />
                </Path>
                <Path path={p} style="stroke" strokeWidth={OUT_W} strokeCap="round" color={cat.color} start={0} end={end} />
              </Group>
            );
          })}

          {/* 中リング: 総合正答(エネルギーの光弧) */}
          <Path path={arcPath(R_MID, 4, 356)} style="stroke" strokeWidth={MID_W} strokeCap="round" color="rgba(255,255,255,0.10)" />
          <Path path={arcPath(R_MID, 4, 356)} style="stroke" strokeWidth={MID_W} strokeCap="round" start={0} end={progress * (data.overallAccuracyPct / 100)}>
            <LinearGradient start={vec(60, 60)} end={vec(340, 340)} colors={['#8fe6ff', '#c9a0ff']} />
            <Blur blur={3} />
          </Path>

          {/* 金の装飾(微回転) */}
          <Group origin={vec(C, C)} transform={[{ rotate }]}>
            <Circle cx={C} cy={C} r={R_OUT + 11} style="stroke" strokeWidth={1.5} color="#e7c877" opacity={0.5}>
              <DashPathEffect intervals={[2, 10]} />
            </Circle>
            <Circle cx={C} cy={C} r={R_OUT - 11} style="stroke" strokeWidth={1} color="#b8924a" opacity={0.5} />
          </Group>
        </Group>
      </Canvas>

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
