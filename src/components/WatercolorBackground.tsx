// 水彩背景(App B同系): 桜/空/緑/藤/茜。near-white地＋淡いにじみ(RadialGradient)を全面に敷く。
// 外部素材なし(react-native-svgで描画)。カード(c.surface)は不透明なので可読性は保たれる。
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';

export type BgSkin = 'sakura' | 'sky' | 'green' | 'fuji' | 'akane';
type Bloom = { cx: string; cy: string; rx: string; ry: string; color: string; op: number };

// 淡く上品な水彩ウォッシュ: ほぼ白の地に、大きく柔らかい低不透明のにじみを重ねる(App B系の繊細さ)。
const PALETTE: Record<BgSkin, { base: string; blooms: Bloom[] }> = {
  sakura: { base: '#fffbfc', blooms: [
    { cx: '12%', cy: '6%', rx: '72%', ry: '52%', color: '#ffdbe8', op: 0.5 },
    { cx: '96%', cy: '22%', rx: '60%', ry: '52%', color: '#fff0dd', op: 0.4 },
    { cx: '55%', cy: '104%', rx: '90%', ry: '50%', color: '#ffe6ef', op: 0.42 },
  ] },
  sky: { base: '#fafdff', blooms: [
    { cx: '10%', cy: '8%', rx: '72%', ry: '52%', color: '#d9edff', op: 0.55 },
    { cx: '96%', cy: '26%', rx: '62%', ry: '54%', color: '#eaf6ff', op: 0.5 },
    { cx: '58%', cy: '104%', rx: '92%', ry: '52%', color: '#e2f2ff', op: 0.42 },
  ] },
  green: { base: '#fafdfb', blooms: [
    { cx: '12%', cy: '8%', rx: '72%', ry: '52%', color: '#dbf2e1', op: 0.55 },
    { cx: '95%', cy: '24%', rx: '60%', ry: '52%', color: '#eef8e6', op: 0.45 },
    { cx: '55%', cy: '104%', rx: '90%', ry: '52%', color: '#e2f5e8', op: 0.42 },
  ] },
  fuji: { base: '#fcfbfe', blooms: [
    { cx: '13%', cy: '7%', rx: '72%', ry: '52%', color: '#e6ddf7', op: 0.52 },
    { cx: '95%', cy: '24%', rx: '60%', ry: '52%', color: '#f1ecfa', op: 0.45 },
    { cx: '54%', cy: '104%', rx: '90%', ry: '52%', color: '#ebe3f8', op: 0.42 },
  ] },
  akane: { base: '#fffbf8', blooms: [
    { cx: '12%', cy: '6%', rx: '74%', ry: '52%', color: '#ffdccf', op: 0.48 },
    { cx: '95%', cy: '22%', rx: '62%', ry: '54%', color: '#ffedcf', op: 0.42 },
    { cx: '55%', cy: '104%', rx: '92%', ry: '52%', color: '#ffdbe0', op: 0.44 },
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
