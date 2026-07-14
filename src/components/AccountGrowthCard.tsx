// 成長カード(アカウント画面・清潔系)。覚えた語の総数＋今週の増加＋直近14日のバー推移。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppState } from '../store/store';
import { learnedNow } from '../store/selectors';
import { dayStr } from '../store/state';
import { growthBars, weekGain } from '../home/growthStats';
import { useT } from '../i18n';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';

const CHART_H = 40;

export default function AccountGrowthCard() {
  const state = useAppState();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const today = dayStr(now);
  const learned = learnedNow(state, now);
  const gain = weekGain(state, today, 7);
  const bars = growthBars(state, today, 14);
  const max = Math.max(1, ...bars);
  const last = bars.length - 1;

  return (
    <View style={s.card}>
      <Text style={s.head}>🌱 {t('home.section_growth')}</Text>
      <View style={s.row}>
        <Text style={s.big}>{t('account.learned_words', { n: learned })}</Text>
        {gain > 0 ? <Text style={s.gain}>{t('account.week_gain', { n: gain })}</Text> : null}
      </View>
      <Text style={s.trendLbl}>{t('account.growth_trend')}</Text>
      <View style={[s.chart, { height: CHART_H }]}>
        {bars.map((v, i) => (
          <View key={i} style={s.col}>
            <View style={{ width: '68%', height: Math.max(2, (v / max) * (CHART_H - 8)), backgroundColor: c.green, opacity: i === last ? 1 : 0.45, borderRadius: 2 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.lg, gap: spacing.xs },
  head: { fontSize: ty.small, fontWeight: '800', color: c.green, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  big: { fontSize: ty.h1, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
  gain: { fontSize: ty.small, fontWeight: '800', color: c.green },
  trendLbl: { fontSize: ty.tiny, color: c.faint, fontWeight: '700', marginTop: spacing.xs },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingHorizontal: 4, paddingVertical: 3, marginTop: 2 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
});
