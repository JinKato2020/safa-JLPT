// 学習タブ = 「学習ホーム」。メイン=4カテゴリからバランス出題ボタン。中リング(正答率)＋控えめに大問(小リング)を選択可。
// カバー率(量)はホームの成長カードに集約。掲示板§4(コツコツ毎日)。
import { useMemo, useState } from 'react';
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
  const prof = examOf(settings.targetExam);
  const isJft = prof.exam === 'jft'; // JFT=文字と語彙/会話と表現/読解/聴解(文法⑥⑦⑧なし)
  const catName = (cat: Category) => t(prof.catLabel[cat]); // JLPT/JFTでラベル切替(bunpou=文法/会話と表現)
  const rings = useMemo(() => ringsFor(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showDaimon, setShowDaimon] = useState(false);

  const mojiDaimons = useMemo(() => daimonsWithUnits(lv, 'moji_goi'), [lv]);
  const bunpouDaimons = useMemo(() => daimonsWithUnits(lv, 'bunpou'), [lv]);
  const readingSubs = useMemo(() => READING_SUBTYPES.map((sub) => ({ ...sub, n: readingItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0), [lv]);
  const listeningSubs = useMemo(() => LISTENING_SUBTYPES.map((sub) => ({ ...sub, n: listeningItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0), [lv]);

  const ringColor = (v: number | null): string => (v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red);

  const subRingsFor = (cat: Category): SubRing[] => {
    // JFTの bunpou=会話と表現 は大問(小)を持たず、中リング(会話と表現)から直接練習。
    if (isJft && cat === 'bunpou') return [];
    if (cat === 'moji_goi' || cat === 'bunpou') {
      const list = cat === 'moji_goi' ? mojiDaimons : bunpouDaimons;
      return list.map((d) => ({ key: d.daimon, label: t(DAIMON_LABEL[d.daimon]), value: daimonRingPct(state, now, d.daimon), onPress: () => nav.navigate('Quiz', { daimon: d.daimon, title: t(DAIMON_LABEL[d.daimon]) }) }));
    }
    if (cat === 'dokkai')
      return readingSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, readingItemsForSub(lv, sub.key).map((x) => x.id)), onPress: () => nav.navigate('Reading', { subtype: sub.key }) }));
    return listeningSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, listeningItemsForSub(lv, sub.key).map((x) => x.id)), onPress: () => nav.navigate('Listening', { subtype: sub.key }) }));
  };
  // 中リングタップ = そのカテゴリの学習へ。JFTの会話と表現(bunpou)は場面→表現の練習へ。
  const catPress = (cat: Category) => {
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
            <Text style={s.tab}>{t('study.tab')}</Text>
            <Text style={s.title}>{t('study.title')}</Text>
          </View>
          {streak.current > 0 ? <Text style={s.streak}>🔥 {streak.current}</Text> : null}
        </View>

        {/* メイン: バランス出題(JLPT=漢字語彙＋文法の混合 / JFT=文字と語彙の混合)。 */}
        <Pressable style={({ pressed }) => [s.cta, pressed && s.ctaPressed]} onPress={() => nav.navigate('Quiz', isJft ? { category: 'moji_goi' } : undefined)}>
          <Text style={s.ctaTitle}>{t('study.balanced')}</Text>
          <Text style={s.ctaSub}>{t('study.balanced_sub')}</Text>
        </Pressable>

        {/* 中リング(4カテゴリ・正答率)。タップで各カテゴリの学習へ。JFTは会話と表現ラベル。 */}
        <View style={s.ringRow}>
          {RING_ORDER.map((cat) => (
            <Pressable key={cat} style={({ pressed }) => [s.ringCell, pressed && s.pressed]} onPress={() => catPress(cat)}>
              <RingGauge value={rings[cat]} color={ringColor(rings[cat])} size={62} stroke={7} label={catName(cat)} />
            </Pressable>
          ))}
        </View>

        {/* 大問ごと(控えめ・折りたたみ)。 */}
        <Pressable style={({ pressed }) => [s.byDaimon, pressed && s.pressed]} onPress={() => setShowDaimon((o) => !o)}>
          <Text style={s.byDaimonTxt}>{t('study.by_daimon')}</Text>
          <Text style={s.byDaimonChev}>{showDaimon ? '▾' : '▸'}</Text>
        </Pressable>
        {showDaimon
          ? RING_ORDER.map((cat) => {
              const subs = subRingsFor(cat);
              if (!subs.length) return null;
              return (
                <View key={cat} style={s.daimonBlock}>
                  <Text style={s.daimonCat}>{RING_META[cat].icon}　{catName(cat)}</Text>
                  <View style={s.subRingWrap}>
                    {subs.map((sr) => (
                      <Pressable key={sr.key} style={({ pressed }) => [s.subRingCell, pressed && s.pressed]} onPress={sr.onPress}>
                        <RingGauge value={sr.value} color={ringColor(sr.value)} size={44} stroke={5} label={sr.label} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })
          : null}

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
  ringRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.xs },
  ringCell: { alignItems: 'center', borderRadius: radius.md, padding: spacing.xs },
  byDaimon: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm, marginTop: spacing.sm,
  },
  byDaimonTxt: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
  byDaimonChev: { fontSize: ty.small, color: c.trace, fontWeight: '800' },
  daimonBlock: {
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
    padding: spacing.md, marginTop: spacing.xs, gap: spacing.xs,
  },
  daimonCat: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
  subRingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs },
  subRingCell: { width: 62, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md },
  foot: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.lg, lineHeight: 16 },
});
