// テストタブ = 本番形式の総合評価(月1〜2回)。客観採点(重み5)で到達度の信頼幅±を狭める。
// 2つの模試を同じカード形で提示し、差は「始めるボタン(利用可)」か「準備中バッジ」のみ＝統一感。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { readinessFor } from '../store/selectors';
import type { RootStackParamList } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TestScreen() {
  const t = useT();
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const readiness = useMemo(() => readinessFor(state, Date.now()), [state]);
  const measured = readiness.score > 0;
  const hist = state.mockHistory ?? [];
  const recentMocks = hist.slice(-12);
  const avgPct = hist.length ? Math.round(hist.reduce((acc, m) => acc + m.pct, 0) / hist.length) : 0;

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.tab}>{t('test.tab')}</Text>
        <Text style={s.title}>{t('test.title')}</Text>
        <Text style={s.sub}>{t('test.sub')}</Text>

        {/* 信頼幅 */}
        <View style={s.bandCard}>
          <Text style={s.bandLabel}>{t('test.band_label')}</Text>
          <Text style={s.bandVal}>±{readiness.band}</Text>
          <Text style={s.bandHint}>
            {measured ? t('test.band_hint_measured') : t('test.band_hint_unmeasured')}
          </Text>
        </View>

        {hist.length > 0 ? (
          <>
            <Text style={s.sectionH}>{t('test.history_section')}</Text>
            <View style={s.histCard}>
              <View style={s.histTop}>
                <Text style={s.histMain}>{t('test.history_latest', { n: hist[hist.length - 1].pct })}</Text>
                <Text style={s.histSub}>{t('test.history_summary', { n: hist.length, avg: avgPct })}</Text>
              </View>
              <View style={s.histBars}>
                {recentMocks.map((m, i) => (
                  <View key={i} style={s.histCol}>
                    <View
                      style={[
                        s.histBar,
                        { height: 6 + (54 * m.pct) / 100, backgroundColor: m.pct >= 80 ? c.green : m.pct >= 50 ? c.amber : c.red },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <Text style={s.histCap}>{t('test.history_cap', { n: recentMocks.length })}</Text>
            </View>
          </>
        ) : null}

        {isJft ? (
          /* JFT-Basic 模試(単一・本番再現) */
          <View style={s.testCard}>
            <View style={s.testHead}>
              <Text style={s.testTitle}>{t('test.jft_title')}</Text>
              <Text style={s.testTime}>{t('test.jft_time')}</Text>
            </View>
            <Text style={s.testNote}>{t('test.jft_note')}</Text>
            <Pressable style={s.cta} onPress={() => nav.navigate('Mock', { full: true })}>
              <Text style={s.ctaTxt}>{t('test.start_btn')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ミニ模試(利用可) */}
            <View style={s.testCard}>
              <View style={s.testHead}>
                <Text style={s.testTitle}>{t('test.mini_title')}</Text>
                <Text style={s.testTime}>{t('test.mini_time')}</Text>
              </View>
              <Text style={s.testNote}>{t('test.mini_note')}</Text>
              <Pressable style={s.cta} onPress={() => nav.navigate('Mock')}>
                <Text style={s.ctaTxt}>{t('test.start_btn')}</Text>
              </Pressable>
            </View>

            {/* フル模試(利用可) */}
            <View style={s.testCard}>
              <View style={s.testHead}>
                <Text style={s.testTitle}>{t('test.full_title')}</Text>
                <Text style={s.testTime}>{t('test.full_time')}</Text>
              </View>
              <Text style={s.testNote}>{t('test.full_note')}</Text>
              <Pressable style={s.cta} onPress={() => nav.navigate('Mock', { full: true })}>
                <Text style={s.ctaTxt}>{t('test.start_btn')}</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={s.foot}>{t('test.foot')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm },
    tab: { fontSize: ty.small, fontWeight: '700', letterSpacing: 1, color: c.mute },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
    sub: { fontSize: ty.small, color: c.mute, lineHeight: 18 },
    bandCard: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.line,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    bandLabel: { fontSize: ty.small, color: c.mute },
    bandVal: { fontSize: 40, fontWeight: '800', color: c.ink, lineHeight: 46 },
    bandHint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.xs },
    // 模試カード(共通)
    testCard: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.line,
      padding: spacing.lg,
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    testHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    testTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink, flex: 1 },
    badge: { fontSize: ty.tiny, fontWeight: '800', paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill, overflow: 'hidden' },
    badgeReady: { color: c.green, backgroundColor: c.okBg, borderWidth: 1, borderColor: c.okBorder },
    badgeSoon: { color: c.mute, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
    testTime: { fontSize: ty.tiny, fontWeight: '700', color: c.mute, backgroundColor: c.bgSoft, paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill, overflow: 'hidden' },
    testNote: { fontSize: ty.small, color: c.ink2, lineHeight: 18 },
    cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
    ctaTxt: { color: '#ffffff', fontSize: ty.h2, fontWeight: '800' },
    ctaDisabled: { backgroundColor: c.bgSoft, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
    ctaDisabledTxt: { color: c.faint, fontSize: ty.body, fontWeight: '700' },
    foot: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.md, lineHeight: 16 },
    sectionH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.md },
    histCard: { backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.line, padding: spacing.lg, marginTop: spacing.sm },
    histTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    histMain: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    histSub: { fontSize: ty.tiny, color: c.mute },
    histBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64, marginTop: spacing.md },
    histCol: { flex: 1, justifyContent: 'flex-end' },
    histBar: { borderRadius: 2, width: '100%' },
    histCap: { fontSize: 10, color: c.faint, marginTop: spacing.xs },
  });
