// 学習タブ = 「学習ホーム」。4カテゴリカード構成。各カード=全体正答率 + 全大問ミックス出題(10問) + 大問毎の正答率(タップで個別10問)。
// カバー率(量)はホームの成長カードに集約。掲示板§4(コツコツ毎日)。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { ringsFor, daimonRingPct, idsRingPct } from '../store/selectors';
import RingGauge from '../components/RingGauge';
import { readingItemsForSub, READING_SUBTYPES, listeningItemsForSub, LISTENING_SUBTYPES } from '../data';
import { daimonsWithUnits } from '../data/daimon';
import { DAIMON_LABEL } from '../data/examBlueprint';
import { examOf } from '../engine/examProfile';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Styles = ReturnType<typeof makeStyles>;

const RING_ORDER: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const RING_META: Record<Category, { icon: string }> = {
  moji_goi: { icon: '字' },
  bunpou: { icon: '文' },
  dokkai: { icon: '読' },
  choukai: { icon: '聴' },
};

// 大問(小リング)の識別コード。リングにはこの記号を表示し、下の凡例で名称を説明する。
const SUB_CODE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface SubRing { key: string; label: string; value: number | null; onPress: () => void; }

export default function StudyScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { settings, streak } = state;
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const lv = settings.level;
  const prof = examOf(settings.targetExam);
  const isJft = prof.exam === 'jft'; // JFT=文字と語彙/会話と表現/読解/聴解(文法⑥⑦⑧なし)
  const catName = (cat: Category) => t(prof.catLabel[cat]); // JLPT/JFTでラベル切替(bunpou=文法/会話と表現)
  const rings = useMemo(() => ringsFor(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const mojiDaimons = useMemo(() => daimonsWithUnits(lv, 'moji_goi'), [lv]);
  const bunpouDaimons = useMemo(() => daimonsWithUnits(lv, 'bunpou'), [lv]);
  const readingSubs = useMemo(() => READING_SUBTYPES.map((sub) => ({ ...sub, n: readingItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0), [lv]);
  const listeningSubs = useMemo(() => LISTENING_SUBTYPES.map((sub) => ({ ...sub, n: listeningItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0), [lv]);

  const ringColor = (v: number | null): string => (v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red);

  // カテゴリの大問(小)一覧。各々=大問毎の正答率＋タップで個別10問。
  const subRingsFor = (cat: Category): SubRing[] => {
    if (isJft && cat === 'bunpou') return []; // JFTの会話と表現は大問(小)を持たない。
    if (cat === 'moji_goi' || cat === 'bunpou') {
      const list = cat === 'moji_goi' ? mojiDaimons : bunpouDaimons;
      return list.map((d) => ({ key: d.daimon, label: t(DAIMON_LABEL[d.daimon]), value: daimonRingPct(state, now, d.daimon), onPress: () => nav.navigate('Quiz', { daimon: d.daimon, title: t(DAIMON_LABEL[d.daimon]) }) }));
    }
    if (cat === 'dokkai')
      return readingSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, readingItemsForSub(lv, sub.key).map((x) => x.id)), onPress: () => nav.navigate('Reading', { subtype: sub.key }) }));
    return listeningSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, listeningItemsForSub(lv, sub.key).map((x) => x.id)), onPress: () => nav.navigate('Listening', { subtype: sub.key }) }));
  };
  // 全大問ミックス出題(10問)。カテゴリごとに全大問を混ぜて出題。
  const mixPress = (cat: Category) => {
    if (cat === 'dokkai') return nav.navigate('Reading');
    if (cat === 'choukai') return nav.navigate('Listening');
    if (isJft && cat === 'bunpou') return nav.navigate('Quiz', { expression: true, title: catName('bunpou') });
    return nav.navigate('Quiz', { category: cat });
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>{t('study.title')}</Text>
          </View>
          {streak.current > 0 ? <Text style={s.streak}>🔥 {streak.current}</Text> : null}
        </View>

        {/* メイン: 4カテゴリ横断のバランス出題(JLPT=漢字語彙＋文法 / JFT=文字と語彙)。 */}
        <Pressable style={({ pressed }) => [s.cta, pressed && s.ctaPressed]} onPress={() => nav.navigate('Quiz', isJft ? { category: 'moji_goi' } : undefined)}>
          <Text style={s.ctaTitle}>{t('study.balanced')}</Text>
          <Text style={s.ctaSub}>{t('study.balanced_sub')}</Text>
        </Pressable>

        {/* カテゴリカード×4。全体正答率＋ミックス出題(10)＋大問毎正答率(タップで個別10問)。 */}
        {RING_ORDER.map((cat) => {
          const subs = subRingsFor(cat);
          return (
            <View key={cat} style={s.card}>
              <View style={s.cardHead}>
                <View style={s.cardTitleWrap}>
                  <Text style={s.cardIcon}>{RING_META[cat].icon}</Text>
                  <Text style={s.cardTitle}>{catName(cat)}</Text>
                </View>
                <RingGauge value={rings[cat]} color={ringColor(rings[cat])} size={54} stroke={6} label={t('study.accuracy')} />
              </View>

              <Pressable style={({ pressed }) => [s.mixBtn, pressed && s.mixBtnPressed]} onPress={() => mixPress(cat)}>
                <Text style={s.mixTitle}>{t('study.mix')}</Text>
                <Text style={s.mixSub}>{t('study.q_each')} ›</Text>
              </Pressable>

              {subs.length ? (
                <>
                  <Text style={s.tapHint}>{t('study.tap_daimon')}</Text>
                  {/* 大問ボタン(1段)。リングはA/B…のコード表示、下の凡例で名称を説明。枠線+背景でタップ可と明示。 */}
                  <View style={s.subRingRow}>
                    {subs.map((sr, i) => (
                      <Pressable key={sr.key} style={({ pressed }) => [s.subRingBtn, pressed && s.subRingBtnPressed]} onPress={sr.onPress}>
                        <RingGauge value={sr.value} color={ringColor(sr.value)} size={38} stroke={5} label={SUB_CODE[i]} />
                      </Pressable>
                    ))}
                  </View>
                  <View style={s.legend}>
                    {subs.map((sr, i) => (
                      <Text key={sr.key} style={s.legendItem}><Text style={s.legendCode}>{SUB_CODE[i]}</Text>：{sr.label}</Text>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          );
        })}

        <Text style={s.foot}>{t('study.foot')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  body: { padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tab: { fontSize: ty.small, fontWeight: '700', letterSpacing: 1, color: c.mute },
  title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.xs },
  streak: { fontSize: ty.h2, fontWeight: '800', color: c.ink2 },
  pressed: { backgroundColor: c.bgSoft, transform: [{ scale: 0.99 }] },
  cta: {
    ...shadow(2),
    backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm, gap: 3,
  },
  ctaPressed: { transform: [{ scale: 0.99 }], opacity: 0.94 },
  ctaTitle: { fontSize: ty.h2, fontWeight: '800', color: '#ffffff' },
  ctaSub: { fontSize: ty.small, color: '#ffffff', opacity: 0.9 },
  // カテゴリカード
  card: {
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
    padding: spacing.md, marginTop: spacing.sm, gap: spacing.sm, ...shadow(1),
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  cardIcon: {
    fontSize: ty.h2, fontWeight: '800', color: c.ink2, width: 30, height: 30, lineHeight: 30,
    textAlign: 'center', borderRadius: 15, backgroundColor: c.bgSoft, overflow: 'hidden',
  },
  cardTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  mixBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.bgSoft, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  mixBtnPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  mixTitle: { fontSize: ty.body, fontWeight: '800', color: c.blue },
  mixSub: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  tapHint: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.xs },
  // 大問ボタン(1段・均等配置)。枠線・背景は付けず(チープなので)、リングは均一サイズ。押下時だけ淡くハイライト。
  subRingRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.xs },
  subRingBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md },
  subRingBtnPressed: { backgroundColor: c.bgSoft, transform: [{ scale: 0.96 }] },
  // コード→名称の凡例(A：漢字読み …)。
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: 2, marginTop: spacing.xs, paddingHorizontal: 2 },
  legendItem: { fontSize: ty.tiny, color: c.mute, lineHeight: 15 },
  legendCode: { fontWeight: '800', color: c.ink2 },
  foot: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.lg, lineHeight: 16 },
});
