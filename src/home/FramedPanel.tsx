// ホームの3カード共通の枠＋部品。和風フレーム素材を背景に、中央和紙へ内容を載せる。
// useReveal=マウント時に0→1へ伸ばす共有アニメ(バーの伸び＋数値カウントアップ)。
import { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, Easing, StyleSheet } from 'react-native';

export const FRAME = require('../../assets/tabs/status_frame.png');
export const FRAME_ASPECT = 720 / 987;
// 和紙(暗色)上のテキスト/バー色トークン。
export const PC = { gold: '#ffe6a3', ink: '#f3e6cf', mute: '#cdb897', trackBg: 'rgba(10,8,20,0.65)', trackBorder: 'rgba(231,200,119,0.25)' };
export const RAMP = ['#37d6a0', '#7fd94a', '#f2c14e', '#ef7a4a', '#e85f86'];

/** マウント時に 0→1 へ伸びる共有値＋数値カウントアップ用の frac。 */
export function useReveal(duration = 1000): { progress: Animated.Value; frac: number } {
  const progress = useRef(new Animated.Value(0)).current;
  const [frac, setFrac] = useState(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => setFrac(value));
    Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => progress.removeListener(id);
  }, [progress, duration]);
  return { progress, frac };
}

// 段(タリー)の目盛りを重ねる装飾。
export function Ticks({ n }: { n: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {Array.from({ length: n }).map((_, i) => (
          <View key={i} style={{ flex: 1, borderRightWidth: i < n - 1 ? 1 : 0, borderRightColor: 'rgba(8,6,4,0.55)' }} />
        ))}
      </View>
    </View>
  );
}

// 単色フィル(段目盛り＋発光)の横バー。gradient=合格Lv用のカラーランプ。
export function AnimBar({ pct, color, progress, height = 15, segs = 16, gradient }: { pct: number; color?: string; progress: Animated.Value; height?: number; segs?: number; gradient?: boolean }) {
  const w = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(0, Math.min(100, pct))}%`] });
  return (
    <View style={[styles.track, { height }]}>
      <Animated.View style={[styles.fill, { width: w, backgroundColor: gradient ? undefined : color, shadowColor: color ?? '#f2c14e' }]}>
        {gradient ? RAMP.map((col, i) => <View key={i} style={{ flex: 1, backgroundColor: col }} />) : null}
      </Animated.View>
      <Ticks n={segs} />
    </View>
  );
}

// 枠＋中央和紙の内側パディング。子は中央和紙に載る。
export default function FramedPanel({ width, children }: { width: number; children: React.ReactNode }) {
  const height = width / FRAME_ASPECT;
  const pad = { paddingLeft: width * 0.17, paddingRight: width * 0.14, paddingTop: height * 0.095, paddingBottom: height * 0.085 };
  return (
    <View style={{ width, height }}>
      <Image source={FRAME} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      <View style={[StyleSheet.absoluteFill, pad]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'relative', borderRadius: 7, overflow: 'hidden', backgroundColor: PC.trackBg, borderWidth: 1, borderColor: PC.trackBorder, flexDirection: 'row' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, flexDirection: 'row', shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
});
