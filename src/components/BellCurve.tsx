// 得点分布ベルカーブ。公式の平均/SDで正規分布を描き、あなたの位置(縦線＋点)と合格ライン(点線)を重ねる。
// あなた以上の面(=上位%相当)を濃く塗り、順位を直感的に示す。模試詳細結果とAIコーチの相対位置カードで共用。
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { OFFICIAL_TOTAL_STAT, type OfficialLevel } from '../data/officialStats';
import type { ThemeColors } from '../theme';

export function BellCurve({ level, score, passTotal, width, c, youLabel, passLabel }: { level: OfficialLevel; score: number; passTotal: number; width: number; c: ThemeColors; youLabel: string; passLabel: string }) {
  const H = 150, padB = 26, padT = 8, padX = 6;
  const { mean, sd } = OFFICIAL_TOTAL_STAT[level];
  const w = width - padX * 2, h = H - padB - padT;
  const xOf = (v: number) => padX + (v / 180) * w;
  const pdf = (v: number) => Math.exp(-((v - mean) ** 2) / (2 * sd * sd));
  const peak = pdf(mean) || 1;
  const yOf = (v: number) => padT + h - (pdf(v) / peak) * h;
  const N = 90;
  const xs = Array.from({ length: N + 1 }, (_, i) => (i / N) * 180);
  const base = padT + h;
  const pts = (arr: number[]) => arr.map((v) => `${xOf(v).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' L ');
  const linePath = `M ${pts(xs)}`;
  // 全体の面(薄い) と あなた以上の面(=上位%相当・濃い)。
  const areaAll = `M ${xOf(0).toFixed(1)} ${base} L ${pts(xs)} L ${xOf(180).toFixed(1)} ${base} Z`;
  const rightXs = xs.filter((v) => v >= score);
  const areaTop = rightXs.length > 1
    ? `M ${xOf(score).toFixed(1)} ${base} L ${pts(rightXs)} L ${xOf(180).toFixed(1)} ${base} Z`
    : '';
  const sx = xOf(score), px = xOf(passTotal);
  return (
    <Svg width={width} height={H}>
      <Path d={areaAll} fill={c.blueLight} opacity={0.5} />
      {areaTop ? <Path d={areaTop} fill={c.blue} opacity={0.28} /> : null}
      <Path d={linePath} fill="none" stroke={c.blue} strokeWidth={2} />
      {/* 合格ライン(点線) */}
      <Line x1={px} y1={padT} x2={px} y2={base} stroke={c.amber} strokeWidth={1.5} strokeDasharray="4 3" />
      <SvgText x={Math.min(px + 3, width - 44)} y={padT + 10} fontSize={10} fill={c.amber} fontWeight="700">{`${passLabel} ${passTotal}`}</SvgText>
      {/* あなた(実線＋点) */}
      <Line x1={sx} y1={padT} x2={sx} y2={base} stroke={c.pink} strokeWidth={2} />
      <Circle cx={sx} cy={yOf(score)} r={4} fill={c.pink} />
      <SvgText x={Math.max(4, Math.min(sx - 12, width - 72))} y={padT + 22} fontSize={11} fill={c.pink} fontWeight="800">{`${youLabel} ${score}`}</SvgText>
      {/* 目盛り */}
      <Line x1={padX} y1={base} x2={padX + w} y2={base} stroke={c.line} strokeWidth={1} />
      {[0, 45, 90, 135, 180].map((v) => (
        <SvgText key={v} x={xOf(v)} y={base + 16} fontSize={9} fill={c.faint} textAnchor="middle">{v}</SvgText>
      ))}
    </Svg>
  );
}
