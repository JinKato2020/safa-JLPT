// ホームの3カード共通の枠＋部品。ドラクエ風の「コマンドウィンドウ」= 紺地＋白の角丸二重枠。
// (旧: 木目素材＋放電シェーダは廃止。ユーザー指定でDQ風のクリーンな枠に統一。)
// useReveal=マウント時に0→1へ伸ばす共有アニメ(バーの伸び＋数値カウントアップ)。
import { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

export const FRAME_ASPECT = 640 / 823; // カード縦横比(据え置き=ホームのレイアウト互換)。
// DQ風ウィンドウ(紺地)上のテキスト/バー色トークン。寒色系・高コントラスト。
export const PC = { gold: '#ffd76a', ink: '#eef2ff', mute: '#a9b4d6', trackBg: 'rgba(6,10,26,0.72)', trackBorder: 'rgba(180,200,255,0.30)' };
// DQ風ウィンドウの地色(上→下でわずかに明→暗)。gradientライブラリ不使用のため単色帯を重ねて近似。
const WIN = { top: '#1b2a58', bottom: '#0e1836', border: '#eef2ff', innerBorder: 'rgba(180,200,255,0.35)' };
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

// DQ風コマンドウィンドウ。紺地の角丸＋白の外枠＋淡色の内枠、上に薄い明色帯で立体感。子は中央に載る。
export default function FramedPanel({ width, children }: { width: number; children: React.ReactNode }) {
  const height = width / FRAME_ASPECT;
  return (
    <View style={[styles.win, { width, height }]}>
      {/* 地色の縦グラデ近似: 下地(暗)の上に上半分だけ明色帯を重ねる。 */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WIN.bottom, borderRadius: 16 }]} />
      <View style={[styles.topBand, { height: height * 0.5, backgroundColor: WIN.top }]} pointerEvents="none" />
      {/* 内側の淡い二重枠(DQらしさ)。 */}
      <View style={styles.innerBorder} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, { paddingHorizontal: width * 0.075, paddingVertical: height * 0.07 }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  win: { borderRadius: 16, borderWidth: 2, borderColor: WIN.border, overflow: 'hidden', backgroundColor: WIN.bottom,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  topBand: { position: 'absolute', left: 0, right: 0, top: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, opacity: 0.55 },
  innerBorder: { position: 'absolute', left: 5, top: 5, right: 5, bottom: 5, borderRadius: 11, borderWidth: 1, borderColor: WIN.innerBorder },
  track: { position: 'relative', borderRadius: 7, overflow: 'hidden', backgroundColor: PC.trackBg, borderWidth: 1, borderColor: PC.trackBorder, flexDirection: 'row' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, flexDirection: 'row', shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
});
