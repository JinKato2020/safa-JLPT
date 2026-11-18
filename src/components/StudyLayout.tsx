import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ExamHeader, { type ExamHeaderProps } from './ExamHeader';
import { StudySceneBanner, useStudyColors, useStudyScroll } from './StudyPresentation';
import { spacing } from '../theme';

type Props = Omit<ExamHeaderProps, 'count'> & {
  current: number;
  total: number;
  children: ReactNode;
  footer?: ReactNode;
  scrollKey?: string | number;
  /** 学習一覧は件数表示にし、問題を解く進捗とは分ける。 */
  countLabel?: string;
  showProgress?: boolean;
  /** 本文側がスクロールとフッターを持つ読解専用。二重スクロールを作らない。 */
  scrollable?: boolean;
};

export default function StudyLayout({ current, total, children, footer, scrollKey, countLabel, showProgress = true, scrollable = true, study = true, ...header }: Props) {
  const c = useStudyColors(study);
  const scrollRef = useStudyScroll(scrollKey ?? current);
  const progress = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.header}><ExamHeader {...header} study={study} count={countLabel ?? `${current} / ${total}`} /></View>
      {showProgress && <View style={{ height: 4, backgroundColor: c.bgSoft }} accessible={false}>
        <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: c.blue }} />
      </View>}
      {scrollable ? <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
        {study && <StudySceneBanner />}
        {children}
      </ScrollView> : children}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg },
});
