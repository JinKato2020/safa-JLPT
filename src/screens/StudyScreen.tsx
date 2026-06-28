// 学習タブ = 「学習ホーム」。今日やること(復習/新規)を区分ごとに提示し、
// 単語カードSRS / 文法 / 読解 / 聴解 へ送り出すハブ。掲示板§4(コツコツ毎日)。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { ringsFor } from '../store/selectors';
import RingGauge from '../components/RingGauge';
import { itemsFor, ringItemIdsFor, readingItemsForSub, READING_SUBTYPES } from '../data';
import { dueStats } from '../quiz/quiz';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Styles = ReturnType<typeof makeStyles>;

const RING_ORDER: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];
const RING_META: Record<Category, { labelKey: string }> = {
  moji_goi: { labelKey: 'study.cat_moji_goi' },
  bunpou: { labelKey: 'study.cat_bunpou' },
  dokkai: { labelKey: 'study.cat_dokkai' },
  choukai: { labelKey: 'study.cat_choukai' },
};

export default function StudyScreen() {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { settings, items, streak } = state;
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const rings = useMemo(() => ringsFor(state, now), [state]);

  const vocab = useMemo(() => dueStats(itemsFor(settings.level, 'moji_goi'), items, now), [settings.level, items]);
  const grammar = useMemo(() => dueStats(itemsFor(settings.level, 'bunpou'), items, now), [settings.level, items]);
  const reading = useMemo(() => dueStats(ringItemIdsFor(settings.level, 'dokkai').map((id) => ({ id })), items, now), [settings.level, items]);
  const listening = useMemo(() => dueStats(ringItemIdsFor(settings.level, 'choukai').map((id) => ({ id })), items, now), [settings.level, items]);

  const todo = vocab.due + grammar.due + reading.due + listening.due;
  const [openReading, setOpenReading] = useState(false);
  // 読解の小区分(内容理解短文/中文/情報検索)ごとの問題数(その級に在るものだけ表示)。
  const readingSubs = useMemo(
    () => READING_SUBTYPES.map((sub) => ({ ...sub, n: readingItemsForSub(settings.level, sub.key).length })).filter((x) => x.n > 0),
    [settings.level],
  );

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
        <Text style={s.sub}>
          {todo > 0 ? t('study.due_count', { n: todo }) : t('study.no_due')}
        </Text>

        <StudyCard s={s} icon="字" title={t('study.cat_moji_goi')} onPress={() => nav.navigate('Flashcard')} />
        <StudyCard s={s} icon="文" title={t('study.cat_bunpou')} onPress={() => nav.navigate('Grammar')} />
        {/* 読解=小区分(内容理解短文/中文/情報検索)に展開。区分カードをタップで開閉。 */}
        <StudyCard s={s} icon="読" title={t('study.cat_dokkai')} expandable open={openReading} onPress={() => (readingSubs.length > 1 ? setOpenReading((o) => !o) : nav.navigate('Reading'))} />
        {openReading && readingSubs.map((sub) => (
          <Pressable key={sub.key} style={({ pressed }) => [s.subCard, pressed && s.cardPressed]} onPress={() => nav.navigate('Reading', { subtype: sub.key })}>
            <View style={s.subDot} />
            <Text style={s.subTitle}>{t(sub.labelKey)}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        ))}

        <StudyCard s={s} icon="聴" title={t('study.cat_choukai')} onPress={() => nav.navigate('Listening')} />

        <Text style={s.sectionH}>{t('study.section_progress')}</Text>
        <View style={s.ringRow}>
          {RING_ORDER.map((cat) => {
            const v = rings[cat];
            const rc = v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red;
            const all = ringItemIdsFor(settings.level, cat);
            const done = all.filter((id) => items[id]).length;
            return (
              <View key={cat} style={s.ringCell}>
                <RingGauge value={v} color={rc} label={t(RING_META[cat].labelKey)} />
                <Text style={s.ringData}>{done}/{all.length}</Text>
              </View>
            );
          })}
        </View>

        <Text style={s.foot}>{t('study.foot')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StudyCard({
  s, icon, title, onPress, expandable, open,
}: {
  s: Styles; icon: string; title: string; onPress: () => void; expandable?: boolean; open?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [s.card, pressed && s.cardPressed]} onPress={onPress}>
      <View style={s.badge}>
        <Text style={s.badgeTxt}>{icon}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      <Text style={s.chevron}>{expandable ? (open ? '▾' : '▸') : '›'}</Text>
    </Pressable>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.line,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  cardPressed: { backgroundColor: c.bgSoft },
  badge: {
    width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bgSoft,
  },
  badgeTxt: { color: c.ink2, fontSize: ty.h2, fontWeight: '800' },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  chevron: { fontSize: 28, color: c.trace, fontWeight: '700' },
  subCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
    paddingVertical: spacing.sm + 2, paddingLeft: spacing.xl, paddingRight: spacing.md, marginTop: spacing.xs, marginLeft: spacing.lg,
  },
  subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.blue },
  subTitle: { flex: 1, fontSize: ty.body, fontWeight: '700', color: c.ink2 },
  sectionH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.lg },
  ringRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  ringCell: { alignItems: 'center' },
  ringData: { fontSize: 10, color: c.mute, fontWeight: '700', marginTop: 2 },
  foot: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.lg, lineHeight: 16 },
});
