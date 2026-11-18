import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { studyPaper, useStudyColors } from './StudyPresentation';
import { spacing } from '../theme';

export default function StudyPrompt({ children, style, study = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; study?: boolean }) {
  const c = useStudyColors(study);
  return <View style={[studyPaper(c), styles.paper, style]}>{children}</View>;
}

export function StudyInstruction({ children, study = true }: { children: ReactNode; study?: boolean }) {
  const c = useStudyColors(study);
  return <Text style={[styles.instruction, { color: c.mute }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  paper: { padding: spacing.md, gap: spacing.sm },
  instruction: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
});
