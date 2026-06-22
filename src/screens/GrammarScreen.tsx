// 文法。連続学習→連続テストの共通フロー(LearnTestSession)で実施。
// 学習フェーズ=文法点＋意味＋例文を続けて提示(採点なし)。テスト=意味・用法の客観4択・自動採点(重み3)。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { itemsFor } from '../data';
import type { StudyItem } from '../data';
import LearnTestSession from '../components/LearnTestSession';

function GrammarCard({ item }: { item: StudyItem }) {
  const c = useColors();
  const s = useMemo(() => cardStyles(c), [c]);
  if (item.type !== 'grammar') return null;
  return (
    <View style={s.card}>
      <Text style={s.tag}>文法</Text>
      <Text style={s.point}>{item.point}</Text>
      <Text style={s.romaji}>{item.romaji}</Text>
      <Text style={s.meaning}>{item.meaning}</Text>
      <View style={s.divider} />
      <Text style={s.exLabel}>例文</Text>
      <Text style={s.exJa}>{item.exampleJa}</Text>
      <Text style={s.exEn}>{item.exampleEn}</Text>
    </View>
  );
}

export default function GrammarScreen() {
  const { settings } = useAppState();
  const pool = useMemo(() => itemsFor(settings.level, 'bunpou'), [settings.level]);
  return <LearnTestSession pool={pool} size={8} renderLearnCard={(item) => <GrammarCard item={item} />} />;
}

const cardStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.line,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    tag: { fontSize: ty.tiny, fontWeight: '800', color: c.bunpou, letterSpacing: 1 },
    point: { fontSize: ty.h1, fontWeight: '800', color: c.ink, marginTop: spacing.xs },
    romaji: { fontSize: ty.small, color: c.faint },
    meaning: { fontSize: ty.body, color: c.ink2, marginTop: spacing.sm },
    divider: { height: 1, backgroundColor: c.line, marginVertical: spacing.md },
    exLabel: { fontSize: ty.tiny, fontWeight: '700', color: c.mute, letterSpacing: 1 },
    exJa: { fontSize: ty.h2, color: c.ink, lineHeight: 28, marginTop: spacing.xs },
    exEn: { fontSize: ty.small, color: c.mute, marginTop: spacing.xs, fontStyle: 'italic' },
  });
