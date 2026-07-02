// 学習タブ = 「学習ホーム」。今日やること(復習/新規)を区分ごとに提示し、
// 単語カードSRS / 文法 / 読解 / 聴解 へ送り出すハブ。掲示板§4(コツコツ毎日)。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { ringsFor } from '../store/selectors';
import RingGauge from '../components/RingGauge';
import { itemsFor, ringItemIdsFor, readingItemsForSub, READING_SUBTYPES, listeningItemsForSub, LISTENING_SUBTYPES } from '../data';
import { daimonsWithUnits } from '../data/daimon';
import { DAIMON_LABEL } from '../data/examBlueprint';
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
  const [openMoji, setOpenMoji] = useState(false);
  const [openBunpou, setOpenBunpou] = useState(false);
  const [openReading, setOpenReading] = useState(false);
  const [openListening, setOpenListening] = useState(false);
  // 文字語彙/文法の大問(漢字読み/表記/文脈規定/言い換え/用法・文法形式/組み立て/文章の文法)＝本番の学習区分。
  const mojiDaimons = useMemo(() => daimonsWithUnits(settings.level, 'moji_goi'), [settings.level]);
  const bunpouDaimons = useMemo(() => daimonsWithUnits(settings.level, 'bunpou'), [settings.level]);
  // 読解の小区分(内容理解短文/中文/情報検索)ごとの問題数(その級に在るものだけ表示)。
  const readingSubs = useMemo(
    () => READING_SUBTYPES.map((sub) => ({ ...sub, n: readingItemsForSub(settings.level, sub.key).length })).filter((x) => x.n > 0),
    [settings.level],
  );
  // 聴解の小区分(課題理解/ポイント理解/概要理解/発話表現/即時応答)ごとの問題数(その級に在るものだけ表示)。
  const listeningSubs = useMemo(
    () => LISTENING_SUBTYPES.map((sub) => ({ ...sub, n: listeningItemsForSub(settings.level, sub.key).length })).filter((x) => x.n > 0),
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

        {/* 文字語彙=大問(漢字読み/表記/文脈規定/言い換え/用法)に展開。各大問は本番の固定形式で連続出題(状態は項目#大問)。 */}
        <StudyCard s={s} icon="字" title={t('study.cat_moji_goi')} expandable open={openMoji} onPress={() => (mojiDaimons.length ? setOpenMoji((o) => !o) : nav.navigate('Flashcard'))} />
        {openMoji && mojiDaimons.map((d) => (
          <Pressable key={d.daimon} style={({ pressed }) => [s.subCard, pressed && s.cardPressed]} onPress={() => nav.navigate('Quiz', { daimon: d.daimon, title: t(DAIMON_LABEL[d.daimon]) })}>
            <View style={s.subDot} />
            <Text style={s.subTitle}>{t(DAIMON_LABEL[d.daimon])}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        ))}
        {/* 文法=大問(文法形式の判断/文の組み立て/文章の文法)に展開。 */}
        <StudyCard s={s} icon="文" title={t('study.cat_bunpou')} expandable open={openBunpou} onPress={() => (bunpouDaimons.length ? setOpenBunpou((o) => !o) : nav.navigate('Grammar'))} />
        {openBunpou && bunpouDaimons.map((d) => (
          <Pressable key={d.daimon} style={({ pressed }) => [s.subCard, pressed && s.cardPressed]} onPress={() => nav.navigate('Quiz', { daimon: d.daimon, title: t(DAIMON_LABEL[d.daimon]) })}>
            <View style={s.subDot} />
            <Text style={s.subTitle}>{t(DAIMON_LABEL[d.daimon])}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        ))}
        {/* 読解=小区分(内容理解短文/中文/情報検索)に展開。区分カードをタップで開閉。 */}
        <StudyCard s={s} icon="読" title={t('study.cat_dokkai')} expandable open={openReading} onPress={() => (readingSubs.length > 1 ? setOpenReading((o) => !o) : nav.navigate('Reading'))} />
        {openReading && readingSubs.map((sub) => (
          <Pressable key={sub.key} style={({ pressed }) => [s.subCard, pressed && s.cardPressed]} onPress={() => nav.navigate('Reading', { subtype: sub.key })}>
            <View style={s.subDot} />
            <Text style={s.subTitle}>{t(sub.labelKey)}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        ))}

        {/* 聴解=小区分(課題理解/ポイント理解/概要理解/発話表現/即時応答)に展開。レベルに在る区分だけ表示。 */}
        <StudyCard s={s} icon="聴" title={t('study.cat_choukai')} expandable open={openListening} onPress={() => (listeningSubs.length > 1 ? setOpenListening((o) => !o) : nav.navigate('Listening'))} />
        {openListening && listeningSubs.map((sub) => (
          <Pressable key={sub.key} style={({ pressed }) => [s.subCard, pressed && s.cardPressed]} onPress={() => nav.navigate('Listening', { subtype: sub.key })}>
            <View style={s.subDot} />
            <Text style={s.subTitle}>{t(sub.labelKey)}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        ))}

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
    ...shadow(1),
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
  cardPressed: { backgroundColor: c.bgSoft, borderColor: c.trace, transform: [{ scale: 0.985 }] },
  badge: {
    width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.blueLight,
  },
  badgeTxt: { color: c.blueDark, fontSize: ty.h2, fontWeight: '800' },
  cardBody: { flex: 1, gap: 2 },
  // App Bのリスト見出しに合わせ、カード表題は明朝(Shippori Mincho)で上質に(本文フォントとは別系統)。
  cardTitle: { fontSize: ty.h2, fontFamily: 'ShipporiMincho-Bold', color: c.ink, letterSpacing: 0.5 },
  chevron: { fontSize: 28, color: c.trace, fontWeight: '700' },
  subCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
    paddingVertical: spacing.sm + 2, paddingLeft: spacing.xl, paddingRight: spacing.md, marginTop: spacing.xs, marginLeft: spacing.lg,
  },
  subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.blue },
  subTitle: { flex: 1, fontSize: ty.body + 1, fontFamily: 'ShipporiMincho-Regular', color: c.ink2, letterSpacing: 0.3 },
  sectionH: { fontSize: ty.small, fontWeight: '800', color: c.ink2, marginTop: spacing.lg },
  ringRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  ringCell: { alignItems: 'center' },
  ringData: { fontSize: 10, color: c.mute, fontWeight: '700', marginTop: 2 },
  foot: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.lg, lineHeight: 16 },
});
