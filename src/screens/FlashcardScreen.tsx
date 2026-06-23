// 文字語彙(漢字+語彙)。連続学習→連続テストの共通フロー(LearnTestSession)で実施。
// 学習フェーズ=語/漢字＋読み＋意味＋例文を続けて提示(採点なし)。テスト=客観4択・自動採点(重み3)。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { itemsFor, KANJI_EXAMPLE, VOCAB_EXAMPLE, VOCAB_FURIGANA } from '../data';
import type { StudyItem } from '../data';
import LearnTestSession from '../components/LearnTestSession';
import HighlightedText from '../components/HighlightedText';
import { useT } from '../i18n';

function VocabKanjiCard({ item }: { item: StudyItem }) {
  const c = useColors();
  const t = useT();
  const s = useMemo(() => cardStyles(c), [c]);
  if (item.type === 'kanji') {
    const ex = KANJI_EXAMPLE[item.char];
    return (
      <View style={s.card}>
        <Text style={s.kanji}>{item.char}</Text>
        <Text style={s.reading}>{t('flashcardscreen.reading_label', { on: item.on, kun: item.kun })}</Text>
        <Text style={s.meaning}>{item.meaning}</Text>
        {ex ? <Text style={s.ex}>{ex.word}（{ex.reading}）</Text> : null}
        {ex?.kun ? <Text style={s.ex}>{ex.kun.word}（{ex.kun.reading}）</Text> : null}
      </View>
    );
  }
  if (item.type === 'vocab') {
    const ex = VOCAB_EXAMPLE[item.id];
    return (
      <View style={s.card}>
        <Text style={s.word}>{item.word}</Text>
        <Text style={s.reading}>{item.reading}</Text>
        <Text style={s.meaning}>{item.meaning}</Text>
        {ex ? (
          <>
            <HighlightedText text={VOCAB_FURIGANA[item.id] ?? ex.ja} target={item.word} style={s.ex} hitStyle={s.exHit} />
            <Text style={s.exEn}>{ex.en}</Text>
          </>
        ) : null}
      </View>
    );
  }
  return null;
}

export default function FlashcardScreen() {
  const { settings } = useAppState();
  const pool = useMemo(() => itemsFor(settings.level, 'moji_goi'), [settings.level]);
  return <LearnTestSession pool={pool} size={12} renderLearnCard={(item) => <VocabKanjiCard item={item} />} />;
}

const cardStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.line,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.xs,
    },
    kanji: { fontSize: 88, fontWeight: '800', color: c.ink, lineHeight: 96 },
    word: { fontSize: 40, fontWeight: '800', color: c.ink, textAlign: 'center' },
    reading: { fontSize: ty.body, color: c.mute, fontWeight: '700' },
    meaning: { fontSize: ty.body, color: c.ink2, marginTop: spacing.xs, textAlign: 'center' },
    ex: { fontSize: ty.body, color: c.ink, marginTop: spacing.sm, textAlign: 'center', lineHeight: 24 },
    exHit: { textDecorationLine: 'underline' },
    exEn: { fontSize: ty.tiny, color: c.faint, fontStyle: 'italic', textAlign: 'center' },
  });
