// 試験タブの1カテゴリ(文字語彙/文法/読解/聴解)カードをインライン表示する自己完結コンポーネント。
// 全体正答率リング＋大問毎リング(タップで個別出題)。タブ画面の背景の下に差し込む。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, radius, type as ty, shadow, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { ringsFor, daimonRingPct, idsRingPct } from '../store/selectors';
import RingGauge from './RingGauge';
import { readingItemsForSub, READING_SUBTYPES, listeningItemsForSub, LISTENING_SUBTYPES } from '../data';
import { daimonsWithUnits } from '../data/daimon';
import { DAIMON_LABEL } from '../data/examBlueprint';
import { examOf } from '../engine/examProfile';
import type { Category } from '../engine/engine';
import type { RootStackParamList, StudyStackParamList } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<StudyStackParamList & RootStackParamList>;
const SUB_CODE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
interface SubRing { key: string; label: string; value: number | null; onPress: () => void; }

export default function CategoryCard({ cat }: { cat: Category }) {
  const nav = useNavigation<Nav>();
  const state = useAppState();
  const { settings } = state;
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();
  const lv = settings.level;
  const prof = examOf(settings.targetExam);
  const isJft = prof.exam === 'jft';
  const catName = (cc: Category) => t(prof.catLabel[cc]);
  const rings = useMemo(() => ringsFor(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const mojiDaimons = useMemo(() => daimonsWithUnits(lv, 'moji_goi'), [lv]);
  const bunpouDaimons = useMemo(() => daimonsWithUnits(lv, 'bunpou'), [lv]);
  const readingSubs = useMemo(() => READING_SUBTYPES.map((sub) => ({ ...sub, n: readingItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0), [lv]);
  const listeningSubs = useMemo(() => LISTENING_SUBTYPES.map((sub) => ({ ...sub, n: listeningItemsForSub(lv, sub.key).length })).filter((x) => x.n > 0), [lv]);
  const ringColor = (v: number | null): string => (v === null ? c.trace : v >= 80 ? c.green : v >= 50 ? c.amber : c.red);

  const subRingsFor = (cc: Category): SubRing[] => {
    if (isJft && cc === 'bunpou') return [];
    if (cc === 'moji_goi' || cc === 'bunpou') {
      const list = cc === 'moji_goi' ? mojiDaimons : bunpouDaimons;
      return list.map((d) => ({
        key: d.daimon,
        label: t(DAIMON_LABEL[d.daimon]),
        value: daimonRingPct(state, now, d.daimon),
        onPress: () => (d.daimon === 'passage_grammar' ? nav.navigate('PassageGrammar', { title: t(DAIMON_LABEL[d.daimon]) }) : nav.navigate('Quiz', { daimon: d.daimon, title: t(DAIMON_LABEL[d.daimon]) })),
      }));
    }
    // 正答率は「設問id(questions[].id)」で記録される(quizAnswer)。集計もパッセージidでなく設問idで見る
    // (旧: x.id=パッセージidを渡していたため state に無く、常に未測定=大問別正答率が出ないバグ。StudyCategoryScreenと同じ修正)。
    if (cc === 'dokkai')
      return readingSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, readingItemsForSub(lv, sub.key).flatMap((x) => x.questions.map((q) => q.id))), onPress: () => nav.navigate('Reading', { subtype: sub.key, title: t(sub.labelKey) }) }));
    return listeningSubs.map((sub) => ({ key: sub.key, label: t(sub.labelKey), value: idsRingPct(state, now, listeningItemsForSub(lv, sub.key).flatMap((x) => x.questions.map((q) => q.id))), onPress: () => nav.navigate('Listening', { subtype: sub.key, title: t(sub.labelKey) }) }));
  };
  const subs = subRingsFor(cat);
  // ミックス出題(全部混ぜ)は撤去済み(語彙/文法=統合復習へ・読解/聴解=大問リングから開く)。ここには置かない。

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{catName(cat)}</Text>
        <RingGauge value={rings[cat]} color={ringColor(rings[cat])} size={54} stroke={6} label={t('study.accuracy')} />
      </View>
      {subs.length ? (
        <>
          <Text style={s.tapHint}>{t('study.tap_daimon')}</Text>
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
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm, ...shadow(1) },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  tapHint: { fontSize: ty.tiny, color: c.faint, marginTop: spacing.xs },
  subRingRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.xs, flexWrap: 'wrap', rowGap: spacing.sm },
  subRingBtn: { alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md, minWidth: 56 },
  subRingBtnPressed: { backgroundColor: c.bgSoft, transform: [{ scale: 0.96 }] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: 2, marginTop: spacing.xs, paddingHorizontal: 2 },
  legendItem: { fontSize: ty.tiny, color: c.mute, lineHeight: 15 },
  legendCode: { fontWeight: '800', color: c.ink2 },
});
