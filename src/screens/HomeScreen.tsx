// ホーム = ダッシュボード。到達度ゲージ(＋ペース予測)＋継続＋成長＋今日のおすすめ＋バッジ。
// 指標は注記で明示。設定系は「設定」タブへ分離。
import { useMemo } from 'react';
import { useT } from '../i18n';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { readinessFor, growthSeries, growthCurve, pacePrediction, nextBestAction, ringsFor, learnedNow, ringLearnedRatio } from '../store/selectors';
import { computeBadges } from '../store/badges';
import { StreakWeek, StreakCalendar, GrowthBars, BadgeGrid } from '../shared-design';
import HeroGauge from '../components/HeroGauge';
import RingGauge from '../components/RingGauge';
import { dayStr, daysBetween, lastNDays } from '../store/state';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

const RING_ORDER: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const RING_META: Record<Category, { label: string; color: keyof ThemeColors }> = {
  moji_goi: { label: 'home.cat_moji_goi', color: 'mojiGoi' },
  bunpou: { label: 'home.cat_bunpou', color: 'bunpou' },
  dokkai: { label: 'home.cat_dokkai', color: 'dokkai' },
  choukai: { label: 'home.cat_choukai', color: 'choukai' },
};
const WEEKDAY = ['home.wd_sun', 'home.wd_mon', 'home.wd_tue', 'home.wd_wed', 'home.wd_thu', 'home.wd_fri', 'home.wd_sat'];

