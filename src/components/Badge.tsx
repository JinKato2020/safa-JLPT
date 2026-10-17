// バッジ/勲章: 値(0-100)に応じて10段階の画像を表示。set=natural/gorgeous, metric=pass(合格率)/cover(カバー率)。
import { Image, View, Text, StyleSheet } from 'react-native';
import { BADGE_IMAGES, badgeTierIndex, type BadgeSet, type BadgeMetric } from '../data/badges';

export default function Badge({ set, metric, pct, size = 48, label }: {
  set: BadgeSet;
  metric: BadgeMetric;
  pct: number | null;
  size?: number;
  label?: string;
}) {
  const tier = pct === null ? 0 : badgeTierIndex(pct);
  const src = BADGE_IMAGES[set][metric][tier];
  return (
    <View style={s.wrap}>
      <Image source={src} style={{ width: size, height: size, resizeMode: 'contain', opacity: pct === null ? 0.45 : 1 }} />
      {label ? <Text style={s.lbl}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  lbl: { fontSize: 10, color: '#94a3b8', marginTop: 1, fontWeight: '700' },
});
