// ホームの到達度ゲージ(根本刷新)= 光る計器ダイヤル。
// ①進捗で点灯する60目盛りベゼル ②グラデーション弧 ③多層グロー(ブルーム) ④白芯入り彗星ヘッド ⑤合格ライン刻み。
// 中央は children(到達度の数値±)。色は成績/合格圏(緑/橙/赤)。Profileの小リングは RingGauge を継続使用。
import { useRef, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useColors } from '../theme';

let _hg = 0;
const TICKS = 60;

export default function HeroGauge({
  value, color, mark, marks, size = 212, stroke = 14, children,
}: {
  value: number | null; color: string; mark?: number; marks?: number[]; size?: number; stroke?: number; children?: ReactNode;
}) {
  const c = useColors();
  const idRef = useRef<string | undefined>(undefined);
  if (!idRef.current) idRef.current = `hg-${_hg++}`;
  const gid = idRef.current!;

  const mid = size / 2;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const drawn = value !== null && pct > 0;

  const rTickOut = mid - 3;
  const rTickIn = rTickOut - 8;
  const rRing = rTickIn - 11;
  const circ = 2 * Math.PI * rRing;
  const offset = circ * (1 - pct / 100);

  // 彗星ヘッド
  const endA = ((-90 + 3.6 * pct) * Math.PI) / 180;
  const ex = mid + rRing * Math.cos(endA);
  const ey = mid + rRing * Math.sin(endA);

  // 合格ライン刻み(ベゼルを貫く)
  const markPct = Math.max(0, Math.min(100, mark ?? 0));
  const mA = ((-90 + 3.6 * markPct) * Math.PI) / 180;
  const mri = rRing - stroke / 2 - 2;
  const mro = rTickOut + 1;

  const ticks = [];
  for (let i = 0; i < TICKS; i++) {
    const a = ((-90 + (360 * i) / TICKS) * Math.PI) / 180;
    const lit = drawn && (100 * i) / TICKS <= pct;
    ticks.push(
      <Line
        key={i}
        x1={mid + rTickIn * Math.cos(a)} y1={mid + rTickIn * Math.sin(a)}
        x2={mid + rTickOut * Math.cos(a)} y2={mid + rTickOut * Math.sin(a)}
        stroke={lit ? color : c.trace}
        strokeOpacity={lit ? 0.9 : 0.45}
        strokeWidth={lit ? 2.4 : 1.4}
        strokeLinecap="round"
      />,
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.7" stopColor={color} stopOpacity={0.85} />
            <Stop offset="1" stopColor={color} stopOpacity={0.4} />
          </LinearGradient>
        </Defs>

        {ticks}

        {/* 内側トラック(淡い同色) */}
        <Circle cx={mid} cy={mid} r={rRing} stroke={color} strokeOpacity={0.1} strokeWidth={stroke} fill="none" />

        {drawn ? (
          <>
            {/* 多層グロー(ブルーム) */}
            <Circle
              cx={mid} cy={mid} r={rRing} stroke={color} strokeWidth={stroke + 16} fill="none"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" opacity={0.06}
              transform={`rotate(-90 ${mid} ${mid})`}
            />
            <Circle
              cx={mid} cy={mid} r={rRing} stroke={color} strokeWidth={stroke + 8} fill="none"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" opacity={0.13}
              transform={`rotate(-90 ${mid} ${mid})`}
            />
            {/* 本体(グラデーション) */}
            <Circle
              cx={mid} cy={mid} r={rRing} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              transform={`rotate(-90 ${mid} ${mid})`}
            />
            {/* 彗星ヘッド(発光ビーズ) */}
            <Circle cx={ex} cy={ey} r={stroke * 1.05} fill={color} opacity={0.18} />
            <Circle cx={ex} cy={ey} r={stroke * 0.6} fill={color} />
            <Circle cx={ex} cy={ey} r={stroke * 0.26} fill="#ffffff" opacity={0.95} />
          </>
        ) : null}

        {/* 帯の基準線(JFT=145/175/200の3本など。淡い線) */}
        {(marks ?? []).map((mk, i) => {
          const p = Math.max(0, Math.min(100, mk));
          const a = ((-90 + 3.6 * p) * Math.PI) / 180;
          return (
            <Line
              key={`mk-${i}`}
              x1={mid + mri * Math.cos(a)} y1={mid + mri * Math.sin(a)}
              x2={mid + mro * Math.cos(a)} y2={mid + mro * Math.sin(a)}
              stroke={c.mute} strokeWidth={1.6} strokeLinecap="round" strokeOpacity={0.7}
            />
          );
        })}

        {/* 合格ライン刻み(単一) */}
        {mark != null ? (
          <Line
            x1={mid + mri * Math.cos(mA)} y1={mid + mri * Math.sin(mA)}
            x2={mid + mro * Math.cos(mA)} y2={mid + mro * Math.sin(mA)}
            stroke={c.ink} strokeWidth={2.5} strokeLinecap="round"
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