export default function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAppState();
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const readiness = useMemo(() => readinessFor(state, now), [state]);
  const pace = useMemo(() => pacePrediction(state, now), [state]);
  const nba = useMemo(() => nextBestAction(state, now), [state]);
  const rings = useMemo(() => ringsFor(state, now), [state]);
  const ringRatio = useMemo(() => ringLearnedRatio(state, now), [state]);
  const learned = useMemo(() => learnedNow(state, now), [state]);
  const curve = useMemo(() => growthCurve(state, dayStr(now), 14), [state, now]);
  const studied = useMemo(() => new Set(state.streak.history), [state.streak.history]);
  const badges = useMemo(
    () => computeBadges({ studyDays: state.streak.history.length, longestStreak: state.streak.longest, learned, score: readiness.score }),
    [state, learned, readiness.score],
  );
  const overall = readiness.overallPct ?? 0;
  const measured = overall > 0;
  const zone = !measured ? c.trace : readiness.passing ? c.green : readiness.gateRatio >= 0.8 ? c.amber : c.red;
  const today = dayStr(now);
  const examDays = state.settings.examDate ? daysBetween(today, state.settings.examDate) : null;
  const series = growthSeries(state);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const todayGain = last && last.day === today ? last.learned - (prev?.learned ?? 0) : 0;
  const status = !measured ? t('home.status_unmeasured') : readiness.passing ? t('home.status_passing') : t('home.status_borderline');
  const week = lastNDays(today, 7);
  const cal = lastNDays(today, 35);
  const curveMax = Math.max(1, ...curve.map((p) => p.learned));
  const hasGrowth = (state.growth?.length ?? 0) > 0;

  const goAction = () => (readiness.passing || !nba ? nav.navigate('Quiz', { category: 'all' }) : nav.navigate(nba.route));

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.brand}>{t('home.brand')}</Text>

        {/* ヒーロー: 到達度ゲージ＋ペース＋統計 */}
        <View style={s.hero}>
          <Text style={s.dd}>{state.settings.level} {t('home.readiness')}</Text>
          <HeroGauge value={measured ? overall : null} color={zone} mark={readiness.overallMinPct} size={212} stroke={14}>
            <Text style={s.score}>{measured ? overall : '—'}</Text>
            <Text style={s.bandIn}>±{readiness.band}</Text>
          </HeroGauge>
          <Text style={[s.status, { color: zone }]}>{status}</Text>
          <Text style={s.passHint}>{t('home.pass_hint', { n: readiness.overallMinPct })}</Text>

          {readiness.passing ? (
            <Text style={s.paceOk}>🎉 {t('home.pace_ok')}</Text>
          ) : pace.daysToPass != null ? (
            <>
              <Text style={s.paceMain}>
                {t('home.pace_prefix')} <Text style={s.paceDays}>{t('home.pace_days', { n: pace.daysToPass })}</Text> {t('home.pace_suffix')}
              </Text>
              <Text style={s.paceSub}>{t('home.pace_sub', { n: pace.perDay, m: pace.itemsNeeded })}</Text>
            </>
          ) : (
            <Text style={s.paceMuted}>{t('home.pace_muted')}</Text>
          )}

          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={s.statVal}>🔥 {state.streak.current}</Text>
              <Text style={s.statLbl}>{t('home.streak_days')}</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.stat}>
              <Text style={s.statVal}>+{todayGain}</Text>
              <Text style={s.statLbl}>{t('home.today_learned')}</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.stat}>
              <Text style={s.statVal}>{learned}</Text>
              <Text style={s.statLbl}>{t('home.total_learned')}</Text>
            </View>
          </View>
          <Text style={s.statsCap}>{t('home.stats_caption')}</Text>
        </View>

        {/* 成長 */}
        <Text style={s.sectionH}>{t('home.section_growth')}</Text>
        <View style={s.card}>
          <Text style={s.miniH}>{t('home.growth_chart_title')}</Text>
          {hasGrowth ? (
            <GrowthBars values={curve.map((p) => p.learned)} height={64} />
          ) : (
            <Text style={s.hint}>{t('home.growth_empty_hint')}</Text>
          )}
          <Text style={s.miniH}>{t('home.ring_title')}</Text>
          <Text style={s.cap}>{t('home.ring_caption')}</Text>
          <View style={s.ringRow}>
            {RING_ORDER.map((cat) => {
              const v = rings[cat];
              const rc = v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red;
              const rt = ringRatio[cat];
              return <RingGauge key={cat} value={v} color={rc} label={t(RING_META[cat].label)} sub={`${rt.learned}/${rt.total}`} />;
            })}
          </View>
        </View>

        {/* 今日のおすすめ(成長の後・主要操作=青。ボタン自体がセクション見出しを兼ねる) */}
        <Pressable style={s.cta} onPress={goAction}>
          <Text style={s.ctaTxt}>{t('home.cta_title')}</Text>
          <Text style={s.ctaSub}>
            {readiness.passing
              ? t('home.cta_review')
              : nba
                ? `${nba.label} ・ ${nba.reason}`
                : t('home.cta_diagnose')}
          </Text>
        </Pressable>

        {/* 継続 */}
        <Text style={s.sectionH}>{t('home.section_streak')}</Text>
        <View style={s.card}>
          <StreakWeek
            days={week.map((d) => ({ key: d, label: t(WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()]), on: studied.has(d), today: d === today }))}
          />
          <View style={s.streakMetaRow}>
            <Text style={s.metaTxt}>{t('home.streak_longest', { n: state.streak.longest })}</Text>
            <Text style={s.metaTxt}>❄️ {t('home.streak_freezes', { n: state.streak.freezes })}</Text>
          </View>
          {examDays != null && examDays >= 0 ? (
            <Text style={s.examLine}>
              {t('home.exam_days', { n: examDays })}
              {pace.daysToPass != null
                ? pace.daysToPass <= examDays
                  ? ` ・ ${t('home.exam_on_track')}`
                  : ` ・ ${t('home.exam_speed_up')}`
                : ''}
            </Text>
          ) : null}
          <Text style={s.calCaption}>{t('home.cal_caption')}</Text>
          <StreakCalendar days={cal.map((d) => ({ key: d, on: studied.has(d), today: d === today }))} />
        </View>

        {/* バッジ */}
        <Text style={s.sectionH}>{t('home.section_badges')}</Text>
        <BadgeGrid
          badges={badges.map((b) => ({ id: b.id, emoji: b.emoji, label: b.label, hint: b.hint, unlocked: b.unlocked }))}
          achievedLabel={t('home.badge_achieved')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.md },
    brand: { fontSize: ty.body, fontWeight: '800', color: c.blue, letterSpacing: 0.5 },

    hero: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.line,
      shadowColor: '#0f172a',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    dd: { fontSize: ty.body, color: c.ink2, letterSpacing: 0.5, fontWeight: '800', marginBottom: spacing.md },
    score: { fontSize: 66, fontWeight: '800', color: c.ink, lineHeight: 70 },
    bandIn: { fontSize: ty.small, color: c.faint, fontWeight: '600', marginTop: 2 },
    status: { fontSize: ty.h2, fontWeight: '800', marginTop: spacing.md },
    passHint: { fontSize: ty.tiny, color: c.faint, marginTop: 4 },
    paceMain: { fontSize: ty.body, color: c.ink2, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' },
    paceDays: { color: c.blue, fontWeight: '800' },
    paceSub: { fontSize: ty.tiny, color: c.faint, marginTop: 2, textAlign: 'center' },
    paceMuted: { fontSize: ty.small, color: c.faint, marginTop: spacing.sm, textAlign: 'center' },
    paceOk: { fontSize: ty.body, color: c.green, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' },

    stats: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.line,
    },
    stat: { flex: 1, alignItems: 'center', gap: 3 },
    statVal: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    statLbl: { fontSize: ty.tiny, color: c.mute, letterSpacing: 0.5 },
    statSep: { width: 1, backgroundColor: c.line, marginVertical: 2 },
    statsCap: { fontSize: 10, color: c.faint, marginTop: spacing.sm, textAlign: 'center' },

    sectionH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.xs },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.line,
      padding: spacing.md,
    },
    // 今日の一手
    cta: {
      backgroundColor: c.blue,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    ctaTxt: { color: '#ffffff', fontSize: ty.h2, fontWeight: '800' },
    ctaSub: { color: '#dbeafe', fontSize: ty.tiny, marginTop: 3, textAlign: 'center' },
    // 継続
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weekCell: { alignItems: 'center', gap: 4 },
    weekDot: {
      width: 30, height: 30, borderRadius: radius.pill,
      backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line,
      alignItems: 'center', justifyContent: 'center',
    },
    weekDotOn: { backgroundColor: c.orange, borderColor: c.orange },
    weekDotToday: { borderColor: c.blue, borderWidth: 2 },
    weekDotTxt: { fontSize: ty.small, color: c.faint },
    weekDotTxtOn: { color: '#ffffff', fontWeight: '800' },
    weekLbl: { fontSize: ty.tiny, color: c.faint },
    streakMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
    metaTxt: { fontSize: ty.small, color: c.mute, fontWeight: '600' },
    examLine: { fontSize: ty.tiny, color: c.mute, marginTop: spacing.sm },
    calCaption: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.md, marginBottom: spacing.xs },
    cal: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    calCell: { width: 14, height: 14, borderRadius: 3, backgroundColor: c.bgSoft },
    calCellOn: { backgroundColor: c.orange },
    calCellToday: { borderWidth: 1.5, borderColor: c.blue },
    // 成長
    miniH: { fontSize: ty.tiny, fontWeight: '700', color: c.mute, marginTop: spacing.md, letterSpacing: 0.5 },
    cap: { fontSize: 10, color: c.faint, marginTop: 2, lineHeight: 14 },
    curve: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64, marginTop: spacing.xs },
    curveCol: { flex: 1, justifyContent: 'flex-end' },
    curveBar: { backgroundColor: c.green, borderRadius: 2, width: '100%' },
    hint: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.xs },
    ringRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
    // バッジ
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    badge: {
      width: '31%', backgroundColor: c.surface, borderRadius: radius.md,
      borderWidth: 1, borderColor: c.line, padding: spacing.sm, alignItems: 'center', gap: 2,
    },
    badgeLocked: { backgroundColor: c.bgSoft },
    badgeEmoji: { fontSize: 26 },
    badgeEmojiLocked: { opacity: 0.5 },
    badgeLabel: { fontSize: ty.tiny, fontWeight: '800', color: c.ink2, textAlign: 'center' },
    badgeHint: { fontSize: 9, color: c.faint, textAlign: 'center' },
  });
