// 水彩背景(App B同系): 桜/空/緑/藤/茜。near-white地＋淡いにじみ(RadialGradient)を全面に敷く。
// 外部素材なし(react-native-svgで描画)。カード(c.surface)は不透明なので可読性は保たれる。
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';

export type BgSkin = 'sakura' | 'sky' | 'green' | 'fuji' | 'akane';
type Bloom = { cx: string; cy: string; rx: string; ry: string; color: string; op: number };

const PALETTE: Record<BgSkin, { base: string; blooms: Bloom[] }> = {
  sakura: { base: '#fff6f9', blooms: [
    { cx: '18%', cy: '10%', rx: '60%', ry: '42%', color: '#ffd0e2', op: 0.75 },
    { cx: '92%', cy: '26%', rx: '52%', ry: '44%', color: '#ffe3c4', op: 0.35 },
    { cx: '50%', cy: '98%', rx: '75%', ry: '42%', color: '#ffdcea', op: 0.6 },
  ] },
  sky: { base: '#f4faff', blooms: [
    { cx: '15%', cy: '12%', rx: '58%', ry: '42%', color: '#c9e6ff', op: 0.8 },
    { cx: '90%', cy: '32%', rx: '55%', ry: '45%', color: '#dff0ff', op: 0.7 },
    { cx: '55%', cy: '96%', rx: '75%', ry: '42%', color: '#d3ecff', op: 0.55 },
  ] },
  green: { base: '#f4fbf5', blooms: [
    { cx: '16%', cy: '12%', rx: '58%', ry: '42%', color: '#cbeed3', op: 0.8 },
    { cx: '90%', cy: '30%', rx: '52%', ry: '44%', color: '#e3f3d8', op: 0.6 },
    { cx: '52%', cy: '97%', rx: '75%', ry: '42%', color: '#d6f2df', op: 0.55 },
  ] },
  fuji: { base: '#f8f6fd', blooms: [
    { cx: '17%', cy: '11%', rx: '58%', ry: '42%', color: '#dcd0f4', op: 0.8 },
    { cx: '91%', cy: '30%', rx: '52%', ry: '44%', color: '#e9def7', op: 0.6 },
    { cx: '50%', cy: '97%', rx: '75%', ry: '42%', color: '#e0d6f5', op: 0.55 },
  ] },
  akane: { base: '#fff6f1', blooms: [
    { cx: '16%', cy: '10%', rx: '60%', ry: '42%', color: '#ffd0bf', op: 0.7 },
    { cx: '90%', cy: '28%', rx: '54%', ry: '46%', color: '#ffe2b8', op: 0.55 },
    { cx: '52%', cy: '98%', rx: '78%', ry: '44%', color: '#ffcfd8', op: 0.6 },
  ] },
};

export default function WatercolorBackground({ skin }: { skin: BgSkin }) {
  const p = PALETTE[skin];
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {p.blooms.map((b, i) => (
          <RadialGradient key={i} id={`wc${skin}${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={b.color} stopOpacity={b.op} />
            <Stop offset="100%" stopColor={b.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect width="100%" height="100%" fill={p.base} />
      {p.blooms.map((b, i) => (
        <Ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={`url(#wc${skin}${i})`} />
      ))}
    </Svg>
  );
}
