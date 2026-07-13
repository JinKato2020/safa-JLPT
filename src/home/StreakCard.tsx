// カード③(継続)。DQ風: 称号＋合格到達Lv(共通ヘッダー)＋継続日数(大)＋総学習時間＋今週/直近4週の点図。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppState } from '../store/store';
import { dayStr, lastNDays } from '../store/state';
import { useT } from '../i18n';
import { studyHM, type HomeStatus } from './homeStatus';
import FramedPanel, { PC, useReveal } from './FramedPanel';
import StatusHeader from './StatusHeader';

const GOLD = '#f2c14e';
export default function StreakCard({ data, width }: { data: HomeStatus; width: number }) {
  const t = useT();
  const state = useAppState();
  const { frac } = useReveal();
  const today = dayStr(Date.now());
  const studied = useMemo(() => new Set(state.streak.history), [state.streak.history]);
  const week = lastNDays(today, 7);
  const month = lastNDays(today, 28);
  const cu = (n: number) => Math.round(n * frac);
  const { h, m } = studyHM(data.studySeconds);

  return (
    <FramedPanel width={width}>
      <StatusHeader passPct={data.passPct} rankTitleKey={data.rankTitleKey} />
      <View style={s.statRow}>
        <View style={s.stat}>
          <Text style={s.statLbl}>{t('home.section_streak')}</Text>
          <Text style={s.big}>🔥{t('status.days', { n: cu(state.streak.current) })}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLbl}>{t('status.studytime_label')}</Text>
          <Text style={s.big}>{h > 0 ? t('status.time_hm', { h, m }) : t('status.time_m', { m })}</Text>
        </View>
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
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  stat: { flex: 1 },
  statLbl: { color: PC.gold, fontWeight: '800', fontSize: 11, fontFamily: 'ShipporiMincho-Bold' },
  big: { color: PC.ink, fontWeight: '900', fontSize: 20, fontFamily: 'ShipporiMincho-Bold', marginTop: 2 },
  week: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.12)' },
  dotOn: { backgroundColor: GOLD },
  dotToday: { borderWidth: 2, borderColor: '#fff' },
  meta: { color: PC.mute, fontSize: 11.5, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, width: 7 * 18 + 6 * 5 },
  gdot: { width: 13, height: 13, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
});
