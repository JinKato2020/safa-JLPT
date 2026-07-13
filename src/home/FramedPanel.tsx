// ホームの3カード共通の枠＋部品。和風フレーム素材を背景に、中央和紙へ内容を載せる。
// useReveal=マウント時に0→1へ伸ばす共有アニメ(バーの伸び＋数値カウントアップ)。
import { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, Easing, StyleSheet } from 'react-native';
import ElectricShader from './ElectricShader';

export const FRAME = require('../../assets/tabs/status_frame.png');
export const FRAME_ASPECT = 640 / 823; // 濃茶木目枠(方式B)の実比率
// 木目の暗色内側上のテキスト/バー色トークン。
export const PC = { gold: '#ffe6a3', ink: '#f3e6cf', mute: '#cdb897', trackBg: 'rgba(14,8,20,0.72)', trackBorder: 'rgba(231,200,119,0.28)' };
// メインバー=虹(参考実測: シアン→金→紫)。区分バー=紫グラデ(参考実測 #EDE6FF→#824EBD→#47387D)。
export const RAMP = ['#66B0D7', '#7fd0c8', '#F6C569', '#e0943f', '#824EBD'];
export const PURPLE_RAMP = ['#ede6ff', '#b79ae6', '#824EBD', '#47387D'];

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

// 段目盛り＋発光の横バー。gradient=メイン(虹)。それ以外=区分(紫グラデ)。参考実測色。
export function AnimBar({ pct, progress, height = 15, segs = 16, gradient }: { pct: number; color?: string; progress: Animated.Value; height?: number; segs?: number; gradient?: boolean }) {
  const w = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(0, Math.min(100, pct))}%`] });
  const ramp = gradient ? RAMP : PURPLE_RAMP;
  return (
    <View style={[styles.track, { height }]}>
      <Animated.View style={[styles.fill, { width: w, shadowColor: gradient ? '#f2c14e' : '#a98fe0' }]}>
        {ramp.map((col, i) => <View key={i} style={{ flex: 1, backgroundColor: col }} />)}
      </Animated.View>
      <Ticks n={segs} />
    </View>
  );
}

// 枠＋中央和紙＋動的電撃層(UVスクロール＋フリッカ)。子は中央和紙に載る。
export default function FramedPanel({ width, children }: { width: number; children: React.ReactNode }) {
  const height = width / FRAME_ASPECT;
  const pad = { paddingLeft: width * 0.20, paddingRight: width * 0.20, paddingTop: height * 0.14, paddingBottom: height * 0.13 };
  const innerX = width * 0.19, innerY = height * 0.13, innerW = Math.round(width * 0.62), innerH = Math.round(height * 0.74);
  return (
    <View style={{ width, height }}>
      <Image source={FRAME} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      {/* 動的電撃層(中央和紙の上・内容の下)= expo-gl の GLSL シェーダ(UVスクロール＋加算合成グロー)。 */}
      <View style={{ position: 'absolute', left: innerX, top: innerY, width: innerW, height: innerH, overflow: 'hidden', opacity: 0.9 }} pointerEvents="none">
        <ElectricShader width={innerW} height={innerH} />
      </View>
      <View style={[StyleSheet.absoluteFill, pad]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'relative', borderRadius: 7, overflow: 'hidden', backgroundColor: PC.trackBg, borderWidth: 1, borderColor: PC.trackBorder, flexDirection: 'row' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, flexDirection: 'row', shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
});
