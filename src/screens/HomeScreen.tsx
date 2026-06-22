// ホーム = ダッシュボード。到達度ゲージ(＋ペース予測)＋継続＋成長＋今日のおすすめ＋バッジ。
// 指標は注記で明示。設定系は「設定」タブへ分離。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { readinessFor, growthSeries, growthCurve, pacePrediction, nextBestAction, ringsFor, learnedNow } from '../store/selectors';
import { computeBadges } from '../store/badges';
import HeroGauge from '../components/HeroGauge';
import RingGauge from '../components/RingGauge';
import { dayStr, daysBetween, lastNDays } from '../store/state';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';

const RING_ORDER: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const RING_META: Record<Category, { label: string; color: keyof ThemeColors }> = {
  moji_goi: { label: '漢字・語彙', color: 'mojiGoi' },
  bunpou: { label: '文法', color: 'bunpou' },
  dokkai: { label: '読解', color: 'dokkai' },
  choukai: { label: '聴解', color: 'choukai' },
};
const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

export default function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useAppState();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const readiness = useMemo(() => readinessFor(state, now), [state]);
  const pace = useMemo(() => pacePrediction(state, now), [state]);
  const nba = useMemo(() => nextBestAction(state, now), [state]);
  const rings = useMemo(() => ringsFor(state, now), [state]);
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
  const status = !measured ? '未測定' : readiness.passing ? '合格圏' : '合格ライン';
  const week = lastNDays(today, 7);
  const cal = lastNDays(today, 35);
  const curveMax = Math.max(1, ...curve.map((p) => p.learned));
  const hasGrowth = (state.growth?.length ?? 0) > 0;

  const goAction = () => (readiness.passing || !nba ? nav.navigate('Quiz', { category: 'all' }) : nav.navigate(nba.route));

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.brand}>まいにちJLPT</Text>

        {/* ヒーロー: 到達度ゲージ＋ペース＋統計 */}
        <View style={s.hero}>
          <Text style={s.dd}>{state.settings.level} 到達度</Text>
          <HeroGauge value={measured ? overall : null} color={zone} mark={readiness.overallMinPct} size={212} stroke={14}>
            <Text style={s.score}>{measured ? overall : '—'}</Text>
            <Text style={s.bandIn}>±{readiness.band}</Text>
          </HeroGauge>
          <Text style={[s.status, { color: zone }]}>{status}</Text>
          <Text style={s.passHint}>合格ライン {readiness.overallMinPct}%（｜印）</Text>

          {readiness.passing ? (
            <Text style={s.paceOk}>🎉 合格圏！この調子で維持しましょう。</Text>
          ) : pace.daysToPass != null ? (
            <>
              <Text style={s.paceMain}>
                このペースで <Text style={s.paceDays}>あと{pace.daysToPass}日</Text> で合格圏
              </Text>
              <Text style={s.paceSub}>1日 約{pace.perDay}語 ・ 残り 約{pace.itemsNeeded}語</Text>
            </>
          ) : (
            <Text style={s.paceMuted}>毎日続けると「あと◯日で合格圏」が見えます</Text>
          )}

          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={s.statVal}>🔥 {state.streak.current}</Text>
              <Text style={s.statLbl}>連続日数</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.stat}>
              <Text style={s.statVal}>+{todayGain}</Text>
              <Text style={s.statLbl}>今日 覚えた</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.stat}>
              <Text style={s.statVal}>{learned}</Text>
              <Text style={s.statLbl}>累計 覚えた</Text>
            </View>
          </View>
          <Text style={s.statsCap}>「覚えた」＝テストに正答して定着した語（4択で自動判定）</Text>
        </View>

        {/* 成長 */}
        <Text style={s.sectionH}>成長</Text>
        <View style={s.card}>
          <Text style={s.miniH}>覚えた語の伸び（直近14日）</Text>
          {hasGrowth ? (
            <View style={s.curve}>
              {curve.map((p) => (
                <View key={p.day} style={s.curveCol}>
                  <View style={[s.curveBar, { height: 6 + (54 * p.learned) / curveMax }]} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.hint}>学習した日ごとに伸びが記録されます。</Text>
          )}
          <Text style={s.miniH}>区分別の到達度</Text>
          <Text style={s.cap}>各区分＝学習範囲（カバー率）×定着（習得度）。｜は不要、数字は0〜100。</Text>
          <View style={s.ringRow}>
            {RING_ORDER.map((cat) => {
              const v = rings[cat];
              const rc = v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red;
              return <RingGauge key={cat} value={v} color={rc} label={RING_META[cat].label} />;
            })}
          </View>
        </View>

        {/* 今日のおすすめ(成長の後・主要操作=青。ボタン自体がセクション見出しを兼ねる) */}
        <Pressable style={s.cta} onPress={goAction}>
          <Text style={s.ctaTxt}>今日のおすすめ</Text>
          <Text style={s.ctaSub}>
            {readiness.passing
              ? '今日の復習 ・ 全区分から10問'
              : nba
                ? `${nba.label} ・ ${nba.reason}`
                : '診断クイズ ・ 現在地を測定'}
          </Text>
        </Pressable>

        {/* 継続 */}
        <Text style={s.sectionH}>継続</Text>
        <View style={s.card}>
          <View style={s.weekRow}>
            {week.map((d) => {
              const wd = WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()];
              const on = studied.has(d);
              return (
                <View key={d} style={s.weekCell}>
                  <View style={[s.weekDot, on ? s.weekDotOn : null, d === today && s.weekDotToday]}>
                    <Text style={[s.weekDotTxt, on && s.weekDotTxtOn]}>{on ? '✓' : ''}</Text>
                  </View>
                  <Text style={s.weekLbl}>{wd}</Text>
                </View>
              );
            })}
          </View>
          <View style={s.streakMetaRow}>
            <Text style={s.metaTxt}>最長 {state.streak.longest}日</Text>
            <Text style={s.metaTxt}>❄️ フリーズ {state.streak.freezes}</Text>
          </View>
          {examDays != null && examDays >= 0 ? (
            <Text style={s.examLine}>
              試験まで {examDays}日
              {pace.daysToPass != null
                ? pace.daysToPass <= examDays
                  ? ' ・ このペースで間に合います ✓'
                  : ' ・ もう少しペースアップで届きます'
                : ''}
            </Text>
          ) : null}
          <Text style={s.calCaption}>直近5週（学習した日に色）</Text>
          <View style={s.cal}>
            {cal.map((d) => (
              <View key={d} style={[s.calCell, studied.has(d) && s.calCellOn, d === today && s.calCellToday]} />
            ))}
          </View>
        </View>

        {/* バッジ */}
        <Text style={s.sectionH}>バッジ</Text>
        <View style={s.badgeGrid}>
          {badges.map((b) => (
            <View key={b.id} style={[s.badge, !b.unlocked && s.badgeLocked]}>
              <Text style={[s.badgeEmoji, !b.unlocked && s.badgeEmojiLocked]}>{b.unlocked ? b.emoji : '🔒'}</Text>
              <Text style={s.badgeLabel}>{b.label}</Text>
              <Text style={s.badgeHint}>{b.unlocked ? '達成' : b.hint}</Text>
            </View>
          ))}
        </View>
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
