// 継続カード(3カードの1枚)。和風フレーム中央に 継続日数(大)＋今週の点＋最長/凍結＋直近4週の点図。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppState } from '../store/store';
import { dayStr, lastNDays } from '../store/state';
import { useT } from '../i18n';
import FramedPanel, { PC, useReveal } from './FramedPanel';

const GOLD = '#f2c14e';
export default function StreakCard({ width }: { width: number }) {
  const t = useT();
  const state = useAppState();
  const { frac } = useReveal();
  const today = dayStr(Date.now());
  const studied = useMemo(() => new Set(state.streak.history), [state.streak.history]);
  const week = lastNDays(today, 7);
  const month = lastNDays(today, 28);
  const cu = (n: number) => Math.round(n * frac);

  return (
    <FramedPanel width={width}>
      <Text style={s.title}>{t('home.section_streak')}</Text>
      <View style={s.bigRow}>
        <Text style={s.fire}>🔥</Text>
        <Text style={s.big}>{t('status.days', { n: cu(state.streak.current) })}</Text>
      </View>
      <View style={s.week}>
        {week.map((d) => (
          <View key={d} style={[s.dot, studied.has(d) && s.dotOn, d === today && s.dotToday]} />
        ))}
      </View>
      <Text style={s.meta}>{t('home.streak_longest', { n: state.streak.longest })}　❄️ {t('home.streak_freezes', { n: state.streak.freezes })}</Text>
      <View style={s.grid}>
        {month.map((d) => (
          <View key={d} style={[s.gdot, studied.has(d) && s.dotOn, d === today && s.dotToday]} />
        ))}
      </View>
    </FramedPanel>
  );
}

const s = StyleSheet.create({
  title: { color: PC.gold, fontWeight: '900', fontSize: 14, fontFamily: 'ShipporiMincho-Bold', marginBottom: 6 },
  bigRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  fire: { fontSize: 30 },
  big: { color: PC.ink, fontWeight: '900', fontSize: 34, fontFamily: 'ShipporiMincho-Bold' },
  week: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },
  dotOn: { backgroundColor: GOLD },
  dotToday: { borderWidth: 2, borderColor: '#fff' },
  meta: { color: PC.mute, fontSize: 12, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: 7 * 20 + 6 * 6 },
  gdot: { width: 14, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
});
