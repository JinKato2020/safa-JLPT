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
import { readinessFor, growthSeries, growthCurve, nextBestAction, ringsFor, learnedNow, levelRank } from '../store/selectors';
import { computeBadges } from '../store/badges';
import { DAIMON_LABEL } from '../data/examBlueprint';
import { examOf } from '../engine/examProfile';
import { StreakWeek, StreakCalendar, GrowthBars, BadgeGrid } from '../../shared/JLPT-Listening/design';
import HeroGauge from '../components/HeroGauge';
import RingGauge from '../components/RingGauge';
import Badge from '../components/Badge';
import { badgeTierIndex } from '../data/badges';

// 称号(合格率tier 10段)= i18n home.passTitle0..9 / カバー率の成長バッジ段名 = home.coverTier0..9
// バッジ名 = home.badge_<id> / home.badge_<id>_hint (badgeTierIndex 0-9・badge id 対応)。
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
  const nba = useMemo(() => nextBestAction(state, now), [state]);
  const rings = useMemo(() => ringsFor(state, now), [state]);
  const rank = useMemo(() => levelRank(state, now), [state]);
  const learned = useMemo(() => learnedNow(state, now), [state]);
  const curve = useMemo(() => growthCurve(state, dayStr(now), 14), [state, now]);
  const ppSeries = useMemo(() => (state.growth ?? []).slice(-14).map((g) => g.passProb ?? 0), [state.growth]);
  const badgeSet = state.settings.badgeSet ?? 'gorgeous';
  const studied = useMemo(() => new Set(state.streak.history), [state.streak.history]);
  const badges = useMemo(
    () => computeBadges({ studyDays: state.streak.history.length, longestStreak: state.streak.longest, learned, score: readiness.passProbability }),
    [state, learned, readiness.passProbability],
  );
  const prof = examOf(state.settings.targetExam);
  const isJft = prof.exam === 'jft';
  const overall = readiness.overallPct ?? 0;
  const measured = overall > 0;
  // 大リング＝【合格率】(%)。全ゲート(各区分足切り＋総合)を同時にクリアする推定確率＝足切りを自然に内包。
  // 色は安全圏かで: 緑=合格率≥80(本番ラインを余裕でクリア)/黄=40〜79/赤<40。
  const passProb = readiness.passProbability;
  const gaugeVal = passProb;
  const zone = !measured ? c.trace : passProb >= 80 ? c.green : passProb >= 40 ? c.amber : c.red;
  const today = dayStr(now);
  const examDays = state.settings.examDate ? daysBetween(today, state.settings.examDate) : null;
  const series = growthSeries(state);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const todayGain = last && last.day === today ? last.learned - (prev?.learned ?? 0) : 0;
  const week = lastNDays(today, 7);
  const cal = lastNDays(today, 35);
  const curveMax = Math.max(1, ...curve.map((p) => p.learned));
  const hasGrowth = (state.growth?.length ?? 0) > 0;

  // AIコーチ分析(端末内・非送信): 入手できるパラメータから【褒める材料】を積極的に探し、継続と成長を実感させる。
  const ai = useMemo(() => {
    const lines: { k: string; p?: Record<string, string | number> }[] = [];
    let hl: string;
    if (!measured) {
      hl = 'home.ai_hl_start';
      lines.push({ k: 'home.ai_start_body' });
    } else {
      hl = passProb >= 80 ? 'home.ai_hl_pass' : passProb >= 40 ? 'home.ai_hl_close' : 'home.ai_hl_build';
      // ① 褒める: いちばん得意な区分(正解率が高い)
      let strong: { cat: Category; v: number } | null = null;
      for (const cd of RING_ORDER) { const v = rings[cd]; if (v !== null && (strong === null || v > strong.v)) strong = { cat: cd, v }; }
      if (strong && strong.v >= 60) lines.push({ k: 'home.ai_strong', p: { cat: t(prof.catLabel[strong.cat]), pct: strong.v } });
      // ② 褒める: 今日の学習成果(成長の実感)
      if (todayGain > 0) lines.push({ k: 'home.ai_today_growth', p: { n: todayGain } });
      // ③ 褒める: 合格率が上がった(伸びの実感)
      const ppUp = ppSeries.length >= 2 ? ppSeries[ppSeries.length - 1] - ppSeries[ppSeries.length - 2] : 0;
      if (ppUp > 0) lines.push({ k: 'home.ai_improving', p: { n: ppUp } });
      // 現状＋やさしい次の一歩
      lines.push({ k: 'home.ai_passprob', p: { n: passProb } });
      if (passProb >= 80) lines.push({ k: 'home.ai_keep' });
      else if (nba) lines.push({ k: 'home.ai_advice', p: { action: t(prof.catLabel[nba.category]) } });
    }
    // 継続(streak)を必ず励ます
    lines.push(state.streak.current > 0 ? { k: 'home.ai_streak', p: { n: state.streak.current } } : { k: 'home.ai_streak0' });
    return { hl, lines };
  }, [measured, nba, rings, passProb, todayGain, ppSeries, prof, t, state.streak.current]);

  // 弱点(nba)があればその区分の学習へ(合格圏でも穴を埋める)。弱点なし=全区分高→一般復習。
  // 文法(route==='Quiz')は勧める大問へ(学習カード→四択)。他区分は各画面へ。
  const goAction = () => {
    if (!nba) return nav.navigate('Quiz', { category: 'all' });
    if (nba.route === 'Quiz') {
      return nba.daimon
        ? nav.navigate('Quiz', { daimon: nba.daimon, title: t(DAIMON_LABEL[nba.daimon]) })
        : nav.navigate('Quiz', { category: 'bunpou' });
    }
    return nav.navigate(nba.route);
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.brand}>{t('home.brand')}</Text>

        {/* ヒーロー: 到達度ゲージ＋ペース＋統計 */}
        <View style={s.hero}>
          {/* 「N4 到達度」の横に学習メダル(入門/初級/中級/上級/仕上げ) */}
          <View style={s.ddRow}>
            <Text style={s.dd}>{isJft ? 'JFT-Basic' : state.settings.level} {t('home.readiness')}</Text>
            {measured ? <Text style={s.ddPct}>{passProb}%</Text> : null}
            <View style={{ flex: 1 }} />
            {/* 連続日数は右上に */}
            <Text style={s.streakChip}>🔥 {state.streak.current}</Text>
          </View>
          <HeroGauge
            value={measured ? gaugeVal : null}
            color={zone}
            mark={80}
            markLabel={t('home.pass_line')}
            size={212}
            stroke={14}
          >
            {/* 大リング中央＝合格率の“格”バッジを大きく。初回(未測定)は新芽(tier0)を既定表示。 */}
            <Badge set={badgeSet} metric="pass" pct={measured ? passProb : 0} size={146} />
            {/* 大リング下の称号バンド: natural=上に称号+下に花の名前、gorgeous=称号のみ */}
            <View style={s.band}>
              <Text style={s.bandTitle}>{t((badgeSet === 'natural' ? 'home.natPassTitle' : 'home.passTitle') + badgeTierIndex(measured ? passProb : 0))}</Text>
              {badgeSet === 'natural' ? (
                <Text style={s.bandFlower}>{t('home.natFlower' + badgeTierIndex(measured ? passProb : 0))}</Text>
              ) : null}
            </View>
          </HeroGauge>
          {/* 区分別 正解率(小リング4つ)を 大リングと推移の間に */}
          <Text style={s.miniH}>{t('home.ring_title')}</Text>
          <View style={s.ringRow}>
            {RING_ORDER.map((cat) => {
              const v = rings[cat];
              const rc = v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red;
              return (
                <View key={cat} style={s.ringCell}>
                  <RingGauge value={v} color={rc} label={t(prof.catLabel[cat])} sub="" />
                </View>
              );
            })}
          </View>
          {/* 合格率の推移(横軸=日)を合格カード下部に */}
          <Text style={s.miniH}>{t('home.passprob_trend_title')}</Text>
          {ppSeries.length >= 2 ? (
            <GrowthBars values={ppSeries} height={56} max={100} color={c.blue} />
          ) : (
            <Text style={s.hint}>{t('home.passprob_trend_empty')}</Text>
          )}
        </View>

        {/* AIコーチ分析(端末内・あなたの学習データから自動評価) */}
        <View style={s.aiCard}>
          <Text style={s.aiTitle}>{t('home.ai_title')}</Text>
          <Text style={s.aiHl}>{t(ai.hl)}</Text>
          {ai.lines.map((ln, i) => (
            <Text key={i} style={s.aiLine}>・{t(ln.k, ln.p)}</Text>
          ))}
          <Text style={s.aiCap}>{t('home.ai_caption')}</Text>
        </View>

        {/* 成長 */}
        <Text style={s.sectionH}>{t('home.section_growth')}</Text>
        <View style={s.card}>
          {/* ① 今日覚えた・累計覚えた */}
          <View style={s.growStats}>
            <View style={s.stat}><Text style={s.statVal}>+{todayGain}</Text><Text style={s.statLbl}>{t('home.today_learned')}</Text></View>
            <View style={s.statSep} />
            <View style={s.stat}><Text style={s.statVal}>{learned}</Text><Text style={s.statLbl}>{t('home.total_learned')}</Text></View>
          </View>
          {/* 覚えた語の伸び */}
          <Text style={s.miniH}>{t('home.growth_chart_title')}</Text>
          {hasGrowth ? (
            <GrowthBars values={curve.map((p) => p.learned)} height={64} />
          ) : (
            <Text style={s.hint}>{t('home.growth_empty_hint')}</Text>
          )}
          {/* ④ カバー率(量)= 漢字/語彙/文法はカードタブ(CardsScreen)へ移設。ホームでは非表示。 */}
        </View>

        {/* 今日のおすすめ(成長の後・主要操作=青。ボタン自体がセクション見出しを兼ねる) */}
        <Pressable style={s.cta} onPress={goAction}>
          <Text style={s.ctaTxt}>{t('home.cta_title')}</Text>
          <Text style={s.ctaSub}>
            {nba ? `${t(prof.catLabel[nba.category])} ・ ${t(nba.reasonKey, nba.reasonParams)}` : t('home.cta_review')}
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
              {t('home.exam_days', { n: examDays })}{measured ? ` ・ ${t('home.pass_prob_label')} ${passProb}%` : ''}
            </Text>
          ) : null}
          <Text style={s.calCaption}>{t('home.cal_caption')}</Text>
          <StreakCalendar days={cal.map((d) => ({ key: d, on: studied.has(d), today: d === today }))} />
        </View>

        {/* バッジ */}
        <Text style={s.sectionH}>{t('home.section_badges')}</Text>
        <BadgeGrid
          badges={badges.map((b) => ({ id: b.id, emoji: b.emoji, label: t('home.badge_' + b.id), hint: t('home.badge_' + b.id + '_hint'), unlocked: b.unlocked, image: b.id === 'pass' ? require('../../assets/icon.png') : undefined }))}
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
    ddRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    dd: { fontSize: 19, color: c.ink2, letterSpacing: 0.5, fontWeight: '800' },
    ddPct: { fontSize: 20, fontWeight: '800', color: c.blue },
    streakChip: { fontSize: 15, fontWeight: '800', color: c.orange },
    growStats: { flexDirection: 'row', alignSelf: 'stretch', paddingBottom: spacing.sm, marginBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: c.line },
    medal: { backgroundColor: c.blueLight, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: c.blue },
    medalTxt: { fontSize: 24, fontWeight: '800', color: c.blueDark },
    score: { fontSize: 66, fontWeight: '800', color: c.ink, lineHeight: 70 },
    // 称号ラベル: 少し光らせる(金色グロー)。リング下部に固定。
    band: { position: 'absolute', bottom: 6, paddingHorizontal: 11, paddingVertical: 3, borderRadius: 12, backgroundColor: c.surface + 'e6', alignItems: 'center' },
    bandTitle: { fontSize: ty.small, color: c.ink, fontWeight: '800', letterSpacing: 0.3, textShadowColor: '#f5b301', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 7 },
    bandFlower: { fontSize: ty.tiny, color: c.mute, fontWeight: '700', marginTop: 1, letterSpacing: 0.2 },
    status: { fontSize: ty.h2, fontWeight: '800', marginTop: spacing.md },
    passHint: { fontSize: ty.tiny, color: c.faint, marginTop: 4 },
    rank: { fontSize: ty.small, color: c.blue, fontWeight: '800', marginTop: 6 },
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

    // AIコーチ分析カード
    aiCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: 2 },
    aiTitle: { fontSize: ty.small, fontWeight: '800', color: c.blueDark, letterSpacing: 0.3 },
    aiHl: { fontSize: ty.body, fontWeight: '800', color: c.ink, marginTop: 2, marginBottom: 2 },
    aiLine: { fontSize: ty.small, color: c.ink2, lineHeight: 21 },
    aiCap: { fontSize: 10, color: c.faint, marginTop: 5 },

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
    miniH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.md, letterSpacing: 0.5 },
    cap: { fontSize: 10, color: c.faint, marginTop: 2, lineHeight: 14 },
    curve: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64, marginTop: spacing.xs },
    curveCol: { flex: 1, justifyContent: 'flex-end' },
    curveBar: { backgroundColor: c.green, borderRadius: 2, width: '100%' },
    hint: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.xs },
    ringRow: { flexDirection: 'row', marginTop: spacing.lg, marginBottom: spacing.xs },
    ringCell: { flex: 1, alignItems: 'center' },
    // カバー率(量)の横バー＋横に分数
    covRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
    covLabel: { width: 36, fontSize: ty.small, color: c.ink2, fontWeight: '700' },
    covBarHalf: { flex: 1 },                                  // バーは行の約半分(右の大バッジ＋段名で残りを使う)
    covTrack: { height: 12, borderRadius: 6, backgroundColor: c.bgSoft, overflow: 'hidden' },
    covFill: { height: '100%', borderRadius: 6, backgroundColor: c.blue },
    covFrac: { fontSize: ty.tiny, color: c.mute, marginTop: 3, fontWeight: '600' },
    covBadgeWrap: { width: 72, alignItems: 'center' },        // 右に大きな成長バッジ＋10段名
    covTierName: { fontSize: ty.tiny, color: c.ink2, fontWeight: '800', marginTop: 1 },
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
