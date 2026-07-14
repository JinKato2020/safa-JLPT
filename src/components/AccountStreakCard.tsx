// 継続カード(アカウント画面・清潔系)。継続日数＋最長/フリーズ＋総学習時間＋直近7日ドット＋28日グリッド。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppState } from '../store/store';
import { dayStr, lastNDays } from '../store/state';
import { studyHM } from '../home/homeStatus';
import { useT } from '../i18n';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';

export default function AccountStreakCard() {
  const state = useAppState();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const today = dayStr(Date.now());
  const studied = useMemo(() => new Set(state.streak.history), [state.streak.history]);
  const week = lastNDays(today, 7);
  const month = lastNDays(today, 28);
  const { h, m } = studyHM(state.studySeconds ?? 0);

  return (
    <View style={s.card}>
      <Text style={s.head}>🔥 {t('home.section_streak')}</Text>
      <View style={s.row}>
        <Text style={s.big}>{t('status.days', { n: state.streak.current })}</Text>
        <View style={s.timeWrap}>
          <Text style={s.timeLbl}>{t('status.studytime_label')}</Text>
          <Text style={s.time}>{h > 0 ? t('status.time_hm', { h, m }) : t('status.time_m', { m })}</Text>
        </View>
      </View>
      <Text style={s.meta}>{t('home.streak_longest', { n: state.streak.longest })}　❄️ {t('home.streak_freezes', { n: state.streak.freezes })}</Text>
      <View style={s.week}>
        {week.map((d) => <View key={d} style={[s.dot, studied.has(d) && s.dotOn, d === today && s.dotToday]} />)}
      </View>
      <View style={s.grid}>
        {month.map((d) => <View key={d} style={[s.gdot, studied.has(d) && s.dotOn, d === today && s.dotToday]} />)}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.lg, gap: spacing.sm },
  head: { fontSize: ty.small, fontWeight: '800', color: c.amber, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  big: { fontSize: ty.h1, fontWeight: '900', color: c.ink, fontVariant: ['tabular-nums'] },
  timeWrap: { alignItems: 'flex-end' },
  timeLbl: { fontSize: ty.tiny, color: c.faint, fontWeight: '700' },
  time: { fontSize: ty.body, fontWeight: '800', color: c.ink2 },
  meta: { fontSize: ty.small, color: c.mute },
  week: { flexDirection: 'row', gap: 7 },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
  dotOn: { backgroundColor: c.amber, borderColor: c.amber },
  dotToday: { borderWidth: 2, borderColor: c.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, width: 7 * 18 + 6 * 5 },
  gdot: { width: 13, height: 13, borderRadius: 4, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
});
