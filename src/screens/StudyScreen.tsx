// 学習タブ = 「学習ホーム」。3段階リングで到達度を提示: 大(合格=ホーム) → 中(漢字語彙/文法/読解/聴解) → 小(大問)。
// 各小リング(大問/サブ種別)をタップで該当の学習へ。掲示板§4(コツコツ毎日)。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { ringsFor, daimonRingPct, idsRingPct } from '../store/selectors';
import RingGauge from '../components/RingGauge';
import { ringItemIdsFor, readingItemsForSub, READING_SUBTYPES, listeningItemsForSub, LISTENING_SUBTYPES } from '../data';
import { daimonsWithUnits } from '../data/daimon';
import { DAIMON_LABEL } from '../data/examBlueprint';
import { dueStats } from '../quiz/quiz';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Styles = ReturnType<typeof makeStyles>;

const RING_ORDER: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const RING_META: Record<Category, { labelKey: string; icon: string }> = {
  moji_goi: { labelKey: 'study.cat_moji_goi', icon: '字' },
  bunpou: { labelKey: 'study.cat_bunpou', icon: '文' },
  dokkai: { labelKey: 'study.cat_dokkai', icon: '読' },
  choukai: { labelKey: 'study.cat_choukai', icon: '聴' },
};

interface SubRing { key: string; label: string; value: number | null; onPress: () => void; }

export default function StudyScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { settings, items, streak } = state;
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const lv = settings.level;
  const rings = useMemo(() => ringsFor(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const reading = useMemo(() => dueStats(ringItemIdsFor(lv, 'dokkai').map((id) => ({ id })), items, now), [lv, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const listening = useMemo(() => dueStats(ringItemIdsFor(lv, 'choukai').map((id) => ({ id })), items, now), [lv, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const todo = reading.due + listening.due; // 概況の未消化数(参考)

  const mojiDaimons = useMemo(() => daimonsWithUnits(lv, 'moji_goi'), [lv]);
  const bunpouDaimons = useMemo(() => daimonsWithUnits(lv, 'bunpou'), [lv]);
  const readingSubs = useMemo(
    () => READING_SUBTYPES.map((sub) => ({ ...sub, n: readingItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0),
    [lv],
  );
  const listeningSubs = useMemo(
    () => LISTENING_SUBTYPES.map((sub) => ({ ...sub, n: listeningItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0),
    [lv],
  );

  const ringColor = (v: number | null): string => (v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red);

  // 各中リング(カテゴリ)配下の小リング(大問/サブ種別)。
  const subRingsFor = (cat: Category): SubRing[] => {
    if (cat === 'moji_goi')
      return mojiDaimons.map((d) => ({ key: d.daimon, label: t(DAIMON_LABEL[d.daimon]), value: daimonRingPct(state, now, d.daimon), onPress: () => nav.navigate('Quiz', { daimon: d.daimon, title: t(DAIMON_LABEL[d.daimon]) }) }));
    if (cat === 'bunpou')
      return bunpouDaimons.map((d) => ({ key: d.daimon, label: t(DAIMON_LABEL[d.daimon]), value: daimonRingPct(state, now, d.daimon), onPress: () => nav.navigate('Quiz', { daimon: d.daimon, title: t(DAIMON_LABEL[d.daimon]) }) }));
    if (cat === 'dokkai')
      return readingSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, readingItemsForSub(lv, sub.key).map((x) => x.id)), onPress: () => nav.navigate('Reading', { subtype: sub.key }) }));
    return listeningSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, listeningItemsForSub(lv, sub.key).map((x) => x.id)), onPress: () => nav.navigate('Listening', { subtype: sub.key }) }));
  };
  const catHeadPress = (cat: Category) => {
    if (cat === 'moji_goi') return mojiDaimons.length ? nav.navigate('Quiz', { daimon: mojiDaimons[0].daimon, title: t(DAIMON_LABEL[mojiDaimons[0].daimon]) }) : nav.navigate('Flashcard');
    if (cat === 'bunpou') return bunpouDaimons.length ? nav.navigate('Quiz', { daimon: bunpouDaimons[0].daimon, title: t(DAIMON_LABEL[bunpouDaimons[0].daimon]) }) : nav.navigate('Quiz', { category: 'bunpou' });
    if (cat === 'dokkai') return nav.navigate('Reading');
    return nav.navigate('Listening');
  };

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.head}>
          <View>
            <Text style={s.tab}>{t('study.tab')}</Text>
            <Text style={s.title}>{t('study.title')}</Text>
          </View>
          {streak.current > 0 ? <Text style={s.streak}>🔥 {streak.current}</Text> : null}
        </View>
        <Text style={s.sub}>{todo > 0 ? t('study.due_count', { n: todo }) : t('study.no_due')}</Text>

        {/* 中リング(カテゴリ)→ 小リング(大問/サブ種別)の3段階。大リング(合格)はホーム。 */}
        {RING_ORDER.map((cat) => {
          const v = rings[cat];
          const all = ringItemIdsFor(lv, cat);
          const done = all.filter((id) => items[id]).length;
          const subs = subRingsFor(cat);
          return (
            <View key={cat} style={s.catBlock}>
              <Pressable style={({ pressed }) => [s.catHead, pressed && s.pressed]} onPress={() => catHeadPress(cat)}>
                <View style={s.badge}><Text style={s.badgeTxt}>{RING_META[cat].icon}</Text></View>
                <View style={s.catHeadTxt}>
                  <Text style={s.catName}>{t(RING_META[cat].labelKey)}</Text>
                  <Text style={s.catData}>{done}/{all.length}</Text>
                </View>
                <RingGauge value={v} color={ringColor(v)} size={52} stroke={6} />
              </Pressable>
              {subs.length ? (
                <View style={s.subRingWrap}>
                  {subs.map((sr) => (
                    <Pressable key={sr.key} style={({ pressed }) => [s.subRingCell, pressed && s.pressed]} onPress={sr.onPress}>
                      <RingGauge value={sr.value} color={ringColor(sr.value)} size={46} stroke={5} label={sr.label} />
                    </Pressable>
                  ))}
                </View>
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
  sub: { fontSize: ty.small, color: c.mute, lineHeight: 18 },
  pressed: { backgroundColor: c.bgSoft, transform: [{ scale: 0.99 }] },
  catBlock: {
    ...shadow(1),
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
    padding: spacing.md, marginTop: spacing.sm, gap: spacing.sm,
  },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md },
  badge: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.blueLight },
  badgeTxt: { color: c.blueDark, fontSize: ty.h2, fontWeight: '800' },
  catHeadTxt: { flex: 1, gap: 2 },
  catName: { fontSize: ty.h2, fontFamily: 'ShipporiMincho-Bold', color: c.ink, letterSpacing: 0.5 },
  catData: { fontSize: ty.tiny, color: c.mute, fontWeight: '700' },
  subRingWrap: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start',
    gap: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: c.line,
  },
  subRingCell: { width: 64, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md },
  foot: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.lg, lineHeight: 16 },
});
