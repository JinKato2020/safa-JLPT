import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import RubyText from '../components/RubyText';
import { StudySceneBanner, studyPaper, useStudyColors } from '../components/StudyPresentation';
import { GRAMMAR, meaningIn, rubyNeeded } from '../data';
import { hasGrammarNote } from '../data/grammarNotes';
import { meaningL1, useT } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/store';
import { spacing, type as ty, type ThemeColors } from '../theme';

export default function GrammarLessonsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GrammarLessons'>>();
  const { settings } = useAppState();
  const t = useT();
  const colors = useStudyColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const level = settings.level;
  const language = meaningL1(settings);
  const rubyGate = (run: string) => rubyNeeded(run, level);
  const lessons = useMemo(
    () => GRAMMAR.filter(item => item.level === level && hasGrammarNote(item.id)),
    [level],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => nav.goBack()}
          accessibilityRole="button" accessibilityLabel={t('mock.break_back')}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">{t('cards.grammar_lessons')}</Text>
        <Text style={styles.level}>{level}</Text>
      </View>
      <FlatList
        data={lessons}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<StudySceneBanner />}
        ListEmptyComponent={<Text style={styles.hint}>{t('browse.empty')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.lesson, pressed && styles.pressed]}
            accessibilityRole="button"
            onPress={() => nav.navigate('GrammarNote', { id: item.id })}
          >
            <View style={styles.copy}>
              <RubyText text={item.point} style={styles.point} rubyStyle={styles.ruby} rubyGate={rubyGate} />
              <Text style={styles.hint}>{(language && meaningIn(item.id, language)) || item.meaning}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mute} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  back: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: c.ink, fontSize: ty.h2, fontWeight: '800' },
  level: { color: c.blueDark, fontSize: ty.small, fontWeight: '800', paddingHorizontal: spacing.sm },
  list: { gap: spacing.sm, padding: spacing.lg },
  lesson: {
    ...studyPaper(c), minHeight: 48, flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.sm,
  },
  pressed: { backgroundColor: c.bgSoft },
  copy: { flex: 1, gap: 3 },
  point: { color: c.ink, fontSize: ty.body, fontWeight: '800' },
  ruby: { color: c.mute, fontSize: 10 },
  hint: { color: c.mute, fontSize: ty.small },
});
