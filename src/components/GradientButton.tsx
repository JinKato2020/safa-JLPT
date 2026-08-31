// 主導線CTA用の高級感ピルボタン。単色ピルより一段カッコよく:
//  ・SVGの斜めグラデーション地(青→濃紺)＋上半分のガラス光沢(白のフェード)
//  ・白い細リムと色付きの発光シャドウ、押下で軽くスケール
// expo-linear-gradient は未導入のため react-native-svg で描画(角丸はRectのrxで自前に丸める→
// overflow:hidden 不要=Androidの elevation 影も消えない)。onLayoutで実寸を取ってから描く。
import { useState } from 'react';
import { Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

type Props = {
  label: string;
  onPress: () => void;
  colors?: [string, string];        // グラデーション 始点→終点
  glowColor?: string;               // 発光シャドウ色
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;     // 親からの配置(絶対配置など)
  disabledLook?: boolean;           // ロック等のグレー見た目
};

export default function GradientButton({
  label, onPress, colors = ['#4f7dff', '#2436c8'], glowColor = '#2f4fd8',
  accessibilityLabel, style, disabledLook,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const grad = disabledLook ? ['#9aa2b4', '#6f7789'] : colors;
  const glow = disabledLook ? '#000000' : glowColor;
  const r = size.h / 2;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={({ pressed }) => [styles.btn, { shadowColor: glow }, style, pressed && styles.pressed]}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="gbFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={grad[0]} />
              <Stop offset="1" stopColor={grad[1]} />
            </LinearGradient>
            <LinearGradient id="gbGloss" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.30" />
              <Stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} rx={r} ry={r} fill="url(#gbFill)" />
          <Rect x={1} y={1} width={size.w - 2} height={size.h - 2} rx={r} ry={r} fill="url(#gbGloss)" />
        </Svg>
      )}
      <Text style={styles.txt}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 999, paddingVertical: 15, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  pressed: { transform: [{ scale: 0.98 }], shadowOpacity: 0.35 },
  txt: {
    color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
});
