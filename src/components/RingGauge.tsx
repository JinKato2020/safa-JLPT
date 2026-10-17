// モダンな発光リング(progress)。淡い同色トラック＋柔らかいグロー＋グラデーション＋発光ビーズ＋丸キャップ。
// 色は成績/合格圏(緑/橙/赤)。children=中央表示(ホーム到達度)、label=区分名、mark=合格ライン印。掲示板§3/§10。
import { useRef, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { type as ty, useColors } from '../theme';

let _gid = 0;

export default function RingGauge({
  value, color, label, size = 68, stroke = 7, children, mark, sub,
}: {
  value: number | null; color: string; label?: string; size?: number; stroke?: number; children?: ReactNode; mark?: number; sub?: string;
}) {
  const c = useColors();
  const idRef = useRef<string | undefined>(undefined);
  if (!idRef.current) idRef.current = `rg-grad-${_gid++}`;
  const gid = idRef.current!;

  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const offset = circ * (1 - pct / 100);
  const mid = size / 2;

  // 進捗の先端(発光ビーズ)座標
  const endA = ((-90 + (360 * pct) / 100) * Math.PI) / 180;
  const ex = mid + r * Math.cos(endA);
  const ey = mid + r * Math.sin(endA);

  // 合格ラインの印
  const markA = ((-90 + (360 * Math.max(0, Math.min(100, mark ?? 0))) / 100) * Math.PI) / 180;
  const mr1 = r - stroke / 2 - 3;
  const mr2 = r + stroke / 2 + 3;

  const drawn = value !== null && pct > 0;

  return (
    <View style={s.wrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={1} />
              <Stop offset="0.7" stopColor={color} stopOpacity={0.85} />
              <Stop offset="1" stopColor={color} stopOpacity={0.45} />
            </LinearGradient>
          </Defs>
          {/* トラック(進捗色を淡く) */}
          <Circle cx={mid} cy={mid} r={r} stroke={color} strokeOpacity={0.13} strokeWidth={stroke} fill="none" />
          {drawn ? (
            <>
              {/* 柔らかいグロー */}
              <Circle
                cx={mid} cy={mid} r={r} stroke={color} strokeWidth={stroke + 8} fill="none"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                opacity={0.15} transform={`rotate(-90 ${mid} ${mid})`}
              />
              {/* 本体(グラデーション) */}
              <Circle
                cx={mid} cy={mid} r={r} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                transform={`rotate(-90 ${mid} ${mid})`}
              />
              {/* 先端: 発光ビーズ(色の玉＋白い芯) */}
              <Circle cx={ex} cy={ey} r={stroke * 0.95} fill={color} opacity={0.22} />
              <Circle cx={ex} cy={ey} r={stroke * 0.58} fill={color} />
              <Circle cx={ex} cy={ey} r={stroke * 0.24} fill="#ffffff" opacity={0.92} />
            </>
          ) : null}
          {/* 合格ライン印 */}
          {mark != null ? (
            <Line
              x1={mid + mr1 * Math.cos(markA)} y1={mid + mr1 * Math.sin(markA)}
              x2={mid + mr2 * Math.cos(markA)} y2={mid + mr2 * Math.sin(markA)}
              stroke={c.ink} strokeWidth={2} strokeLinecap="round"
            />
          ) : null}
        </Svg>
        {children ?? (
          <Text style={[s.pct, { color: value === null ? c.trace : color }]}>
            {value === null ? '–' : value}
          </Text>
        )}
      </View>
      {label ? <Text numberOfLines={2} style={[s.label, { color: c.mute }]}>{label}</Text> : null}
      {sub ? <Text style={[s.sub, { color: c.faint }]}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  pct: { fontSize: ty.body, fontWeight: '800' },
  label: { fontSize: ty.tiny, textAlign: 'center', maxWidth: 84, lineHeight: 13 },
  sub: { fontSize: 10, fontWeight: '700' },
});
