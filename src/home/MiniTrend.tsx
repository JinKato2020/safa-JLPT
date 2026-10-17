// DQ風のミニ推移グラフ(直近N日)。棒(バー)で表示=依存なし・確実に描画。最新日を明るく。
import { View, Text, StyleSheet } from 'react-native';
import { PC } from './FramedPanel';

export default function MiniTrend({ title, values, color = '#f2c14e', height = 32 }: {
  title: string; values: number[]; color?: string; height?: number;
}) {
  const vals = values.length ? values : [0];
  const max = Math.max(1, ...vals);
  const last = vals.length - 1;
  return (
    <View style={s.wrap}>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <View style={[s.chart, { height }]}>
        {vals.map((v, i) => (
          <View key={i} style={s.col}>
            <View style={{ width: '68%', height: Math.max(2, (v / max) * (height - 6)), backgroundColor: color, opacity: i === last ? 1 : 0.6, borderRadius: 1 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 7 },
  title: { color: PC.mute, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: 'rgba(14,8,20,0.42)', borderRadius: 5, borderWidth: 1, borderColor: PC.trackBorder, paddingHorizontal: 3, paddingVertical: 2 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
});
