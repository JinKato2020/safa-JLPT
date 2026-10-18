// 試験タブの1カテゴリ(文字語彙/文法/読解/聴解)カードをインライン表示する自己完結コンポーネント。
// 全体正答率リング＋大問リスト(各行=大問ラベル＋右端に正答率リング・タップで個別出題)。
// 練習(書斎)タブの KubunCard と同じ「縦リスト+右端インジケータ」スタイルで統一(2026-10-18)。
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
  // カード見出しは下端アイコンのラベルと一致させる: moji_goi は漢字を内包するが表示は「語彙」(icon と同じ cards.vocab)。
  const catName = (cc: Category) => t(cc === 'moji_goi' ? 'cards.vocab' : prof.catLabel[cc]);
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

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{catName(cat)}</Text>
        <RingGauge value={rings[cat]} color={ringColor(rings[cat])} size={54} stroke={6} label={t('study.accuracy')} />
      </View>
      {subs.length ? (
        <>
          <Text style={s.tapHint}>{t('study.tap_daimon')}</Text>
          {/* 大問を縦リストで表示。各行=ラベル(左)＋右端に正答率リング(%)。タップで個別出題へ。 */}
          {subs.map((sr) => (
            <Pressable key={sr.key} style={({ pressed }) => [s.rowBtn, pressed && s.rowPressed]} onPress={sr.onPress}>
              <Text style={s.rowLabel} numberOfLines={1}>{sr.label}</Text>
              <RingGauge value={sr.value} color={ringColor(sr.value)} size={36} stroke={5} />
            </Pressable>
          ))}
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
  // 大問の行ボタン(練習タブ KubunCard の linkBtn と同形)。右端にリングを置くため alignItems=center。
  rowBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  rowPressed: { backgroundColor: c.bgSoft, opacity: 0.85 },
  rowLabel: { flex: 1, fontSize: ty.body, fontWeight: '700', color: c.ink2 },
});
