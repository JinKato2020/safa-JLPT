import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { type ThemeColors } from '../theme';
import { studyBadge, studyChoice, useStudyColors } from './StudyPresentation';
import { studyChoiceState } from './studyChoiceState';

type Props = {
  choices: readonly string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  answerIndex?: number;
  revealed?: boolean;
  disabled?: boolean;
  layout?: 'list' | 'grid';
  study?: boolean;
  /** 聴解の番号回答。本文を描画・読み上げのどちらにも出さない。 */
  numbersOnly?: boolean;
  renderChoice?: (text: string, index: number, textStyle: TextStyle) => ReactNode;
};

export default function StudyChoiceList({ choices, selectedIndex, onSelect, answerIndex, revealed = false, disabled = false, layout = 'list', study = true, numbersOnly = false, renderChoice }: Props) {
  const c = useStudyColors(study);
  const s = useMemo(() => makeStyles(c), [c]);
  const grid = layout === 'grid';
  const locked = disabled || revealed;
  return (
    <View testID="study-choices" style={[s.list, grid && s.grid]}>
      {choices.map((choice, index) => {
        const state = studyChoiceState(index, selectedIndex, answerIndex, revealed);
        const mark = state === 'correct' ? '✓' : state === 'wrong' ? '✕' : String(index + 1);
        return (
          <Pressable key={index} accessibilityRole="button" accessibilityLabel={numbersOnly ? String(index + 1) : undefined}
            accessibilityState={{ selected: index === selectedIndex, disabled: locked }} disabled={locked}
            onPress={() => { if (!locked) onSelect(index); }}
            style={({ pressed }) => [s.choice, grid && s.cell, numbersOnly && s.numberOnly,
              state === 'selected' && s.selected, state === 'correct' && s.correct, state === 'wrong' && s.wrong,
              pressed && !locked && s.pressed]}>
            <View style={[s.badge, grid && !numbersOnly && s.cellBadge]}><Text style={[s.badgeText, state === 'correct' && s.okText, state === 'wrong' && s.ngText]}>{mark}</Text></View>
            {!numbersOnly && <View style={grid ? s.glyphWrap : s.textWrap}>
              {renderChoice ? renderChoice(choice, index, grid ? s.glyph : s.text) : <Text style={grid ? s.glyph : s.text}>{choice}</Text>}
            </View>}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  list: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignSelf: 'center', width: '100%', maxWidth: 360, gap: 8 },
  choice: { ...studyChoice(c), flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 14 },
  cell: { width: '48%', minHeight: 124, paddingTop: 36, paddingBottom: 12, paddingHorizontal: 8, justifyContent: 'center' },
  badge: studyBadge(c),
  cellBadge: { position: 'absolute', top: 8, left: 8 },
  badgeText: { fontSize: 13, fontWeight: '700', color: c.ink2 },
  textWrap: { flex: 1, minWidth: 0 },
  text: { fontSize: 16, lineHeight: 25, fontWeight: '600', color: c.ink2 },
  glyphWrap: { flex: 1, alignItems: 'center' },
  glyph: { fontSize: 60, fontWeight: '700', color: c.ink, textAlign: 'center', includeFontPadding: false },
  numberOnly: { justifyContent: 'center', minHeight: 60 },
  selected: { borderColor: c.blue, backgroundColor: c.blueLight },
  correct: { borderColor: c.green, backgroundColor: c.okBg },
  wrong: { borderColor: c.red, backgroundColor: c.ngBg },
  okText: { color: c.green },
  ngText: { color: c.red },
  pressed: { opacity: 0.8 },
});
