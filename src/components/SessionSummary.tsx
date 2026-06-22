// セッション結果の「伸び」表示(誠実な序盤の伸び体感)。要点3つに絞る:
// 採点した語↑ / 信頼幅±の収束(精度UP) / 🔥streak。スコアは水増ししない。掲示板§2・§10。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import type { ProgressSnapshot } from '../store/selectors';

type Styles = ReturnType<typeof makeStyles>;

export default function SessionSummary({
  before, after, streak,
}: {
  before: ProgressSnapshot; after: ProgressSnapshot; streak: number;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const dTouched = after.touched - before.touched;
  const narrowed = before.band - after.band; // >0 = ± が縮んだ=精度UP

  return (
    <View style={s.card}>
      <Text style={s.h}>このセッションの伸び</Text>
      <Row s={s} label="採点した語" value={`+${dTouched}`} good={dTouched > 0} />
      <Row
        s={s}
        label="信頼幅(精度)"
        value={narrowed > 0 ? `±${before.band} → ±${after.band}` : `±${after.band}`}
        good={narrowed > 0}
      />
      <Row s={s} label="連続" value={`🔥 ${streak}`} good={false} />
    </View>
  );
}

function Row({ s, label, value, good }: { s: Styles; label: string; value: string; good: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, good && s.valueGood]}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  h: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: ty.small, color: c.mute },
  value: { fontSize: ty.body, fontWeight: '800', color: c.ink2 },
  valueGood: { color: c.green },
});
